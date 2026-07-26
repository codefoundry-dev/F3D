import { PaymentReminderService } from '../payment-reminder.service';

const mockPrisma = {
  invoice: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  rolePermission: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

const mockEmailService = {
  sendPaymentDueReminderEmail: jest.fn().mockResolvedValue(undefined),
  sendPaymentOverdueReminderEmail: jest.fn().mockResolvedValue(undefined),
};

const mockNotifications = {
  createForEmails: jest.fn().mockResolvedValue(undefined),
};

const mockBranding = {
  getEmailBrand: jest.fn().mockResolvedValue(undefined),
};

/** Config stub: WEB_APP_URL resolves, the lead-days override is unset. */
const mockConfig = {
  get: jest.fn((key: string, fallback?: string) =>
    key === 'WEB_APP_URL' ? 'http://localhost:5179' : fallback,
  ),
};

/** A date `days` from local midnight today, at midday to dodge DST edges. */
function daysFromToday(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    companyId: 'comp-1',
    dueDate: daysFromToday(2),
    totalAmount: 1500,
    vendor: { legalName: 'VendorCo' },
    ...overrides,
  };
}

describe('PaymentReminderService', () => {
  let service: PaymentReminderService;

  const build = () =>
    new PaymentReminderService(
      mockPrisma as never,
      mockEmailService as never,
      mockNotifications as never,
      mockBranding as never,
      mockConfig as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailService.sendPaymentDueReminderEmail.mockResolvedValue(undefined);
    mockEmailService.sendPaymentOverdueReminderEmail.mockResolvedValue(undefined);
    mockNotifications.createForEmails.mockResolvedValue(undefined);
    mockBranding.getEmailBrand.mockResolvedValue(undefined);
    mockConfig.get.mockImplementation((key: string, fallback?: string) =>
      key === 'WEB_APP_URL' ? 'http://localhost:5179' : fallback,
    );
    // Claim always succeeds unless a test says otherwise.
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.rolePermission.findMany.mockResolvedValue([{ role: 'FINANCIAL_OFFICER' }]);
    mockPrisma.user.findMany.mockResolvedValue([{ email: 'fo@builder.test' }]);
    service = build();
  });

  describe('sendDueReminders', () => {
    it('emails and notifies the invoice.approve holders of the invoice company', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice()]);

      const sent = await service.sendDueReminders();

      expect(sent).toBe(1);
      expect(mockEmailService.sendPaymentDueReminderEmail).toHaveBeenCalledWith(
        'fo@builder.test',
        expect.objectContaining({
          invoiceReference: 'INV-A1B2C3D4',
          vendorName: 'VendorCo',
          amount: '$1,500.00',
          daysUntilDue: 2,
        }),
        'http://localhost:5179/invoices/a1b2c3d4-0000-0000-0000-000000000000',
        undefined,
      );
      expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
        ['fo@builder.test'],
        expect.objectContaining({
          type: 'PAYMENT_DUE',
          entityType: 'INVOICE',
          entityId: 'a1b2c3d4-0000-0000-0000-000000000000',
        }),
      );
    });

    it('scans APPROVED invoices inside the default 3-day lead window only', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.sendDueReminders();

      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('APPROVED');
      expect(where.dueReminderSentAt).toBeNull();

      const spanMs = where.dueDate.lte.getTime() - where.dueDate.gte.getTime();
      // 3 whole days plus the end-of-day rounding on the upper bound.
      expect(Math.round(spanMs / 86_400_000)).toBe(4);
    });

    it('honours a configured lead-day override', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: string) => {
        if (key === 'WEB_APP_URL') return 'http://localhost:5179';
        if (key === 'PAYMENT_DUE_REMINDER_LEAD_DAYS') return '7';
        return fallback;
      });
      service = build();
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.sendDueReminders();

      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      const spanMs = where.dueDate.lte.getTime() - where.dueDate.gte.getTime();
      expect(Math.round(spanMs / 86_400_000)).toBe(8);
    });

    it('falls back to the default lead time when the override is not a positive number', async () => {
      mockConfig.get.mockImplementation((key: string, fallback?: string) => {
        if (key === 'WEB_APP_URL') return 'http://localhost:5179';
        if (key === 'PAYMENT_DUE_REMINDER_LEAD_DAYS') return 'not-a-number';
        return fallback;
      });
      service = build();
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.sendDueReminders();

      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      const spanMs = where.dueDate.lte.getTime() - where.dueDate.gte.getTime();
      expect(Math.round(spanMs / 86_400_000)).toBe(4);
    });

    it('claims the invoice before sending, so a second run cannot re-send', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice()]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });

      const sent = await service.sendDueReminders();

      expect(sent).toBe(0);
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: 'a1b2c3d4-0000-0000-0000-000000000000', dueReminderSentAt: null },
        data: { dueReminderSentAt: expect.any(Date) },
      });
      expect(mockEmailService.sendPaymentDueReminderEmail).not.toHaveBeenCalled();
    });

    it('sends nothing when the company has no invoice.approve holders', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice()]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.sendDueReminders();

      expect(mockEmailService.sendPaymentDueReminderEmail).not.toHaveBeenCalled();
      expect(mockNotifications.createForEmails).not.toHaveBeenCalled();
    });

    it('sends nothing when no role grants invoice.approve at all', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice()]);
      mockPrisma.rolePermission.findMany.mockResolvedValue([]);

      await service.sendDueReminders();

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(mockEmailService.sendPaymentDueReminderEmail).not.toHaveBeenCalled();
    });

    it('skips an invoice with no due date', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice({ dueDate: null })]);

      await service.sendDueReminders();

      expect(mockEmailService.sendPaymentDueReminderEmail).not.toHaveBeenCalled();
    });

    it('forwards the issuing company brand', async () => {
      const brand = { name: 'BuilderCo', logoUrl: 'https://cdn/logo.png' };
      mockBranding.getEmailBrand.mockResolvedValue(brand);
      mockPrisma.invoice.findMany.mockResolvedValue([invoice()]);

      await service.sendDueReminders();

      expect(mockEmailService.sendPaymentDueReminderEmail).toHaveBeenCalledWith(
        'fo@builder.test',
        expect.anything(),
        expect.any(String),
        brand,
      );
    });
  });

  describe('sendOverdueReminders', () => {
    it('emails and notifies for an invoice past its due date', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice({ dueDate: daysFromToday(-5) })]);

      const sent = await service.sendOverdueReminders();

      expect(sent).toBe(1);
      expect(mockEmailService.sendPaymentOverdueReminderEmail).toHaveBeenCalledWith(
        'fo@builder.test',
        expect.objectContaining({ invoiceReference: 'INV-A1B2C3D4', vendorName: 'VendorCo' }),
        'http://localhost:5179/invoices/a1b2c3d4-0000-0000-0000-000000000000',
        undefined,
      );
      expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
        ['fo@builder.test'],
        expect.objectContaining({ type: 'PAYMENT_OVERDUE', entityType: 'INVOICE' }),
      );
    });

    it('scans only APPROVED invoices already past due, not yet reminded', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.sendOverdueReminders();

      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('APPROVED');
      expect(where.overdueReminderSentAt).toBeNull();
      expect(where.dueDate.lt).toBeInstanceOf(Date);
    });

    it('claims against the overdue column, so a second run cannot re-send', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice({ dueDate: daysFromToday(-1) })]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });

      const sent = await service.sendOverdueReminders();

      expect(sent).toBe(0);
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: 'a1b2c3d4-0000-0000-0000-000000000000', overdueReminderSentAt: null },
        data: { overdueReminderSentAt: expect.any(Date) },
      });
      expect(mockEmailService.sendPaymentOverdueReminderEmail).not.toHaveBeenCalled();
    });

    it('skips an invoice with no due date', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([invoice({ dueDate: null })]);

      await service.sendOverdueReminders();

      expect(mockEmailService.sendPaymentOverdueReminderEmail).not.toHaveBeenCalled();
    });
  });

  describe('runDailySweep', () => {
    it('runs both passes', async () => {
      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([invoice()])
        .mockResolvedValueOnce([invoice({ dueDate: daysFromToday(-3) })]);

      await service.runDailySweep();

      expect(mockEmailService.sendPaymentDueReminderEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPaymentOverdueReminderEmail).toHaveBeenCalledTimes(1);
    });

    it('swallows a failure so the scheduler keeps running', async () => {
      mockPrisma.invoice.findMany.mockRejectedValue(new Error('db down'));

      await expect(service.runDailySweep()).resolves.toBeUndefined();
    });

    it('logs nothing when there is nothing to remind about', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await expect(service.runDailySweep()).resolves.toBeUndefined();
      expect(mockEmailService.sendPaymentDueReminderEmail).not.toHaveBeenCalled();
      expect(mockEmailService.sendPaymentOverdueReminderEmail).not.toHaveBeenCalled();
    });
  });
});
