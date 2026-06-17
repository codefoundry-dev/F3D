import { PoListQueryDto } from '@forethread/shared-types';
import { BadRequestException } from '@nestjs/common';

import { PoExportService } from '../po-export.service';

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: 'COMPANY_ADMIN',
  companyId: 'comp-1',
};

const mockPoService = {
  listPurchaseOrders: jest.fn(),
  getPurchaseOrder: jest.fn(),
  getPurchaseOrderById: jest.fn(),
};

const mockPdfExportService = {
  exportToCSV: jest.fn(),
  exportToPDF: jest.fn(),
  exportToXLSX: jest.fn(),
  exportInvoicePDF: jest.fn(),
  generateInvoicePDFBuffer: jest.fn(),
};

function q(overrides: Partial<PoListQueryDto> = {}): PoListQueryDto {
  return Object.assign(new PoListQueryDto(), overrides);
}

const sampleItems = [
  {
    id: 'po-1',
    poNumber: 'PO-001',
    projectName: 'Alpha',
    projectId: 'proj-1',
    status: 'SENT',
    poType: 'STANDARD',
    revision: 1,
    pickUp: true,
    deliveryLocationId: 'loc-1',
    pickUpLocation: 'Warehouse',
    holdForRelease: false,
    paymentTermsDays: 30,
    totalAmount: 25000,
    deadlineStart: '2026-04-01',
    deadlineEnd: '2026-05-01',
    plannedDeliveryDate: null,
    lineItemCount: 5,
    totalRequestedQty: 20,
    createdDate: '2026-03-01T00:00:00.000Z',
    createdBy: 'PO User',
    lastModifiedBy: null,
    updatedAt: '2026-03-02T00:00:00.000Z',
    approvalStatus: 'APPROVED',
    approvedBy: 'Admin',
    issuedAt: '2026-03-01T00:00:00.000Z',
    contractorName: 'TestCo',
    vendorName: 'VendorCo',
    lineItemsDelivered: 2,
    quantityDelivered: 10,
    linkedRfqAvgPrice: 1200,
    sourceOfCreation: 'MANUAL',
    currency: 'AUD',
  },
  {
    id: 'po-2',
    poNumber: 'PO-002',
    projectName: 'Beta',
    projectId: 'proj-2',
    status: 'DRAFT',
    poType: 'BULK',
    revision: 0,
    pickUp: false,
    deliveryLocationId: null,
    pickUpLocation: null,
    holdForRelease: true,
    paymentTermsDays: null,
    totalAmount: null,
    deadlineStart: null,
    deadlineEnd: null,
    plannedDeliveryDate: '2026-06-01',
    lineItemCount: 1,
    totalRequestedQty: 5,
    createdDate: '2026-03-05T00:00:00.000Z',
    createdBy: 'CA User',
    lastModifiedBy: 'Admin',
    updatedAt: '2026-03-06T00:00:00.000Z',
    approvalStatus: null,
    approvedBy: null,
    issuedAt: null,
    contractorName: 'TestCo',
    vendorName: null,
    lineItemsDelivered: 0,
    quantityDelivered: 0,
    linkedRfqAvgPrice: null,
    sourceOfCreation: 'RFQ',
    currency: 'USD',
  },
];

describe('PoExportService', () => {
  let service: PoExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoExportService(mockPoService as never, mockPdfExportService as never);
    mockPoService.listPurchaseOrders.mockResolvedValue({ items: sampleItems, meta: {} });
  });

  it('exports to CSV format', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    const result = await service.exportPos('csv', q(), companyAdmin as never);

    expect(result).toEqual({ url: 'https://storage/pos.csv' });
    expect(mockPdfExportService.exportToCSV).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.arrayContaining(['PO Number', 'Project Name', 'PO Status']),
        rows: expect.any(Array),
        filenamePrefix: 'purchase-orders-export',
      }),
    );
    expect(mockPdfExportService.exportToCSV.mock.calls[0][0].rows).toHaveLength(2);
  });

  it('exports to PDF format', async () => {
    mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://storage/pos.pdf' });

    const result = await service.exportPos('pdf', q(), companyAdmin as never);

    expect(result).toEqual({ url: 'https://storage/pos.pdf' });
    expect(mockPdfExportService.exportToPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Purchase Orders Export',
        landscape: true,
        columns: expect.any(Array),
        rows: expect.any(Array),
        filenamePrefix: 'purchase-orders-export',
      }),
    );
  });

  it('exports to XLSX format', async () => {
    mockPdfExportService.exportToXLSX.mockResolvedValue({ url: 'https://storage/pos.xlsx' });

    const result = await service.exportPos('xlsx', q(), companyAdmin as never);

    expect(result).toEqual({ url: 'https://storage/pos.xlsx' });
    expect(mockPdfExportService.exportToXLSX).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.arrayContaining(['PO Number', 'Project Name']),
        rows: expect.any(Array),
        filenamePrefix: 'purchase-orders-export',
      }),
    );
  });

  it('throws BadRequestException for invalid format', async () => {
    await expect(service.exportPos('xml', q(), companyAdmin as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('handles case-insensitive format strings', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('CSV', q(), companyAdmin as never);
    expect(mockPdfExportService.exportToCSV).toHaveBeenCalled();
  });

  it('overrides query to page:1, limit:10000', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('csv', q({ page: 5, limit: 10 }), companyAdmin as never);

    const passedQuery = mockPoService.listPurchaseOrders.mock.calls[0][0];
    expect(passedQuery.page).toBe(1);
    expect(passedQuery.limit).toBe(10000);
  });

  it('passes user to poService.listPurchaseOrders', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('csv', q(), companyAdmin as never);

    expect(mockPoService.listPurchaseOrders).toHaveBeenCalledWith(expect.any(Object), companyAdmin);
  });

  it('uses custom columns when provided', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos(
      'csv',
      q({ columns: 'poNumber,vendorName' } as never),
      companyAdmin as never,
    );

    const { headers } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(headers).toEqual(['PO Number', 'Vendor Name']);
  });

  it('filters out unknown column keys from columns param', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos(
      'csv',
      q({ columns: 'poNumber,bogus,vendorName' } as never),
      companyAdmin as never,
    );

    const { headers } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(headers).toEqual(['PO Number', 'Vendor Name']);
  });

  it('maps CSV rows correctly with null values', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('csv', q(), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    // First item: pickUp=true, totalAmount=25000
    expect(rows[0]).toContain('Yes');
    expect(rows[0]).toContain('25000');
    // Second item: pickUp=false, totalAmount=null
    expect(rows[1]).toContain('No');
  });

  it('maps PDF rows as objects with correct keys', async () => {
    mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://storage/pos.pdf' });

    await service.exportPos('pdf', q(), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToPDF.mock.calls[0][0];
    expect(rows[0]).toEqual(
      expect.objectContaining({
        'PO Number': 'PO-001',
        'Project Name': 'Alpha',
        'PO Status': 'Sent',
      }),
    );
  });

  it('maps aging column based on issuedAt or updatedAt', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('csv', q({ columns: 'aging' } as never), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    // First item has issuedAt, second does not so falls back to updatedAt
    expect(rows[0][0]).toMatch(/^\d+d$/);
    expect(rows[1][0]).toMatch(/^\d+d$/);
  });

  it('maps isBulkOrder column correctly', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('csv', q({ columns: 'isBulkOrder' } as never), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0][0]).toBe('No'); // STANDARD
    expect(rows[1][0]).toBe('Yes'); // BULK
  });

  it('maps linkedRfqAvgPrice column correctly', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos(
      'csv',
      q({ columns: 'linkedRfqAvgPrice' } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0][0]).toBe('1200');
    expect(rows[1][0]).toBe('');
  });

  it('maps delivery-related columns correctly', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos(
      'csv',
      q({
        columns: 'lineItemsDelivered,quantityDelivered,needBy,earliestDate,plannedDeliveryDate',
      } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0]).toEqual(['2', '10', '2026-05-01', '2026-04-01', '']);
    expect(rows[1]).toEqual(['0', '0', '', '', '2026-06-01']);
  });

  it('maps vendorName with fallback to contractorName when vendorName is null', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos('csv', q({ columns: 'vendorName' } as never), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0][0]).toBe('VendorCo'); // has vendorName
    expect(rows[1][0]).toBe('TestCo'); // vendorName is null, falls back to contractorName
  });

  it('maps pickUpLocation, paymentTermsDays, totalQuantity, createdDate, approvedBy columns', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos(
      'csv',
      q({
        columns: 'pickUpLocation,paymentTermsDays,totalQuantity,createdDate,approvedBy,revision',
      } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    // First item
    expect(rows[0][0]).toBe('Warehouse');
    expect(rows[0][1]).toBe('30 days');
    expect(rows[0][2]).toBe('20');
    expect(rows[0][3]).toBe('2026-03-01T00:00:00.000Z');
    expect(rows[0][4]).toBe('Admin');
    expect(rows[0][5]).toBe('1');
    // Second item — null/missing values
    expect(rows[1][0]).toBe('');
    expect(rows[1][1]).toBe('');
    expect(rows[1][2]).toBe('5');
    expect(rows[1][4]).toBe('');
    expect(rows[1][5]).toBe('0');
  });

  it('exercises all column value functions with fully-null item', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    // Item with all nullable fields set to null/undefined
    const nullItem = {
      id: null,
      poNumber: null,
      projectName: null,
      projectId: null,
      status: null,
      poType: null,
      revision: null,
      pickUp: false,
      deliveryLocationId: null,
      pickUpLocation: null,
      holdForRelease: false,
      paymentTermsDays: null,
      totalAmount: null,
      deadlineStart: null,
      deadlineEnd: null,
      plannedDeliveryDate: null,
      lineItemCount: null,
      totalRequestedQty: null,
      createdDate: null,
      createdBy: null,
      lastModifiedBy: null,
      updatedAt: null,
      approvalStatus: null,
      approvedBy: null,
      issuedAt: null,
      contractorName: null,
      vendorName: null,
      lineItemsDelivered: null,
      quantityDelivered: null,
      linkedRfqAvgPrice: null,
      sourceOfCreation: null,
      currency: null,
    };
    mockPoService.listPurchaseOrders.mockResolvedValue({ items: [nullItem], meta: {} });

    // Request ALL columns
    const allCols = [
      'poNumber',
      'projectName',
      'projectId',
      'vendorName',
      'contractorName',
      'poStatus',
      'revision',
      'poType',
      'pickUp',
      'deliveryLocation',
      'pickUpLocation',
      'paymentTermsDays',
      'totalAmount',
      'needBy',
      'holdForRelease',
      'earliestDate',
      'plannedDeliveryDate',
      'lineItems',
      'totalQuantity',
      'createdDate',
      'createdBy',
      'lastModifyBy',
      'lastUpdated',
      'approvalStatus',
      'approvedBy',
      'aging',
      'isBulkOrder',
      'linkedRfqAvgPrice',
      'lineItemsDelivered',
      'quantityDelivered',
    ].join(',');

    await service.exportPos('csv', q({ columns: allCols } as never), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    // Every column should return a string (mostly empty) without throwing
    expect(rows).toHaveLength(1);
    for (const cell of rows[0]) {
      expect(typeof cell).toBe('string');
    }
  });

  it('maps contractorName and lastModifyBy columns', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/pos.csv' });

    await service.exportPos(
      'csv',
      q({ columns: 'contractorName,lastModifyBy,lastUpdated,holdForRelease' } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0]).toEqual(['TestCo', '', expect.any(String), 'No']);
    expect(rows[1]).toEqual(['TestCo', 'Admin', expect.any(String), 'Yes']);
  });

  // ── Single-PO PDF template (FOR-211) ──────────────────────────────────────
  describe('single PO PDF template', () => {
    // A fully-populated PO detail fixture with fixed dates so the template model
    // is deterministic and snapshot-stable.
    const poDetail = {
      id: 'po-123',
      poNumber: 'PO-2026-0042',
      projectName: 'Harbour Bridge Refurb',
      status: 'SENT',
      poType: 'STANDARD',
      revision: 2,
      currency: 'AUD',
      totalAmount: 12750.5,
      paymentTermsDays: 30,
      deliveryLocationName: 'Site B — Gate 4',
      plannedDeliveryDate: '2026-07-01T00:00:00.000Z',
      deliveryNotes: 'Call ahead 30 minutes before arrival.',
      message: 'Please prioritise the structural steel.',
      deliveryResponsibleName: 'Dana Reeves',
      deliveryResponsibleEmail: 'dana@vendor.example',
      vendor: { id: 'v-1', name: 'SteelWorks Pty Ltd' },
      company: { id: 'c-1', name: 'BuildCo Contractors' },
      approvedBy: { id: 'u-2', name: 'Priya Approver' },
      createdBy: { id: 'u-1', name: 'Sam Creator' },
      lineItems: [
        {
          materialName: 'Structural Steel Beam',
          description: 'I-beam 200x100',
          quantityOrdered: 10,
          unitOfMeasure: 'EA',
          unitPrice: 1200,
          lineTotal: 12000,
        },
        {
          materialName: null,
          description: 'Delivery surcharge',
          quantityOrdered: 1,
          unitOfMeasure: 'EA',
          unitPrice: 750.5,
          lineTotal: 750.5,
        },
      ],
      deliveries: [
        {
          sequence: 1,
          deliveryLocationName: 'Site B — Gate 4',
          deliveryDate: '2026-07-01T00:00:00.000Z',
          notes: 'First drop',
        },
        {
          sequence: 2,
          deliveryLocationName: 'Site B — Yard',
          deliveryDate: '2026-07-08T00:00:00.000Z',
          notes: null,
        },
      ],
      createdAt: '2026-06-01T00:00:00.000Z',
    };

    it('builds a stable PO PDF template model (snapshot)', () => {
      const options = service.buildPoPdfOptions(poDetail as never);
      expect(options).toMatchSnapshot();
    });

    it('renders all required fields: number, vendor, lines, deliveries, terms, signatures', () => {
      const options = service.buildPoPdfOptions(poDetail as never);

      // Number + vendor + buyer
      expect(options.heading).toBe('Purchase Order');
      expect(options.infoLeft?.lines).toEqual(expect.arrayContaining(['PO Number: PO-2026-0042']));
      expect(options.infoRight?.lines).toEqual(expect.arrayContaining(['SteelWorks Pty Ltd']));

      // Line items — Qty/Unit use the correct fields (regression: was quantity/unit)
      expect(options.rows[0]).toEqual({
        Item: 'Structural Steel Beam',
        Qty: '10',
        Unit: 'EA',
        'Unit Price': '$1,200.00 AUD',
        Total: '$12,000.00 AUD',
      });
      expect(options.totalRow).toEqual({ label: 'Total Amount', value: '$12,750.50 AUD' });

      // Deliveries section
      const deliverySection = options.sections?.find((s) => s.label === 'Delivery Schedule');
      expect(deliverySection?.rows).toHaveLength(2);
      expect(deliverySection?.rows[0]).toEqual({
        '#': '1',
        Location: 'Site B — Gate 4',
        Date: 'July 1, 2026',
        Notes: 'First drop',
      });

      // Terms
      expect(options.terms?.lines).toEqual(
        expect.arrayContaining([
          'Payment terms: Net 30 days',
          'Delivery contact: Dana Reeves (dana@vendor.example)',
          'Delivery notes: Call ahead 30 minutes before arrival.',
        ]),
      );

      // Signatures — buyer line pre-filled with approver name
      expect(options.signatures).toEqual([
        { label: 'Authorised by (Buyer)', name: 'Priya Approver' },
        { label: 'Accepted by (Vendor)' },
      ]);
    });

    it('falls back to a planned-delivery hint when there are no delivery rows', () => {
      const options = service.buildPoPdfOptions({ ...poDetail, deliveries: [] } as never);
      const deliverySection = options.sections?.find((s) => s.label === 'Delivery Schedule');
      expect(deliverySection?.rows).toHaveLength(0);
      expect(deliverySection?.emptyText).toBe('Planned delivery: July 1, 2026');
    });

    it('exportSinglePo delegates to exportInvoicePDF with the PO template', async () => {
      mockPoService.getPurchaseOrder.mockResolvedValue(poDetail);
      mockPdfExportService.exportInvoicePDF.mockResolvedValue({ url: 'https://storage/po.pdf' });

      const result = await service.exportSinglePo('po-123', 'pdf', companyAdmin as never);

      expect(result).toEqual({ url: 'https://storage/po.pdf' });
      expect(mockPdfExportService.exportInvoicePDF).toHaveBeenCalledWith(
        expect.objectContaining({ heading: 'Purchase Order', filenamePrefix: 'po-PO-2026-0042' }),
      );
    });

    it('exportSinglePo rejects non-PDF formats', async () => {
      await expect(service.exportSinglePo('po-123', 'csv', companyAdmin as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('generatePoPdfBuffer delegates to generateInvoicePDFBuffer and returns a Buffer', async () => {
      mockPoService.getPurchaseOrder.mockResolvedValue(poDetail);
      mockPdfExportService.generateInvoicePDFBuffer.mockResolvedValue(Buffer.from('%PDF-1.7 fake'));

      const buffer = await service.generatePoPdfBuffer('po-123', companyAdmin as never);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(mockPdfExportService.generateInvoicePDFBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ filenamePrefix: 'po-PO-2026-0042' }),
      );
    });

    // Exercises the fallback/empty branches of buildPoPdfOptions: missing
    // currency/vendor/company/poType/terms, no planned-delivery hint, and
    // line-item/delivery rows whose every optional field is null.
    it('renders blank-safe defaults when all optional PO fields are empty', () => {
      const emptyPo = {
        poNumber: 'PO-EMPTY',
        projectName: 'Bare Project',
        status: 'DRAFT',
        poType: null,
        revision: null,
        currency: null,
        totalAmount: null,
        paymentTermsDays: null,
        deliveryLocationName: null,
        plannedDeliveryDate: null,
        deliveryNotes: null,
        message: null,
        deliveryResponsibleName: null,
        deliveryResponsibleEmail: null,
        vendor: null,
        company: null,
        approvedBy: null,
        createdBy: null,
        lineItems: [
          {
            materialName: null,
            description: null,
            quantityOrdered: 0,
            unitOfMeasure: '',
            unitPrice: null,
            lineTotal: null,
          },
        ],
        deliveries: [
          { sequence: null, deliveryLocationName: null, deliveryDate: null, notes: null },
        ],
        createdAt: '2026-06-01T00:00:00.000Z',
      };

      const options = service.buildPoPdfOptions(emptyPo as never);

      // currency falls back to AUD; money(null) → "$0.00 AUD"
      expect(options.totalRow).toEqual({ label: 'Total Amount', value: '$0.00 AUD' });
      // vendor/company/type fall back to em-dash / STANDARD
      expect(options.infoRight?.lines).toEqual(['—']);
      expect(options.infoLeft?.lines).toEqual(
        expect.arrayContaining(['Type: Standard', 'Buyer: —']),
      );
      // no payment terms / deliver-to → those vendor lines are omitted
      expect(options.infoRight?.lines).toHaveLength(1);
      // empty line item → blank Item, money(null) totals
      expect(options.rows[0]).toEqual({
        Item: '',
        Qty: '0',
        Unit: '',
        'Unit Price': '$0.00 AUD',
        Total: '$0.00 AUD',
      });
      // delivery row with null fields → sequence index, em-dashes, blank notes
      const section = options.sections?.find((s) => s.label === 'Delivery Schedule');
      expect(section?.emptyText).toBe('No delivery schedule specified.');
      expect(section?.rows[0]).toEqual({ '#': '1', Location: '—', Date: '—', Notes: '' });
      // terms with every optional empty → all blank lines
      expect(options.terms?.lines).toEqual(['', '', '', '']);
      // no approver/creator → buyer signature name is undefined
      expect(options.signatures?.[0]).toEqual({ label: 'Authorised by (Buyer)', name: undefined });
    });

    // Covers the nullish-collection fallbacks (lineItems/deliveries undefined) and
    // a delivery contact that has a name but no email.
    it('handles missing line-item/delivery arrays and a contact without an email', () => {
      const noCollectionsPo = {
        poNumber: 'PO-NOCOLL',
        projectName: 'Sparse',
        status: 'DRAFT',
        currency: 'AUD',
        totalAmount: 0,
        deliveryResponsibleName: 'Jordan Contact',
        deliveryResponsibleEmail: null,
        lineItems: undefined,
        deliveries: undefined,
        createdAt: '2026-06-01T00:00:00.000Z',
      };

      const options = service.buildPoPdfOptions(noCollectionsPo as never);

      expect(options.rows).toEqual([]);
      const section = options.sections?.find((s) => s.label === 'Delivery Schedule');
      expect(section?.rows).toEqual([]);
      // contact name present, email absent → no parenthesised email suffix
      expect(options.terms?.lines).toEqual(
        expect.arrayContaining(['Delivery contact: Jordan Contact']),
      );
    });
  });

  describe('exportPublicPoPdf (FOR-246)', () => {
    it('loads the PO by id (no user) and returns the generated PDF url', async () => {
      mockPoService.getPurchaseOrderById.mockResolvedValue({
        poNumber: 'PO-77',
        projectName: 'Portal',
        status: 'SENT',
        currency: 'AUD',
        totalAmount: 1000,
        lineItems: [],
        createdAt: '2026-06-16T00:00:00.000Z',
      });
      mockPdfExportService.exportInvoicePDF.mockResolvedValue({ url: 'https://files/po-77.pdf' });

      const result = await service.exportPublicPoPdf('po-77');

      expect(mockPoService.getPurchaseOrderById).toHaveBeenCalledWith('po-77');
      // Identity-free: the authenticated getPurchaseOrder(user) path is not used.
      expect(mockPoService.getPurchaseOrder).not.toHaveBeenCalled();
      expect(mockPdfExportService.exportInvoicePDF).toHaveBeenCalledWith(
        expect.objectContaining({ filenamePrefix: 'po-PO-77' }),
      );
      expect(result).toEqual({ url: 'https://files/po-77.pdf' });
    });
  });
});
