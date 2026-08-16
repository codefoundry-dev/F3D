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
  deliveryReport: { findMany: jest.fn() },
};

const mockPoExport = { exportSinglePo: jest.fn() };

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

function poLineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pol-1',
    lineNumber: 1,
    materialCode: 'PVC-100',
    description: 'DN100 PVC pipe',
    quantityOrdered: 10,
    quantityDelivered: 10,
    unitOfMeasure: 'm',
    unitPrice: dec(8.5),
    lineTotal: dec(85),
    costCode: 'CC-100',
    ...overrides,
  };
}

function poRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    poNumber: 'PO-00042',
    status: 'SENT',
    companyId: 'comp-1',
    vendorId: 'vendor-1',
    projectId: 'proj-1',
    currency: 'AUD',
    plannedDeliveryDate: new Date('2026-08-14T00:00:00.000Z'),
    totalAmount: dec(85),
    vendor: { legalName: 'VendorCo' },
    project: { name: 'Plant Upgrade' },
    lineItems: [poLineRow()],
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
    mockPrisma.deliveryReport.findMany.mockResolvedValue([]);
    service = new InvoiceMatchingService(
      mockPrisma as never,
      mockPoExport as never,
      mockConfig as never,
    );
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

  // The reviewer's dropdown choice, previewed before it is saved as relatedPoId.
  describe('reviewer-selected PO (poIdOverride)', () => {
    it('reconciles against the selected PO and reports SELECTED', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ lines: [invLine()] }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(
        poRow({ id: 'po-9', poNumber: 'PO-00099' }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin, 'po-9');

      expect(result.resolution).toBe('SELECTED');
      expect(result.po?.id).toBe('po-9');
      // The selection is a real reconciliation, not just a header swap.
      expect(result.lines[0].poLine?.id).toBe('pol-1');
    });

    it('reports LINKED when the selection is the PO already saved on the invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ relatedPoId: 'po-1' }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poRow());

      const result = await service.getPoMatch('inv-1', companyAdmin, 'po-1');

      expect(result.resolution).toBe('LINKED');
      expect(result.po?.id).toBe('po-1');
    });

    it('keeps AUTO_MATCHED when the reviewer selects the PO the document already resolved to', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['PO-00042']));
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([{ id: 'po-1', poNumber: 'PO-00042' }])
        .mockResolvedValueOnce([poRow()]);

      const result = await service.getPoMatch('inv-1', companyAdmin, 'po-1');

      expect(result.resolution).toBe('AUTO_MATCHED');
      // No second read — the auto-resolved PO already is the selection.
      expect(mockPrisma.purchaseOrder.findUnique).not.toHaveBeenCalled();
    });

    it("retains the ambiguous candidates when the reviewer picks one, so the form's PO list keeps them", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.docExtraction.findFirst.mockResolvedValue(extractionWith(['PO-42', 'PO-43']));
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([
          { id: 'po-1', poNumber: 'PO-00042' },
          { id: 'po-2', poNumber: 'PO-00043' },
        ])
        .mockResolvedValueOnce([poRow(), poRow({ id: 'po-2', poNumber: 'PO-00043' })]);
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(
        poRow({ id: 'po-2', poNumber: 'PO-00043' }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin, 'po-2');

      expect(result.resolution).toBe('SELECTED');
      expect(result.po?.id).toBe('po-2');
      expect(result.poCandidates.map((po) => po.id)).toEqual(['po-1', 'po-2']);
    });

    it("ignores a PO belonging to another company and falls back to the document's own resolution", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poRow({ companyId: 'other-comp' }));

      const result = await service.getPoMatch('inv-1', companyAdmin, 'po-1');

      expect(result.resolution).toBe('NO_REFERENCE');
      expect(result.po).toBeNull();
    });

    it('ignores an unknown PO id', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      const result = await service.getPoMatch('inv-1', companyAdmin, 'nope');
      expect(result.po).toBeNull();
    });
  });

  // Everything the reviewer needs about the PO itself, so the invoice can be
  // judged without leaving the review form.
  describe('PO context: status, delivery progress and lines', () => {
    const linkedTo = (po: Record<string, unknown>) => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ relatedPoId: 'po-1' }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(po);
    };

    /** Delivery roll-up of the linked PO, proving it resolved on the way through. */
    const deliveryOf = async () => {
      const result = await service.getPoMatch('inv-1', companyAdmin);
      if (result.po === null) throw new Error('expected the linked PO to resolve');
      return result.po.delivery;
    };

    it("carries the PO's status, currency, project and every one of its lines", async () => {
      linkedTo(
        poRow({
          lineItems: [poLineRow(), poLineRow({ id: 'pol-2', lineNumber: 2, quantityDelivered: 0 })],
        }),
      );

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.po).toMatchObject({
        status: 'SENT',
        currency: 'AUD',
        projectName: 'Plant Upgrade',
        vendorName: 'VendorCo',
      });
      // Every PO line, billed or not — the side-by-side reference.
      expect(result.poLines.map((line) => line.id)).toEqual(['pol-1', 'pol-2']);
      expect(result.poLines[0].costCode).toBe('CC-100');
    });

    it('reports DELIVERED when every line has been received in full', async () => {
      linkedTo(poRow());

      const delivery = await deliveryOf();

      expect(delivery).toEqual({
        status: 'DELIVERED',
        quantityOrdered: 10,
        quantityDelivered: 10,
        linesDelivered: 1,
        lineCount: 1,
        percentDelivered: 100,
        plannedDeliveryDate: '2026-08-14T00:00:00.000Z',
      });
    });

    it('reports PARTIALLY_DELIVERED while any line is short', async () => {
      linkedTo(
        poRow({
          lineItems: [
            poLineRow({ quantityDelivered: 4 }),
            poLineRow({ id: 'pol-2', lineNumber: 2, quantityDelivered: 0 }),
          ],
        }),
      );

      const delivery = await deliveryOf();

      expect(delivery.status).toBe('PARTIALLY_DELIVERED');
      expect(delivery.quantityDelivered).toBe(4);
      expect(delivery.quantityOrdered).toBe(20);
      expect(delivery.linesDelivered).toBe(0);
      expect(delivery.percentDelivered).toBe(20);
    });

    it('reports AWAITING_DELIVERY when nothing has arrived', async () => {
      linkedTo(poRow({ lineItems: [poLineRow({ quantityDelivered: 0 })] }));

      const delivery = await deliveryOf();

      expect(delivery.status).toBe('AWAITING_DELIVERY');
      expect(delivery.percentDelivered).toBe(0);
    });

    it('caps the delivered percentage at 100 on an over-receipt', async () => {
      linkedTo(poRow({ lineItems: [poLineRow({ quantityDelivered: 14 })] }));

      const delivery = await deliveryOf();

      expect(delivery.status).toBe('DELIVERED');
      expect(delivery.percentDelivered).toBe(100);
    });

    it('treats a PO with no lines as awaiting delivery rather than delivered', async () => {
      linkedTo(poRow({ lineItems: [], plannedDeliveryDate: null }));

      const delivery = await deliveryOf();

      expect(delivery).toMatchObject({
        status: 'AWAITING_DELIVERY',
        lineCount: 0,
        percentDelivered: 0,
        plannedDeliveryDate: null,
      });
    });

    it('reports a vendorless, projectless, untotalled PO as nulls rather than crashing', async () => {
      linkedTo(poRow({ vendor: null, project: null, totalAmount: null }));

      const result = await service.getPoMatch('inv-1', companyAdmin);

      expect(result.po).toMatchObject({
        vendorName: null,
        projectName: null,
        totalAmount: null,
      });
    });

    it('reports no PO lines when no PO resolved', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ lines: [invLine()] }));

      const result = await service.getPoMatch('inv-1', companyAdmin);
      expect(result.poLines).toEqual([]);
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
      service = new InvoiceMatchingService(
        mockPrisma as never,
        mockPoExport as never,
        mockConfig as never,
      );

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

  describe('getPoInfo (FOR-355)', () => {
    it('returns the match with no delivery reports when no PO resolves', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());

      const result = await service.getPoInfo('inv-1', companyAdmin);

      expect(result.match.resolution).toBe('NO_REFERENCE');
      expect(result.deliveryReports).toEqual([]);
      expect(mockPrisma.deliveryReport.findMany).not.toHaveBeenCalled();
    });

    it("summarises the resolved PO's delivery reports, newest first as queried", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ relatedPoId: 'po-1' }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poRow());
      mockPrisma.deliveryReport.findMany.mockResolvedValue([
        {
          id: 'dr-1',
          reportNumber: 'DR-0007',
          status: 'APPROVED',
          source: 'INTERNAL',
          deliveryDate: new Date('2026-08-10T00:00:00.000Z'),
          submitterName: 'Sam Site',
          createdAt: new Date('2026-08-10T08:00:00.000Z'),
          deliveryLocation: { label: 'North gate', address: '1 Plant Rd' },
          lines: [{ quantityReceived: 6 }, { quantityReceived: 4 }],
        },
        {
          id: 'dr-2',
          reportNumber: 'DR-0006',
          status: 'SUBMITTED',
          source: 'EXTERNAL',
          deliveryDate: null,
          submitterName: 'Driver Dan',
          createdAt: new Date('2026-08-09T08:00:00.000Z'),
          deliveryLocation: null,
          lines: [],
        },
      ]);

      const result = await service.getPoInfo('inv-1', companyAdmin);

      expect(result.match.resolution).toBe('LINKED');
      expect(mockPrisma.deliveryReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { purchaseOrderId: 'po-1' } }),
      );
      expect(result.deliveryReports).toEqual([
        expect.objectContaining({
          id: 'dr-1',
          reportNumber: 'DR-0007',
          status: 'APPROVED',
          deliveryDate: '2026-08-10T00:00:00.000Z',
          locationName: 'North gate',
          quantityReceived: 10,
          lineCount: 2,
        }),
        expect.objectContaining({
          id: 'dr-2',
          status: 'SUBMITTED',
          deliveryDate: null,
          locationName: null,
          quantityReceived: 0,
          lineCount: 0,
        }),
      ]);
    });

    it('falls back to the location address when it has no label', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ relatedPoId: 'po-1' }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(poRow());
      mockPrisma.deliveryReport.findMany.mockResolvedValue([
        {
          id: 'dr-1',
          reportNumber: 'DR-0008',
          status: 'SUBMITTED',
          source: 'INTERNAL',
          deliveryDate: null,
          submitterName: 'Sam Site',
          createdAt: new Date('2026-08-11T08:00:00.000Z'),
          deliveryLocation: { label: null, address: '1 Plant Rd' },
          lines: [{ quantityReceived: 1 }],
        },
      ]);

      const result = await service.getPoInfo('inv-1', companyAdmin);
      expect(result.deliveryReports[0].locationName).toBe('1 Plant Rd');
    });
  });

  describe('exportRelatedPoPdf (FOR-355)', () => {
    beforeEach(() => {
      mockPoExport.exportSinglePo.mockResolvedValue({ url: 'https://signed/po.pdf' });
    });

    it('throws NotFoundException for a missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.exportRelatedPoPdf('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException for another company's invoice", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ companyId: 'other-comp' }));
      await expect(service.exportRelatedPoPdf('inv-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the invoice has no linked PO and no poId is given', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      await expect(service.exportRelatedPoPdf('inv-1', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPoExport.exportSinglePo).not.toHaveBeenCalled();
    });

    it('exports the linked PO as PDF through the PO export service', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ relatedPoId: 'po-1' }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', companyId: 'comp-1' });

      const result = await service.exportRelatedPoPdf('inv-1', companyAdmin);

      expect(mockPoExport.exportSinglePo).toHaveBeenCalledWith('po-1', 'pdf', companyAdmin);
      expect(result).toEqual({ url: 'https://signed/po.pdf' });
    });

    it('accepts a poId override for the displayed (auto-matched) PO', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow());
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-9', companyId: 'comp-1' });

      await service.exportRelatedPoPdf('inv-1', companyAdmin, 'po-9');

      expect(mockPrisma.purchaseOrder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'po-9' } }),
      );
      expect(mockPoExport.exportSinglePo).toHaveBeenCalledWith('po-9', 'pdf', companyAdmin);
    });

    it("rejects a poId outside the invoice's company — the link is the authorisation", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow({ relatedPoId: 'po-1' }));
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-foreign',
        companyId: 'other-comp',
      });

      await expect(service.exportRelatedPoPdf('inv-1', companyAdmin, 'po-foreign')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPoExport.exportSinglePo).not.toHaveBeenCalled();
    });
  });
});
