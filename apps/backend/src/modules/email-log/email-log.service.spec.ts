import { NotFoundException } from '@nestjs/common';
import { EmailDeliveryStatus, EmailEventType, UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { EmailLogService } from './email-log.service';

type DataArg = { data: Record<string, unknown> };

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'buyer@contractor.local',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};

const baseMessage = {
  id: 'em-1',
  status: EmailDeliveryStatus.SENT,
  sentAt: new Date('2026-06-04T10:00:00.000Z'),
  lastEventAt: new Date('2026-06-04T10:00:00.000Z'),
};

describe('EmailLogService', () => {
  let tx: {
    emailMessage: { findUnique: jest.Mock; update: jest.Mock };
    emailEvent: { findFirst: jest.Mock; create: jest.Mock };
  };
  let prisma: {
    emailMessage: { create: jest.Mock; findMany: jest.Mock };
    rfq: { findUnique: jest.Mock };
    purchaseOrder: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: EmailLogService;

  beforeEach(() => {
    tx = {
      emailMessage: { findUnique: jest.fn(), update: jest.fn() },
      emailEvent: { findFirst: jest.fn(), create: jest.fn() },
    };
    prisma = {
      emailMessage: { create: jest.fn(), findMany: jest.fn() },
      rfq: { findUnique: jest.fn() },
      purchaseOrder: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    service = new EmailLogService(prisma as unknown as PrismaService);
  });

  describe('recordOutbound', () => {
    it('creates a SENT message carrying the provider id and linkage', async () => {
      prisma.emailMessage.create.mockResolvedValue({ id: 'em-new' });

      await service.recordOutbound({
        companyId: 'company-1',
        rfqId: 'rfq-1',
        template: 'rfq-received',
        toEmail: 'vendor@acme.local',
        subject: 'RFQ ABC',
        provider: 'RESEND',
        providerMessageId: 'resend-123',
        sentByUserId: 'user-1',
      });

      const arg = prisma.emailMessage.create.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.SENT);
      expect(arg.data.provider).toBe('RESEND');
      expect(arg.data.providerMessageId).toBe('resend-123');
      expect(arg.data.rfqId).toBe('rfq-1');
      expect(arg.data.purchaseOrderId).toBeNull();
    });

    it('defaults optional linkage/attribution to null (SMTP PO email, no provider id)', async () => {
      prisma.emailMessage.create.mockResolvedValue({ id: 'em-smtp' });

      await service.recordOutbound({
        companyId: 'company-1',
        purchaseOrderId: 'po-1',
        template: 'po-issued',
        toEmail: 'vendor@acme.local',
        subject: 'PO-0001',
        provider: 'SMTP',
      });

      const arg = prisma.emailMessage.create.mock.calls[0][0] as DataArg;
      expect(arg.data.purchaseOrderId).toBe('po-1');
      // The omitted fields fall back to null rather than undefined.
      expect(arg.data.rfqId).toBeNull();
      expect(arg.data.providerMessageId).toBeNull();
      expect(arg.data.sentByUserId).toBeNull();
    });
  });

  describe('recordFailed', () => {
    it('creates a FAILED message carrying the reason and linkage, with no provider id', async () => {
      prisma.emailMessage.create.mockResolvedValue({ id: 'em-failed' });

      await service.recordFailed({
        companyId: 'company-1',
        rfqId: 'rfq-1',
        template: 'rfq-received',
        toEmail: 'vendor@acme.local',
        subject: 'RFQ ABC',
        provider: 'RESEND',
        reason: 'RATE_LIMITED: Too many requests',
        sentByUserId: 'user-1',
      });

      const arg = prisma.emailMessage.create.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.FAILED);
      expect(arg.data.bounceReason).toBe('RATE_LIMITED: Too many requests');
      expect(arg.data.providerMessageId).toBeNull();
      expect(arg.data.rfqId).toBe('rfq-1');
      expect(arg.data.purchaseOrderId).toBeNull();
      // A failed send never handed off, so there is no sentAt timestamp.
      expect(arg.data.sentAt).toBeUndefined();
    });

    it('defaults an omitted reason to null', async () => {
      prisma.emailMessage.create.mockResolvedValue({ id: 'em-failed-2' });

      await service.recordFailed({
        companyId: 'company-1',
        purchaseOrderId: 'po-1',
        template: 'po-issued',
        toEmail: 'vendor@acme.local',
        subject: 'PO-0001',
        provider: 'SMTP',
      });

      const arg = prisma.emailMessage.create.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.FAILED);
      expect(arg.data.bounceReason).toBeNull();
      expect(arg.data.purchaseOrderId).toBe('po-1');
      expect(arg.data.rfqId).toBeNull();
    });
  });

  describe('recordEvent', () => {
    it('ignores events for an unknown message', async () => {
      tx.emailMessage.findUnique.mockResolvedValue(null);

      const result = await service.recordEvent({
        providerMessageId: 'missing',
        type: EmailEventType.DELIVERED,
        occurredAt: new Date(),
      });

      expect(result).toBe(false);
      expect(tx.emailEvent.create).not.toHaveBeenCalled();
    });

    it('is idempotent — a duplicate (message, type, occurredAt) is a no-op', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({ ...baseMessage });
      tx.emailEvent.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.DELIVERED,
        occurredAt: new Date('2026-06-04T10:05:00.000Z'),
      });

      expect(result).toBe(true);
      expect(tx.emailEvent.create).not.toHaveBeenCalled();
      expect(tx.emailMessage.update).not.toHaveBeenCalled();
    });

    it('records a bounce: status BOUNCED + reason', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({ ...baseMessage });
      tx.emailEvent.findFirst.mockResolvedValue(null);
      const occurredAt = new Date('2026-06-04T11:00:00.000Z');

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.BOUNCED,
        occurredAt,
        bounceType: 'Permanent',
        bounceReason: 'Mailbox full',
      });

      expect(tx.emailEvent.create).toHaveBeenCalled();
      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.BOUNCED);
      expect(arg.data.bouncedAt).toEqual(occurredAt);
      expect(arg.data.bounceReason).toBe('Mailbox full');
    });

    it('records a bounce with no metadata: bounceType/reason default to null', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({ ...baseMessage });
      tx.emailEvent.findFirst.mockResolvedValue(null);

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.BOUNCED,
        occurredAt: new Date('2026-06-04T11:00:00.000Z'),
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.BOUNCED);
      expect(arg.data.bounceType).toBeNull();
      expect(arg.data.bounceReason).toBeNull();
    });

    it('increments openCount and advances to OPENED', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({
        ...baseMessage,
        status: EmailDeliveryStatus.DELIVERED,
      });
      tx.emailEvent.findFirst.mockResolvedValue(null);
      const occurredAt = new Date('2026-06-04T12:00:00.000Z');

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.OPENED,
        occurredAt,
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.OPENED);
      expect(arg.data.openedAt).toEqual(occurredAt);
      expect(arg.data.openCount).toEqual({ increment: 1 });
    });

    it('does not downgrade status when a less significant event arrives late', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({
        ...baseMessage,
        status: EmailDeliveryStatus.OPENED,
      });
      tx.emailEvent.findFirst.mockResolvedValue(null);

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.DELIVERED,
        occurredAt: new Date('2026-06-04T11:30:00.000Z'),
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      // deliveredAt is still stamped, but the rolled-up status stays OPENED.
      expect(arg.data.status).toBeUndefined();
      expect(arg.data.deliveredAt).toEqual(new Date('2026-06-04T11:30:00.000Z'));
    });

    it('stamps sentAt and lastEventAt on a SENT event for a message lacking both', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({
        ...baseMessage,
        status: EmailDeliveryStatus.QUEUED,
        sentAt: null,
        lastEventAt: null,
      });
      tx.emailEvent.findFirst.mockResolvedValue(null);
      const occurredAt = new Date('2026-06-04T09:00:00.000Z');

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.SENT,
        occurredAt,
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.SENT);
      expect(arg.data.sentAt).toEqual(occurredAt);
      // lastEventAt advances from null on the first event.
      expect(arg.data.lastEventAt).toEqual(occurredAt);
    });

    it('does not overwrite an existing sentAt when a SENT event arrives', async () => {
      const originalSentAt = new Date('2026-06-04T08:00:00.000Z');
      tx.emailMessage.findUnique.mockResolvedValue({
        ...baseMessage,
        status: EmailDeliveryStatus.SENT,
        sentAt: originalSentAt,
      });
      tx.emailEvent.findFirst.mockResolvedValue(null);

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.SENT,
        occurredAt: new Date('2026-06-04T09:00:00.000Z'),
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.sentAt).toBeUndefined();
    });

    it('records a complaint: status COMPLAINED + complainedAt', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({
        ...baseMessage,
        status: EmailDeliveryStatus.DELIVERED,
      });
      tx.emailEvent.findFirst.mockResolvedValue(null);
      const occurredAt = new Date('2026-06-04T13:00:00.000Z');

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.COMPLAINED,
        occurredAt,
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.COMPLAINED);
      expect(arg.data.complainedAt).toEqual(occurredAt);
    });

    it('advances to CLICKED without stamping a type-specific timestamp (default branch)', async () => {
      tx.emailMessage.findUnique.mockResolvedValue({
        ...baseMessage,
        status: EmailDeliveryStatus.OPENED,
      });
      tx.emailEvent.findFirst.mockResolvedValue(null);
      const occurredAt = new Date('2026-06-04T14:00:00.000Z');

      await service.recordEvent({
        providerMessageId: 'resend-123',
        type: EmailEventType.CLICKED,
        occurredAt,
      });

      const arg = tx.emailMessage.update.mock.calls[0][0] as DataArg;
      expect(arg.data.status).toBe(EmailDeliveryStatus.CLICKED);
      // CLICKED hits the default switch arm — no deliveredAt/openedAt/etc set here.
      expect(arg.data.deliveredAt).toBeUndefined();
      expect(arg.data.openedAt).toBeUndefined();
      expect(arg.data.complainedAt).toBeUndefined();
      expect(arg.data.bouncedAt).toBeUndefined();
    });
  });

  describe('listForRfq', () => {
    const messageRow = {
      id: 'em-1',
      toEmail: 'vendor@acme.local',
      subject: 'RFQ ABC',
      template: 'rfq-received',
      status: EmailDeliveryStatus.BOUNCED,
      sentAt: new Date('2026-06-04T10:00:00.000Z'),
      deliveredAt: null,
      openedAt: null,
      bouncedAt: new Date('2026-06-04T11:00:00.000Z'),
      openCount: 0,
      bounceReason: 'Mailbox full',
      lastEventAt: new Date('2026-06-04T11:00:00.000Z'),
      createdAt: new Date('2026-06-04T09:59:00.000Z'),
      events: [
        {
          id: 'ev-1',
          type: EmailEventType.BOUNCED,
          occurredAt: new Date('2026-06-04T11:00:00.000Z'),
        },
      ],
    };

    it('maps rows to DTOs when the RFQ belongs to the caller company', async () => {
      prisma.rfq.findUnique.mockResolvedValue({ companyId: 'company-1' });
      prisma.emailMessage.findMany.mockResolvedValue([messageRow]);

      const result = await service.listForRfq('rfq-1', USER);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        toEmail: 'vendor@acme.local',
        status: 'BOUNCED',
        bounceReason: 'Mailbox full',
        bouncedAt: '2026-06-04T11:00:00.000Z',
      });
      expect(result[0].events[0]).toEqual({
        id: 'ev-1',
        type: 'BOUNCED',
        occurredAt: '2026-06-04T11:00:00.000Z',
      });
    });

    it('renders null timestamps as null for a freshly queued message with no events', async () => {
      prisma.rfq.findUnique.mockResolvedValue({ companyId: 'company-1' });
      prisma.emailMessage.findMany.mockResolvedValue([
        {
          ...messageRow,
          status: EmailDeliveryStatus.QUEUED,
          sentAt: null,
          deliveredAt: null,
          openedAt: null,
          bouncedAt: null,
          lastEventAt: null,
          events: [],
        },
      ]);

      const result = await service.listForRfq('rfq-1', USER);

      expect(result[0]).toMatchObject({
        status: 'QUEUED',
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        bouncedAt: null,
        lastEventAt: null,
      });
      expect(result[0].events).toEqual([]);
    });

    it('throws NotFound when the RFQ belongs to another company', async () => {
      prisma.rfq.findUnique.mockResolvedValue({ companyId: 'other-company' });

      await expect(service.listForRfq('rfq-1', USER)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.emailMessage.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFound when the RFQ does not exist', async () => {
      prisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.listForRfq('rfq-1', USER)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listForPurchaseOrder', () => {
    const poMessageRow = {
      id: 'em-po-1',
      toEmail: 'vendor@acme.local',
      subject: 'PO-0001',
      template: 'po-issued',
      status: EmailDeliveryStatus.DELIVERED,
      sentAt: new Date('2026-06-04T10:00:00.000Z'),
      deliveredAt: new Date('2026-06-04T10:01:00.000Z'),
      openedAt: null,
      bouncedAt: null,
      openCount: 0,
      bounceReason: null,
      lastEventAt: new Date('2026-06-04T10:01:00.000Z'),
      createdAt: new Date('2026-06-04T09:59:00.000Z'),
      events: [
        {
          id: 'ev-po-1',
          type: EmailEventType.DELIVERED,
          occurredAt: new Date('2026-06-04T10:01:00.000Z'),
        },
      ],
    };

    it('maps rows to DTOs when the PO belongs to the caller company', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({ companyId: 'company-1' });
      prisma.emailMessage.findMany.mockResolvedValue([poMessageRow]);

      const result = await service.listForPurchaseOrder('po-1', USER);

      expect(prisma.emailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { purchaseOrderId: 'po-1' } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        toEmail: 'vendor@acme.local',
        status: 'DELIVERED',
        deliveredAt: '2026-06-04T10:01:00.000Z',
        bounceReason: null,
      });
      expect(result[0].events[0]).toEqual({
        id: 'ev-po-1',
        type: 'DELIVERED',
        occurredAt: '2026-06-04T10:01:00.000Z',
      });
    });

    it('throws NotFound when the PO belongs to another company', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({ companyId: 'other-company' });

      await expect(service.listForPurchaseOrder('po-1', USER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.emailMessage.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFound when the PO does not exist', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.listForPurchaseOrder('po-1', USER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
