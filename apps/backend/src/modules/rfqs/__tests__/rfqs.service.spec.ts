import { RfqListQueryDto, VendorRfqStatus } from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  QuoteLineItemAvailability,
  QuoteResponseStatus,
  RfqStatus,
  UserRole,
} from '@prisma/client';

import { RfqsService } from '../rfqs.service';

/** Build a query object that satisfies the DTO (including computed skip/take). */
function q(overrides: Partial<RfqListQueryDto> = {}): RfqListQueryDto {
  const dto = Object.assign(new RfqListQueryDto(), overrides);
  return dto;
}

// ── Mock users ──────────────────────────────────────────────────────────────

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const procOfficer = {
  id: 'po-1',
  email: 'po@test.com',
  role: UserRole.PROCUREMENT_OFFICER,
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

const otherCompanyUser = {
  id: 'other-1',
  email: 'other@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-2',
};

// ── Mock StorageService ─────────────────────────────────────────────────────

const mockStorageService = {
  upload: jest.fn(),
  delete: jest.fn(),
  getObject: jest.fn(),
};

const mockEmailService = {
  sendTemplateEmail: jest.fn(),
  sendRfqReceivedEmail: jest.fn(),
  sendQuoteUpdatedEmail: jest.fn(),
};

const mockAccessTokens = {
  issueToken: jest.fn(),
};

const mockConfig = {
  get: jest.fn((_key: string, fallback: string) => fallback),
};

// ── Mock PrismaService ──────────────────────────────────────────────────────

const mockPrisma = {
  rfq: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  quoteResponse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  quoteAudit: {
    create: jest.fn(),
  },
  purchaseOrder: {
    create: jest.fn(),
    count: jest.fn(),
  },
  rfqLineItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  rfqDocument: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn(),
  },
  rfqVendor: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  rfqProject: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  file: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
  projectLocation: {
    findUnique: jest.fn(),
  },
  material: {
    findMany: jest.fn(),
  },
  company: {
    findMany: jest.fn(),
  },
  companyVendorAssignment: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('RfqsService', () => {
  let service: RfqsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RfqsService(
      mockPrisma as never,
      mockStorageService as never,
      mockEmailService as never,
      mockAccessTokens as never,
      mockConfig as never,
    );
    mockAccessTokens.issueToken.mockResolvedValue({
      token: 'issued-token-xyz',
      record: { id: 'tok-1' },
    });
  });

  // ── listRfqs ────────────────────────────────────────────────────────────

  describe('listRfqs', () => {
    beforeEach(() => {
      mockPrisma.rfq.findMany.mockResolvedValue([]);
      mockPrisma.rfq.count.mockResolvedValue(0);
    });

    it('scopes CompanyAdmin to company RFQs', async () => {
      await service.listRfqs(q(), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('scopes ProcurementOfficer to company RFQs', async () => {
      await service.listRfqs(q(), procOfficer);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('scopes Vendor to RFQs via include quoteResponses filter', async () => {
      await service.listRfqs(q(), vendor);
      const include = mockPrisma.rfq.findMany.mock.calls[0][0].include;
      expect(include.quoteResponses).toBeDefined();
      expect(include.quoteResponses.where.vendor.users.some.id).toBe('v-1');
    });

    it('SuperAdmin sees all RFQs (no companyId filter)', async () => {
      await service.listRfqs(q(), superAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('companyId');
    });

    it('applies status filter', async () => {
      await service.listRfqs(q({ status: 'OPEN' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('OPEN');
    });

    it('applies search filter', async () => {
      await service.listRfqs(q({ search: 'Alpha' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('applies quick filter myRfqs', async () => {
      await service.listRfqs(q({ quickFilter: 'myRfqs' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.createdByUserId).toBe('ca-1');
    });

    it('applies quick filter openRfqs', async () => {
      await service.listRfqs(q({ quickFilter: 'openRfqs' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('OPEN');
    });

    it('applies quick filter noQuotes', async () => {
      await service.listRfqs(q({ quickFilter: 'noQuotes' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.quoteResponses).toEqual({ none: {} });
    });

    it('applies projectId filter', async () => {
      await service.listRfqs(q({ projectId: 'proj-1' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.projectId).toBe('proj-1');
    });

    it('returns paginated response with meta', async () => {
      mockPrisma.rfq.count.mockResolvedValue(50);
      const result = await service.listRfqs(q({ page: 2, limit: 10 }), companyAdmin);
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 50, totalPages: 5 });
      expect(mockPrisma.rfq.findMany.mock.calls[0][0].skip).toBe(10);
      expect(mockPrisma.rfq.findMany.mock.calls[0][0].take).toBe(10);
    });

    it('caps limit at 100', async () => {
      await service.listRfqs(q({ limit: 200 }), companyAdmin);
      expect(mockPrisma.rfq.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('defaults to page 1 and limit 25', async () => {
      await service.listRfqs(q(), companyAdmin);
      expect(mockPrisma.rfq.findMany.mock.calls[0][0].skip).toBe(0);
      expect(mockPrisma.rfq.findMany.mock.calls[0][0].take).toBe(25);
    });

    it('maps RFQ items with computed fields', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-1',
          projectId: 'proj-1',
          status: 'OPEN',
          totalRequestedQty: 100,
          pickUpLocation: null,
          deliveryLocationId: '123 St',
          deadlineStart: new Date('2026-04-01'),
          deadlineEnd: new Date('2026-04-15'),
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 3, quoteResponses: 2, invitedVendors: 4 },
          quoteResponses: [
            {
              vendorId: 'v1',
              status: 'APPROVED',
              totalCost: 1000,
              lineItems: [{ status: 'APPROVED' }, { status: 'APPROVED' }, { status: 'DECLINED' }],
            },
            {
              vendorId: 'v2',
              status: 'SUBMITTED',
              totalCost: 3000,
              lineItems: [{ status: 'APPROVED' }, { status: 'PENDING' }],
            },
          ],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), companyAdmin);
      const item = result.items[0];
      expect(item.id).toBe('rfq-1');
      expect(item.projectName).toBe('Alpha');
      expect(item.lineItems).toBe(3);
      expect(item.recQuotes).toBe(2);
      expect(item.recVendors).toBe(2);
      expect(item.deadlineRange).toBe('2026-04-01 - 2026-04-15');
      expect(item.pickUp).toBe(false);
      // US 2.06 dashboard metrics
      expect(item.invitedVendors).toBe(4);
      expect(item.applVendors).toBe(1); // only v1 is APPROVED
      expect(item.approvedItems).toBe(3); // v1: 2 + v2: 1
      expect(item.declinedItems).toBe(1); // v1: 1
      expect(item.avgQuoteCost).toBe(2000); // (1000 + 3000) / 2 received quotes
    });

    it('returns avgQuoteCost null and zero metrics when no quotes received', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-2',
          projectId: 'proj-1',
          status: 'DRAFT',
          totalRequestedQty: 10,
          pickUpLocation: null,
          deliveryLocationId: null,
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Beta' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 2, quoteResponses: 0, invitedVendors: 0 },
          quoteResponses: [],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const item = (await service.listRfqs(q(), companyAdmin)).items[0];
      expect(item.applVendors).toBe(0);
      expect(item.approvedItems).toBe(0);
      expect(item.declinedItems).toBe(0);
      expect(item.avgQuoteCost).toBeNull();
    });

    it('sorts by project name when specified', async () => {
      await service.listRfqs(q({ sortBy: 'projectName', sortDir: 'asc' }), companyAdmin);
      const orderBy = mockPrisma.rfq.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.project).toEqual({ name: 'asc' });
    });

    // ── Quick filters: awaitingResponses, awardedRfqs, closedRfqs, approvedForMe, incoming ──

    it('applies quick filter awaitingResponses', async () => {
      await service.listRfqs(q({ quickFilter: 'awaitingResponses' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(RfqStatus.AWAITING_RESPONSE);
    });

    it('applies quick filter awardedRfqs', async () => {
      await service.listRfqs(q({ quickFilter: 'awardedRfqs' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(RfqStatus.AWARDED);
    });

    it('applies quick filter closedRfqs', async () => {
      await service.listRfqs(q({ quickFilter: 'closedRfqs' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(RfqStatus.CLOSED);
    });

    it('applies quick filter approvedForMe', async () => {
      await service.listRfqs(q({ quickFilter: 'approvedForMe' as never }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.quoteResponses).toEqual({
        some: {
          status: QuoteResponseStatus.APPROVED,
          vendor: { users: { some: { id: 'v-1' } } },
        },
      });
    });

    it('applies quick filter incoming (alias for OpenRfqs)', async () => {
      await service.listRfqs(q({ quickFilter: 'incoming' as never }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(RfqStatus.OPEN);
    });

    it('myRfqs quick filter does not set createdByUserId for vendors', async () => {
      await service.listRfqs(q({ quickFilter: 'myRfqs' as never }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.createdByUserId).toBeUndefined();
    });

    // ── Vendor status filter branches ──

    it('applies vendor status filter INCOMING', async () => {
      await service.listRfqs(q({ status: VendorRfqStatus.INCOMING }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE] });
      expect(where.quoteResponses.some.status).toBe(QuoteResponseStatus.PENDING);
    });

    it('applies vendor status filter RESPONDED', async () => {
      await service.listRfqs(q({ status: VendorRfqStatus.RESPONDED }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.quoteResponses.some.status).toBe(QuoteResponseStatus.SUBMITTED);
    });

    it('applies vendor status filter APPROVED', async () => {
      await service.listRfqs(q({ status: VendorRfqStatus.APPROVED }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.quoteResponses.some.status).toBe(QuoteResponseStatus.APPROVED);
    });

    it('applies vendor status filter REJECTED', async () => {
      await service.listRfqs(q({ status: VendorRfqStatus.REJECTED }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
      expect(where.OR[0].status).toBe(RfqStatus.CANCELLED);
      expect(where.OR[1].quoteResponses.some.status).toBe(QuoteResponseStatus.DECLINED);
    });

    it('applies vendor status filter CLOSED', async () => {
      await service.listRfqs(q({ status: VendorRfqStatus.CLOSED }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(RfqStatus.CLOSED);
    });

    it('handles unknown vendor status via default fallback', async () => {
      await service.listRfqs(q({ status: 'UNKNOWN_STATUS' as VendorRfqStatus }), vendor);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      // Unknown status not in VENDOR_STATUS_TO_RFQ → no status filter applied
      expect(where.status).toBeUndefined();
    });

    // ── Sort options ──

    it.each([
      ['id', { id: 'asc' }],
      ['status', { status: 'asc' }],
      ['totalRequestedQty', { totalRequestedQty: 'asc' }],
      ['deadlineRange', { deadlineStart: 'asc' }],
      ['deadlineStart', { deadlineStart: 'asc' }],
      ['deliveryLocationId', { deliveryLocationId: 'asc' }],
      ['pickUpLocation', { pickUpLocation: 'asc' }],
      ['pickUp', { pickUpDate: 'asc' }],
      ['createdBy', { createdBy: { name: 'asc' } }],
      ['approvalStatus', { approvalStatus: 'asc' }],
      ['approvedBy', { approvedBy: { name: 'asc' } }],
      ['projectId', { projectId: 'asc' }],
    ])('sorts by %s', async (sortBy, expectedOrderBy) => {
      await service.listRfqs(q({ sortBy, sortDir: 'asc' }), companyAdmin);
      const orderBy = mockPrisma.rfq.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual(expectedOrderBy);
    });

    it('defaults sort to createdAt desc', async () => {
      await service.listRfqs(q(), companyAdmin);
      const orderBy = mockPrisma.rfq.findMany.mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ createdAt: 'desc' });
    });

    // ── Additional filter branches ──

    it('applies deliveryLocation filter', async () => {
      await service.listRfqs(q({ deliveryLocation: 'Main St' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.deliveryLocationId).toBe('Main St');
    });

    it('applies createdByUserId filter', async () => {
      await service.listRfqs(q({ createdByUserId: 'po-1' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.createdByUserId).toBe('po-1');
    });

    it('applies createdDateFrom filter', async () => {
      await service.listRfqs(q({ createdDateFrom: '2026-01-01' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date('2026-01-01'));
    });

    it('applies createdDateTo filter', async () => {
      await service.listRfqs(q({ createdDateTo: '2026-12-31' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.createdAt.lte).toEqual(new Date('2026-12-31'));
    });

    it('applies both createdDateFrom and createdDateTo filters', async () => {
      await service.listRfqs(
        q({ createdDateFrom: '2026-01-01', createdDateTo: '2026-12-31' }),
        companyAdmin,
      );
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(where.createdAt.lte).toEqual(new Date('2026-12-31'));
    });

    it('applies deadlineFrom filter', async () => {
      await service.listRfqs(q({ deadlineFrom: '2026-03-01' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.deadlineStart).toEqual({ gte: new Date('2026-03-01') });
    });

    it('applies deadlineTo filter', async () => {
      await service.listRfqs(q({ deadlineTo: '2026-06-01' }), companyAdmin);
      const where = mockPrisma.rfq.findMany.mock.calls[0][0].where;
      expect(where.deadlineEnd).toEqual({ lte: new Date('2026-06-01') });
    });

    // ── getFilteredRfqIdsByApprovedQuotes (via listRfqs) ──

    it('filters by minApprovedQuotes', async () => {
      // First call to findMany returns rfqs with quote data (for approved quote filtering)
      mockPrisma.rfq.findMany
        .mockResolvedValueOnce([
          { id: 'rfq-1', quoteResponses: [{ id: 'q1', vendorId: 'v1' }] },
          { id: 'rfq-2', quoteResponses: [] },
        ])
        // Second call returns the filtered list items
        .mockResolvedValueOnce([]);
      mockPrisma.rfq.count.mockResolvedValue(0);

      await service.listRfqs(q({ minApprovedQuotes: 1 }), companyAdmin);

      // First findMany was for approved quote filtering
      expect(mockPrisma.rfq.findMany).toHaveBeenCalledTimes(2);
      // Second findMany should have where.id.in
      const secondCallWhere = mockPrisma.rfq.findMany.mock.calls[1][0].where;
      expect(secondCallWhere.id).toEqual({ in: ['rfq-1'] });
    });

    it('filters by minApprovedVendors', async () => {
      mockPrisma.rfq.findMany
        .mockResolvedValueOnce([
          {
            id: 'rfq-1',
            quoteResponses: [
              { id: 'q1', vendorId: 'v1' },
              { id: 'q2', vendorId: 'v2' },
            ],
          },
          { id: 'rfq-2', quoteResponses: [{ id: 'q3', vendorId: 'v1' }] },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.rfq.count.mockResolvedValue(0);

      await service.listRfqs(q({ minApprovedVendors: 2 }), companyAdmin);
      const secondCallWhere = mockPrisma.rfq.findMany.mock.calls[1][0].where;
      expect(secondCallWhere.id).toEqual({ in: ['rfq-1'] });
    });

    // ── Vendor view: computeVendorStatus via listRfqs ──

    it('computes vendor status for items when user is vendor', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-1',
          projectId: 'proj-1',
          status: RfqStatus.OPEN,
          totalRequestedQty: 10,
          pickUpLocation: null,
          deliveryLocationId: '123 St',
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 1 },
          quoteResponses: [{ vendorId: 'v-1', status: QuoteResponseStatus.SUBMITTED }],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), vendor);
      expect(result.items[0].status).toBe(VendorRfqStatus.RESPONDED);
    });

    it('computes vendor status CLOSED for closed rfq', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-2',
          projectId: 'proj-1',
          status: RfqStatus.CLOSED,
          totalRequestedQty: 5,
          pickUpLocation: null,
          deliveryLocationId: '456 Ave',
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Beta' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 0 },
          quoteResponses: [],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), vendor);
      expect(result.items[0].status).toBe(VendorRfqStatus.CLOSED);
    });

    it('computes vendor status REJECTED for cancelled rfq', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-3',
          projectId: 'proj-1',
          status: RfqStatus.CANCELLED,
          totalRequestedQty: 5,
          pickUpLocation: null,
          deliveryLocationId: '789 Blvd',
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Gamma' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 0 },
          quoteResponses: [],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), vendor);
      expect(result.items[0].status).toBe(VendorRfqStatus.REJECTED);
    });

    it('computes vendor status APPROVED for approved quote', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-4',
          projectId: 'proj-1',
          status: RfqStatus.AWARDED,
          totalRequestedQty: 5,
          pickUpLocation: 'Warehouse A',
          deliveryLocationId: null,
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Delta' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 1 },
          quoteResponses: [{ vendorId: 'v-1', status: QuoteResponseStatus.APPROVED }],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), vendor);
      expect(result.items[0].status).toBe(VendorRfqStatus.APPROVED);
    });

    it('computes vendor status REJECTED for declined quote', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-5',
          projectId: 'proj-1',
          status: RfqStatus.OPEN,
          totalRequestedQty: 5,
          pickUpLocation: null,
          deliveryLocationId: '100 Main',
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Epsilon' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 1 },
          quoteResponses: [{ vendorId: 'v-1', status: QuoteResponseStatus.DECLINED }],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), vendor);
      expect(result.items[0].status).toBe(VendorRfqStatus.REJECTED);
    });

    it('computes vendor status INCOMING (fallback) when no vendor quote', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-6',
          projectId: 'proj-1',
          status: RfqStatus.OPEN,
          totalRequestedQty: 5,
          pickUpLocation: null,
          deliveryLocationId: '200 Elm',
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Zeta' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 0 },
          quoteResponses: [],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), vendor);
      expect(result.items[0].status).toBe(VendorRfqStatus.INCOMING);
    });

    it('sets pickUp true when pickUpLocation is defined', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-pu',
          projectId: 'proj-1',
          status: RfqStatus.OPEN,
          totalRequestedQty: 5,
          pickUpLocation: 'Warehouse B',
          deliveryLocationId: null,
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'Pickup Project' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 1, quoteResponses: 0 },
          quoteResponses: [],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), companyAdmin);
      expect(result.items[0].pickUp).toBe(true);
    });

    it('returns null deadlineRange when dates are missing', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-nd',
          projectId: 'proj-1',
          status: RfqStatus.OPEN,
          totalRequestedQty: 5,
          pickUpLocation: null,
          deliveryLocationId: 'Addr',
          deadlineStart: null,
          deadlineEnd: null,
          approvalStatus: null,
          createdAt: new Date('2026-03-01'),
          project: { name: 'NoDeadline' },
          createdBy: { id: 'po-1', name: 'PO User' },
          createdByUserId: 'po-1',
          approvedBy: null,
          _count: { lineItems: 0, quoteResponses: 0 },
          quoteResponses: [],
        },
      ]);
      mockPrisma.rfq.count.mockResolvedValue(1);

      const result = await service.listRfqs(q(), companyAdmin);
      expect(result.items[0].deadlineRange).toBeNull();
    });
  });

  // ── getRfq ──────────────────────────────────────────────────────────────

  describe('getRfq', () => {
    it('returns RFQ with relations', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        projectId: 'proj-1',
        status: 'Open',
        pickUpDate: null,
        deliveryLocationId: '123 St',
        pickUpLocation: null,
        deadlineStart: null,
        deadlineEnd: null,
        totalRequestedQty: 100,
        approvalStatus: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lineItems: [
          {
            id: 'li-1',
            materialId: 'mat-steel-1',
            material: { name: 'Steel' },
            quantity: 100,
            unit: 'tonnes',
            description: null,
          },
        ],
        quoteResponses: [
          {
            id: 'qr-1',
            totalCost: 15000,
            status: 'PENDING',
            submittedAt: null,
            discountPercent: null,
            discountAmount: null,
            itemsCovered: 3,
            totalItems: 5,
            vendor: { legalName: 'VendorCo' },
          },
        ],
        documents: [],
      });

      const result = await service.getRfq('rfq-1', companyAdmin);
      expect(result.id).toBe('rfq-1');
      expect(result.projectName).toBe('Alpha');
      expect(result.lineItems).toHaveLength(1);
      expect(result.quoteResponses).toHaveLength(1);
      expect(result.quoteResponses[0].vendorName).toBe('VendorCo');
    });

    it('throws NotFoundException when RFQ does not exist', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);
      await expect(service.getRfq('non-existent', companyAdmin)).rejects.toThrow(NotFoundException);
    });

    it('returns vendorStatus for vendor user with matching quote', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-v1',
        projectId: 'proj-1',
        status: RfqStatus.OPEN,
        pickUpDate: null,
        deliveryLocationId: '123 St',
        pickUpLocation: null,
        deadlineStart: null,
        deadlineEnd: null,
        totalRequestedQty: 50,
        approvalStatus: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'VendorProj' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lineItems: [],
        quoteResponses: [
          {
            id: 'qr-v1',
            vendorId: 'vendor-comp-1',
            totalCost: 5000,
            status: QuoteResponseStatus.SUBMITTED,
            submittedAt: new Date('2026-03-02'),
            discountPercent: null,
            discountAmount: null,
            itemsCovered: 1,
            totalItems: 1,
            vendor: {
              legalName: 'VendorCo',
              users: [{ id: 'v-1' }],
            },
          },
        ],
        documents: [],
      });

      const result = await service.getRfq('rfq-v1', vendor);
      expect(result.status).toBe(VendorRfqStatus.RESPONDED);
    });

    it('returns INCOMING vendor status when vendor has no quote', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-v2',
        projectId: 'proj-1',
        status: RfqStatus.OPEN,
        pickUpDate: null,
        deliveryLocationId: '123 St',
        pickUpLocation: null,
        deadlineStart: null,
        deadlineEnd: null,
        totalRequestedQty: 50,
        approvalStatus: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'VendorProj2' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lineItems: [],
        quoteResponses: [
          {
            id: 'qr-other',
            vendorId: 'other-vendor',
            totalCost: 5000,
            status: QuoteResponseStatus.PENDING,
            submittedAt: null,
            discountPercent: null,
            discountAmount: null,
            itemsCovered: 1,
            totalItems: 1,
            vendor: {
              legalName: 'OtherVendor',
              users: [{ id: 'other-vendor-user' }],
            },
          },
        ],
        documents: [],
      });

      const result = await service.getRfq('rfq-v2', vendor);
      expect(result.status).toBe(VendorRfqStatus.INCOMING);
    });

    it('maps documents correctly', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-doc',
        projectId: 'proj-1',
        status: RfqStatus.OPEN,
        pickUpDate: null,
        deliveryLocationId: '123 St',
        pickUpLocation: null,
        deadlineStart: new Date('2026-04-01'),
        deadlineEnd: new Date('2026-04-15'),
        totalRequestedQty: 50,
        approvalStatus: 'APPROVED',
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-02'),
        project: { name: 'DocProject' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: { id: 'ca-1', name: 'CA User' },
        lineItems: [],
        quoteResponses: [],
        documents: [
          {
            id: 'doc-1',
            fileId: 'file-1',
            createdAt: new Date('2026-03-01T10:00:00Z'),
            file: {
              filename: 'spec.pdf',
              uploadedBy: { id: 'po-1', name: 'PO User', email: 'po@test.com' },
            },
          },
        ],
      });

      const result = await service.getRfq('rfq-doc', companyAdmin);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].name).toBe('spec.pdf');
      expect(result.documents[0].uploadedBy.name).toBe('PO User');
      expect(result.approvedBy).toEqual({ id: 'ca-1', name: 'CA User' });
    });
  });

  // ── copyRfq ─────────────────────────────────────────────────────────────

  describe('copyRfq', () => {
    const sourceRfq = {
      id: 'rfq-src',
      companyId: 'comp-1',
      projectId: 'proj-1',
      status: RfqStatus.OPEN,
      deliveryLocationId: '123 St',
      pickUpLocation: 'Warehouse A',
      pickUpDate: new Date('2026-05-01'),
      deadlineStart: new Date('2026-04-01'),
      deadlineEnd: new Date('2026-04-15'),
      totalRequestedQty: 200,
      lineItems: [
        {
          id: 'li-1',
          materialId: 'mat-steel-1',
          quantity: 100,
          unit: 'kg',
          description: 'Grade A',
        },
        { id: 'li-2', materialId: 'mat-copper-1', quantity: 50, unit: 'kg', description: null },
      ],
    };

    it('throws NotFoundException when RFQ not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);
      await expect(service.copyRfq('non-existent', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(sourceRfq);
      await expect(service.copyRfq('rfq-src', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a copy with DRAFT status and line items', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(sourceRfq);
      mockPrisma.rfq.create.mockResolvedValue({ id: 'rfq-copy' });

      const result = await service.copyRfq('rfq-src', companyAdmin);

      expect(result).toEqual({ id: 'rfq-copy' });
      expect(mockPrisma.rfq.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'comp-1',
          projectId: 'proj-1',
          createdByUserId: 'ca-1',
          status: RfqStatus.DRAFT,
          deliveryLocationId: '123 St',
          pickUpLocation: 'Warehouse A',
          totalRequestedQty: 200,
          lineItems: {
            create: [
              { materialId: 'mat-steel-1', quantity: 100, unit: 'kg', description: 'Grade A' },
              { materialId: 'mat-copper-1', quantity: 50, unit: 'kg', description: null },
            ],
          },
        }),
      });
    });

    it('allows SuperAdmin to copy any RFQ', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(sourceRfq);
      mockPrisma.rfq.create.mockResolvedValue({ id: 'rfq-sa-copy' });

      const result = await service.copyRfq('rfq-src', superAdmin);
      expect(result).toEqual({ id: 'rfq-sa-copy' });
    });
  });

  // ── archiveRfq ──────────────────────────────────────────────────────────

  describe('archiveRfq', () => {
    it('throws NotFoundException when RFQ not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);
      await expect(service.archiveRfq('non-existent', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-arch',
        status: RfqStatus.CLOSED,
        companyId: 'comp-1',
      });
      await expect(service.archiveRfq('rfq-arch', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when RFQ is not CLOSED', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-arch',
        status: RfqStatus.OPEN,
        companyId: 'comp-1',
      });
      await expect(service.archiveRfq('rfq-arch', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('archives a CLOSED RFQ by setting status to CANCELLED', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-arch',
        status: RfqStatus.CLOSED,
        companyId: 'comp-1',
      });
      mockPrisma.rfq.update.mockResolvedValue({});

      const result = await service.archiveRfq('rfq-arch', companyAdmin);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-arch' },
        data: { status: RfqStatus.CANCELLED },
      });
    });

    it('allows SuperAdmin to archive any RFQ', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-arch-sa',
        status: RfqStatus.CLOSED,
        companyId: 'comp-1',
      });
      mockPrisma.rfq.update.mockResolvedValue({});

      const result = await service.archiveRfq('rfq-arch-sa', superAdmin);
      expect(result).toEqual({ success: true });
    });
  });

  // ── approveQuote ────────────────────────────────────────────────────────

  describe('approveQuote', () => {
    const pendingQuote = {
      id: 'quote-1',
      status: QuoteResponseStatus.PENDING,
      rfqId: 'rfq-1',
      vendorId: 'vendor-co-1',
      source: 'FORM',
      rfq: { companyId: 'comp-1' },
    };

    it('throws NotFoundException when quote not found', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(null);
      await expect(service.approveQuote('rfq-1', 'non-existent', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(pendingQuote);
      await expect(service.approveQuote('rfq-1', 'quote-1', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when quote was already decided', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...pendingQuote,
        status: QuoteResponseStatus.APPROVED,
      });
      await expect(service.approveQuote('rfq-1', 'quote-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('approves a received (SUBMITTED) quote — the standard review path (US 5.06)', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...pendingQuote,
        status: QuoteResponseStatus.SUBMITTED,
      });
      mockPrisma.quoteResponse.update.mockResolvedValue({
        id: 'quote-1',
        status: QuoteResponseStatus.APPROVED,
        totalCost: 15000,
        vendor: { legalName: 'VendorCo' },
      });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.quoteAudit.create.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockPrisma),
      );

      const result = await service.approveQuote('rfq-1', 'quote-1', companyAdmin);
      expect(result.status).toBe(QuoteResponseStatus.APPROVED);
    });

    it('approves quote and updates RFQ to AWARDED', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(pendingQuote);
      mockPrisma.quoteResponse.update.mockResolvedValue({
        id: 'quote-1',
        status: QuoteResponseStatus.APPROVED,
        totalCost: 15000,
        vendor: { legalName: 'VendorCo' },
      });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.quoteAudit.create.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockPrisma),
      );

      const result = await service.approveQuote('rfq-1', 'quote-1', companyAdmin);

      expect(result).toEqual({
        id: 'quote-1',
        vendorName: 'VendorCo',
        status: QuoteResponseStatus.APPROVED,
        totalCost: 15000,
      });
      expect(mockPrisma.quoteResponse.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: { status: QuoteResponseStatus.APPROVED },
        include: { vendor: { select: { legalName: true } } },
      });
      expect(mockPrisma.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: RfqStatus.AWARDED },
      });
      expect(mockPrisma.quoteAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'APPROVED', quoteResponseId: 'quote-1' }),
      });
    });
  });

  // ── awardQuote (FOR-209) ──────────────────────────────────────────────────

  describe('awardQuote', () => {
    const awardableQuote = {
      id: 'quote-1',
      status: QuoteResponseStatus.SUBMITTED,
      rfqId: 'rfq-1',
      vendorId: 'vendor-co-1',
      source: 'FORM',
      message: 'Best price',
      rfq: {
        companyId: 'comp-1',
        projectId: 'proj-1',
        currency: 'AUD',
        deliveryLocationId: 'loc-1',
        holdForRelease: false,
        deadlineStart: null,
        deadlineEnd: null,
      },
      lineItems: [
        {
          unitPrice: 10,
          quotedQuantity: 5,
          availability: QuoteLineItemAvailability.AVAILABLE,
          deliveryDate: new Date('2026-07-01'),
          notes: 'line note',
          rfqLineItem: {
            materialId: 'mat-1',
            materialName: 'Cement',
            unit: 'bags',
            costCode: 'CC-1',
            description: null,
            pickUp: false,
          },
        },
        {
          unitPrice: 0,
          quotedQuantity: 0,
          availability: QuoteLineItemAvailability.NO_QUOTE,
          deliveryDate: new Date('2026-07-02'),
          notes: null,
          rfqLineItem: {
            materialId: 'mat-2',
            materialName: 'Sand',
            unit: 'tonnes',
            costCode: 'CC-2',
            description: null,
            pickUp: false,
          },
        },
      ],
    };

    function primeAwardTransaction() {
      mockPrisma.quoteResponse.update.mockResolvedValue({
        id: 'quote-1',
        status: QuoteResponseStatus.APPROVED,
        totalCost: 50,
        vendor: { legalName: 'VendorCo' },
      });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.quoteAudit.create.mockResolvedValue({});
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1', poNumber: 'PO-00001' });
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockPrisma),
      );
    }

    it('throws NotFoundException when quote not found', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(null);
      await expect(service.awardQuote('rfq-1', 'missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a different company user', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(awardableQuote);
      await expect(service.awardQuote('rfq-1', 'quote-1', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when the quote is already APPROVED', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...awardableQuote,
        status: QuoteResponseStatus.APPROVED,
      });
      await expect(service.awardQuote('rfq-1', 'quote-1', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('approves the quote, marks the RFQ AWARDED and creates a draft PO from quoted lines', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(awardableQuote);
      primeAwardTransaction();

      const result = await service.awardQuote('rfq-1', 'quote-1', companyAdmin);

      expect(result).toEqual({
        id: 'quote-1',
        vendorName: 'VendorCo',
        status: QuoteResponseStatus.APPROVED,
        totalCost: 50,
        purchaseOrderId: 'po-1',
        poNumber: 'PO-00001',
      });

      expect(mockPrisma.quoteResponse.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: { status: QuoteResponseStatus.APPROVED },
        include: { vendor: { select: { legalName: true } } },
      });
      expect(mockPrisma.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: RfqStatus.AWARDED },
      });
      expect(mockPrisma.quoteAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'APPROVED', quoteResponseId: 'quote-1' }),
      });
    });

    it('leaves the created PO as a DRAFT for the contractor to review + issue (no auto-send)', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(awardableQuote);
      primeAwardTransaction();

      await service.awardQuote('rfq-1', 'quote-1', companyAdmin);

      const poData = mockPrisma.purchaseOrder.create.mock.calls[0][0].data;
      expect(poData.status).toBe('DRAFT');
    });

    it('derives PO line items from the quote, dropping NO_QUOTE lines', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(awardableQuote);
      primeAwardTransaction();

      await service.awardQuote('rfq-1', 'quote-1', companyAdmin);

      const poData = mockPrisma.purchaseOrder.create.mock.calls[0][0].data;
      expect(poData).toEqual(
        expect.objectContaining({
          rfqId: 'rfq-1',
          vendorId: 'vendor-co-1',
          projectId: 'proj-1',
          companyId: 'comp-1',
          status: 'DRAFT',
          sourceOfCreation: 'RFQ',
          currency: 'AUD',
          deliveryLocationId: 'loc-1',
          subtotal: 50,
          totalAmount: 50,
          lineItemCount: 1,
          totalRequestedQty: 5,
        }),
      );

      // Only the AVAILABLE line is carried over; the NO_QUOTE line is dropped.
      const createdLines = poData.lineItems.create;
      expect(createdLines).toHaveLength(1);
      expect(createdLines[0]).toEqual(
        expect.objectContaining({
          lineNumber: 1,
          materialId: 'mat-1',
          description: 'Cement',
          quantityOrdered: 5,
          unitOfMeasure: 'bags',
          unitPrice: 10,
          lineTotal: 50,
          costCode: 'CC-1',
        }),
      );
    });
  });

  // ── declineQuote ────────────────────────────────────────────────────────

  describe('declineQuote', () => {
    const pendingQuote = {
      id: 'quote-2',
      status: QuoteResponseStatus.PENDING,
      rfqId: 'rfq-1',
      vendorId: 'vendor-co-1',
      source: 'FORM',
      rfq: { companyId: 'comp-1' },
    };

    it('throws NotFoundException when quote not found', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(null);
      await expect(service.declineQuote('rfq-1', 'non-existent', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(pendingQuote);
      await expect(service.declineQuote('rfq-1', 'quote-2', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when quote is not PENDING', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue({
        ...pendingQuote,
        status: QuoteResponseStatus.DECLINED,
      });
      await expect(service.declineQuote('rfq-1', 'quote-2', companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('declines quote and returns updated data', async () => {
      mockPrisma.quoteResponse.findUnique.mockResolvedValue(pendingQuote);
      mockPrisma.quoteResponse.update.mockResolvedValue({
        id: 'quote-2',
        status: QuoteResponseStatus.DECLINED,
        totalCost: 20000,
        vendor: { legalName: 'DeclinedVendor' },
      });
      mockPrisma.quoteAudit.create.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(mockPrisma),
      );

      const result = await service.declineQuote('rfq-1', 'quote-2', companyAdmin);

      expect(result).toEqual({
        id: 'quote-2',
        vendorName: 'DeclinedVendor',
        status: QuoteResponseStatus.DECLINED,
        totalCost: 20000,
      });
      expect(mockPrisma.quoteResponse.update).toHaveBeenCalledWith({
        where: { id: 'quote-2' },
        data: { status: QuoteResponseStatus.DECLINED },
        include: { vendor: { select: { legalName: true } } },
      });
      expect(mockPrisma.quoteAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'DECLINED', quoteResponseId: 'quote-2' }),
      });
    });
  });

  // ── updateLineItem ──────────────────────────────────────────────────────

  describe('updateLineItem', () => {
    const lineItem = {
      id: 'li-1',
      rfqId: 'rfq-1',
      materialId: 'mat-steel-1',
      quantity: 100,
      unit: 'kg',
      description: 'Grade A',
      rfq: { companyId: 'comp-1' },
    };

    it('throws NotFoundException when line item not found', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(null);
      await expect(
        service.updateLineItem('rfq-1', 'non-existent', { materialId: 'mat-iron-1' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when line item belongs to different RFQ', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue({ ...lineItem, rfqId: 'rfq-other' });
      await expect(
        service.updateLineItem('rfq-1', 'li-1', { materialId: 'mat-iron-1' }, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(lineItem);
      await expect(
        service.updateLineItem('rfq-1', 'li-1', { materialId: 'mat-iron-1' }, otherCompanyUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates line item with partial data', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(lineItem);
      mockPrisma.rfqLineItem.update.mockResolvedValue({
        id: 'li-1',
        materialId: 'mat-iron-1',
        material: { name: 'Iron' },
        description: 'Grade A',
        quantity: 100,
        unit: 'kg',
      });

      const result = await service.updateLineItem(
        'rfq-1',
        'li-1',
        { materialId: 'mat-iron-1' },
        companyAdmin,
      );

      expect(result).toEqual({
        id: 'li-1',
        materialId: 'mat-iron-1',
        materialName: 'Iron',
        description: 'Grade A',
        quantity: 100,
        unit: 'kg',
      });
      expect(mockPrisma.rfqLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li-1' },
        data: { materialId: 'mat-iron-1' },
        include: { material: { select: { id: true, name: true, uom: true } } },
      });
    });

    it('updates multiple fields at once', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(lineItem);
      mockPrisma.rfqLineItem.update.mockResolvedValue({
        id: 'li-1',
        materialId: 'mat-aluminum-1',
        material: { name: 'Aluminum' },
        description: null,
        quantity: 200,
        unit: 'tonnes',
      });

      const result = await service.updateLineItem(
        'rfq-1',
        'li-1',
        { materialId: 'mat-aluminum-1', quantity: 200, unit: 'tonnes', description: null },
        companyAdmin,
      );

      expect(result.materialId).toBe('mat-aluminum-1');
      expect(result.quantity).toBe(200);
    });
  });

  // ── listApprovedResponses (US 5.08 — bulk-order creation) ─────────────────

  describe('listApprovedResponses', () => {
    it('throws NotFoundException when the project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.listApprovedResponses('proj-x', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a contractor from a different company', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'other-comp' });
      await expect(service.listApprovedResponses('proj-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns approved responses with quoted line items, dropping NO_QUOTE lines', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.quoteResponse.findMany.mockResolvedValue([
        {
          id: 'qr-1',
          rfqId: 'rfq-1',
          vendorId: 'vendor-co-1',
          discountPercent: 5,
          vendor: { id: 'vendor-co-1', legalName: 'VendorCo' },
          rfq: { id: 'rfq-1', rfqNumber: 'RFQ-00001' },
          lineItems: [
            {
              unitPrice: 12.5,
              quotedQuantity: 8,
              availability: QuoteLineItemAvailability.AVAILABLE,
              discount: 1.5,
              rfqLineItem: {
                materialId: 'mat-1',
                materialName: 'Cement',
                description: 'Bagged cement',
                unit: 'bags',
                material: { name: 'Cement 25kg', uom: 'BAG' },
              },
            },
            {
              unitPrice: 0,
              quotedQuantity: 0,
              availability: QuoteLineItemAvailability.NO_QUOTE,
              discount: null,
              rfqLineItem: {
                materialId: 'mat-2',
                materialName: 'Sand',
                description: null,
                unit: 'tonnes',
                material: null,
              },
            },
          ],
        },
      ]);

      const result = await service.listApprovedResponses('proj-1', companyAdmin);

      expect(mockPrisma.quoteResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: QuoteResponseStatus.APPROVED }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          rfqId: 'rfq-1',
          responseId: 'qr-1',
          rfqReference: 'RFQ-00001',
          vendorId: 'vendor-co-1',
          vendorName: 'VendorCo',
          discountPercent: 5,
        }),
      );
      // NO_QUOTE line dropped → only one line item remains
      expect(result[0].lineItems).toHaveLength(1);
      expect(result[0].lineItems[0]).toEqual({
        materialId: 'mat-1',
        itemReference: 'Cement 25kg',
        description: 'Bagged cement',
        unitPrice: 12.5,
        uom: 'BAG',
        quantity: 8,
        discount: 1.5,
      });
    });

    it('falls back to the rfqId and line unit when references are missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.quoteResponse.findMany.mockResolvedValue([
        {
          id: 'qr-2',
          rfqId: 'rfq-2',
          vendorId: 'vendor-co-2',
          discountPercent: null,
          vendor: { id: 'vendor-co-2', legalName: 'OtherVendor' },
          rfq: { id: 'rfq-2', rfqNumber: null },
          lineItems: [
            {
              unitPrice: 4,
              quotedQuantity: 2,
              availability: QuoteLineItemAvailability.AVAILABLE,
              discount: null,
              rfqLineItem: {
                materialId: null,
                materialName: 'Free text item',
                description: null,
                unit: 'EA',
                material: null,
              },
            },
          ],
        },
      ]);

      const result = await service.listApprovedResponses('proj-1', companyAdmin);
      expect(result[0].rfqReference).toBe('rfq-2');
      expect(result[0].discountPercent).toBeNull();
      expect(result[0].lineItems[0]).toEqual({
        materialId: null,
        itemReference: 'Free text item',
        description: 'Free text item',
        unitPrice: 4,
        uom: 'EA',
        quantity: 2,
        discount: null,
      });
    });
  });

  // ── deleteLineItem ──────────────────────────────────────────────────────

  describe('deleteLineItem', () => {
    const lineItem = {
      id: 'li-del',
      rfqId: 'rfq-1',
      rfq: { companyId: 'comp-1' },
    };

    it('throws NotFoundException when line item not found', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(null);
      await expect(service.deleteLineItem('rfq-1', 'non-existent', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when line item belongs to different RFQ', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue({ ...lineItem, rfqId: 'rfq-other' });
      await expect(service.deleteLineItem('rfq-1', 'li-del', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(lineItem);
      await expect(service.deleteLineItem('rfq-1', 'li-del', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes line item and returns success', async () => {
      mockPrisma.rfqLineItem.findUnique.mockResolvedValue(lineItem);
      mockPrisma.rfqLineItem.delete.mockResolvedValue({});

      const result = await service.deleteLineItem('rfq-1', 'li-del', companyAdmin);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.rfqLineItem.delete).toHaveBeenCalledWith({
        where: { id: 'li-del' },
      });
    });
  });

  // ── uploadDocument ──────────────────────────────────────────────────────

  describe('uploadDocument', () => {
    const mockFile = {
      originalname: 'specs.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    it('throws BadRequestException when no file provided', async () => {
      await expect(
        service.uploadDocument('rfq-1', undefined as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file exceeds 10MB', async () => {
      const largeFile = { ...mockFile, size: 11 * 1024 * 1024 } as Express.Multer.File;
      await expect(service.uploadDocument('rfq-1', largeFile, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when RFQ not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);
      await expect(service.uploadDocument('non-existent', mockFile, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        companyId: 'comp-1',
      });
      await expect(service.uploadDocument('rfq-1', mockFile, otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('uploads file and creates document record', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        companyId: 'comp-1',
      });
      mockStorageService.upload.mockResolvedValue({
        bucket: 'documents',
        key: 'rfq-documents/rfq-1/uuid.pdf',
      });
      mockPrisma.file.create.mockResolvedValue({ id: 'file-new' });
      mockPrisma.rfqDocument.create.mockResolvedValue({
        id: 'doc-new',
        fileId: 'file-new',
        createdAt: new Date('2026-03-10T10:00:00Z'),
        file: {
          filename: 'specs.pdf',
          uploadedBy: { id: 'ca-1', name: 'CA User', email: 'ca@test.com' },
        },
      });

      const result = await service.uploadDocument('rfq-1', mockFile, companyAdmin);

      expect(result).toEqual({
        id: 'doc-new',
        name: 'specs.pdf',
        fileId: 'file-new',
        uploadedBy: {
          name: 'CA User',
          email: 'ca@test.com',
          avatarUrl: null,
        },
        uploadedAt: '2026-03-10T10:00:00.000Z',
      });

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.stringContaining('rfq-documents/rfq-1/'),
        mockFile.buffer,
        'application/pdf',
      );
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bucket: 'documents',
          filename: 'specs.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          uploadedById: 'ca-1',
        }),
      });
    });
  });

  // ── deleteDocument ──────────────────────────────────────────────────────

  describe('deleteDocument', () => {
    const docRecord = {
      id: 'doc-del',
      fileId: 'file-del',
      rfqId: 'rfq-1',
      file: { key: 'rfq-documents/rfq-1/uuid.pdf' },
      rfq: { companyId: 'comp-1' },
    };

    it('throws NotFoundException when document not found', async () => {
      mockPrisma.rfqDocument.findFirst.mockResolvedValue(null);
      await expect(service.deleteDocument('rfq-1', 'non-existent', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfqDocument.findFirst.mockResolvedValue(docRecord);
      await expect(service.deleteDocument('rfq-1', 'doc-del', otherCompanyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes document, file record, and storage object', async () => {
      mockPrisma.rfqDocument.findFirst.mockResolvedValue(docRecord);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.rfqDocument.delete.mockResolvedValue({});
      mockPrisma.file.delete.mockResolvedValue({});

      const result = await service.deleteDocument('rfq-1', 'doc-del', companyAdmin);

      expect(result).toEqual({ success: true });
      expect(mockStorageService.delete).toHaveBeenCalledWith('rfq-documents/rfq-1/uuid.pdf');
      expect(mockPrisma.rfqDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-del' } });
      expect(mockPrisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-del' } });
    });
  });

  // ── createRfq ────────────────────────────────────────────────────────

  describe('createRfq', () => {
    const createDto = {
      projectId: 'proj-1',
      deliveryLocationId: 'loc-1',
      lineItems: [
        {
          materialId: 'mat-1',
          quantity: 10,
          uom: 'kg',
          costCode: 'CC-1',
          notes: 'note',
          pickUp: false,
        },
        { materialId: 'mat-2', quantity: 5, uom: 'pcs', costCode: 'CC-2', notes: null },
      ],
      vendorIds: ['vendor-1', 'vendor-2'],
      currency: 'USD',
      needByDate: '2026-06-01',
      holdForRelease: false,
      earliestDeliveryDate: null,
      deadlineEnd: '2026-05-01',
      message: 'Please quote',
      attachmentIds: ['file-1'],
    };

    // Helper to set up a valid scenario where getRfq succeeds after create
    function setupCreateSuccess() {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }, { id: 'mat-2' }]);
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([
        { vendorId: 'vendor-1' },
        { vendorId: 'vendor-2' },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const txProxy = {
          rfq: { create: jest.fn().mockResolvedValue({ id: 'rfq-new' }) },
          rfqDocument: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return cb(txProxy);
      });
      // getRfq call after create
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-new',
        rfqNumber: 'RFQ-ABC',
        status: 'DRAFT',
        currency: 'USD',
        companyId: 'comp-1',
        projectId: 'proj-1',
        project: { name: 'TestProj' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lineItems: [],
        quoteResponses: [],
        invitedVendors: [],
        documents: [],
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        deadlineStart: null,
        deadlineEnd: new Date('2026-05-01'),
        deliveryLocationId: 'loc-1',
        needByDate: null,
        holdForRelease: false,
        earliestDeliveryDate: null,
        message: 'Please quote',
        totalRequestedQty: 15,
        pickUpLocation: null,
        pickUpDate: null,
        approvalStatus: null,
      });
    }

    it('creates RFQ and returns detail', async () => {
      setupCreateSuccess();

      const result = await service.createRfq(createDto as never, procOfficer);
      expect(result).toBeDefined();
      expect(result.id).toBe('rfq-new');
    });

    it('throws NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.createRfq(createDto as never, procOfficer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when project belongs to another company', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'other-comp' });

      await expect(service.createRfq(createDto as never, procOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when delivery location does not belong to project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'other-proj',
      });

      await expect(service.createRfq(createDto as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when some material IDs are invalid', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }]); // only 1 of 2

      await expect(service.createRfq(createDto as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when some vendor IDs are not assigned to the contractor', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }, { id: 'mat-2' }]);
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([{ vendorId: 'vendor-1' }]); // only 1 of 2

      await expect(service.createRfq(createDto as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when holdForRelease is true without earliestDeliveryDate', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }, { id: 'mat-2' }]);
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([
        { vendorId: 'vendor-1' },
        { vendorId: 'vendor-2' },
      ]);

      const holdDto = { ...createDto, holdForRelease: true, earliestDeliveryDate: null };
      await expect(service.createRfq(holdDto as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });

    // ── FOR-197: M:N vendor scoping ─────────────────────────────────────
    it('scopes vendor validation to the contractor company (M:N assignment check)', async () => {
      setupCreateSuccess();

      await service.createRfq(createDto as never, procOfficer);

      expect(mockPrisma.companyVendorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractorId: 'comp-1',
            vendorId: { in: ['vendor-1', 'vendor-2'] },
          }),
        }),
      );
    });

    it('rejects vendor IDs that exist on the platform but are not assigned to this contractor', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }, { id: 'mat-2' }]);
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]); // none assigned

      await expect(service.createRfq(createDto as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── saveRfqDraft (FOR-202) ───────────────────────────────────────────

  describe('saveRfqDraft', () => {
    function setupDraftDetail() {
      // getRfq call after the draft is created
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-draft',
        rfqNumber: 'RFQ-00001',
        status: RfqStatus.DRAFT,
        currency: 'AUD',
        companyId: 'comp-1',
        projectId: 'proj-1',
        project: { name: 'TestProj' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lineItems: [],
        quoteResponses: [],
        invitedVendors: [],
        documents: [],
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        deadlineStart: null,
        deadlineEnd: null,
        deliveryLocationId: null,
        needByDate: null,
        holdForRelease: false,
        earliestDeliveryDate: null,
        message: null,
        totalRequestedQty: 0,
        pickUpLocation: null,
        pickUpDate: null,
        approvalStatus: null,
      });
    }

    function mockTx() {
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        const txProxy = {
          rfq: { create: jest.fn().mockResolvedValue({ id: 'rfq-draft' }) },
          rfqDocument: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return cb(txProxy);
      });
    }

    it('persists a draft with only a project (no line items or vendors)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockTx();
      setupDraftDetail();

      const result = await service.saveRfqDraft({ projectId: 'proj-1' } as never, procOfficer);

      expect(result.id).toBe('rfq-draft');
      expect(result.status).toBe(RfqStatus.DRAFT);
      // No cross-entity validation runs when those slices are absent
      expect(mockPrisma.projectLocation.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.material.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.companyVendorAssignment.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.saveRfqDraft({ projectId: 'proj-x' } as never, procOfficer),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when project belongs to another company', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'other-comp' });
      await expect(
        service.saveRfqDraft({ projectId: 'proj-1' } as never, procOfficer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates delivery location belongs to the project when provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'other-proj',
      });
      await expect(
        service.saveRfqDraft(
          { projectId: 'proj-1', deliveryLocationId: 'loc-1' } as never,
          procOfficer,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates material IDs when line items provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }]); // only 1 of 2
      await expect(
        service.saveRfqDraft(
          {
            projectId: 'proj-1',
            lineItems: [
              { materialId: 'mat-1', quantity: 1, uom: 'kg' },
              { materialId: 'mat-2', quantity: 2, uom: 'kg' },
            ],
          } as never,
          procOfficer,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates vendor assignment scope when vendors provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]); // none assigned
      await expect(
        service.saveRfqDraft(
          { projectId: 'proj-1', vendorIds: ['vendor-1'] } as never,
          procOfficer,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when holdForRelease is set without earliestDeliveryDate', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      await expect(
        service.saveRfqDraft({ projectId: 'proj-1', holdForRelease: true } as never, procOfficer),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists provided line items and vendors after validation', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }]);
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([{ vendorId: 'vendor-1' }]);
      mockTx();
      setupDraftDetail();

      const result = await service.saveRfqDraft(
        {
          projectId: 'proj-1',
          lineItems: [{ materialId: 'mat-1', quantity: 3, uom: 'kg' }],
          vendorIds: ['vendor-1'],
        } as never,
        procOfficer,
      );

      expect(result.id).toBe('rfq-draft');
      expect(mockPrisma.companyVendorAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractorId: 'comp-1',
            vendorId: { in: ['vendor-1'] },
          }),
        }),
      );
    });
  });

  // ── updateRfq ────────────────────────────────────────────────────────

  describe('updateRfq', () => {
    it('throws NotFoundException when RFQ not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.updateRfq('rfq-1', {} as never, procOfficer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for different company user', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-2',
        projectId: 'proj-1',
        _count: { quoteResponses: 0 },
      });

      await expect(service.updateRfq('rfq-1', {} as never, procOfficer)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when RFQ is not editable (AWARDED status)', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'AWARDED',
        companyId: 'comp-1',
        projectId: 'proj-1',
        _count: { quoteResponses: 0 },
      });

      await expect(service.updateRfq('rfq-1', {} as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when OPEN RFQ has submitted responses', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'OPEN',
        companyId: 'comp-1',
        projectId: 'proj-1',
        _count: { quoteResponses: 2 },
      });

      await expect(service.updateRfq('rfq-1', {} as never, procOfficer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows editing OPEN RFQ with no submitted responses', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'OPEN',
          companyId: 'comp-1',
          projectId: 'proj-1',
          _count: { quoteResponses: 0 },
        })
        // getRfq call after update
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-1',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.updateRfq('rfq-1', { currency: 'USD' } as never, procOfficer);
      expect(result).toBeDefined();
    });

    it('validates deliveryLocationId belongs to project', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        projectId: 'proj-1',
        _count: { quoteResponses: 0 },
      });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-x',
        projectId: 'other-proj',
      });

      await expect(
        service.updateRfq('rfq-1', { deliveryLocationId: 'loc-x' } as never, procOfficer),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates materialIds when lineItems provided', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        projectId: 'proj-1',
        _count: { quoteResponses: 0 },
      });
      mockPrisma.material.findMany.mockResolvedValue([]); // none found

      await expect(
        service.updateRfq(
          'rfq-1',
          { lineItems: [{ materialId: 'bad', quantity: 1, uom: 'kg' }] } as never,
          procOfficer,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates vendorIds when provided', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        projectId: 'proj-1',
        _count: { quoteResponses: 0 },
      });
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([]); // none assigned

      await expect(
        service.updateRfq('rfq-1', { vendorIds: ['bad-vendor'] } as never, procOfficer),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when holdForRelease=true without earliestDeliveryDate', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
          _count: { quoteResponses: 0 },
        })
        .mockResolvedValueOnce({ earliestDeliveryDate: null });

      await expect(
        service.updateRfq('rfq-1', { holdForRelease: true } as never, procOfficer),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── sendRfq ──────────────────────────────────────────────────────────

  describe('sendRfq', () => {
    it('throws NotFoundException when RFQ not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.sendRfq('rfq-1', {}, procOfficer)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for different company', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-2',
        _count: { lineItems: 1, invitedVendors: 1 },
      });

      await expect(service.sendRfq('rfq-1', {}, procOfficer)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when RFQ is not DRAFT', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'OPEN',
        companyId: 'comp-1',
        _count: { lineItems: 1, invitedVendors: 1 },
      });

      await expect(service.sendRfq('rfq-1', {}, procOfficer)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when RFQ has no line items', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        _count: { lineItems: 0, invitedVendors: 1 },
      });

      await expect(service.sendRfq('rfq-1', {}, procOfficer)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when RFQ has no invited vendors', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        _count: { lineItems: 3, invitedVendors: 0 },
      });

      await expect(service.sendRfq('rfq-1', {}, procOfficer)).rejects.toThrow(BadRequestException);
    });

    it('sends RFQ and generates invitation tokens for vendors', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        // generateInvitationTokensAndNotify
        .mockResolvedValueOnce({
          rfqNumber: 'RFQ-1',
          ccEmails: [],
          documents: [],
          invitedVendors: [
            {
              id: 'iv-1',
              vendor: {
                id: 'v-1',
                users: [
                  { email: 'active@vendor.com', status: 'ACTIVE' },
                  { email: 'pending@vendor.com', status: 'PENDING' },
                ],
              },
            },
          ],
        })
        // getRfq
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-1',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.rfqVendor.update.mockResolvedValue({});
      // First call returns existing (collision), second returns null
      mockPrisma.rfqVendor.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      mockEmailService.sendRfqReceivedEmail.mockResolvedValue(undefined);

      const result = await service.sendRfq('rfq-1', {}, procOfficer);
      expect(result.status).toBe('OPEN');

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      expect(mockAccessTokens.issueToken).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectType: 'RFQ',
          subjectId: 'rfq-1',
          purpose: 'QUOTE_SUBMIT',
          metadata: { rfqVendorId: 'iv-1', vendorId: 'v-1' },
        }),
      );
      expect(mockEmailService.sendRfqReceivedEmail).toHaveBeenCalledTimes(2);
      // Every vendor — including those with active accounts — gets the tokenized
      // guest invitation link (FOR-201 + ADR-0002), never the bare /rfqs list.
      expect(mockEmailService.sendRfqReceivedEmail).toHaveBeenCalledWith(
        'active@vendor.com',
        'RFQ-1',
        'http://localhost:5179/invitation/issued-token-xyz',
        expect.objectContaining({
          cc: [],
          attachments: [],
          log: expect.objectContaining({ rfqId: 'rfq-1' }),
        }),
      );
    });

    it('sends invitation URL for vendors with no active users', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        .mockResolvedValueOnce({
          rfqNumber: null,
          ccEmails: [],
          documents: [],
          invitedVendors: [
            {
              id: 'iv-1',
              vendor: {
                id: 'v-1',
                users: [{ email: 'pending@vendor.com', status: 'PENDING' }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: null,
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.rfqVendor.update.mockResolvedValue({});
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);
      mockEmailService.sendRfqReceivedEmail.mockResolvedValue(undefined);

      await service.sendRfq('rfq-1', {}, procOfficer);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockEmailService.sendRfqReceivedEmail).toHaveBeenCalledWith(
        'pending@vendor.com',
        expect.any(String),
        'http://localhost:5179/invitation/issued-token-xyz',
        expect.objectContaining({
          cc: [],
          attachments: [],
          log: expect.objectContaining({ rfqId: 'rfq-1' }),
        }),
      );
    });

    it('sends to the vendor contactEmail when the vendor has no user accounts', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        // generateInvitationTokensAndNotify
        .mockResolvedValueOnce({
          rfqNumber: 'RFQ-9',
          ccEmails: [],
          documents: [],
          invitedVendors: [
            {
              id: 'iv-1',
              vendor: { id: 'v-1', contactEmail: 'hello@vendor.com', users: [] },
            },
          ],
        })
        // getRfq
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-9',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.rfqVendor.update.mockResolvedValue({});
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);
      mockEmailService.sendRfqReceivedEmail.mockResolvedValue(undefined);

      await service.sendRfq('rfq-1', {}, procOfficer);

      await new Promise((r) => setTimeout(r, 50));

      // No user accounts → guest invitation link, delivered to the contact email.
      expect(mockEmailService.sendRfqReceivedEmail).toHaveBeenCalledWith(
        'hello@vendor.com',
        'RFQ-9',
        'http://localhost:5179/invitation/issued-token-xyz',
        expect.objectContaining({ cc: [], attachments: [] }),
      );
    });

    it('sends RFQ by updating status to OPEN', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        // generateInvitationTokensAndNotify (fire-and-forget)
        .mockResolvedValueOnce({
          rfqNumber: 'RFQ-1',
          ccEmails: [],
          documents: [],
          invitedVendors: [],
        })
        // getRfq call after update
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-1',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});

      const result = await service.sendRfq('rfq-1', {}, procOfficer);
      expect(result.status).toBe('OPEN');
      expect(mockPrisma.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: 'OPEN', ccEmails: [] },
      });
    });

    it('normalizes and persists CC recipients on send', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        .mockResolvedValueOnce({
          rfqNumber: 'RFQ-1',
          ccEmails: [],
          documents: [],
          invitedVendors: [],
        })
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-1',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});

      await service.sendRfq(
        'rfq-1',
        { cc: ['  Buyer@Acme.com ', 'buyer@acme.com', 'pm@acme.com'] },
        procOfficer,
      );

      expect(mockPrisma.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: 'OPEN', ccEmails: ['buyer@acme.com', 'pm@acme.com'] },
      });
    });

    it('downloads RFQ documents and attaches them to vendor emails with CC', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        // generateInvitationTokensAndNotify
        .mockResolvedValueOnce({
          rfqNumber: 'RFQ-1',
          ccEmails: ['pm@acme.com'],
          documents: [
            {
              file: {
                key: 'rfq-documents/rfq-1/spec.pdf',
                filename: 'spec.pdf',
                mimeType: 'application/pdf',
              },
            },
          ],
          invitedVendors: [
            {
              id: 'iv-1',
              vendor: {
                id: 'v-1',
                users: [{ email: 'active@vendor.com', status: 'ACTIVE' }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-1',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.rfqVendor.update.mockResolvedValue({});
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);
      const pdf = Buffer.from('pdf-bytes');
      mockStorageService.getObject.mockResolvedValue({ body: pdf, contentType: 'application/pdf' });
      mockEmailService.sendRfqReceivedEmail.mockResolvedValue(undefined);

      await service.sendRfq('rfq-1', { cc: ['pm@acme.com'] }, procOfficer);

      // Wait for fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      expect(mockStorageService.getObject).toHaveBeenCalledWith('rfq-documents/rfq-1/spec.pdf');
      expect(mockEmailService.sendRfqReceivedEmail).toHaveBeenCalledWith(
        'active@vendor.com',
        'RFQ-1',
        'http://localhost:5179/invitation/issued-token-xyz',
        expect.objectContaining({
          cc: ['pm@acme.com'],
          attachments: [{ filename: 'spec.pdf', content: pdf, contentType: 'application/pdf' }],
          log: expect.objectContaining({ rfqId: 'rfq-1' }),
        }),
      );
    });

    it('skips documents that fail to download without blocking the send', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce({
          id: 'rfq-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          _count: { lineItems: 2, invitedVendors: 1 },
        })
        .mockResolvedValueOnce({
          rfqNumber: 'RFQ-1',
          ccEmails: [],
          documents: [
            {
              file: {
                key: 'rfq-documents/rfq-1/bad.pdf',
                filename: 'bad.pdf',
                mimeType: 'application/pdf',
              },
            },
            {
              file: {
                key: 'rfq-documents/rfq-1/ok.pdf',
                filename: 'ok.pdf',
                mimeType: 'application/pdf',
              },
            },
          ],
          invitedVendors: [
            {
              id: 'iv-1',
              vendor: { id: 'v-1', users: [{ email: 'active@vendor.com', status: 'ACTIVE' }] },
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 'rfq-1',
          rfqNumber: 'RFQ-1',
          status: 'OPEN',
          currency: 'AUD',
          companyId: 'comp-1',
          projectId: 'proj-1',
          project: { name: 'Proj' },
          createdBy: { id: 'po-1', name: 'PO' },
          approvedBy: null,
          lineItems: [],
          quoteResponses: [],
          invitedVendors: [],
          documents: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deadlineStart: null,
          deadlineEnd: null,
          deliveryLocationId: null,
          needByDate: null,
          holdForRelease: false,
          earliestDeliveryDate: null,
          message: null,
          totalRequestedQty: 0,
          pickUpLocation: null,
          pickUpDate: null,
          approvalStatus: null,
        });
      mockPrisma.rfq.update.mockResolvedValue({});
      mockPrisma.rfqVendor.update.mockResolvedValue({});
      mockPrisma.rfqVendor.findUnique.mockResolvedValue(null);
      const okPdf = Buffer.from('ok');
      mockStorageService.getObject
        .mockRejectedValueOnce(new Error('S3 down'))
        .mockResolvedValueOnce({ body: okPdf, contentType: 'application/pdf' });
      mockEmailService.sendRfqReceivedEmail.mockResolvedValue(undefined);

      await service.sendRfq('rfq-1', {}, procOfficer);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockEmailService.sendRfqReceivedEmail).toHaveBeenCalledWith(
        'active@vendor.com',
        'RFQ-1',
        'http://localhost:5179/invitation/issued-token-xyz',
        expect.objectContaining({
          cc: [],
          attachments: [{ filename: 'ok.pdf', content: okPdf, contentType: 'application/pdf' }],
          log: expect.objectContaining({ rfqId: 'rfq-1' }),
        }),
      );
    });
  });

  // ── cancelRfq ────────────────────────────────────────────────────────

  describe('cancelRfq', () => {
    it('throws NotFoundException when RFQ not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await expect(service.cancelRfq('rfq-1', procOfficer)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for different company', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        companyId: 'comp-2',
      });

      await expect(service.cancelRfq('rfq-1', procOfficer)).rejects.toThrow(ForbiddenException);
    });

    it('cancels RFQ and returns success', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        companyId: 'comp-1',
      });
      mockPrisma.rfq.update.mockResolvedValue({});

      const result = await service.cancelRfq('rfq-1', procOfficer);
      expect(result).toEqual({ success: true });
      expect(mockPrisma.rfq.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('allows SuperAdmin to cancel any RFQ', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-1',
        companyId: 'comp-1',
      });
      mockPrisma.rfq.update.mockResolvedValue({});

      const result = await service.cancelRfq('rfq-1', superAdmin);
      expect(result).toEqual({ success: true });
    });
  });

  // ── getRfq – invitedVendors mapping ──────────────────────────────────

  describe('getRfq – invitedVendors', () => {
    it('maps invitedVendors with specialisations and contacts', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        id: 'rfq-iv',
        projectId: 'proj-1',
        status: RfqStatus.OPEN,
        pickUpDate: null,
        deliveryLocationId: '123 St',
        pickUpLocation: null,
        deadlineStart: null,
        deadlineEnd: null,
        totalRequestedQty: 50,
        approvalStatus: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lineItems: [],
        quoteResponses: [
          {
            id: 'qr-1',
            vendorId: 'vendor-1',
            totalCost: 5000,
            status: QuoteResponseStatus.APPROVED,
            submittedAt: null,
            discountPercent: null,
            discountAmount: null,
            itemsCovered: 1,
            totalItems: 1,
            vendor: { legalName: 'VendorCo' },
          },
        ],
        documents: [],
        invitedVendors: [
          {
            vendor: {
              id: 'vendor-1',
              legalName: 'VendorCo',
              logoUrl: 'logo.png',
              legalAddress: '100 Main St',
              specialisations: ['steel', 'iron'],
              users: [
                {
                  id: 'u-v1',
                  name: 'Vendor User',
                  role: 'VENDOR',
                  phone: '+123',
                  email: 'v@co.com',
                  position: 'Manager',
                },
              ],
            },
          },
          {
            vendor: {
              id: 'vendor-2',
              legalName: 'AnotherVendor',
              logoUrl: null,
              legalAddress: null,
              specialisations: [],
              users: [],
            },
          },
        ],
      });

      const result = await service.getRfq('rfq-iv', companyAdmin);
      expect(result.vendors).toHaveLength(2);
      expect(result.vendors[0].approved).toBe(true);
      expect(result.vendors[0].category).toBe('steel, iron');
      expect(result.vendors[1].approved).toBe(false);
      expect(result.vendors[1].category).toBeNull();
    });
  });

  // ── updateRfq – scalar and transaction ops ────────────────────────────

  describe('updateRfq – extra branches', () => {
    const draftRfq = {
      id: 'rfq-1',
      status: 'DRAFT',
      companyId: 'comp-1',
      projectId: 'proj-1',
      _count: { quoteResponses: 0 },
    };
    const getRfqResult = {
      id: 'rfq-1',
      rfqNumber: 'RFQ-1',
      status: 'DRAFT',
      currency: 'AUD',
      companyId: 'comp-1',
      projectId: 'proj-1',
      project: { name: 'Proj' },
      createdBy: { id: 'po-1', name: 'PO' },
      approvedBy: null,
      lineItems: [],
      quoteResponses: [],
      invitedVendors: [],
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deadlineStart: null,
      deadlineEnd: null,
      deliveryLocationId: null,
      needByDate: null,
      holdForRelease: false,
      earliestDeliveryDate: null,
      message: null,
      totalRequestedQty: 0,
      pickUpLocation: null,
      pickUpDate: null,
      approvalStatus: null,
    };

    it('updates deliveryLocationId, needByDate, earliestDeliveryDate', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValueOnce(draftRfq).mockResolvedValueOnce(getRfqResult);
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'proj-1',
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateRfq(
        'rfq-1',
        {
          deliveryLocationId: 'loc-1',
          needByDate: '2026-06-01',
          earliestDeliveryDate: '2026-05-01',
        } as never,
        procOfficer,
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('updates with lineItems, vendorIds, and attachmentIds together', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValueOnce(draftRfq).mockResolvedValueOnce(getRfqResult);
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'mat-1' }]);
      mockPrisma.companyVendorAssignment.findMany.mockResolvedValue([{ vendorId: 'v-1' }]);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateRfq(
        'rfq-1',
        {
          lineItems: [
            {
              materialId: 'mat-1',
              quantity: 10,
              uom: 'kg',
              costCode: 'CC-1',
              notes: null,
              pickUp: false,
            },
          ],
          vendorIds: ['v-1'],
          attachmentIds: ['file-1'],
        } as never,
        procOfficer,
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('clears needByDate and earliestDeliveryDate when null', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValueOnce(draftRfq).mockResolvedValueOnce(getRfqResult);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateRfq(
        'rfq-1',
        { needByDate: null, earliestDeliveryDate: null } as never,
        procOfficer,
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('allows holdForRelease=true when earliestDeliveryDate in dto', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValueOnce(draftRfq).mockResolvedValueOnce(getRfqResult);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateRfq(
        'rfq-1',
        {
          holdForRelease: true,
          earliestDeliveryDate: '2026-05-01',
        } as never,
        procOfficer,
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('allows holdForRelease=true when existing earliestDeliveryDate', async () => {
      mockPrisma.rfq.findUnique
        .mockResolvedValueOnce(draftRfq)
        .mockResolvedValueOnce({ earliestDeliveryDate: new Date('2026-05-01') })
        .mockResolvedValueOnce(getRfqResult);
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateRfq('rfq-1', { holdForRelease: true } as never, procOfficer);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── notifyContractorOfQuoteUpdate ────────────────────────────────────────

  describe('notifyContractorOfQuoteUpdate', () => {
    it('sends email to contractor users', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        rfqNumber: 'RFQ-100',
        companyId: 'comp-1',
      });
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'ca@test.com' },
        { email: 'po@test.com' },
      ]);
      mockEmailService.sendQuoteUpdatedEmail.mockResolvedValue(undefined);

      await service.notifyContractorOfQuoteUpdate('rfq-1', 'VendorCo');

      expect(mockEmailService.sendQuoteUpdatedEmail).toHaveBeenCalledTimes(2);
    });

    it('returns early when rfq not found', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue(null);

      await service.notifyContractorOfQuoteUpdate('missing', 'VendorCo');

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('uses rfqId prefix when rfqNumber is null', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        rfqNumber: null,
        companyId: 'comp-1',
      });
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'ca@test.com' }]);
      mockEmailService.sendQuoteUpdatedEmail.mockResolvedValue(undefined);

      await service.notifyContractorOfQuoteUpdate('abcdef12-rest', 'VendorCo');

      expect(mockEmailService.sendQuoteUpdatedEmail).toHaveBeenCalledWith(
        'ca@test.com',
        'ABCDEF12',
        'VendorCo',
        expect.any(String),
      );
    });

    it('does not throw when email service fails', async () => {
      mockPrisma.rfq.findUnique.mockResolvedValue({
        rfqNumber: 'RFQ-1',
        companyId: 'comp-1',
      });
      mockPrisma.user.findMany.mockResolvedValue([{ email: 'ca@test.com' }]);
      mockEmailService.sendQuoteUpdatedEmail.mockRejectedValue(new Error('smtp'));

      await expect(
        service.notifyContractorOfQuoteUpdate('rfq-1', 'VendorCo'),
      ).resolves.toBeUndefined();
    });
  });
});
