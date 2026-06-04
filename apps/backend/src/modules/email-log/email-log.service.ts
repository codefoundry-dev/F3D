import {
  EmailDeliveryStatus,
  EmailEventType,
  type EmailEventResponse,
  type EmailLogEntryResponse,
} from '@forethread/shared-types';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EmailDeliveryStatus as PrismaEmailDeliveryStatus,
  EmailEventType as PrismaEmailEventType,
  type EmailMessage,
  type EmailEvent,
  Prisma,
} from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { RecordEventInput, RecordOutboundInput } from './email-log.types';

/**
 * Significance ranking of delivery statuses (FOR-213). A status only advances when
 * an incoming event ranks at or above the current one, so late / out-of-order
 * webhooks (e.g. a `delivered` arriving after an `opened`) never downgrade the
 * row. Bounces and complaints outrank everything else.
 */
const STATUS_RANK: Record<PrismaEmailDeliveryStatus, number> = {
  QUEUED: 0,
  SENT: 10,
  DELIVERY_DELAYED: 15,
  DELIVERED: 20,
  OPENED: 30,
  CLICKED: 40,
  BOUNCED: 100,
  COMPLAINED: 100,
  FAILED: 100,
};

/** The delivery status each event type rolls the message up to. */
const EVENT_STATUS: Record<PrismaEmailEventType, PrismaEmailDeliveryStatus> = {
  SENT: PrismaEmailDeliveryStatus.SENT,
  DELIVERED: PrismaEmailDeliveryStatus.DELIVERED,
  DELIVERY_DELAYED: PrismaEmailDeliveryStatus.DELIVERY_DELAYED,
  OPENED: PrismaEmailDeliveryStatus.OPENED,
  CLICKED: PrismaEmailDeliveryStatus.CLICKED,
  BOUNCED: PrismaEmailDeliveryStatus.BOUNCED,
  COMPLAINED: PrismaEmailDeliveryStatus.COMPLAINED,
  FAILED: PrismaEmailDeliveryStatus.FAILED,
};

type EmailMessageWithEvents = EmailMessage & { events: EmailEvent[] };

@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an outbound transactional email so its delivery can be tracked on the
   * RFQ/PO detail page (FOR-213). Called fire-and-forget from the notification
   * layer right after a successful dispatch — failures here must never break the
   * send, so the caller swallows rejections.
   */
  async recordOutbound(input: RecordOutboundInput): Promise<EmailMessage> {
    return this.prisma.emailMessage.create({
      data: {
        companyId: input.companyId,
        rfqId: input.rfqId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        template: input.template,
        toEmail: input.toEmail,
        subject: input.subject,
        provider: input.provider,
        providerMessageId: input.providerMessageId ?? null,
        sentByUserId: input.sentByUserId ?? null,
        // Optimistically SENT: we handed it to the provider. Webhooks refine this
        // to DELIVERED / OPENED / BOUNCED. Without webhooks (e.g. SMTP) the log
        // still shows a sensible state.
        status: PrismaEmailDeliveryStatus.SENT,
        sentAt: new Date(),
        lastEventAt: new Date(),
      },
    });
  }

  /**
   * Apply a delivery event from a Resend webhook (FOR-213). Idempotent: a repeat
   * of the same (message, type, occurredAt) is ignored, so provider re-delivery is
   * safe. Returns false when no matching outbound message is on file (e.g. a
   * webhook for an email we don't track, like OTPs).
   */
  async recordEvent(input: RecordEventInput): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.emailMessage.findUnique({
        where: { providerMessageId: input.providerMessageId },
      });

      if (!message) {
        this.logger.debug(
          `Resend event ${input.type} for unknown message ${input.providerMessageId} — ignored`,
        );
        return false;
      }

      // Idempotency guard — same event delivered twice is a no-op.
      const existing = await tx.emailEvent.findFirst({
        where: {
          emailMessageId: message.id,
          type: input.type,
          occurredAt: input.occurredAt,
        },
        select: { id: true },
      });
      if (existing) {
        return true;
      }

      await tx.emailEvent.create({
        data: {
          emailMessageId: message.id,
          type: input.type,
          occurredAt: input.occurredAt,
          providerEventId: input.providerEventId ?? null,
          payload: input.payload ?? Prisma.JsonNull,
        },
      });

      await tx.emailMessage.update({
        where: { id: message.id },
        data: this.rollupUpdate(message, input),
      });

      return true;
    });
  }

  /** Compute the message-level field updates for a freshly recorded event. */
  private rollupUpdate(
    message: EmailMessage,
    input: RecordEventInput,
  ): Prisma.EmailMessageUpdateInput {
    const data: Prisma.EmailMessageUpdateInput = {};

    // Advance status only when the event is at least as significant.
    const nextStatus = EVENT_STATUS[input.type];
    if (STATUS_RANK[nextStatus] >= STATUS_RANK[message.status]) {
      data.status = nextStatus;
    }

    // Track the latest event time without going backwards.
    if (!message.lastEventAt || input.occurredAt > message.lastEventAt) {
      data.lastEventAt = input.occurredAt;
    }

    switch (input.type) {
      case PrismaEmailEventType.SENT:
        if (!message.sentAt) data.sentAt = input.occurredAt;
        break;
      case PrismaEmailEventType.DELIVERED:
        data.deliveredAt = input.occurredAt;
        break;
      case PrismaEmailEventType.OPENED:
        data.openedAt = input.occurredAt;
        data.openCount = { increment: 1 };
        break;
      case PrismaEmailEventType.BOUNCED:
        data.bouncedAt = input.occurredAt;
        data.bounceType = input.bounceType ?? null;
        data.bounceReason = input.bounceReason ?? null;
        break;
      case PrismaEmailEventType.COMPLAINED:
        data.complainedAt = input.occurredAt;
        break;
      default:
        break;
    }

    return data;
  }

  /** List the email log for an RFQ, scoped to the caller's company (FOR-213). */
  async listForRfq(rfqId: string, user: AuthenticatedUser): Promise<EmailLogEntryResponse[]> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { companyId: true },
    });
    if (rfq?.companyId !== user.companyId) {
      throw new NotFoundException('RFQ not found');
    }

    const messages = await this.prisma.emailMessage.findMany({
      where: { rfqId },
      include: { events: { orderBy: { occurredAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return messages.map((m) => this.toEntryResponse(m));
  }

  /** List the email log for a purchase order, scoped to the caller's company. */
  async listForPurchaseOrder(
    purchaseOrderId: string,
    user: AuthenticatedUser,
  ): Promise<EmailLogEntryResponse[]> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { companyId: true },
    });
    if (po?.companyId !== user.companyId) {
      throw new NotFoundException('Purchase order not found');
    }

    const messages = await this.prisma.emailMessage.findMany({
      where: { purchaseOrderId },
      include: { events: { orderBy: { occurredAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return messages.map((m) => this.toEntryResponse(m));
  }

  private toEntryResponse(message: EmailMessageWithEvents): EmailLogEntryResponse {
    return {
      id: message.id,
      toEmail: message.toEmail,
      subject: message.subject,
      template: message.template,
      status: EmailDeliveryStatus[message.status],
      sentAt: message.sentAt?.toISOString() ?? null,
      deliveredAt: message.deliveredAt?.toISOString() ?? null,
      openedAt: message.openedAt?.toISOString() ?? null,
      bouncedAt: message.bouncedAt?.toISOString() ?? null,
      openCount: message.openCount,
      bounceReason: message.bounceReason,
      lastEventAt: message.lastEventAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
      events: message.events.map((e): EmailEventResponse => ({
        id: e.id,
        type: EmailEventType[e.type],
        occurredAt: e.occurredAt.toISOString(),
      })),
    };
  }
}
