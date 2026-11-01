import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MaterialRequestStatus,
  NotificationEntityType,
  NotificationType,
  Prisma,
  RfqStatus,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { DELIVERABLE_PO_STATUSES } from '../deliveries/deliveries.service';
import {
  EXPECTED_DELIVERY_SELECT,
  expectedDeliveryBefore,
  expectedDeliveryDateOf,
  startOfToday,
} from '../deliveries/expected-delivery.util';
import { BrandingService } from '../export/branding.service';
import { NotificationService } from '../notification-feed/notification.service';
import { SYSTEM_SENDER } from '../notification-feed/notification.types';
import { EmailService } from '../notifications/email.service';

type ReminderTable = 'materialRequest' | 'rfq' | 'purchaseOrder';
type EmailSection =
  | 'materialRequestOverdueReminder'
  | 'rfqOverdueReminder'
  | 'poDeliveryOverdueReminder';

/** One reminder, ready to send: who gets it and what it says. */
interface Reminder {
  companyId: string;
  userIds: (string | null | undefined)[];
  section: EmailSection;
  params: Record<string, string>;
  path: string;
  notification: {
    type: NotificationType;
    title: string;
    body: string;
    entityType: NotificationEntityType;
    entityId: string;
  };
}

/** MRs still waiting to be ordered, matching the MR list's "Overdue" filter. */
const MR_OPEN_STATUSES: MaterialRequestStatus[] = [
  MaterialRequestStatus.DRAFT,
  MaterialRequestStatus.SUBMITTED,
  MaterialRequestStatus.APPROVED,
];

/** RFQs that can still be awarded. */
const RFQ_OPEN_STATUSES: RfqStatus[] = [
  RfqStatus.DRAFT,
  RfqStatus.OPEN,
  RfqStatus.AWAITING_RESPONSE,
  RfqStatus.QUOTED,
];

/**
 * Daily sweep that emails (and notifies in-app) the people waiting on a
 * requested item once its date passes unfulfilled (FOR-394):
 *
 * - (a) a material request past its need-by date that hasn't been ordered:
 *   the requester and the approver who reviewed it
 * - (b) an RFQ past its quote deadline or need-by date with no award: the
 *   buyer who raised it, plus the requesters of the MRs it came from
 * - (c) a PO past its expected delivery date that hasn't been fully delivered
 *   (the FOR-356 "Overdue" predicate): the buyer who raised it, plus the
 *   requesters of the MRs it came from
 *
 * Each document is reminded once. Its `overdueReminderSentAt` ledger is claimed
 * with a conditional update before sending, so a re-run or a second container
 * can't double-send (same trade as the payment reminders: a transport failure
 * loses that one reminder rather than risking a duplicate). A PO that the
 * schedule job puts back on schedule has its ledger cleared, so it is reminded
 * again if the new date also slips.
 */
@Injectable()
export class ProcurementReminderService {
  private readonly logger = new Logger(ProcurementReminderService.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationService,
    private readonly branding: BrandingService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  /** 07:00, after the 06:00 PO delivery-schedule sweep has flagged late POs. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'procurement-overdue-reminders' })
  async runDailySweep(): Promise<void> {
    try {
      const mr = await this.sendMaterialRequestReminders();
      const rfq = await this.sendRfqReminders();
      const po = await this.sendPurchaseOrderReminders();
      if (mr + rfq + po > 0) {
        this.logger.log(`Overdue reminders sent: ${mr} MR, ${rfq} RFQ, ${po} PO`);
      }
    } catch (error) {
      this.logger.error(`Overdue reminder sweep failed: ${String(error)}`);
    }
  }

  async sendMaterialRequestReminders(today: Date = startOfToday()): Promise<number> {
    const mrs = await this.prisma.materialRequest.findMany({
      where: {
        status: { in: MR_OPEN_STATUSES },
        neededByDate: { lt: today },
        overdueReminderSentAt: null,
      },
      select: {
        id: true,
        mrNumber: true,
        companyId: true,
        neededByDate: true,
        requestedById: true,
        reviewedById: true,
        project: { select: { name: true } },
      },
    });

    return this.sendEach('materialRequest', mrs, (mr) => {
      const params = {
        mrNumber: mr.mrNumber,
        projectName: mr.project.name,
        dueDate: this.formatDate(mr.neededByDate as Date),
      };
      return {
        companyId: mr.companyId,
        userIds: [mr.requestedById, mr.reviewedById],
        section: 'materialRequestOverdueReminder',
        params,
        path: `/material-requests/${mr.id}`,
        notification: {
          type: NotificationType.MATERIAL_REQUEST_OVERDUE,
          title: 'Material request past its need-by date',
          body: `${mr.mrNumber} for ${params.projectName} was needed by ${params.dueDate} and hasn't been ordered yet.`,
          entityType: NotificationEntityType.MATERIAL_REQUEST,
          entityId: mr.id,
        },
      };
    });
  }

  async sendRfqReminders(today: Date = startOfToday()): Promise<number> {
    const rfqs = await this.prisma.rfq.findMany({
      where: {
        status: { in: RFQ_OPEN_STATUSES },
        overdueReminderSentAt: null,
        OR: [{ deadlineEnd: { lt: today } }, { needByDate: { lt: today } }],
      },
      select: {
        id: true,
        rfqNumber: true,
        companyId: true,
        deadlineEnd: true,
        needByDate: true,
        createdByUserId: true,
        project: { select: { name: true } },
        sourceMaterialRequests: { select: { requestedById: true } },
      },
    });

    return this.sendEach('rfq', rfqs, (rfq) => {
      const passed = [rfq.deadlineEnd, rfq.needByDate].filter(
        (d): d is Date => d !== null && d < today,
      );
      const dueDate = new Date(Math.min(...passed.map((d) => d.getTime())));
      const rfqNumber = rfq.rfqNumber ?? rfq.id.slice(0, 8);
      const params = {
        rfqNumber,
        projectName: rfq.project.name,
        dueDate: this.formatDate(dueDate),
      };
      return {
        companyId: rfq.companyId,
        userIds: [rfq.createdByUserId, ...rfq.sourceMaterialRequests.map((m) => m.requestedById)],
        section: 'rfqOverdueReminder',
        params,
        path: `/rfqs/${rfq.id}`,
        notification: {
          type: NotificationType.RFQ_OVERDUE,
          title: 'RFQ past its date with no award',
          body: `${rfqNumber} for ${params.projectName} was due on ${params.dueDate} and no quote has been awarded.`,
          entityType: NotificationEntityType.RFQ,
          entityId: rfq.id,
        },
      };
    });
  }

  async sendPurchaseOrderReminders(today: Date = startOfToday()): Promise<number> {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        status: { in: [...DELIVERABLE_PO_STATUSES] },
        vendorId: { not: null },
        overdueReminderSentAt: null,
        AND: [expectedDeliveryBefore(today)],
      },
      select: {
        id: true,
        poNumber: true,
        companyId: true,
        createdByUserId: true,
        ...EXPECTED_DELIVERY_SELECT,
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        sourceMaterialRequests: { select: { requestedById: true } },
      },
    });

    return this.sendEach('purchaseOrder', pos, (po) => {
      const params = {
        poNumber: po.poNumber,
        vendorName: po.vendor?.legalName ?? 'the vendor',
        projectName: po.project?.name ?? '',
        dueDate: this.formatDate(expectedDeliveryDateOf(po) as Date),
      };
      return {
        companyId: po.companyId,
        userIds: [po.createdByUserId, ...po.sourceMaterialRequests.map((m) => m.requestedById)],
        section: 'poDeliveryOverdueReminder',
        params,
        path: `/purchase-orders/${po.id}`,
        notification: {
          type: NotificationType.PO_DELIVERY_OVERDUE,
          title: 'Purchase order delivery is late',
          body: `${po.poNumber} from ${params.vendorName} was expected on ${params.dueDate} and hasn't been fully delivered.`,
          entityType: NotificationEntityType.PURCHASE_ORDER,
          entityId: po.id,
        },
      };
    });
  }

  /** Claim each row's ledger, then send its reminder. Returns how many were sent. */
  private async sendEach<T extends { id: string }>(
    table: ReminderTable,
    rows: T[],
    build: (row: T) => Reminder,
  ): Promise<number> {
    let sent = 0;
    for (const row of rows) {
      if (!(await this.claim(table, row.id))) continue;
      await this.send(build(row));
      sent += 1;
    }
    return sent;
  }

  /**
   * Stamp the reminder ledger, but only if it is still unstamped. Returns false
   * when another run got there first, in which case the caller must not send.
   */
  private async claim(table: ReminderTable, id: string): Promise<boolean> {
    const args = {
      where: { id, overdueReminderSentAt: null },
      data: { overdueReminderSentAt: new Date() },
    };
    const result =
      table === 'materialRequest'
        ? await this.prisma.materialRequest.updateMany(args)
        : table === 'rfq'
          ? await this.prisma.rfq.updateMany(args)
          : await this.prisma.purchaseOrder.updateMany(args);
    return result.count > 0;
  }

  private async send(reminder: Reminder): Promise<void> {
    const ids = [...new Set(reminder.userIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;
    const where: Prisma.UserWhereInput = { id: { in: ids }, status: UserStatus.ACTIVE };
    const users = await this.prisma.user.findMany({ where, select: { id: true, email: true } });
    if (users.length === 0) return;

    const viewUrl = `${this.webAppUrl}${reminder.path}`;
    const brand = await this.branding.getEmailBrand(reminder.companyId);
    await Promise.all(
      users.map((u) =>
        this.emailService.sendOverdueReminderEmail(
          u.email,
          reminder.section,
          reminder.params,
          viewUrl,
          brand,
        ),
      ),
    );
    await this.notifications.createForUsers({
      ...reminder.notification,
      userIds: users.map((u) => u.id),
      sender: SYSTEM_SENDER,
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
