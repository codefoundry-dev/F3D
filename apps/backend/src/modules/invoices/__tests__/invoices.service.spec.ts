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
  company: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  purchaseOrder: {
    findFirst: jest.fn(),
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
  invoiceLineItem: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  docExtraction: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockStorageService = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getSignedUrl: jest.fn(),
  upload: jest.fn(),
  delete: jest.fn(),
};

const mockEmailService = {
  sendInvoiceRejectedEmail: jest.fn().mockResolvedValue(undefined),
};

const mockNotifications = {
  createForEmails: jest.fn().mockResolvedValue(undefined),
  createForUsers: jest.fn().mockResolvedValue(undefined),
};

const mockBranding = {
  getEmailBrand: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = { get: jest.fn(() => 'http://localhost:5179') };

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailService.sendInvoiceRejectedEmail.mockResolvedValue(undefined);
    mockNotifications.createForEmails.mockResolvedValue(undefined);
    mockBranding.getEmailBrand.mockResolvedValue(undefined);
    mockConfig.get.mockReturnValue('http://localhost:5179');
    // No vendor company by default — the rejection notification simply no-ops.
    mockPrisma.company.findUnique.mockResolvedValue(null);
    // No extraction by default (pre-FOR-291 invoices).
    mockPrisma.docExtraction.findFirst.mockResolvedValue(null);
    // The review transaction just resolves; each op is asserted individually.
    mockPrisma.$transaction.mockResolvedValue([]);
    service = new InvoicesService(
      mockPrisma as never,
      mockStorageService as never,
      mockEmailService as never,
      mockNotifications as never,
      mockBranding as never,
      mockConfig as never,
    );
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

    it('applies search across id, invoice number, project and vendor names', async () => {
      await service.listInvoices(q({ search: 'test' }), companyAdmin);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(4);
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
        lines: [],
        documents: [],
      });

      const result = await service.getInvoice('inv-1', companyAdmin);
      expect(result.id).toBe('inv-1');
      expect(result.relatedPo).toBeNull();
      expect(result.extraction).toBeNull();
      expect(result.lines).toEqual([]);
    });

    it('maps saved line items and the completed extraction result (FOR-291)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        projectId: null,
        status: 'PENDING',
        totalAmount: null,
        dueDate: null,
        invoiceNumber: 'INV-42',
        issuedDate: new Date('2026-07-01'),
        reviewedAt: new Date('2026-07-28'),
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: null,
        vendor: null,
        relatedPo: null,
        lines: [
          {
            id: 'line-1',
            lineId: '1',
            description: 'DN100 PVC pipe',
            quantity: 12,
            unit: 'm',
            unitPrice: 8.5,
            lineTotal: 102,
          },
        ],
        documents: [],
      });
      mockPrisma.docExtraction.findFirst.mockResolvedValue({
        id: 'ext-1',
        status: 'COMPLETED',
        errorCode: null,
        completedAt: new Date('2026-07-28T09:00:00Z'),
        editedResult: { vendorName: 'VendorCo', items: [] },
      });

      const result = await service.getInvoice('inv-1', companyAdmin);

      expect(result.invoiceNumber).toBe('INV-42');
      expect(result.lines[0]).toMatchObject({ description: 'DN100 PVC pipe', quantity: 12 });
      expect(result.extraction).toEqual({
        id: 'ext-1',
        status: 'COMPLETED',
        errorCode: null,
        completedAt: '2026-07-28T09:00:00.000Z',
        result: { vendorName: 'VendorCo', items: [] },
      });
    });

    it('withholds the extraction result until the job completes', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        projectId: null,
        status: 'PENDING',
        totalAmount: null,
        dueDate: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: null,
        vendor: null,
        relatedPo: null,
        lines: [],
        documents: [],
      });
      mockPrisma.docExtraction.findFirst.mockResolvedValue({
        id: 'ext-1',
        status: 'PROCESSING',
        errorCode: null,
        completedAt: null,
        editedResult: null,
      });

      const result = await service.getInvoice('inv-1', companyAdmin);

      expect(result.extraction).toEqual({
        id: 'ext-1',
        status: 'PROCESSING',
        errorCode: null,
        completedAt: null,
        result: null,
      });
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
        lines: [],
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

  describe('reviewInvoice', () => {
    const reviewDto = {
      vendorId: 'vendor-comp-1',
      projectId: 'proj-1',
      invoiceNumber: ' INV-42 ',
      issuedDate: '2026-07-01',
      dueDate: '2026-07-31',
      totalAmount: 1234.5,
      lines: [
        {
          lineId: '1',
          description: '  DN100 PVC pipe ',
          quantity: 12,
          unit: 'm',
          unitPrice: 8.5,
          lineTotal: 102,
        },
        { description: 'Delivery fee' },
      ],
    };

    const pendingInvoice = { id: 'inv-1', status: 'PENDING', companyId: 'comp-1' };

    /** Detail row for the getInvoice re-read the review returns. */
    const detailRow = {
      id: 'inv-1',
      projectId: 'proj-1',
      status: 'PENDING',
      totalAmount: 1234.5,
      dueDate: new Date('2026-07-31'),
      invoiceNumber: 'INV-42',
      issuedDate: new Date('2026-07-01'),
      reviewedAt: new Date('2026-07-28'),
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-01'),
      project: { name: 'Alpha' },
      vendor: { legalName: 'VendorCo' },
      relatedPo: null,
      lines: [],
      documents: [],
    };

    beforeEach(() => {
      mockPrisma.invoice.findUnique
        .mockResolvedValueOnce(pendingInvoice)
        .mockResolvedValue(detailRow);
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1' });
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
    });

    it('persists the reviewed fields, replaces the lines, and stamps the reviewer', async () => {
      const result = await service.reviewInvoice('inv-1', reviewDto, companyAdmin);

      const updateArg = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'inv-1' });
      expect(updateArg.data).toMatchObject({
        vendorId: 'vendor-comp-1',
        projectId: 'proj-1',
        invoiceNumber: 'INV-42',
        issuedDate: new Date('2026-07-01'),
        dueDate: new Date('2026-07-31'),
        totalAmount: 1234.5,
        reviewedByUserId: 'ca-1',
        // Review moves dueDate → the reminder ledger resets.
        dueReminderSentAt: null,
        overdueReminderSentAt: null,
      });
      expect(updateArg.data.reviewedAt).toBeInstanceOf(Date);

      expect(mockPrisma.invoiceLineItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-1' },
      });
      const created = mockPrisma.invoiceLineItem.createMany.mock.calls[0][0].data;
      expect(created).toEqual([
        {
          invoiceId: 'inv-1',
          position: 0,
          lineId: '1',
          description: 'DN100 PVC pipe',
          quantity: 12,
          unit: 'm',
          unitPrice: 8.5,
          lineTotal: 102,
        },
        {
          invoiceId: 'inv-1',
          position: 1,
          lineId: null,
          description: 'Delivery fee',
          quantity: null,
          unit: null,
          unitPrice: null,
          lineTotal: null,
        },
      ]);

      expect(result.id).toBe('inv-1');
    });

    it('marks the completed extraction Confirmed with the reviewing user', async () => {
      await service.reviewInvoice('inv-1', reviewDto, companyAdmin);

      const confirmArg = mockPrisma.docExtraction.updateMany.mock.calls[0][0];
      expect(confirmArg.where).toEqual({
        invoiceId: 'inv-1',
        type: 'INVOICE',
        status: 'COMPLETED',
      });
      expect(confirmArg.data).toMatchObject({
        status: 'CONFIRMED',
        confirmedByUserId: 'ca-1',
      });
    });

    it('clears fields the reviewer left empty', async () => {
      await service.reviewInvoice('inv-1', { lines: [] }, companyAdmin);

      const updateArg = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateArg.data).toMatchObject({
        vendorId: null,
        projectId: null,
        invoiceNumber: null,
        issuedDate: null,
        dueDate: null,
        totalAmount: null,
      });
      // No references given — nothing to validate.
      expect(mockPrisma.company.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.project.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockReset().mockResolvedValue(null);
      await expect(service.reviewInvoice('missing', reviewDto, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for the wrong company', async () => {
      mockPrisma.invoice.findUnique
        .mockReset()
        .mockResolvedValue({ id: 'inv-1', status: 'PENDING', companyId: 'other-comp' });
      await expect(service.reviewInvoice('inv-1', reviewDto, companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects reviewing a non-Pending invoice', async () => {
      mockPrisma.invoice.findUnique
        .mockReset()
        .mockResolvedValue({ id: 'inv-1', status: 'APPROVED', companyId: 'comp-1' });
      await expect(service.reviewInvoice('inv-1', reviewDto, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown or non-vendor vendorId', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);
      await expect(service.reviewInvoice('inv-1', reviewDto, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      // The vendor lookup is restricted to VENDOR companies.
      const findArg = mockPrisma.company.findFirst.mock.calls[0][0];
      expect(findArg.where).toEqual({ id: 'vendor-comp-1', type: 'VENDOR' });
    });

    it("rejects a project outside the invoice's company", async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);
      await expect(service.reviewInvoice('inv-1', reviewDto, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      const findArg = mockPrisma.project.findFirst.mock.calls[0][0];
      expect(findArg.where).toEqual({ id: 'proj-1', companyId: 'comp-1' });
    });

    it('persists the reviewer-confirmed PO link (FOR-293)', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1' });

      await service.reviewInvoice('inv-1', { ...reviewDto, relatedPoId: 'po-1' }, companyAdmin);

      // The PO must be one of the buying company's own.
      const findArg = mockPrisma.purchaseOrder.findFirst.mock.calls[0][0];
      expect(findArg.where).toEqual({ id: 'po-1', companyId: 'comp-1' });
      const updateArg = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateArg.data.relatedPoId).toBe('po-1');
    });

    it('clears the PO link when the reviewer removes it', async () => {
      await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
      const updateArg = mockPrisma.invoice.update.mock.calls[0][0];
      expect(updateArg.data.relatedPoId).toBeNull();
      expect(mockPrisma.purchaseOrder.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a PO outside the invoice's company", async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(
        service.reviewInvoice('inv-1', { ...reviewDto, relatedPoId: 'po-x' }, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows SuperAdmin to review without a company check', async () => {
      mockPrisma.invoice.findUnique
        .mockReset()
        .mockResolvedValueOnce({ id: 'inv-1', status: 'PENDING', companyId: 'any-comp' })
        .mockResolvedValue(detailRow);

      const result = await service.reviewInvoice('inv-1', reviewDto, superAdmin);
      expect(result.id).toBe('inv-1');
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

      const result = await service.rejectInvoice('inv-1', {}, companyAdmin);
      expect(result.status).toBe('REJECTED');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'REJECTED', rejectionReason: null },
        }),
      );
    });

    it('persists the rejection reason and emails it to the vendor as the user comment', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-9',
        status: 'PENDING',
        companyId: 'comp-1',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-9',
        projectId: 'proj-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        status: 'REJECTED',
        rejectionReason: 'Quantities do not match the delivery note.',
        totalAmount: 5000,
        dueDate: null,
        project: { name: 'Alpha' },
        company: { legalName: 'BuilderCo' },
        vendor: { legalName: 'VendorCo' },
        relatedPo: null,
      });
      mockPrisma.company.findUnique.mockResolvedValue({
        contactEmail: 'contact@vendor.test',
        users: [{ email: 'rep@vendor.test' }],
      });

      await service.rejectInvoice(
        'inv-9',
        { reason: 'Quantities do not match the delivery note.' },
        companyAdmin,
      );
      // The vendor notification is fire-and-forget; let the microtask queue drain.
      await new Promise((r) => setTimeout(r, 0));

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: 'REJECTED',
            rejectionReason: 'Quantities do not match the delivery note.',
          },
        }),
      );

      // Vendor users win over the company contact email.
      expect(mockEmailService.sendInvoiceRejectedEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendInvoiceRejectedEmail).toHaveBeenCalledWith(
        'rep@vendor.test',
        {
          invoiceReference: 'INV-INV9',
          companyName: 'BuilderCo',
          projectName: 'Alpha',
        },
        'http://localhost:5179/invoices/inv-9',
        expect.objectContaining({ comment: 'Quantities do not match the delivery note.' }),
      );

      expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
        ['rep@vendor.test'],
        expect.objectContaining({
          type: 'INVOICE_REJECTED',
          entityType: 'INVOICE',
          entityId: 'inv-9',
        }),
      );
    });

    it('does not fail the rejection when the vendor notification throws', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-10',
        status: 'PENDING',
        companyId: 'comp-1',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv-10',
        projectId: 'proj-1',
        companyId: 'comp-1',
        vendorId: 'vendor-comp-1',
        status: 'REJECTED',
        rejectionReason: null,
        totalAmount: 100,
        dueDate: null,
        project: { name: 'Alpha' },
        company: { legalName: 'BuilderCo' },
        vendor: { legalName: 'VendorCo' },
        relatedPo: null,
      });
      mockPrisma.company.findUnique.mockRejectedValue(new Error('db down'));

      const result = await service.rejectInvoice('inv-10', {}, companyAdmin);
      await new Promise((r) => setTimeout(r, 0));
      expect(result.status).toBe('REJECTED');
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

      const result = await service.rejectInvoice('inv-2', {}, companyAdmin);
      expect(result.status).toBe('REJECTED');
      expect(result.relatedPo).toBe('po-5');
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.rejectInvoice('missing', {}, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for wrong company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'other-comp',
      });
      await expect(service.rejectInvoice('inv-1', {}, financialOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for APPROVED status', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'APPROVED',
        companyId: 'comp-1',
      });
      await expect(service.rejectInvoice('inv-1', {}, companyAdmin)).rejects.toThrow(
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

      const result = await service.rejectInvoice('inv-1', {}, superAdmin);
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
