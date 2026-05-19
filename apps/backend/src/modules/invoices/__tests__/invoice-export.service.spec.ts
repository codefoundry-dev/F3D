import { InvoiceListQueryDto } from '@forethread/shared-types';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { InvoiceExportService } from '../invoice-export.service';

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

const mockInvoiceItem = {
  id: 'inv-1',
  projectName: 'Alpha',
  projectId: 'proj-1',
  vendorName: 'VendorCo',
  status: 'PENDING',
  relatedPo: 'po-1',
  totalAmount: 12500.75,
  dueDate: '2026-04-15T00:00:00.000Z',
};

const mockInvoiceItemNulls = {
  id: 'inv-2',
  projectName: 'Beta',
  projectId: 'proj-2',
  vendorName: 'SupplierCo',
  status: 'APPROVED',
  relatedPo: null,
  totalAmount: 800,
  dueDate: null,
};

const mockInvoiceDetail = {
  id: 'inv-1',
  projectName: 'Alpha',
  projectId: 'proj-1',
  vendorName: 'VendorCo',
  status: 'PENDING',
  relatedPo: 'po-1',
  totalAmount: 12500.75,
  dueDate: '2026-04-15T00:00:00.000Z',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  documents: [],
};

const mockInvoicesService = {
  listInvoices: jest.fn(),
  getInvoice: jest.fn(),
};

const mockPdfExportService = {
  exportToCSV: jest.fn(),
  exportToPDF: jest.fn(),
  exportToXLSX: jest.fn(),
  exportInvoicePDF: jest.fn(),
};

function q(overrides: Partial<InvoiceListQueryDto & { ids?: string }> = {}): InvoiceListQueryDto & {
  ids?: string;
} {
  return Object.assign(new InvoiceListQueryDto(), overrides);
}

describe('InvoiceExportService', () => {
  let service: InvoiceExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoiceExportService(mockInvoicesService as never, mockPdfExportService as never);
  });

  describe('exportInvoices', () => {
    beforeEach(() => {
      mockInvoicesService.listInvoices.mockResolvedValue({
        items: [mockInvoiceItem],
        meta: { page: 1, limit: 10000, total: 1, totalPages: 1 },
      });
    });

    it('exports invoices as CSV', async () => {
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/invoices.csv' });

      const result = await service.exportInvoices('csv', q(), companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/invoices.csv' });
      expect(mockPdfExportService.exportToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          filenamePrefix: 'invoices-export',
          headers: expect.arrayContaining(['Invoice ID', 'Total Amount']),
        }),
      );
    });

    it('exports invoices as CSV with null relatedPo and dueDate', async () => {
      mockInvoicesService.listInvoices.mockResolvedValue({
        items: [mockInvoiceItemNulls],
        meta: { page: 1, limit: 10000, total: 1, totalPages: 1 },
      });
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/invoices.csv' });

      await service.exportInvoices('csv', q(), companyAdmin);

      const csvCall = mockPdfExportService.exportToCSV.mock.calls[0][0];
      const row = csvCall.rows[0];
      // relatedPo null -> ''
      expect(row[5]).toBe('');
      // dueDate null -> ''
      expect(row[7]).toBe('');
    });

    it('exports invoices as PDF', async () => {
      mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://cdn/invoices.pdf' });

      const result = await service.exportInvoices('pdf', q(), companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/invoices.pdf' });
      expect(mockPdfExportService.exportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          filenamePrefix: 'invoices-export',
          landscape: true,
          columns: expect.arrayContaining([
            expect.objectContaining({ header: 'Invoice ID' }),
            expect.objectContaining({ header: 'Total Amount' }),
          ]),
        }),
      );
    });

    it('exports invoices as PDF with correct row data', async () => {
      mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://cdn/invoices.pdf' });

      await service.exportInvoices('pdf', q(), companyAdmin);

      const pdfCall = mockPdfExportService.exportToPDF.mock.calls[0][0];
      expect(pdfCall.rows).toHaveLength(1);
      expect(pdfCall.rows[0]['Invoice ID']).toBe('inv-1');
      expect(pdfCall.rows[0]['Project Name']).toBe('Alpha');
      expect(pdfCall.rows[0]['Vendor Name']).toBe('VendorCo');
      expect(pdfCall.rows[0]['Status']).toBe('Pending');
      expect(pdfCall.rows[0]['Related PO']).toBe('po-1');
      expect(pdfCall.rows[0]['Total Amount']).toContain('12,500.75');
    });

    it('exports invoices as PDF with null relatedPo and dueDate', async () => {
      mockInvoicesService.listInvoices.mockResolvedValue({
        items: [mockInvoiceItemNulls],
        meta: { page: 1, limit: 10000, total: 1, totalPages: 1 },
      });
      mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://cdn/invoices.pdf' });

      await service.exportInvoices('pdf', q(), companyAdmin);

      const pdfCall = mockPdfExportService.exportToPDF.mock.calls[0][0];
      expect(pdfCall.rows[0]['Related PO']).toBe('');
      expect(pdfCall.rows[0]['Due Date']).toBe('');
    });

    it('exports invoices as PDF with correct title for multiple items', async () => {
      mockInvoicesService.listInvoices.mockResolvedValue({
        items: [mockInvoiceItem, mockInvoiceItemNulls],
        meta: { page: 1, limit: 10000, total: 2, totalPages: 1 },
      });
      mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://cdn/invoices.pdf' });

      await service.exportInvoices('pdf', q(), companyAdmin);

      const pdfCall = mockPdfExportService.exportToPDF.mock.calls[0][0];
      expect(pdfCall.title).toBe('Invoice Export (2 invoices)');
    });

    it('exports invoices as PDF with singular title for one item', async () => {
      mockPdfExportService.exportToPDF.mockResolvedValue({ url: 'https://cdn/invoices.pdf' });

      await service.exportInvoices('pdf', q(), companyAdmin);

      const pdfCall = mockPdfExportService.exportToPDF.mock.calls[0][0];
      expect(pdfCall.title).toBe('Invoice Export (1 invoice)');
    });

    it('exports invoices as XLSX', async () => {
      mockPdfExportService.exportToXLSX.mockResolvedValue({ url: 'https://cdn/invoices.xlsx' });

      const result = await service.exportInvoices('xlsx', q(), companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/invoices.xlsx' });
      expect(mockPdfExportService.exportToXLSX).toHaveBeenCalledWith(
        expect.objectContaining({
          filenamePrefix: 'invoices-export',
          headers: expect.arrayContaining(['Invoice ID', 'Status']),
        }),
      );
    });

    it('throws BadRequestException for invalid format', async () => {
      await expect(service.exportInvoices('docx', q(), companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('handles case-insensitive format string', async () => {
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/invoices.csv' });

      await service.exportInvoices('CSV', q(), companyAdmin);
      expect(mockPdfExportService.exportToCSV).toHaveBeenCalled();
    });

    it('filters by comma-separated ids', async () => {
      mockInvoicesService.listInvoices.mockResolvedValue({
        items: [
          { ...mockInvoiceItem, id: 'inv-1' },
          { ...mockInvoiceItem, id: 'inv-2' },
          { ...mockInvoiceItem, id: 'inv-3' },
        ],
        meta: { page: 1, limit: 10000, total: 3, totalPages: 1 },
      });
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/filtered.csv' });

      await service.exportInvoices('csv', q({ ids: 'inv-1, inv-3' }), companyAdmin);

      const csvCall = mockPdfExportService.exportToCSV.mock.calls[0][0];
      // Only inv-1 and inv-3 should be in rows (not inv-2)
      expect(csvCall.rows).toHaveLength(2);
      expect(csvCall.rows[0][0]).toBe('inv-1');
      expect(csvCall.rows[1][0]).toBe('inv-3');
    });

    it('overrides query to page=1 and limit=10000', async () => {
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/invoices.csv' });

      await service.exportInvoices('csv', q({ page: 5, limit: 20 }), companyAdmin);

      const calledQuery = mockInvoicesService.listInvoices.mock.calls[0][0];
      expect(calledQuery.page).toBe(1);
      expect(calledQuery.limit).toBe(10000);
    });

    it('does not filter by ids when ids is not provided', async () => {
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/invoices.csv' });

      await service.exportInvoices('csv', q(), companyAdmin);

      const csvCall = mockPdfExportService.exportToCSV.mock.calls[0][0];
      expect(csvCall.rows).toHaveLength(1);
    });
  });

  describe('exportSingleInvoice', () => {
    beforeEach(() => {
      mockInvoicesService.getInvoice.mockResolvedValue(mockInvoiceDetail);
    });

    it('exports single invoice as PDF', async () => {
      mockPdfExportService.exportInvoicePDF.mockResolvedValue({
        url: 'https://cdn/invoice-inv-1.pdf',
      });

      const result = await service.exportSingleInvoice('inv-1', 'pdf', companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/invoice-inv-1.pdf' });
      expect(mockPdfExportService.exportInvoicePDF).toHaveBeenCalledWith(
        expect.objectContaining({
          heading: 'Invoice',
          filenamePrefix: expect.stringContaining('invoice-'),
        }),
      );
    });

    it('exports single invoice as PDF with relatedPo in infoRight', async () => {
      mockPdfExportService.exportInvoicePDF.mockResolvedValue({ url: 'https://cdn/inv.pdf' });

      await service.exportSingleInvoice('inv-1', 'pdf', companyAdmin);

      const pdfCall = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(pdfCall.infoRight.lines).toEqual(
        expect.arrayContaining([expect.stringContaining('Related PO')]),
      );
      expect(pdfCall.infoLeft.lines).toEqual(
        expect.arrayContaining([expect.stringContaining('Status: PENDING')]),
      );
      expect(pdfCall.totalRow.label).toBe('Total');
    });

    it('exports single invoice as CSV', async () => {
      mockPdfExportService.exportToCSV.mockResolvedValue({
        url: 'https://cdn/invoice-inv-1.csv',
      });

      const result = await service.exportSingleInvoice('inv-1', 'csv', companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/invoice-inv-1.csv' });
      expect(mockPdfExportService.exportToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          filenamePrefix: expect.stringContaining('invoice-'),
          headers: expect.arrayContaining(['Invoice ID', 'Created At']),
          rows: expect.arrayContaining([expect.arrayContaining(['inv-1'])]),
        }),
      );
    });

    it('exports single invoice as CSV with null relatedPo and dueDate', async () => {
      mockInvoicesService.getInvoice.mockResolvedValue({
        ...mockInvoiceDetail,
        relatedPo: null,
        dueDate: null,
      });
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/inv.csv' });

      await service.exportSingleInvoice('inv-1', 'csv', companyAdmin);

      const csvCall = mockPdfExportService.exportToCSV.mock.calls[0][0];
      const row = csvCall.rows[0];
      // relatedPo null -> ''
      expect(row[4]).toBe('');
      // dueDate null -> ''
      expect(row[6]).toBe('');
    });

    it('exports single invoice as XLSX', async () => {
      mockPdfExportService.exportToXLSX.mockResolvedValue({
        url: 'https://cdn/invoice-inv-1.xlsx',
      });

      const result = await service.exportSingleInvoice('inv-1', 'xlsx', companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/invoice-inv-1.xlsx' });
      expect(mockPdfExportService.exportToXLSX).toHaveBeenCalledWith(
        expect.objectContaining({
          filenamePrefix: expect.stringContaining('invoice-'),
          headers: expect.arrayContaining(['Invoice ID', 'Created At']),
        }),
      );
    });

    it('exports single invoice as XLSX with null relatedPo and dueDate', async () => {
      mockInvoicesService.getInvoice.mockResolvedValue({
        ...mockInvoiceDetail,
        relatedPo: null,
        dueDate: null,
      });
      mockPdfExportService.exportToXLSX.mockResolvedValue({ url: 'https://cdn/inv.xlsx' });

      await service.exportSingleInvoice('inv-1', 'xlsx', companyAdmin);

      const xlsxCall = mockPdfExportService.exportToXLSX.mock.calls[0][0];
      const row = xlsxCall.rows[0];
      expect(row[4]).toBe('');
      expect(row[6]).toBe('');
    });

    it('throws BadRequestException for invalid format', async () => {
      await expect(service.exportSingleInvoice('inv-1', 'docx', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('calls getInvoice with the correct id and user', async () => {
      mockPdfExportService.exportToCSV.mockResolvedValue({ url: 'https://cdn/inv.csv' });

      await service.exportSingleInvoice('inv-42', 'csv', companyAdmin);
      expect(mockInvoicesService.getInvoice).toHaveBeenCalledWith('inv-42', companyAdmin);
    });

    it('handles invoice with null relatedPo and dueDate in PDF export', async () => {
      mockInvoicesService.getInvoice.mockResolvedValue({
        ...mockInvoiceDetail,
        relatedPo: null,
        dueDate: null,
      });
      mockPdfExportService.exportInvoicePDF.mockResolvedValue({ url: 'https://cdn/inv.pdf' });

      const result = await service.exportSingleInvoice('inv-1', 'pdf', companyAdmin);
      expect(result).toEqual({ url: 'https://cdn/inv.pdf' });

      const pdfCall = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      // infoRight should not contain "Related PO" line when relatedPo is null
      expect(pdfCall.infoRight.lines).not.toEqual(
        expect.arrayContaining([expect.stringContaining('Related PO')]),
      );
      // infoLeft should contain due date as dash
      expect(pdfCall.infoLeft.lines).toEqual(
        expect.arrayContaining([expect.stringContaining('Due Date')]),
      );
    });
  });
});
