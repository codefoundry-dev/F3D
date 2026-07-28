import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { InvoiceMatchingService } from '../invoice-matching.service';

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

/** Stand-in for a Prisma Decimal — the service only calls toNumber(). */
const dec = (value: number) => ({ toNumber: () => value });

const mockPrisma = {
  invoice: { findUnique: jest.fn() },
  docExtraction: { findFirst: jest.fn() },
  purchaseOrder: { findUnique: jest.fn(), findMany: jest.fn() },
};

const mockConfig = { get: jest.fn() };

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    companyId: 'comp-1',
    vendorId: null,
    relatedPoId: null,
    lines: [],
    ...overrides,
  };
}

/** An invoice line row as the service selects it (Decimals arrive as numbers via Number()). */
function invLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'il-1',
    position: 0,
    lineId: null,
    description: 'DN100 PVC pipe',
    quantity: 10,
    unitPrice: 8.5,
    lineTotal: 85,
    ...overrides,
  };
}

function poRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    poNumber: 'PO-00042',
    status: 'SENT',
    vendorId: 'vendor-1',
    projectId: 'proj-1',
    totalAmount: dec(85),
    vendor: { legalName: 'VendorCo' },
    lineItems: [
      {
        id: 'pol-1',
        lineNumber: 1,
        materialCode: 'PVC-100',
        description: 'DN100 PVC pipe',
        quantityOrdered: 10,
        quantityDelivered: 10,
        unitOfMeasure: 'm',
        unitPrice: dec(8.5),
        lineTotal: dec(85),
      },
    ],
    ...overrides,
  };
}

/** Extraction row carrying PO references (a full valid InvoiceExtractionResult). */
function extractionWith(poReferences: string[]) {
  return {
    editedResult: {
      vendorName: 'VendorCo',
      invoiceNumber: 'INV-9',
      poReferences,
      issuedDate: null,
      dueDate: null,
      paymentTerms: null,
      currency: null,
      subTotal: null,
      taxLabel: null,
      taxRate: null,
      taxAmount: null,
      totalAmount: null,
      items: [],
      notes: null,
    },
  };
}

describe('InvoiceMatchingService', () => {
  let service: InvoiceMatchingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined); // default thresholds: ±2% price, exact qty
    mockPrisma.docExtraction.findFirst.mockResolvedValue(null);
    mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
    service = new InvoiceMatchingService(mockPrisma as never, mockConfig as never);
  });

  describe('access control', () => {
    it('throws NotFoundException for a missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.getPoMatch('missing', companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for another company's invoice", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ companyId: 'other-comp' }));
      await expect(service.getPoMatch('inv-1', companyAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('allows SuperAdmin regardless of company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ companyId: 'other-comp' }));
      const result = await service.getPoMatch('inv-1', superAdmin);
      expect(result.resolution).toBe('NO_REFERENCE');
    });
  });

  describe('PO resolution', () => {
    it('reports NO_REFERENCE when the invoice cites no PO (missing PO ref flagged)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ lines: [invLine()] }));

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.resolution).toBe('NO_REFERENCE');
      expect(result.po).toBeNull();
      // Without a PO no line can be judged expected or unexpected.
      expect(result.lines[0].flags).toEqual([]);
      expect(result.summary).toEqual({
        lineCount: 1,
        matchedCount: 0,
        priceVarianceCount: 0,
        quantityVarianceCount: 0,
        unexpectedCount: 0,
      });
    });

    it('reports NOT_FOUND when the cited references resolve to no company PO', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['PO 999']));
      mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([
        { id: 'po-1', poNumber: 'PO-00042' },
      ]);

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.resolution).toBe('NOT_FOUND');
      expect(result.poReferences).toEqual(['PO 999']);
      // Only the company's POs are candidates.
      const whereArg = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ companyId: 'comp-1' });
    });

    it('auto-matches a loosely-cited reference to the company PO', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['P/O 42']));
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([{ id: 'po-1', poNumber: 'PO-00042' }])
        .mockResolvedValueOnce([poRow()]);

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.resolution).toBe('AUTO_MATCHED');
      expect(result.po).toMatchObject({
        id: 'po-1',
        poNumber: 'PO-00042',
        vendorName: 'VendorCo',
        totalAmount: 85,
      });
    });

    it('reports AMBIGUOUS with candidates when several POs resolve', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ lines: [invLine()] }));
      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['PO-42', 'PO-43']));
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([
          { id: 'po-1', poNumber: 'PO-00042' },
          { id: 'po-2', poNumber: 'PO-00043' },
        ])
        .mockResolvedValueOnce([poRow(), poRow({ id: 'po-2', poNumber: 'PO-00043' })]);

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.resolution).toBe('AMBIGUOUS');
      expect(result.po).toBeNull();
      expect(result.poCandidates.map((po) => po.id)).toEqual(['po-1', 'po-2']);
      // No PO chosen yet — lines carry no flags.
      expect(result.lines[0].flags).toEqual([]);
    });

    it('prefers the reviewer-confirmed link (LINKED) over extracted references', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({ relatedPoId: 'po-1', lines: [invLine()] }),
      );
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poRow());

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.resolution).toBe('LINKED');
      expect(result.po?.id).toBe('po-1');
      expect(mockPrisma.purchaseOrder.findMany).not.toHaveBeenCalled();
    });
  });

  describe('per-line variance flags', () => {
    beforeEach(() => {
      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['PO-00042']));
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([{ id: 'po-1', poNumber: 'PO-00042' }])
        .mockResolvedValueOnce([poRow()]);
    });

    it('happy path: identical line matches with no flags', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ lines: [invLine()] }));

      const result = await service.getPoMatch('inv-1', companyAdmin);

      const line = result.lines[0];
      expect(line.poLine?.id).toBe('pol-1');
      expect(line.flags).toEqual([]);
      expect(line.priceVariancePct).toBe(0);
      expect(line.quantityDelta).toBe(0);
      expect(line.matchConfidence).toBeGreaterThan(0.5);
      expect(result.summary.matchedCount).toBe(1);
      expect(result.unbilledPoLines).toEqual([]);
    });

    it('flags price variance beyond the ±2% default tolerance', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({ lines: [invLine({ unitPrice: 9.35, lineTotal: 93.5 })] }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);

      const line = result.lines[0];
      expect(line.flags).toEqual(['PRICE_VARIANCE']);
      expect(line.priceVariancePct).toBe(10);
      expect(result.summary.priceVarianceCount).toBe(1);
    });

    it('does not flag price variance inside the tolerance', async () => {
      // +1% — inside ±2%.
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({ lines: [invLine({ unitPrice: 8.585 })] }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);
      expect(result.lines[0].flags).toEqual([]);
    });

    it('flags quantity variance (exact-quantity default)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({ lines: [invLine({ quantity: 12 })] }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);

      const line = result.lines[0];
      expect(line.flags).toEqual(['QTY_VARIANCE']);
      expect(line.quantityDelta).toBe(2);
      expect(result.summary.quantityVarianceCount).toBe(1);
    });

    it('flags lines the PO never ordered as NOT_ON_PO and lists unbilled PO lines', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({
          lines: [
            invLine(),
            invLine({
              id: 'il-2',
              position: 1,
              description: 'Weekend crane hire surcharge',
              quantity: 1,
              unitPrice: 500,
              lineTotal: 500,
            }),
          ],
        }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.lines[0].flags).toEqual([]);
      expect(result.lines[1].flags).toEqual(['NOT_ON_PO']);
      expect(result.lines[1].poLine).toBeNull();
      expect(result.summary.unexpectedCount).toBe(1);
      // The single PO line is billed by line 0, so nothing is unbilled.
      expect(result.unbilledPoLines).toEqual([]);
    });

    it('reports vendor mismatch when the invoice vendor differs from the PO vendor', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({ vendorId: 'someone-else', lines: [invLine()] }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);
      expect(result.vendorMismatch).toBe(true);
    });
  });

  describe('configurable thresholds (FOR-218)', () => {
    it('honours a wider price tolerance from config', async () => {
      mockConfig.get.mockImplementation((key: string) =>
        key === 'INVOICE_MATCH_PRICE_TOLERANCE_PCT' ? '15' : undefined,
      );
      service = new InvoiceMatchingService(mockPrisma as never, mockConfig as never);

      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['PO-00042']));
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([{ id: 'po-1', poNumber: 'PO-00042' }])
        .mockResolvedValueOnce([poRow()]);
      // +10% — outside the 2% default, inside the configured 15%.
      mockPrisma.invoice.findUnique.mockResolvedValue(
        invoiceRow({ lines: [invLine({ unitPrice: 9.35 })] }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.thresholds.priceTolerancePct).toBe(15);
      expect(result.lines[0].flags).toEqual([]);
    });
  });
});
