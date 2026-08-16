import { InvoiceListQueryDto } from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

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
  auditLog: {
    findMany: jest.fn(),
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
  // FOR-307 approval routing: the Pool ask, and the empty-Pool fallback.
  sendInvoicePendingApprovalEmail: jest.fn().mockResolvedValue(undefined),
  sendInvoiceApprovalUnroutableEmail: jest.fn().mockResolvedValue(undefined),
};

const mockNotifications = {
  createForEmails: jest.fn().mockResolvedValue(undefined),
  createForUsers: jest.fn().mockResolvedValue(undefined),
};

const mockBranding = {
  getEmailBrand: jest.fn().mockResolvedValue(undefined),
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = { get: jest.fn(() => 'http://localhost:5179') };

const mockApprovalAuth = {
  evaluate: jest.fn(),
  resolveApproverPool: jest.fn(),
  findCompanyAdminRecipients: jest.fn(),
};

/**
 * Approver Pool + Nomination (FOR-307/309). `resolveNotificationTargets`
 * defaults to "the whole pool" so a review that nominates nobody reproduces the
 * plain broadcast.
 */
const mockApprovals = {
  assertNomineesInPool: jest.fn(),
  recordNominationsAtSubmit: jest.fn(),
  resolveNotificationTargets: jest.fn(),
  addNominations: jest.fn(),
};

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailService.sendInvoiceRejectedEmail.mockResolvedValue(undefined);
    mockEmailService.sendInvoicePendingApprovalEmail.mockResolvedValue(undefined);
    mockEmailService.sendInvoiceApprovalUnroutableEmail.mockResolvedValue(undefined);
    mockNotifications.createForUsers.mockResolvedValue(undefined);
    mockNotifications.createForEmails.mockResolvedValue(undefined);
    mockBranding.getEmailBrand.mockResolvedValue(undefined);
    mockConfig.get.mockReturnValue('http://localhost:5179');
    // No vendor company by default — the rejection notification simply no-ops.
    mockPrisma.company.findUnique.mockResolvedValue(null);
    // No extraction by default (pre-FOR-291 invoices).
    mockPrisma.docExtraction.findFirst.mockResolvedValue(null);
    // The review transaction just resolves; each op is asserted individually.
    mockPrisma.$transaction.mockResolvedValue([]);
    mockAudit.log.mockResolvedValue(undefined);
    // Default: the approver's cap is unlimited (null threshold), so existing
    // approval tests behave exactly as they did before FOR-303.
    mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
    mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);
    mockApprovalAuth.findCompanyAdminRecipients.mockResolvedValue([]);
    mockApprovals.assertNomineesInPool.mockResolvedValue(undefined);
    mockApprovals.recordNominationsAtSubmit.mockResolvedValue([]);
    mockApprovals.resolveNotificationTargets.mockImplementation(
      (_type: unknown, _id: string, pool: unknown[]) => Promise.resolve(pool),
    );
    service = new InvoicesService(
      mockPrisma as never,
      mockStorageService as never,
      mockEmailService as never,
      mockNotifications as never,
      mockBranding as never,
      mockAudit as never,
      mockApprovalAuth as never,
      mockApprovals as never,
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
            costCode: '03-100',
            glAccount: null,
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
      expect(result.lines[0]).toMatchObject({
        description: 'DN100 PVC pipe',
        quantity: 12,
        costCode: '03-100',
        glAccount: null,
      });
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
          // Buyer-side accounting coding (FOR-295), whitespace-trimmed on save.
          costCode: ' 03-100 ',
          glAccount: '5010',
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
          costCode: '03-100',
          glAccount: '5010',
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
          costCode: null,
          glAccount: null,
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

    // ── FOR-307: review completion is the invoice's "submit for approval" ────
    describe('approval routing at review completion (FOR-307)', () => {
      const approver = {
        id: 'appr-1',
        name: 'Ama Boateng',
        email: 'ama@test.com',
        role: UserRole.COMPANY_ADMIN,
        customRoleName: null,
      };

      /** Push the reviewed total over the reviewer's own invoice.approve cap. */
      const overCap = () =>
        mockApprovalAuth.evaluate.mockResolvedValue({
          outcome: 'belowThreshold',
          threshold: new Prisma.Decimal(1000),
        });

      it('routes to the Approver Pool when the reviewed total is over the reviewer’s cap', async () => {
        overCap();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([approver]);

        await service.reviewInvoice('inv-1', reviewDto, companyAdmin);

        // Measured against the REVIEWER's cap: an invoice arrives rather than
        // being raised, so the reviewer stands in for the PO's creator.
        expect(mockApprovalAuth.evaluate).toHaveBeenCalledWith(
          companyAdmin,
          'invoice.approve',
          1234.5,
        );
        expect(mockPrisma.invoice.update.mock.calls[0][0].data.approvalStatus).toBe('PENDING');
      });

      it('leaves the invoice unrouted when the reviewer could approve it themselves', async () => {
        // Default mock: outcome 'allowed'.
        await service.reviewInvoice('inv-1', reviewDto, companyAdmin);

        expect(mockPrisma.invoice.update.mock.calls[0][0].data.approvalStatus).toBe('NOT_REQUIRED');
        expect(mockApprovalAuth.resolveApproverPool).not.toHaveBeenCalled();
        expect(mockEmailService.sendInvoicePendingApprovalEmail).not.toHaveBeenCalled();
      });

      it('never adds a PENDING_APPROVAL document status — the two axes stay separate', async () => {
        overCap();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([approver]);

        await service.reviewInvoice('inv-1', reviewDto, companyAdmin);

        // ADR-0006 keeps approval state off InvoiceStatus; collapsing them would
        // make the Pool logic entity-specific instead of shared with the PO.
        expect(mockPrisma.invoice.update.mock.calls[0][0].data.status).toBeUndefined();
      });

      it('re-evaluates on a second review rather than keeping a stale status', async () => {
        overCap();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([approver]);
        await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
        expect(mockPrisma.invoice.update.mock.calls[0][0].data.approvalStatus).toBe('PENDING');

        // Reviewer corrects the total down to within their cap.
        jest.clearAllMocks();
        mockPrisma.invoice.findUnique
          .mockResolvedValueOnce(pendingInvoice)
          .mockResolvedValue(detailRow);
        mockPrisma.company.findFirst.mockResolvedValue({ id: 'vendor-comp-1' });
        mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
        mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });

        await service.reviewInvoice('inv-1', { ...reviewDto, totalAmount: 10 }, companyAdmin);

        expect(mockPrisma.invoice.update.mock.calls[0][0].data.approvalStatus).toBe('NOT_REQUIRED');
      });

      it('clears any previous approver, since a re-review reopens the question', async () => {
        await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
        expect(mockPrisma.invoice.update.mock.calls[0][0].data.approvedById).toBeNull();
      });

      it('treats SUPER_ADMIN as unlimited, matching the PO issue path', async () => {
        mockPrisma.invoice.findUnique
          .mockReset()
          .mockResolvedValueOnce({ id: 'inv-1', status: 'PENDING', companyId: 'comp-1' })
          .mockResolvedValue(detailRow);

        await service.reviewInvoice('inv-1', reviewDto, superAdmin);

        expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.update.mock.calls[0][0].data.approvalStatus).toBe('NOT_REQUIRED');
      });

      it('emails the whole Approver Pool when nobody was nominated', async () => {
        overCap();
        mockApprovalAuth.resolveApproverPool.mockResolvedValue([approver]);

        await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
        await new Promise((r) => setTimeout(r, 10));

        expect(mockEmailService.sendInvoicePendingApprovalEmail).toHaveBeenCalledWith(
          'ama@test.com',
          expect.stringMatching(/^INV-/),
          '$1,234.50',
          'http://localhost:5179/invoices/inv-1',
          expect.objectContaining({ companyId: 'comp-1', invoiceId: 'inv-1' }),
          undefined,
        );
        expect(mockNotifications.createForEmails).toHaveBeenCalledWith(
          ['ama@test.com'],
          expect.objectContaining({ type: 'INVOICE_PENDING_APPROVAL' }),
        );
      });

      describe('nomination (FOR-309)', () => {
        const kojo = { ...approver, id: 'appr-2', name: 'Kojo Owusu', email: 'kojo@test.com' };

        it('records the nomination and narrows the fan-out', async () => {
          overCap();
          mockApprovalAuth.resolveApproverPool.mockResolvedValue([approver, kojo]);
          mockApprovals.resolveNotificationTargets.mockResolvedValue([approver]);

          await service.reviewInvoice(
            'inv-1',
            { ...reviewDto, nomineeIds: ['appr-1'] },
            companyAdmin,
          );
          await new Promise((r) => setTimeout(r, 10));

          expect(mockApprovals.recordNominationsAtSubmit).toHaveBeenCalledWith(
            'INVOICE',
            'inv-1',
            'comp-1',
            [approver, kojo],
            ['appr-1'],
            'ca-1',
          );
          expect(mockEmailService.sendInvoicePendingApprovalEmail).toHaveBeenCalledTimes(1);
        });

        it('vets the nominees before writing the review', async () => {
          overCap();
          mockApprovalAuth.resolveApproverPool.mockResolvedValue([approver]);
          mockApprovals.assertNomineesInPool.mockRejectedValue(
            new BadRequestException('outside pool'),
          );

          await expect(
            service.reviewInvoice(
              'inv-1',
              { ...reviewDto, nomineeIds: ['stranger'] },
              companyAdmin,
            ),
          ).rejects.toThrow(BadRequestException);

          // A bad id must not leave a half-applied review behind.
          expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('ignores nominees when the total is within the reviewer’s cap', async () => {
          await service.reviewInvoice(
            'inv-1',
            { ...reviewDto, nomineeIds: ['appr-1'] },
            companyAdmin,
          );

          // There is no approval to route, so there is nobody to notify.
          expect(mockApprovals.assertNomineesInPool).not.toHaveBeenCalled();
          expect(mockApprovals.recordNominationsAtSubmit).not.toHaveBeenCalled();
        });
      });

      describe('empty Approver Pool (FOR-302 parity)', () => {
        const admin = {
          id: 'admin-1',
          name: 'Efua Sarpong',
          email: 'admin@test.com',
          role: UserRole.COMPANY_ADMIN,
          customRoleName: null,
        };

        it('tells the Company Admins nobody can approve it', async () => {
          overCap();
          mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);
          mockApprovalAuth.findCompanyAdminRecipients.mockResolvedValue([admin]);

          await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
          await new Promise((r) => setTimeout(r, 10));

          expect(mockEmailService.sendInvoiceApprovalUnroutableEmail).toHaveBeenCalledWith(
            'admin@test.com',
            expect.stringMatching(/^INV-/),
            '$1,234.50',
            'http://localhost:5179/invoices/inv-1',
            expect.objectContaining({ companyId: 'comp-1', invoiceId: 'inv-1' }),
            undefined,
          );
          // Never the ordinary "needs your approval" mail — they cannot approve it.
          expect(mockEmailService.sendInvoicePendingApprovalEmail).not.toHaveBeenCalled();
        });

        it('signals the reviewer so completing a review is not a silent dead end', async () => {
          overCap();
          mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);
          mockApprovalAuth.findCompanyAdminRecipients.mockResolvedValue([admin]);

          await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
          await new Promise((r) => setTimeout(r, 10));

          expect(mockNotifications.createForUsers).toHaveBeenCalledWith(
            expect.objectContaining({
              userIds: ['ca-1'],
              type: 'INVOICE_APPROVAL_UNROUTABLE',
              entityId: 'inv-1',
            }),
          );
        });

        it('never grants the Company Admins approval authority', async () => {
          overCap();
          mockApprovalAuth.resolveApproverPool.mockResolvedValue([]);
          mockApprovalAuth.findCompanyAdminRecipients.mockResolvedValue([admin]);

          await service.reviewInvoice('inv-1', reviewDto, companyAdmin);
          await new Promise((r) => setTimeout(r, 10));

          // Resolved as recipients, never folded into the Pool — their own cap
          // still decides what they may approve.
          await expect(mockApprovalAuth.resolveApproverPool.mock.results[0].value).resolves.toEqual(
            [],
          );
        });
      });

      afterEach(() => {
        mockPrisma.invoice.findUnique.mockReset();
        mockEmailService.sendInvoicePendingApprovalEmail.mockClear();
        mockEmailService.sendInvoiceApprovalUnroutableEmail.mockClear();
      });
    });
  });

  // ── FOR-309: nominate further invoice approvers after review ──────────────
  describe('nominateApprovers (invoice)', () => {
    const yaw = {
      id: 'appr-3',
      name: 'Yaw Mensah',
      email: 'yaw@test.com',
      role: UserRole.COMPANY_ADMIN,
      customRoleName: null,
    };
    const poolView = { entityId: 'inv-1', members: [], nominations: [] };

    beforeEach(() => {
      mockPrisma.invoice.findUnique.mockReset().mockResolvedValue({
        id: 'inv-1',
        companyId: 'comp-1',
        totalAmount: 1234.5,
      });
    });

    it('emails only the newly nominated member', async () => {
      mockApprovals.addNominations.mockResolvedValue({ view: poolView, notify: [yaw] });

      const result = await service.nominateApprovers('inv-1', ['appr-3'], companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockEmailService.sendInvoicePendingApprovalEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendInvoicePendingApprovalEmail).toHaveBeenCalledWith(
        'yaw@test.com',
        expect.stringMatching(/^INV-/),
        '$1,234.50',
        'http://localhost:5179/invoices/inv-1',
        expect.objectContaining({ companyId: 'comp-1', invoiceId: 'inv-1' }),
        undefined,
      );
      expect(result).toBe(poolView);
    });

    it('sends nothing when the nominee was already asked', async () => {
      mockApprovals.addNominations.mockResolvedValue({ view: poolView, notify: [] });

      await service.nominateApprovers('inv-1', ['appr-3'], companyAdmin);
      await new Promise((r) => setTimeout(r, 10));

      // Re-nominating is a no-op, not a second email.
      expect(mockEmailService.sendInvoicePendingApprovalEmail).not.toHaveBeenCalled();
    });

    afterEach(() => mockPrisma.invoice.findUnique.mockReset());
  });

  // ── FOR-303: invoice.approve's configured cap is enforced on approve ───────
  describe('approveInvoice threshold enforcement (FOR-303)', () => {
    const reviewedInvoice = (totalAmount: Prisma.Decimal) => ({
      id: 'inv-1',
      status: 'PENDING',
      companyId: 'comp-1',
      projectId: 'proj-1',
      vendorId: 'vend-1',
      totalAmount,
    });

    const approvedRow = {
      id: 'inv-1',
      projectId: 'proj-1',
      status: 'APPROVED',
      totalAmount: 12_500,
      dueDate: null,
      project: { name: 'Alpha' },
      vendor: { legalName: 'VendorCo' },
      relatedPo: null,
    };

    it('approves when the total is within the caller cap', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'allowed',
        threshold: new Prisma.Decimal(25_000),
      });
      mockPrisma.invoice.findUnique.mockResolvedValue(reviewedInvoice(new Prisma.Decimal(12_500)));
      mockPrisma.invoice.update.mockResolvedValue(approvedRow);

      await expect(service.approveInvoice('inv-1', {}, companyAdmin)).resolves.toMatchObject({
        status: 'APPROVED',
      });
      expect(mockApprovalAuth.evaluate).toHaveBeenCalledWith(
        companyAdmin,
        'invoice.approve',
        new Prisma.Decimal(12_500),
      );
    });

    it('rejects when the total exceeds the caller cap, naming both figures', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'belowThreshold',
        threshold: new Prisma.Decimal(25_000),
      });
      mockPrisma.invoice.findUnique.mockResolvedValue(reviewedInvoice(new Prisma.Decimal(90_000)));

      await expect(service.approveInvoice('inv-1', {}, companyAdmin)).rejects.toThrow(
        /90000.*25000/,
      );
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });

    it('rejects when the caller does not hold invoice.approve at all', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'notGranted' });
      mockPrisma.invoice.findUnique.mockResolvedValue(reviewedInvoice(new Prisma.Decimal(100)));

      await expect(service.approveInvoice('inv-1', {}, companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });

    it('approves any amount when the cap is null (unlimited)', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.invoice.findUnique.mockResolvedValue(
        reviewedInvoice(new Prisma.Decimal(5_000_000)),
      );
      mockPrisma.invoice.update.mockResolvedValue(approvedRow);

      await expect(service.approveInvoice('inv-1', {}, companyAdmin)).resolves.toMatchObject({
        status: 'APPROVED',
      });
    });

    it('lets SUPER_ADMIN approve past any cap without an evaluate call (break-glass)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(
        reviewedInvoice(new Prisma.Decimal(5_000_000)),
      );
      mockPrisma.invoice.update.mockResolvedValue(approvedRow);

      await expect(service.approveInvoice('inv-1', {}, superAdmin)).resolves.toMatchObject({
        status: 'APPROVED',
      });
      expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
      // The acting user is still recorded for audit.
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ performedById: superAdmin.id, action: 'INVOICE_APPROVED' }),
      );
    });

    it('resolves the cap through evaluate so custom-role-first applies (FOR-253)', async () => {
      const customRoleUser = { ...companyAdmin, customRoleId: 'cr-junior' };
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'belowThreshold',
        threshold: new Prisma.Decimal(5_000),
      });
      mockPrisma.invoice.findUnique.mockResolvedValue(reviewedInvoice(new Prisma.Decimal(12_500)));

      await expect(service.approveInvoice('inv-1', {}, customRoleUser)).rejects.toThrow(
        ForbiddenException,
      );
      // Custom-role resolution lives in evaluate — never reimplemented here.
      expect(mockApprovalAuth.evaluate).toHaveBeenCalledWith(
        customRoleUser,
        'invoice.approve',
        new Prisma.Decimal(12_500),
      );
    });

    it('reports "not reviewed" before the cap check on an unreviewed invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'comp-1',
        projectId: null,
        vendorId: null,
        totalAmount: null,
      });

      await expect(service.approveInvoice('inv-1', {}, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
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

      const result = await service.approveInvoice('inv-1', {}, companyAdmin);
      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          // FOR-307: the approval axis resolves alongside the document status,
          // and records who did it — ADR-0006's audit wants a person.
          data: { status: 'APPROVED', approvalStatus: 'APPROVED', approvedById: 'ca-1' },
        }),
      );
      // FOR-294 — the transition lands on the audit trail without a reason.
      expect(mockAudit.log).toHaveBeenCalledWith({
        action: 'INVOICE_APPROVED',
        performedById: companyAdmin.id,
        targetType: 'Invoice',
        targetId: 'inv-1',
        metadata: { from: 'PENDING', to: 'APPROVED' },
      });
    });

    it('records the approval note on the audit trail (FOR-294)', async () => {
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

      await service.approveInvoice(
        'inv-1',
        { reason: '  Verified against the PO.  ' },
        companyAdmin,
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVOICE_APPROVED',
          metadata: { from: 'PENDING', to: 'APPROVED', reason: 'Verified against the PO.' },
        }),
      );
    });

    it('does not fail the approval when the audit write throws', async () => {
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
      mockAudit.log.mockRejectedValue(new Error('audit down'));

      const result = await service.approveInvoice('inv-1', {}, companyAdmin);
      expect(result.status).toBe('APPROVED');
    });

    it('throws NotFoundException for missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.approveInvoice('missing', {}, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for non-Pending invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'APPROVED',
        companyId: 'comp-1',
      });
      await expect(service.approveInvoice('inv-1', {}, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException for wrong company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        companyId: 'other-comp',
      });
      await expect(service.approveInvoice('inv-1', {}, financialOfficer)).rejects.toThrow(
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

      const result = await service.approveInvoice('inv-1', {}, superAdmin);
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
          data: {
            status: 'REJECTED',
            rejectionReason: null,
            approvalStatus: 'REJECTED',
            approvedById: 'ca-1',
          },
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
            approvalStatus: 'REJECTED',
            approvedById: 'ca-1',
          },
        }),
      );

      // FOR-294 — the rejection and its reason land on the audit trail.
      expect(mockAudit.log).toHaveBeenCalledWith({
        action: 'INVOICE_REJECTED',
        performedById: companyAdmin.id,
        targetType: 'Invoice',
        targetId: 'inv-9',
        metadata: {
          from: 'PENDING',
          to: 'REJECTED',
          reason: 'Quantities do not match the delivery note.',
        },
      });

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
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1' },
        { id: 'inv-2' },
        { id: 'inv-3' },
      ]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkApproveInvoices(['inv-1', 'inv-2', 'inv-3'], companyAdmin);
      expect(result.approvedCount).toBe(3);
      expect(result.requestedCount).toBe(3);
    });

    it('records each approval on the audit trail (FOR-294)', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 2 });

      await service.bulkApproveInvoices(['inv-1', 'inv-2', 'inv-3'], companyAdmin);
      expect(mockAudit.log).toHaveBeenCalledTimes(2);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVOICE_APPROVED',
          performedById: companyAdmin.id,
          targetType: 'Invoice',
          targetId: 'inv-2',
          metadata: { from: 'PENDING', to: 'APPROVED' },
        }),
      );
    });

    it('throws BadRequestException for empty array', async () => {
      await expect(service.bulkApproveInvoices([], companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    // ── FOR-303: the single-approve cap applies per invoice here too ─────────
    it('skips invoices over the caller cap and reports how many were skipped', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'allowed',
        threshold: new Prisma.Decimal(25_000),
      });
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-under', totalAmount: new Prisma.Decimal(10_000) },
        { id: 'inv-over', totalAmount: new Prisma.Decimal(90_000) },
        { id: 'inv-equal', totalAmount: new Prisma.Decimal(25_000) },
      ]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkApproveInvoices(
        ['inv-under', 'inv-over', 'inv-equal'],
        companyAdmin,
      );

      expect(result.skippedOverLimitCount).toBe(1);
      expect(result.approvedCount).toBe(2);
      expect(result.requestedCount).toBe(3);
      // The over-cap row is excluded from the write, not merely uncounted.
      expect(mockPrisma.invoice.updateMany.mock.calls[0][0].where.id).toEqual({
        in: ['inv-under', 'inv-equal'],
      });
    });

    it('does not audit an invoice that was skipped for being over the cap', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({
        outcome: 'allowed',
        threshold: new Prisma.Decimal(25_000),
      });
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-under', totalAmount: new Prisma.Decimal(10_000) },
        { id: 'inv-over', totalAmount: new Prisma.Decimal(90_000) },
      ]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkApproveInvoices(['inv-under', 'inv-over'], companyAdmin);

      expect(mockAudit.log).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: 'inv-under' }),
      );
    });

    it('approves every selected invoice when the cap is unlimited', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'allowed', threshold: null });
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: new Prisma.Decimal(5_000_000) },
      ]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkApproveInvoices(['inv-1'], companyAdmin);

      expect(result.skippedOverLimitCount).toBe(0);
      expect(result.approvedCount).toBe(1);
    });

    it('never applies a cap to SUPER_ADMIN (break-glass)', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: new Prisma.Decimal(5_000_000) },
      ]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkApproveInvoices(['inv-1'], superAdmin);

      expect(result.approvedCount).toBe(1);
      expect(result.skippedOverLimitCount).toBe(0);
      expect(mockApprovalAuth.evaluate).not.toHaveBeenCalled();
    });

    it('refuses the whole run when the caller does not hold invoice.approve', async () => {
      mockApprovalAuth.evaluate.mockResolvedValue({ outcome: 'notGranted' });
      mockPrisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', totalAmount: new Prisma.Decimal(100) },
      ]);

      await expect(service.bulkApproveInvoices(['inv-1'], companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it('scopes by company for non-SuperAdmin', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkApproveInvoices(['inv-1'], companyAdmin);
      const where = mockPrisma.invoice.updateMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('does not scope by company for SuperAdmin', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkApproveInvoices(['inv-1'], superAdmin);
      const where = mockPrisma.invoice.updateMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('companyId');
    });
  });

  // ── FOR-294: invoice audit trail ──────────────────────────────────────────
  describe('getAuditTrail', () => {
    const invoiceRow = { id: 'inv-1', companyId: 'comp-1', vendorId: 'vendor-comp-1' };
    const logRow = {
      id: 'log-1',
      action: 'INVOICE_REJECTED',
      metadata: { from: 'PENDING', to: 'REJECTED', reason: 'Wrong amount' },
      performedBy: { id: 'ca-1', name: 'Casey Admin', email: 'ca@test.com' },
      performedByLabel: null,
      createdAt: new Date('2026-07-28T10:00:00.000Z'),
    };

    it('returns mapped entries, oldest first, for the owning company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow);
      mockPrisma.auditLog.findMany.mockResolvedValue([logRow]);

      const result = await service.getAuditTrail('inv-1', companyAdmin);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'Invoice', targetId: 'inv-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(result).toEqual([
        {
          id: 'log-1',
          action: 'INVOICE_REJECTED',
          metadata: { from: 'PENDING', to: 'REJECTED', reason: 'Wrong amount' },
          performedBy: { id: 'ca-1', name: 'Casey Admin', email: 'ca@test.com' },
          createdAt: '2026-07-28T10:00:00.000Z',
        },
      ]);
    });

    it('allows the billed vendor company to read the trail', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(invoiceRow);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await expect(service.getAuditTrail('inv-1', vendor)).resolves.toEqual([]);
    });

    it('throws NotFoundException for a missing invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.getAuditTrail('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for an unrelated company', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        companyId: 'other-comp',
        vendorId: null,
      });
      await expect(service.getAuditTrail('inv-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
