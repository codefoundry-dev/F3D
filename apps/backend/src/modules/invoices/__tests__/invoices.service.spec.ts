import { InvoiceListQueryDto } from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { InvoicesService } from '../invoices.service';

/** Build a query object that satisfies the DTO (including computed skip/take). */
function q(overrides: Partial<InvoiceListQueryDto> = {}): InvoiceListQueryDto {
  return Object.assign(new InvoiceListQueryDto(), overrides);
}

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const financialOfficer = {
  id: 'fo-1',
  email: 'fo@test.com',
  role: UserRole.FINANCIAL_OFFICER,
  companyId: 'comp-1',
};
const vendor = {
  id: 'v-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};
const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const mockPrisma = {
  invoice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  file: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  invoiceDocument: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockStorageService = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getSignedUrl: jest.fn(),
  upload: jest.fn(),
  delete: jest.fn(),
};

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoicesService(mockPrisma as never, mockStorageService as never);
  });

  describe('listInvoices', () => {
    beforeEach(() => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);
    });

    it('scopes CompanyAdmin to company invoices', async () => {
      await service.listInvoices(q(), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('scopes Vendor to their invoices', async () => {
      await service.listInvoices(q(), vendor);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-comp-1');
    });

    it('SuperAdmin sees all invoices', async () => {
      await service.listInvoices(q(), superAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('companyId');
    });

    it('filters by status', async () => {
      await service.listInvoices(q({ status: 'PENDING' as never }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
    });

    it('applies search', async () => {
      await service.listInvoices(q({ search: 'test' }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
    });

    it('returns paginated response', async () => {
      mockPrisma.invoice.count.mockResolvedValue(40);
      const result = await service.listInvoices(q({ page: 2, limit: 20 }), companyAdmin);
      expect(result.meta).toEqual({ page: 2, limit: 20, total: 40, totalPages: 2 });
    });

    it('maps invoice items correctly', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          projectId: 'proj-1',
          status: 'PENDING',
          totalAmount: 12500.75,
          dueDate: new Date('2026-04-15'),
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          relatedPo: { id: 'po-1' },
        },
      ]);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await service.listInvoices(q(), companyAdmin);
      expect(result.items[0].vendorName).toBe('VendorCo');
      expect(result.items[0].relatedPo).toBe('po-1');
      expect(result.items[0].totalAmount).toBe(12500.75);
    });

    it('maps null relatedPo and null dueDate correctly', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-2',
          projectId: 'proj-2',
          status: 'APPROVED',
          totalAmount: 800,
          dueDate: null,
          project: { name: 'Beta' },
          vendor: { legalName: 'SupplierCo' },
          relatedPo: null,
        },
      ]);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await service.listInvoices(q(), companyAdmin);
      expect(result.items[0].relatedPo).toBeNull();
      expect(result.items[0].dueDate).toBeNull();
    });

    // ── Additional filter tests ───────────────────────────────────────────────

    it('filters by projectId', async () => {
      await service.listInvoices(q({ projectId: 'proj-1' }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.projectId).toBe('proj-1');
    });

    it('filters by vendorId', async () => {
      await service.listInvoices(q({ vendorId: 'vendor-1' }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-1');
    });

    it('filters by dueDateFrom only', async () => {
      await service.listInvoices(q({ dueDateFrom: '2026-01-01' }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.dueDate).toEqual({ gte: new Date('2026-01-01') });
    });

    it('filters by dueDateTo only', async () => {
      await service.listInvoices(q({ dueDateTo: '2026-12-31' }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.dueDate).toEqual({ lte: new Date('2026-12-31') });
    });

    it('filters by dueDateFrom and dueDateTo together', async () => {
      await service.listInvoices(
        q({ dueDateFrom: '2026-01-01', dueDateTo: '2026-12-31' }),
        companyAdmin,
      );
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.dueDate).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      });
    });

    it('filters by amountMin only', async () => {
      await service.listInvoices(q({ amountMin: 1000 }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.totalAmount).toEqual({ gte: 1000 });
    });

    it('filters by amountMax only', async () => {
      await service.listInvoices(q({ amountMax: 5000 }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.totalAmount).toEqual({ lte: 5000 });
    });

    it('filters by amountMin and amountMax together', async () => {
      await service.listInvoices(q({ amountMin: 1000, amountMax: 5000 }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.totalAmount).toEqual({ gte: 1000, lte: 5000 });
    });

    // ── Sorting tests ─────────────────────────────────────────────────────────

    it('sorts by id', async () => {
      await service.listInvoices(q({ sortBy: 'id', sortDir: 'asc' }), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ id: 'asc' });
    });

    it('sorts by projectName', async () => {
      await service.listInvoices(q({ sortBy: 'projectName', sortDir: 'asc' }), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ project: { name: 'asc' } });
    });

    it('sorts by vendorName', async () => {
      await service.listInvoices(q({ sortBy: 'vendorName', sortDir: 'desc' }), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ vendor: { legalName: 'desc' } });
    });

    it('sorts by status', async () => {
      await service.listInvoices(q({ sortBy: 'status', sortDir: 'asc' }), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ status: 'asc' });
    });

    it('sorts by totalAmount', async () => {
      await service.listInvoices(q({ sortBy: 'totalAmount', sortDir: 'desc' }), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ totalAmount: 'desc' });
    });

    it('defaults to sorting by dueDate', async () => {
      await service.listInvoices(q(), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ dueDate: 'desc' });
    });

    it('uses explicit sortBy and sortDir when provided', async () => {
      await service.listInvoices(q({ sortBy: 'status', sortDir: 'asc' }), companyAdmin);
      const orderBy = mockPrisma.invoice.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ status: 'asc' });
    });

    it('scopes FinancialOfficer to company invoices', async () => {
      await service.listInvoices(q(), financialOfficer);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });
  });

  describe('getInvoice', () => {
    it('returns invoice detail', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        projectId: 'proj-1',
        status: 'PENDING',
        totalAmount: 12500,
        dueDate: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
        relatedPo: null,
        documents: [],
      });

      const result = await service.getInvoice('inv-1', companyAdmin);
      expect(result.id).toBe('inv-1');
      expect(result.relatedPo).toBeNull();
    });

    it('throws NotFoundException', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.getInvoice('missing', companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it('maps documents correctly', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        projectId: 'proj-1',
        status: 'PENDING',
        totalAmount: 5000,
        dueDate: new Date('2026-06-01'),
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-02'),
        project: { name: 'Beta' },
        vendor: { legalName: 'SupplierCo' },
        relatedPo: { id: 'po-99' },
        documents: [
          {
            id: 'doc-1',
            fileId: 'file-1',
            createdAt: new Date('2026-03-05'),
            file: {
              filename: 'receipt.pdf',
              uploadedBy: { id: 'u-1', name: 'Alice', email: 'alice@test.com' },
            },
          },
          {
            id: 'doc-2',
            fileId: 'file-2',
            createdAt: new Date('2026-03-06'),
            file: {
              filename: 'scan.png',
              uploadedBy: { id: 'u-2', name: 'Bob', email: 'bob@test.com' },
            },
          },
        ],
      });

      const result = await service.getInvoice('inv-1', companyAdmin);
      expect(result.documents).toHaveLength(2);
      expect(result.documents[0]).toEqual({
        id: 'doc-1',
        name: 'receipt.pdf',
        fileId: 'file-1',
        uploadedBy: { name: 'Alice', email: 'alice@test.com', avatarUrl: null },
        uploadedAt: new Date('2026-03-05').toISOString(),
      });
      expect(result.documents[1].name).toBe('scan.png');
      expect(result.relatedPo).toBe('po-99');
      expect(result.dueDate).toBe(new Date('2026-06-01').toISOString());
    });
  });

  describe('approveInvoice', () => {
    it('approves a Pending invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'comp-1',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        projectId: 'proj-1',
        status: 'APPROVED',
        totalAmount: 12500,
        dueDate: null,
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
        relatedPo: null,
      });

      const result = await service.approveInvoice('inv-1', companyAdmin);
      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'APPROVED' },
        }),
      );
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.approveInvoice('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for non-Pending invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'APPROVED',
        companyId: 'comp-1',
      });
      await expect(service.approveInvoice('inv-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException for wrong company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'other-comp',
      });
      await expect(service.approveInvoice('inv-1', financialOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SuperAdmin to approve without company check', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'any-comp',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        projectId: 'proj-1',
        status: 'APPROVED',
        totalAmount: 1000,
        dueDate: null,
        project: { name: 'Gamma' },
        vendor: { legalName: 'VendorX' },
        relatedPo: null,
      });

      const result = await service.approveInvoice('inv-1', superAdmin);
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('rejectInvoice', () => {
    it('rejects a PENDING invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'comp-1',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        projectId: 'proj-1',
        status: 'REJECTED',
        totalAmount: 5000,
        dueDate: null,
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
        relatedPo: null,
      });

      const result = await service.rejectInvoice('inv-1', companyAdmin);
      expect(result.status).toBe('REJECTED');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'REJECTED' },
        }),
      );
    });

    it('rejects a DISPUTED invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-2',
        status: 'DISPUTED',
        companyId: 'comp-1',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-2',
        projectId: 'proj-1',
        status: 'REJECTED',
        totalAmount: 3000,
        dueDate: new Date('2026-05-01'),
        project: { name: 'Beta' },
        vendor: { legalName: 'SupplierCo' },
        relatedPo: { id: 'po-5' },
      });

      const result = await service.rejectInvoice('inv-2', companyAdmin);
      expect(result.status).toBe('REJECTED');
      expect(result.relatedPo).toBe('po-5');
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.rejectInvoice('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for wrong company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'other-comp',
      });
      await expect(service.rejectInvoice('inv-1', financialOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for APPROVED status', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'APPROVED',
        companyId: 'comp-1',
      });
      await expect(service.rejectInvoice('inv-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows SuperAdmin to reject without company check', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'any-comp',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        projectId: 'proj-1',
        status: 'REJECTED',
        totalAmount: 1000,
        dueDate: null,
        project: { name: 'Delta' },
        vendor: { legalName: 'VendorY' },
        relatedPo: null,
      });

      const result = await service.rejectInvoice('inv-1', superAdmin);
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('uploadDocument', () => {
    const mockFile = {
      originalname: 'invoice-scan.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 500, // 500KB
      buffer: Buffer.from('fake-pdf-content'),
    } as Express.Multer.File;

    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.uploadDocument('inv-1', undefined as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file exceeds 10MB', async () => {
      const largeFile = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      } as Express.Multer.File;
      await expect(service.uploadDocument('inv-1', largeFile, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.uploadDocument('missing', mockFile, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for wrong company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        companyId: 'other-comp',
      });
      await expect(service.uploadDocument('inv-1', mockFile, financialOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('uploads document successfully', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        companyId: 'comp-1',
      });
      mockStorageService.upload.mockResolvedValue({
        bucket: 'docs',
        key: 'invoice-documents/inv-1/uuid.pdf',
      });
      mockPrisma.file.create.mockResolvedValue({
        id: 'file-1',
        bucket: 'docs',
        key: 'invoice-documents/inv-1/uuid.pdf',
        filename: 'invoice-scan.pdf',
        mimeType: 'application/pdf',
        size: 512000,
        uploadedById: 'ca-1',
      });
      mockPrisma.invoiceDocument.create.mockResolvedValue({
        id: 'doc-1',
        invoiceId: 'inv-1',
        fileId: 'file-1',
        createdAt: new Date('2026-03-10'),
        file: {
          filename: 'invoice-scan.pdf',
          uploadedBy: { id: 'ca-1', name: 'Admin', email: 'ca@test.com' },
        },
      });

      const result = await service.uploadDocument('inv-1', mockFile, companyAdmin);
      expect(result.id).toBe('doc-1');
      expect(result.name).toBe('invoice-scan.pdf');
      expect(result.fileId).toBe('file-1');
      expect(result.uploadedBy).toEqual({
        name: 'Admin',
        email: 'ca@test.com',
        avatarUrl: null,
      });
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.stringContaining('invoice-documents/inv-1/'),
        mockFile.buffer,
        'application/pdf',
      );
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'invoice-scan.pdf',
          mimeType: 'application/pdf',
          size: 512000,
          uploadedById: 'ca-1',
        }),
      });
    });

    it('allows SuperAdmin to upload without company check', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        companyId: 'any-comp',
      });
      mockStorageService.upload.mockResolvedValue({ bucket: 'docs', key: 'k' });
      mockPrisma.file.create.mockResolvedValue({ id: 'file-1' });
      mockPrisma.invoiceDocument.create.mockResolvedValue({
        id: 'doc-1',
        invoiceId: 'inv-1',
        fileId: 'file-1',
        createdAt: new Date('2026-03-10'),
        file: {
          filename: 'invoice-scan.pdf',
          uploadedBy: { id: 'sa-1', name: 'SA', email: 'sa@test.com' },
        },
      });

      const result = await service.uploadDocument('inv-1', mockFile, superAdmin);
      expect(result.id).toBe('doc-1');
    });
  });

  describe('deleteDocument', () => {
    it('throws NotFoundException for missing document', async () => {
      mockPrisma.invoiceDocument.findFirst.mockResolvedValue(null);
      await expect(service.deleteDocument('inv-1', 'doc-missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for wrong company', async () => {
      mockPrisma.invoiceDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileId: 'file-1',
        file: { key: 'some-key' },
        invoice: { companyId: 'other-comp' },
      });
      await expect(service.deleteDocument('inv-1', 'doc-1', financialOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes document successfully', async () => {
      mockPrisma.invoiceDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileId: 'file-1',
        file: { key: 'invoice-documents/inv-1/uuid.pdf' },
        invoice: { companyId: 'comp-1' },
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.invoiceDocument.delete.mockResolvedValue({});
      mockPrisma.file.delete.mockResolvedValue({});

      const result = await service.deleteDocument('inv-1', 'doc-1', companyAdmin);
      expect(result).toEqual({ success: true });
      expect(mockStorageService.delete).toHaveBeenCalledWith('invoice-documents/inv-1/uuid.pdf');
      expect(mockPrisma.invoiceDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
      expect(mockPrisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    });

    it('allows SuperAdmin to delete without company check', async () => {
      mockPrisma.invoiceDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileId: 'file-1',
        file: { key: 'some-key' },
        invoice: { companyId: 'any-comp' },
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.invoiceDocument.delete.mockResolvedValue({});
      mockPrisma.file.delete.mockResolvedValue({});

      const result = await service.deleteDocument('inv-1', 'doc-1', superAdmin);
      expect(result).toEqual({ success: true });
    });
  });

  describe('bulkApproveInvoices', () => {
    it('bulk approves invoices', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkApproveInvoices(['inv-1', 'inv-2', 'inv-3'], companyAdmin);
      expect(result.approvedCount).toBe(3);
      expect(result.requestedCount).toBe(3);
    });

    it('throws BadRequestException for empty array', async () => {
      await expect(service.bulkApproveInvoices([], companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('scopes by company for non-SuperAdmin', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkApproveInvoices(['inv-1'], companyAdmin);
      const where = mockPrisma.invoice.updateMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('does not scope by company for SuperAdmin', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkApproveInvoices(['inv-1'], superAdmin);
      const where = mockPrisma.invoice.updateMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('companyId');
    });
  });
});
