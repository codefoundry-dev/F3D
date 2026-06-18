import { RfqListQueryDto } from '@forethread/shared-types';
import { BadRequestException } from '@nestjs/common';

import { RfqExportService } from '../rfq-export.service';

// ── Mock users ──────────────────────────────────────────────────────────────

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: 'COMPANY_ADMIN',
  companyId: 'comp-1',
};

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockRfqsService = {
  listRfqs: jest.fn(),
};

const mockPdfExportService = {
  exportToCSV: jest.fn(),
  exportToPDF: jest.fn(),
  exportToXLSX: jest.fn(),
};

function q(overrides: Partial<RfqListQueryDto> = {}): RfqListQueryDto {
  return Object.assign(new RfqListQueryDto(), overrides);
}

const sampleItems = [
  {
    id: 'rfq-1',
    projectName: 'Alpha',
    status: 'OPEN',
    deadlineRange: '2026-04-01 - 2026-04-15',
    pickUp: true,
    deliveryLocation: '123 St',
    recVendors: 2,
    recQuotes: 3,
    lineItems: 5,
    totalRequestedQty: 100,
    createdDate: '2026-03-01T00:00:00.000Z',
    createdBy: 'PO User',
    approvalStatus: 'APPROVED',
  },
  {
    id: 'rfq-2',
    projectName: 'Beta',
    status: 'CLOSED',
    deadlineRange: null,
    pickUp: false,
    deliveryLocation: null,
    recVendors: 0,
    recQuotes: 0,
    lineItems: 1,
    totalRequestedQty: 50,
    createdDate: '2026-03-05T00:00:00.000Z',
    createdBy: 'CA User',
    approvalStatus: null,
  },
];

describe('RfqExportService', () => {
  let service: RfqExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RfqExportService(mockRfqsService as never, mockPdfExportService as never);
    mockRfqsService.listRfqs.mockResolvedValue({ items: sampleItems, meta: {} });
  });

  it('exports to CSV format', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    const result = await service.exportRfqs('csv', q(), companyAdmin as never);

    expect(result).toEqual({ url: 'https://storage/rfqs.csv' });
    expect(mockPdfExportService.exportToCSV).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.arrayContaining(['RFQ ID', 'Project Name', 'Status']),
        rows: expect.any(Array),
        filenamePrefix: 'rfqs-export',
      }),
    );
    expect(mockPdfExportService.exportToCSV.mock.calls[0][0].rows).toHaveLength(2);
  });

  it('exports to PDF format', async () => {
    mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://storage/rfqs.pdf' });

    const result = await service.exportRfqs('pdf', q(), companyAdmin as never);

    expect(result).toEqual({ url: 'https://storage/rfqs.pdf' });
    expect(mockPdfExportService.exportToPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'RFQ List Export',
        landscape: true,
        columns: expect.any(Array),
        rows: expect.any(Array),
        filenamePrefix: 'rfqs-export',
      }),
    );
  });

  it('exports to XLSX format', async () => {
    mockPdfExportService.exportToXLSX.mockResolvedValue({ url: 'https://storage/rfqs.xlsx' });

    const result = await service.exportRfqs('xlsx', q(), companyAdmin as never);

    expect(result).toEqual({ url: 'https://storage/rfqs.xlsx' });
    expect(mockPdfExportService.exportToXLSX).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.arrayContaining(['RFQ ID', 'Project Name']),
        rows: expect.any(Array),
        filenamePrefix: 'rfqs-export',
      }),
    );
  });

  it('throws BadRequestException for invalid format', async () => {
    await expect(service.exportRfqs('xml', q(), companyAdmin as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('handles case-insensitive format strings', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    await service.exportRfqs('CSV', q(), companyAdmin as never);
    expect(mockPdfExportService.exportToCSV).toHaveBeenCalled();
  });

  it('overrides query to page:1, limit:10000', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    await service.exportRfqs('csv', q({ page: 5, limit: 10 }), companyAdmin as never);

    const passedQuery = mockRfqsService.listRfqs.mock.calls[0][0];
    expect(passedQuery.page).toBe(1);
    expect(passedQuery.limit).toBe(10000);
  });

  it('passes user to rfqsService.listRfqs', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    await service.exportRfqs('csv', q(), companyAdmin as never);

    expect(mockRfqsService.listRfqs).toHaveBeenCalledWith(expect.any(Object), companyAdmin);
  });

  it('maps rows correctly for CSV with null values', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    await service.exportRfqs('csv', q(), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    // Second item has null values
    const secondRow = rows[1];
    expect(secondRow).toContain(''); // null deadlineRange maps to ''
    expect(secondRow).toContain('No'); // pickUp false maps to 'No'
  });

  it('maps pickUpLocation, applVendors, lineItems columns', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    const extendedItems = [
      { ...sampleItems[0], pickUpLocation: 'Warehouse A', applVendors: 5 },
      { ...sampleItems[1], pickUpLocation: null, applVendors: null },
    ];
    mockRfqsService.listRfqs.mockResolvedValue({ items: extendedItems, meta: {} });

    await service.exportRfqs(
      'csv',
      q({ columns: 'pickUpLocation,applVendors,lineItems,projectId' } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0][0]).toBe('Warehouse A');
    expect(rows[0][1]).toBe('5');
    expect(rows[0][2]).toBe('5');
    expect(rows[1][0]).toBe('');
    expect(rows[1][1]).toBe('');
    expect(rows[1][2]).toBe('1');
  });

  it('maps US 2.06 dashboard columns (Inv. Vendors, Appr./Decline items, Avr. Quote Cost)', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    const extendedItems = [
      {
        ...sampleItems[0],
        invitedVendors: 4,
        approvedItems: 3,
        declinedItems: 1,
        avgQuoteCost: 2000,
      },
      {
        ...sampleItems[1],
        invitedVendors: 0,
        approvedItems: 0,
        declinedItems: 0,
        avgQuoteCost: null,
      },
    ];
    mockRfqsService.listRfqs.mockResolvedValue({ items: extendedItems, meta: {} });

    await service.exportRfqs(
      'csv',
      q({ columns: 'invitedVendors,declinedItems,approvedItems,avgQuoteCost' } as never),
      companyAdmin as never,
    );

    const { headers, rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(headers).toEqual(['Inv. Vendors', 'Decline items', 'Appr. items', 'Avr. Quote Cost']);
    expect(rows[0]).toEqual(['4', '1', '3', '2000']);
    expect(rows[1]).toEqual(['0', '0', '0', '']); // null avgQuoteCost → empty string
  });

  it('maps custom columns including applIssues, arcBlocksDist, contractorName', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    const extendedItems = [
      {
        ...sampleItems[0],
        applIssues: 3,
        arcBlocksDist: 7.5,
        lastModifiedBy: 'Editor',
      },
      {
        ...sampleItems[1],
        applIssues: null,
        arcBlocksDist: null,
        lastModifiedBy: null,
      },
    ];
    mockRfqsService.listRfqs.mockResolvedValue({ items: extendedItems, meta: {} });

    await service.exportRfqs(
      'csv',
      q({
        columns: 'applIssues,arcBlocksDist,contractorName,approvalStatus,approvedBy,lastModifiedBy',
      } as never),
      companyAdmin as never,
    );

    const { headers, rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(headers).toEqual([
      'Appl. Issues',
      'Arc Blocks Dist.',
      'Contractor Name',
      'Approval Status',
      'Approved By',
      'Last Modified By',
    ]);
    // First item
    expect(rows[0][0]).toBe('3');
    expect(rows[0][1]).toBe('7.5');
    expect(rows[0][2]).toBe('PO User'); // contractorName maps to createdBy
    expect(rows[0][3]).toBe('Approved');
    expect(rows[0][5]).toBe('Editor');
    // Second item — null values
    expect(rows[1][0]).toBe('');
    expect(rows[1][1]).toBe('');
    expect(rows[1][3]).toBe('');
    expect(rows[1][4]).toBe('');
    expect(rows[1][5]).toBe('');
  });

  it('maps US 2.06 vendor dashboard columns (Contractor Company, Total Responded Quotes)', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    await service.exportRfqs(
      'csv',
      q({ columns: 'contractorCompany,totalRespondedQuotes' } as never),
      companyAdmin as never,
    );

    const { headers, rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(headers).toEqual(['Contractor Company', 'Total Responded Quotes']);
    // contractorCompany → createdBy, totalRespondedQuotes → recQuotes
    expect(rows[0]).toEqual(['PO User', '3']);
    expect(rows[1]).toEqual(['CA User', '0']);
  });

  it('maps PDF rows as objects with correct keys', async () => {
    mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://storage/rfqs.pdf' });

    await service.exportRfqs('pdf', q(), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToPDF.mock.calls[0][0];
    expect(rows[0]).toEqual(
      expect.objectContaining({
        'RFQ ID': 'rfq-1',
        'Project Name': 'Alpha',
        Status: 'Open',
      }),
    );
  });

  it('maps PDF rows with custom columns including applIssues', async () => {
    mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://storage/rfqs.pdf' });

    const extendedItems = [{ ...sampleItems[0], applIssues: 2, arcBlocksDist: 5 }];
    mockRfqsService.listRfqs.mockResolvedValue({ items: extendedItems, meta: {} });

    await service.exportRfqs(
      'pdf',
      q({ columns: 'applIssues,arcBlocksDist' } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToPDF.mock.calls[0][0];
    expect(rows[0]).toEqual(
      expect.objectContaining({
        'Appl. Issues': '2',
        'Arc Blocks Dist.': '5',
      }),
    );
  });

  it('exercises all column value functions with fully-null item', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    const nullItem = {
      id: null,
      projectName: null,
      projectId: null,
      status: null,
      deadlineRange: null,
      pickUp: false,
      deliveryLocation: null,
      pickUpLocation: null,
      recVendors: null,
      recQuotes: null,
      applVendors: null,
      lineItems: null,
      totalRequestedQty: null,
      applIssues: null,
      arcBlocksDist: null,
      invitedVendors: null,
      approvedItems: null,
      declinedItems: null,
      avgQuoteCost: null,
      createdDate: null,
      createdBy: null,
      contractorName: null,
      approvalStatus: null,
      approvedBy: null,
      lastModifiedBy: null,
    };
    mockRfqsService.listRfqs.mockResolvedValue({ items: [nullItem], meta: {} });

    const allCols = [
      'rfqId',
      'projectName',
      'projectId',
      'rfqStatus',
      'resDeadline',
      'pickUp',
      'deliveryLocation',
      'pickUpLocation',
      'recVendors',
      'recQuotes',
      'applVendors',
      'lineItems',
      'totalRequestedQty',
      'applIssues',
      'arcBlocksDist',
      'invitedVendors',
      'declinedItems',
      'approvedItems',
      'avgQuoteCost',
      'createdDate',
      'createdBy',
      'contractorName',
      'contractorCompany',
      'totalRespondedQuotes',
      'approvalStatus',
      'approvedBy',
      'lastModifiedBy',
    ].join(',');

    await service.exportRfqs('csv', q({ columns: allCols } as never), companyAdmin as never);

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    for (const cell of rows[0]) {
      expect(typeof cell).toBe('string');
    }
  });

  it('handles object values in item data via str() JSON.stringify branch', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    const itemWithObject = {
      ...sampleItems[0],
      deliveryLocation: { address: '123 St', label: 'Main' },
    };
    mockRfqsService.listRfqs.mockResolvedValue({ items: [itemWithObject], meta: {} });

    await service.exportRfqs(
      'csv',
      q({ columns: 'deliveryLocation' } as never),
      companyAdmin as never,
    );

    const { rows } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(rows[0][0]).toContain('123 St');
  });

  it('uses custom columns when provided and filters unknown keys', async () => {
    mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://storage/rfqs.csv' });

    await service.exportRfqs(
      'csv',
      q({ columns: 'rfqId,bogusKey,projectName' } as never),
      companyAdmin as never,
    );

    const { headers } = mockPdfExportService.exportToCSV.mock.calls[0][0];
    expect(headers).toEqual(['RFQ ID', 'Project Name']);
  });
});
