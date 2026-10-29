import { ProcurementReminderService } from '../procurement-reminder.service';

const mockPrisma = {
  materialRequest: { findMany: jest.fn(), updateMany: jest.fn() },
  rfq: { findMany: jest.fn(), updateMany: jest.fn() },
  purchaseOrder: { findMany: jest.fn(), updateMany: jest.fn() },
  user: { findMany: jest.fn() },
};
const mockEmailService = { sendOverdueReminderEmail: jest.fn().mockResolvedValue(undefined) };
const mockNotifications = { createForUsers: jest.fn().mockResolvedValue(undefined) };
const mockBranding = { getEmailBrand: jest.fn().mockResolvedValue({ name: 'Acme' }) };
const mockConfig = {
  get: jest.fn((key: string, fallback?: string) =>
    key === 'WEB_APP_URL' ? 'https://app.example.com' : fallback,
  ),
};

const today = new Date('2026-10-29T00:00:00');
const yesterday = new Date('2026-10-28T00:00:00');

describe('ProcurementReminderService (FOR-394)', () => {
  let service: ProcurementReminderService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const table of [mockPrisma.materialRequest, mockPrisma.rfq, mockPrisma.purchaseOrder]) {
      table.findMany.mockResolvedValue([]);
      table.updateMany.mockResolvedValue({ count: 1 });
    }
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u-req', email: 'req@acme.test' },
      { id: 'u-buyer', email: 'buyer@acme.test' },
    ]);
    service = new ProcurementReminderService(
      mockPrisma as never,
      mockEmailService as never,
      mockNotifications as never,
      mockBranding as never,
      mockConfig as never,
    );
  });

  describe('material requests', () => {
    const mr = {
      id: 'mr-1',
      mrNumber: 'MR-00007',
      companyId: 'comp-1',
      neededByDate: yesterday,
      requestedById: 'u-req',
      reviewedById: 'u-buyer',
      project: { name: 'Riverside' },
    };

    it('only looks at unordered MRs past need-by that were not reminded yet', async () => {
      await service.sendMaterialRequestReminders(today);
      expect(mockPrisma.materialRequest.findMany.mock.calls[0][0].where).toEqual({
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        neededByDate: { lt: today },
        overdueReminderSentAt: null,
      });
    });

    it('emails + notifies the requester and the reviewer once, after claiming the ledger', async () => {
      mockPrisma.materialRequest.findMany.mockResolvedValue([mr]);

      const sent = await service.sendMaterialRequestReminders(today);

      expect(sent).toBe(1);
      expect(mockPrisma.materialRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'mr-1', overdueReminderSentAt: null },
        data: { overdueReminderSentAt: expect.any(Date) },
      });
      expect(mockPrisma.user.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ['u-req', 'u-buyer'] },
        status: 'ACTIVE',
      });
      expect(mockEmailService.sendOverdueReminderEmail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendOverdueReminderEmail).toHaveBeenCalledWith(
        'req@acme.test',
        'materialRequestOverdueReminder',
        { mrNumber: 'MR-00007', projectName: 'Riverside', dueDate: 'October 28, 2026' },
        'https://app.example.com/material-requests/mr-1',
        { name: 'Acme' },
      );
      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MATERIAL_REQUEST_OVERDUE',
          entityType: 'MATERIAL_REQUEST',
          entityId: 'mr-1',
          userIds: ['u-req', 'u-buyer'],
        }),
      );
    });

    it('sends nothing when another run already claimed the reminder', async () => {
      mockPrisma.materialRequest.findMany.mockResolvedValue([mr]);
      mockPrisma.materialRequest.updateMany.mockResolvedValue({ count: 0 });

      expect(await service.sendMaterialRequestReminders(today)).toBe(0);
      expect(mockEmailService.sendOverdueReminderEmail).not.toHaveBeenCalled();
      expect(mockNotifications.createForUsers).not.toHaveBeenCalled();
    });
  });

  describe('RFQs', () => {
    it('reminds the creator and source-MR requesters of an unawarded RFQ past its date', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-1',
          rfqNumber: 'RFQ-00003',
          companyId: 'comp-1',
          deadlineEnd: new Date('2026-10-20T00:00:00'),
          needByDate: new Date('2026-11-30T00:00:00'),
          createdByUserId: 'u-buyer',
          project: { name: 'Riverside' },
          sourceMaterialRequests: [{ requestedById: 'u-req' }],
        },
      ]);

      await service.sendRfqReminders(today);

      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['DRAFT', 'OPEN', 'AWAITING_RESPONSE', 'QUOTED'] });
      expect(where.OR).toEqual([{ deadlineEnd: { lt: today } }, { needByDate: { lt: today } }]);
      // The passed date is quoted (the deadline), not the future need-by date.
      expect(mockEmailService.sendOverdueReminderEmail.mock.calls[0][2]).toEqual({
        rfqNumber: 'RFQ-00003',
        projectName: 'Riverside',
        dueDate: 'October 20, 2026',
      });
      expect(mockPrisma.user.findMany.mock.calls[0][0].where.id).toEqual({
        in: ['u-buyer', 'u-req'],
      });
      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'RFQ_OVERDUE', entityType: 'RFQ', entityId: 'rfq-1' }),
      );
    });
  });

  describe('purchase orders', () => {
    it('uses the FOR-356 overdue predicate and quotes the expected date', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          poNumber: 'PO-00042',
          companyId: 'comp-1',
          createdByUserId: 'u-buyer',
          plannedDeliveryDate: null,
          deadlineEnd: null,
          deliveries: [],
          lineItems: [{ expectedDeliveryDate: new Date('2026-10-25T00:00:00') }],
          project: { name: 'Riverside' },
          vendor: { legalName: 'SteelCorp' },
          sourceMaterialRequests: [],
        },
      ]);

      await service.sendPurchaseOrderReminders(today);

      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status.in).toEqual(
        expect.arrayContaining(['SCHEDULED_FOR_DELIVERY', 'LATE_FOR_DELIVERY']),
      );
      expect(where.status.in).not.toContain('DELIVERED');
      expect(where.AND[0].OR[0]).toEqual({ plannedDeliveryDate: { lt: today } });
      expect(mockEmailService.sendOverdueReminderEmail).toHaveBeenCalledWith(
        expect.any(String),
        'poDeliveryOverdueReminder',
        {
          poNumber: 'PO-00042',
          vendorName: 'SteelCorp',
          projectName: 'Riverside',
          dueDate: 'October 25, 2026',
        },
        'https://app.example.com/purchase-orders/po-1',
        { name: 'Acme' },
      );
      expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PO_DELIVERY_OVERDUE', entityId: 'po-1' }),
      );
    });
  });

  it('skips sending when no recipient is active', async () => {
    mockPrisma.materialRequest.findMany.mockResolvedValue([
      {
        id: 'mr-1',
        mrNumber: 'MR-1',
        companyId: 'comp-1',
        neededByDate: yesterday,
        requestedById: 'u-gone',
        reviewedById: null,
        project: { name: 'P' },
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await service.sendMaterialRequestReminders(today);

    expect(mockEmailService.sendOverdueReminderEmail).not.toHaveBeenCalled();
  });

  it('falls back when the RFQ number, vendor or project is missing', async () => {
    mockPrisma.rfq.findMany.mockResolvedValue([
      {
        id: 'abcdef12-3456',
        rfqNumber: null,
        companyId: 'comp-1',
        deadlineEnd: null,
        needByDate: yesterday,
        createdByUserId: 'u-buyer',
        project: { name: 'P' },
        sourceMaterialRequests: [],
      },
    ]);
    mockPrisma.purchaseOrder.findMany.mockResolvedValue([
      {
        id: 'po-2',
        poNumber: 'PO-2',
        companyId: 'comp-1',
        createdByUserId: 'u-buyer',
        plannedDeliveryDate: yesterday,
        deadlineEnd: null,
        deliveries: [],
        lineItems: [],
        project: null,
        vendor: null,
        sourceMaterialRequests: [{ requestedById: 'u-req' }],
      },
    ]);

    await service.sendRfqReminders(today);
    await service.sendPurchaseOrderReminders(today);

    const [rfqCall, poCall] = mockEmailService.sendOverdueReminderEmail.mock.calls.filter(
      (_c, i) => i % 2 === 0,
    );
    expect(rfqCall[2].rfqNumber).toBe('abcdef12');
    expect(poCall[2]).toMatchObject({ vendorName: 'the vendor', projectName: '' });
  });

  it('skips a reminder with no recipients at all', async () => {
    mockPrisma.materialRequest.findMany.mockResolvedValue([
      {
        id: 'mr-1',
        mrNumber: 'MR-1',
        companyId: 'comp-1',
        neededByDate: yesterday,
        requestedById: null,
        reviewedById: null,
        project: { name: 'P' },
      },
    ]);

    await service.sendMaterialRequestReminders(today);

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockEmailService.sendOverdueReminderEmail).not.toHaveBeenCalled();
  });

  it('runs all three sweeps from the daily job', async () => {
    mockPrisma.purchaseOrder.findMany.mockResolvedValue([
      {
        id: 'po-3',
        poNumber: 'PO-3',
        companyId: 'comp-1',
        createdByUserId: 'u-buyer',
        plannedDeliveryDate: yesterday,
        deadlineEnd: null,
        deliveries: [],
        lineItems: [],
        project: { name: 'P' },
        vendor: { legalName: 'V' },
        sourceMaterialRequests: [],
      },
    ]);

    await service.runDailySweep();

    expect(mockPrisma.materialRequest.findMany).toHaveBeenCalled();
    expect(mockPrisma.rfq.findMany).toHaveBeenCalled();
    expect(mockPrisma.purchaseOrder.updateMany).toHaveBeenCalledTimes(1);
  });

  it('never throws out of the scheduled sweep', async () => {
    mockPrisma.materialRequest.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.runDailySweep()).resolves.toBeUndefined();
  });
});
