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
};

const mockPdfExportService = {
  exportToCSV: jest.fn(),
  exportToPDF: jest.fn(),
  exportToXLSX: jest.fn(),
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
});
