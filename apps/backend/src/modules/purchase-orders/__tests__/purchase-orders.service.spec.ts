import { PoListQueryDto, PoQuickFilter } from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PurchaseOrdersService } from '../purchase-orders.service';

/** Build a query object that satisfies the DTO (including computed skip/take). */
function q(overrides: Partial<PoListQueryDto> = {}): PoListQueryDto {
  return Object.assign(new PoListQueryDto(), overrides);
}

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
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
  purchaseOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  quoteResponse: {
    groupBy: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
  projectLocation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  poLineItem: {
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  poDelivery: {
    deleteMany: jest.fn(),
  },
  bulkOrder: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bulkOrderLineItem: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  drawdown: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PurchaseOrdersService(mockPrisma as never);
    // createPurchaseOrder now runs its create + drawdown bookkeeping inside a
    // $transaction callback. Default: invoke the callback with mockPrisma so
    // `tx.*` resolves to the same mocks. updatePurchaseOrder uses the array
    // form; tests that need that form override this per-case.
    mockPrisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: typeof mockPrisma) => unknown)(mockPrisma) : arg,
    );
  });

  describe('listPurchaseOrders', () => {
    beforeEach(() => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
    });

    it('scopes CompanyAdmin to company POs', async () => {
      await service.listPurchaseOrders(q(), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
    });

    it('scopes Vendor to their own POs', async () => {
      await service.listPurchaseOrders(q(), vendor);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-comp-1');
    });

    it('SuperAdmin sees all POs', async () => {
      await service.listPurchaseOrders(q(), superAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('companyId');
      expect(where).not.toHaveProperty('vendorId');
    });

    it('filters by status', async () => {
      await service.listPurchaseOrders(q({ status: 'DRAFT' as never }), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('DRAFT');
    });

    it('filters by projectId', async () => {
      await service.listPurchaseOrders(q({ projectId: 'proj-1' }), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.projectId).toBe('proj-1');
    });

    it('applies search', async () => {
      await service.listPurchaseOrders(q({ search: 'test' }), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
    });

    it('combines search with quick filter that uses OR (splitedPos)', async () => {
      await service.listPurchaseOrders(
        q({ search: 'test', quickFilter: PoQuickFilter.SPLITED_POS }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      // Quick filter sets AND with OR inside, search should also use AND
      expect(where.AND).toBeDefined();
    });

    it('wraps existing non-array AND when search combines with quick filter', async () => {
      await service.listPurchaseOrders(
        q({ search: 'steel', quickFilter: PoQuickFilter.SPLITED_POS }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(Array.isArray(where.AND)).toBe(true);
      expect(where.AND.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches linked RFQ average prices when POs have rfqId', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          poNumber: 'PO-001',
          projectId: 'proj-1',
          status: 'SENT',
          poType: 'STANDARD',
          approvalStatus: 'NOT_REQUIRED',
          sourceOfCreation: 'MANUAL',
          revision: 1,
          priority: null,
          pickUp: false,
          holdForRelease: false,
          deliveryLocationId: null,
          pickUpLocation: null,
          paymentTermsDays: null,
          currency: 'AUD',
          subtotal: null,
          discountAmount: null,
          taxAmount: null,
          totalAmount: 1000,
          lineItemCount: 1,
          totalRequestedQty: 5,
          deadlineStart: null,
          deadlineEnd: null,
          plannedDeliveryDate: null,
          issuedAt: null,
          rfqId: 'rfq-1',
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          company: { legalName: 'TestCo' },
          createdBy: { id: 'u-1', name: 'User' },
          approvedBy: null,
          lastModifiedBy: null,
          lineItems: [],
          _count: { documents: 0 },
        },
      ]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(1);
      mockPrisma.quoteResponse.groupBy.mockResolvedValue([
        { rfqId: 'rfq-1', _avg: { totalCost: 500 } },
      ]);

      const result = await service.listPurchaseOrders(q(), companyAdmin);
      expect(result.items[0].linkedRfqAvgPrice).toBe(500);
      expect(mockPrisma.quoteResponse.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['rfqId'],
          where: { rfqId: { in: ['rfq-1'] } },
        }),
      );
    });

    it('sorts by poNumber', async () => {
      await service.listPurchaseOrders(
        q({ sortBy: 'poNumber' as never, sortDir: 'asc' as never }),
        companyAdmin,
      );
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.poNumber).toBe('asc');
    });

    it('returns paginated response', async () => {
      mockPrisma.purchaseOrder.count.mockResolvedValue(30);
      const result = await service.listPurchaseOrders(q({ page: 2, limit: 10 }), companyAdmin);
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 30, totalPages: 3 });
    });

    it('maps PO items correctly', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          poNumber: 'PO-00001',
          projectId: 'proj-1',
          status: 'SENT',
          poType: 'STANDARD',
          approvalStatus: 'NOT_REQUIRED',
          sourceOfCreation: 'MANUAL',
          revision: 1,
          priority: null,
          pickUp: true,
          holdForRelease: false,
          deliveryLocationId: null,
          pickUpLocation: 'Warehouse',
          paymentTermsDays: null,
          currency: 'AUD',
          subtotal: null,
          discountAmount: null,
          taxAmount: null,
          totalAmount: 25000,
          lineItemCount: 5,
          totalRequestedQty: 20,
          deadlineStart: new Date('2026-04-01'),
          deadlineEnd: new Date('2026-05-01'),
          plannedDeliveryDate: null,
          issuedAt: null,
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          company: { legalName: 'TestCo' },
          createdBy: { id: 'po-1', name: 'PO User' },
          approvedBy: null,
          lastModifiedBy: null,
          lineItems: [{ quantityDelivered: 5 }, { quantityDelivered: 0 }],
          _count: { documents: 0 },
          messages: [],
        },
      ]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(1);

      const result = await service.listPurchaseOrders(q(), companyAdmin);
      expect(result.items[0].poNumber).toBe('PO-00001');
      expect(result.items[0].projectName).toBe('Alpha');
      expect(result.items[0].contractorName).toBe('TestCo');
      expect(result.items[0].pickUp).toBe(true);
      expect(result.items[0].vendorName).toBe('VendorCo');
      expect(result.items[0].lineItemsDelivered).toBe(1);
      expect(result.items[0].quantityDelivered).toBe(5);
    });

    it('sorts by id', async () => {
      await service.listPurchaseOrders(
        q({ sortBy: 'id' as never, sortDir: 'asc' as never }),
        companyAdmin,
      );
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.id).toBe('asc');
    });

    it('sorts by projectName', async () => {
      await service.listPurchaseOrders(
        q({ sortBy: 'projectName' as never, sortDir: 'desc' as never }),
        companyAdmin,
      );
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.project).toEqual({ name: 'desc' });
    });

    it('sorts by status', async () => {
      await service.listPurchaseOrders(
        q({ sortBy: 'status' as never, sortDir: 'asc' as never }),
        companyAdmin,
      );
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.status).toBe('asc');
    });

    it('sorts by totalAmount', async () => {
      await service.listPurchaseOrders(
        q({ sortBy: 'totalAmount' as never, sortDir: 'desc' as never }),
        companyAdmin,
      );
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.totalAmount).toBe('desc');
    });

    it('defaults to createdAt sorting', async () => {
      await service.listPurchaseOrders(q(), companyAdmin);
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.createdAt).toBe('desc');
    });

    it('uses createdAt for unknown sortBy values', async () => {
      await service.listPurchaseOrders(q({ sortBy: 'unknown' as never }), companyAdmin);
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.createdAt).toBeDefined();
    });

    // ── Quick Filters ──────────────────────────────────────────────────────

    it('quickFilter allOpen excludes CLOSED and CANCELLED', async () => {
      await service.listPurchaseOrders(q({ quickFilter: PoQuickFilter.ALL_OPEN }), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({
        notIn: ['CLOSED', 'CANCELLED', 'CANCELLED_BY_VENDOR'],
      });
    });

    it('quickFilter pendingIntApproval filters by PENDING approval', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.PENDING_INT_APPROVAL }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.approvalStatus).toBe('PENDING');
    });

    it('quickFilter pendingExtApproval filters by SENT status', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.PENDING_EXT_APPROVAL }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('SENT');
    });

    it('quickFilter approvedByVendor filters by ACCEPTED/ACKNOWLEDGED', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.APPROVED_BY_VENDOR }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['ACCEPTED', 'ACKNOWLEDGED'] });
    });

    it('quickFilter partiallyDelivered filters by PARTIALLY_DELIVERED', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.PARTIALLY_DELIVERED }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PARTIALLY_DELIVERED');
    });

    it('quickFilter closed filters by CLOSED status', async () => {
      await service.listPurchaseOrders(q({ quickFilter: PoQuickFilter.CLOSED }), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('CLOSED');
    });

    it('quickFilter dueSoon filters by planned delivery within 7 days', async () => {
      await service.listPurchaseOrders(q({ quickFilter: PoQuickFilter.DUE_SOON }), companyAdmin);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.plannedDeliveryDate).toBeDefined();
      expect(where.plannedDeliveryDate.gte).toBeInstanceOf(Date);
      expect(where.plannedDeliveryDate.lte).toBeInstanceOf(Date);
    });

    it('quickFilter openRevision filters by unapproved change requests', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.OPEN_REVISION }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.changeRequests).toEqual({ some: { resolvedById: null } });
    });

    it('quickFilter recentlyUpdated filters by updatedAt within 7 days', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.RECENTLY_UPDATED }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.updatedAt).toBeDefined();
      expect(where.updatedAt.gte).toBeInstanceOf(Date);
    });

    it('quickFilter withUnreadMessages filters POs with documents', async () => {
      await service.listPurchaseOrders(
        q({ quickFilter: PoQuickFilter.WITH_UNREAD_MESSAGES }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.documents).toEqual({ some: {} });
    });

    it('quickFilter splitedPos filters by SPLIT type or parent PO', async () => {
      await service.listPurchaseOrders(q({ quickFilter: PoQuickFilter.SPLITED_POS }), vendor);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.AND).toEqual(
        expect.arrayContaining([{ OR: [{ poType: 'SPLIT' }, { parentPoId: { not: null } }] }]),
      );
    });

    it('combines search with quick filter that sets where.OR via AND array', async () => {
      // Spy on applyQuickFilter to simulate a quick filter that sets where.OR
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = jest.spyOn(service as any, 'applyQuickFilter');
      spy.mockImplementation((...args: unknown[]) => {
        const where = args[0] as Record<string, unknown>;
        where.OR = [{ status: 'SENT' }];
      });

      await service.listPurchaseOrders(
        q({ search: 'steel', quickFilter: PoQuickFilter.ALL_OPEN }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;

      // search should be added via AND since where.OR is already occupied
      expect(where.AND).toBeDefined();
      expect(Array.isArray(where.AND)).toBe(true);
      expect(where.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ id: { contains: 'steel', mode: 'insensitive' } }),
            ]),
          }),
        ]),
      );

      spy.mockRestore();
    });

    it('appends search to existing AND array when where.OR is set', async () => {
      // Spy on applyQuickFilter to simulate a quick filter that sets both where.OR and where.AND
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = jest.spyOn(service as any, 'applyQuickFilter');
      spy.mockImplementation((...args: unknown[]) => {
        const where = args[0] as Record<string, unknown>;
        where.OR = [{ status: 'SENT' }];
        where.AND = [{ companyId: 'comp-1' }];
      });

      await service.listPurchaseOrders(
        q({ search: 'concrete', quickFilter: PoQuickFilter.ALL_OPEN }),
        companyAdmin,
      );
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;

      // existing AND items should be preserved plus new search condition
      expect(Array.isArray(where.AND)).toBe(true);
      expect(where.AND.length).toBe(2);
      expect(where.AND[0]).toEqual({ companyId: 'comp-1' });
      expect(where.AND[1]).toEqual(
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ id: { contains: 'concrete', mode: 'insensitive' } }),
          ]),
        }),
      );

      spy.mockRestore();
    });
  });

  describe('getPurchaseOrder', () => {
    it('returns PO detail', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-00001',
        documentName: null,
        projectId: 'proj-1',
        status: 'DRAFT',
        poType: 'STANDARD',
        approvalStatus: 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: 1,
        priority: null,
        pickUp: false,
        holdForRelease: false,
        deliveryLocationId: 'loc-1',
        deliveryLocation: null,
        pickUpLocation: null,
        currency: 'AUD',
        subtotal: null,
        discountAmount: null,
        taxAmount: null,
        totalAmount: null,
        paymentTermsDays: null,
        costCode: null,
        lineItemCount: 3,
        totalRequestedQty: 10,
        deadlineStart: null,
        deadlineEnd: null,
        plannedDeliveryDate: null,
        deliveryNotes: null,
        issuedAt: null,
        parentPoId: null,
        rfqId: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        vendor: { id: 'v-1', legalName: 'VendorCo' },
        company: { id: 'comp-1', legalName: 'TestCo' },
        createdBy: { id: 'po-1', name: 'PO User' },
        approvedBy: null,
        lastModifiedBy: null,
        lineItems: [],
        documents: [],
        invoices: [],
      });

      const result = await service.getPurchaseOrder('po-1', companyAdmin);
      expect(result.id).toBe('po-1');
      expect(result.poNumber).toBe('PO-00001');
      expect(result.vendor?.name).toBe('VendorCo');
      expect(result.company?.name).toBe('TestCo');
    });

    it('returns documentName and deliveryLocationName in PO detail', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-2',
        poNumber: 'PO-00002',
        documentName: 'My PO Document',
        projectId: 'proj-1',
        status: 'DRAFT',
        poType: 'HOLD_FOR_RELEASE',
        approvalStatus: 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: 1,
        priority: null,
        pickUp: false,
        holdForRelease: true,
        deliveryLocationId: 'loc-1',
        deliveryLocation: { label: 'Warehouse A', address: '123 Main St' },
        pickUpLocation: null,
        pickUpTimeExpectation: null,
        pickUpPersonName: null,
        pickUpPersonPhone: null,
        currency: 'AUD',
        subtotal: null,
        discountAmount: null,
        taxAmount: null,
        totalAmount: null,
        paymentTermsDays: null,
        costCode: null,
        lineItemCount: 0,
        totalRequestedQty: 0,
        deadlineStart: new Date('2026-04-01'),
        deadlineEnd: null,
        plannedDeliveryDate: new Date('2026-04-15'),
        deliveryNotes: null,
        message: null,
        deliveryResponsibleName: null,
        deliveryResponsibleEmail: null,
        issuedAt: null,
        parentPoId: null,
        rfqId: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Beta' },
        vendor: { id: 'v-1', legalName: 'VendorCo' },
        company: { id: 'comp-1', legalName: 'TestCo' },
        createdBy: { id: 'ca-1', name: 'CA User' },
        approvedBy: null,
        lastModifiedBy: null,
        lineItems: [],
        documents: [],
        invoices: [],
      });

      const result = await service.getPurchaseOrder('po-2', companyAdmin);
      expect(result.documentName).toBe('My PO Document');
      expect(result.deliveryLocationName).toBe('Warehouse A');
    });

    it('falls back to address when deliveryLocation label is null', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-3',
        poNumber: 'PO-00003',
        documentName: null,
        projectId: 'proj-1',
        status: 'DRAFT',
        poType: 'STANDARD',
        approvalStatus: 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: 1,
        priority: null,
        pickUp: false,
        holdForRelease: false,
        deliveryLocationId: 'loc-1',
        deliveryLocation: { label: null, address: '456 Oak Ave' },
        pickUpLocation: null,
        pickUpTimeExpectation: null,
        pickUpPersonName: null,
        pickUpPersonPhone: null,
        currency: 'AUD',
        subtotal: null,
        discountAmount: null,
        taxAmount: null,
        totalAmount: null,
        paymentTermsDays: null,
        costCode: null,
        lineItemCount: 0,
        totalRequestedQty: 0,
        deadlineStart: null,
        deadlineEnd: null,
        plannedDeliveryDate: null,
        deliveryNotes: null,
        message: null,
        deliveryResponsibleName: null,
        deliveryResponsibleEmail: null,
        issuedAt: null,
        parentPoId: null,
        rfqId: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        vendor: { id: 'v-1', legalName: 'VendorCo' },
        company: { id: 'comp-1', legalName: 'TestCo' },
        createdBy: { id: 'ca-1', name: 'CA User' },
        approvedBy: null,
        lastModifiedBy: null,
        lineItems: [],
        documents: [],
        invoices: [],
      });

      const result = await service.getPurchaseOrder('po-3', companyAdmin);
      expect(result.documentName).toBeNull();
      expect(result.deliveryLocationName).toBe('456 Oak Ave');
    });

    it('returns null deliveryLocationName when no delivery location', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-4',
        poNumber: 'PO-00004',
        documentName: null,
        projectId: 'proj-1',
        status: 'DRAFT',
        poType: 'STANDARD',
        approvalStatus: 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: 1,
        priority: null,
        pickUp: false,
        holdForRelease: false,
        deliveryLocationId: null,
        deliveryLocation: null,
        pickUpLocation: null,
        pickUpTimeExpectation: null,
        pickUpPersonName: null,
        pickUpPersonPhone: null,
        currency: 'AUD',
        subtotal: null,
        discountAmount: null,
        taxAmount: null,
        totalAmount: null,
        paymentTermsDays: null,
        costCode: null,
        lineItemCount: 0,
        totalRequestedQty: 0,
        deadlineStart: null,
        deadlineEnd: null,
        plannedDeliveryDate: null,
        deliveryNotes: null,
        message: null,
        deliveryResponsibleName: null,
        deliveryResponsibleEmail: null,
        issuedAt: null,
        parentPoId: null,
        rfqId: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        vendor: null,
        company: { id: 'comp-1', legalName: 'TestCo' },
        createdBy: { id: 'ca-1', name: 'CA User' },
        approvedBy: null,
        lastModifiedBy: null,
        lineItems: [],
        documents: [],
        invoices: [],
      });

      const result = await service.getPurchaseOrder('po-4', companyAdmin);
      expect(result.deliveryLocationName).toBeNull();
    });

    it('maps lineItems, documents, and invoices correctly', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-00001',
        projectId: 'proj-1',
        status: 'DRAFT',
        poType: 'STANDARD',
        approvalStatus: 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: 1,
        priority: null,
        pickUp: false,
        holdForRelease: false,
        deliveryLocationId: 'loc-1',
        pickUpLocation: null,
        currency: 'AUD',
        subtotal: 100,
        discountAmount: 10,
        taxAmount: 9,
        totalAmount: 99,
        paymentTermsDays: null,
        costCode: 'CC-1',
        lineItemCount: 1,
        totalRequestedQty: 10,
        deadlineStart: new Date('2026-04-01'),
        deadlineEnd: new Date('2026-05-01'),
        plannedDeliveryDate: new Date('2026-04-15'),
        deliveryNotes: 'handle with care',
        issuedAt: new Date('2026-03-10'),
        parentPoId: null,
        rfqId: 'rfq-1',
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        vendor: { id: 'v-1', legalName: 'VendorCo' },
        company: { id: 'comp-1', legalName: 'TestCo' },
        createdBy: { id: 'u-1', name: 'PO User' },
        approvedBy: { id: 'u-2', name: 'Admin' },
        lastModifiedBy: { id: 'u-3', name: 'Editor' },
        lineItems: [
          {
            id: 'li-1',
            lineNumber: 1,
            materialId: 'Steel',
            material: { name: 'Steel' },
            materialCode: 'ST-01',
            description: 'Steel bars',
            quantityOrdered: 10,
            quantityDelivered: 3,
            unitOfMeasure: 'pcs',
            unitPrice: 50,
            lineTotal: 500,
            costCode: 'CC-1',
            expectedDeliveryDate: new Date('2026-04-10'),
            deliveryLocationId: 'loc-2',
            notes: 'urgent',
          },
        ],
        documents: [
          {
            id: 'doc-1',
            fileId: 'f-1',
            createdAt: new Date('2026-03-01'),
            file: {
              filename: 'spec.pdf',
              mimeType: 'application/pdf',
              size: 1024,
              uploadedBy: { id: 'u-1', name: 'Uploader', email: 'up@test.com' },
            },
          },
        ],
        invoices: [{ id: 'inv-1', status: 'PENDING', totalAmount: 500 }],
      });

      const result = await service.getPurchaseOrder('po-1', companyAdmin);

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]).toEqual(
        expect.objectContaining({
          id: 'li-1',
          materialId: 'Steel',
          unitPrice: 50,
          lineTotal: 500,
          expectedDeliveryDate: '2026-04-10T00:00:00.000Z',
        }),
      );
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]).toEqual(
        expect.objectContaining({
          id: 'doc-1',
          name: 'spec.pdf',
          fileId: 'f-1',
          uploadedBy: { name: 'Uploader', email: 'up@test.com', avatarUrl: null },
        }),
      );
      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0]).toEqual({ id: 'inv-1', status: 'PENDING', totalAmount: 500 });

      // Also verify related object mapping
      expect(result.approvedBy).toEqual({ id: 'u-2', name: 'Admin' });
      expect(result.lastModifiedBy).toEqual({ id: 'u-3', name: 'Editor' });
      expect(result.subtotal).toBe(100);
      expect(result.deadlineStart).toBe('2026-04-01T00:00:00.000Z');
    });

    it('throws NotFoundException for missing PO', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.getPurchaseOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── copyPurchaseOrder ─────────────────────────────────────────────────────

  describe('copyPurchaseOrder', () => {
    const sourcePo = {
      id: 'po-1',
      companyId: 'comp-1',
      projectId: 'proj-1',
      vendorId: 'v-1',
      poType: 'STANDARD',
      currency: 'AUD',
      deliveryLocationId: 'loc-1',
      pickUp: false,
      pickUpLocation: null,
      holdForRelease: false,
      deliveryNotes: null,
      paymentTermsDays: 30,
      costCode: 'CC-1',
      deadlineStart: new Date('2026-04-01'),
      deadlineEnd: new Date('2026-05-01'),
      plannedDeliveryDate: null,
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 100,
      totalAmount: 1100,
      lineItemCount: 1,
      totalRequestedQty: 10,
      lineItems: [
        {
          lineNumber: 1,
          materialId: 'Steel',
          materialCode: 'ST-01',
          description: 'Steel bars',
          quantityOrdered: 10,
          unitOfMeasure: 'pcs',
          unitPrice: 100,
          lineTotal: 1000,
          costCode: 'CC-1',
          expectedDeliveryDate: new Date('2026-04-10'),
          deliveryLocationId: 'loc-2',
          notes: null,
        },
      ],
    };

    it('throws NotFoundException when PO does not exist', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(service.copyPurchaseOrder('missing', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ ...sourcePo, companyId: 'other' });
      await expect(service.copyPurchaseOrder('po-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a DRAFT copy with line items', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(sourcePo);
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-copy-1' });
      const result = await service.copyPurchaseOrder('po-1', companyAdmin);
      expect(result).toEqual({ id: 'po-copy-1' });
      const call = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(call.data.status).toBe('DRAFT');
      expect(call.data.lineItems.create).toHaveLength(1);
    });

    it('allows SuperAdmin to copy PO from any company', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ ...sourcePo, companyId: 'any' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-copy-1' });
      const result = await service.copyPurchaseOrder('po-1', superAdmin);
      expect(result).toEqual({ id: 'po-copy-1' });
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fullPoDetail = {
    id: 'po-new',
    poNumber: 'PO-ABCD1234',
    projectId: 'proj-1',
    status: 'DRAFT',
    poType: 'STANDARD',
    approvalStatus: 'NOT_REQUIRED',
    sourceOfCreation: 'MANUAL',
    revision: 1,
    priority: null,
    pickUp: false,
    holdForRelease: false,
    deliveryLocationId: 'loc-1',
    pickUpLocation: null,
    pickUpTimeExpectation: null,
    pickUpPersonName: null,
    pickUpPersonPhone: null,
    currency: 'AUD',
    subtotal: 500,
    discountAmount: null,
    taxAmount: null,
    totalAmount: 500,
    paymentTermsDays: 30,
    costCode: null,
    lineItemCount: 1,
    totalRequestedQty: 10,
    deadlineStart: null,
    deadlineEnd: null,
    plannedDeliveryDate: null,
    deliveryNotes: null,
    message: null,
    deliveryResponsibleName: null,
    deliveryResponsibleEmail: null,
    issuedAt: null,
    parentPoId: null,
    rfqId: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    project: { name: 'Alpha' },
    vendor: { id: 'v-1', legalName: 'VendorCo' },
    company: { id: 'comp-1', legalName: 'TestCo' },
    createdBy: { id: 'ca-1', name: 'CA User' },
    approvedBy: null,
    lastModifiedBy: null,
    lineItems: [
      {
        id: 'li-1',
        lineNumber: 1,
        materialId: 'mat-1',
        material: { name: 'Steel' },
        materialCode: 'ST-01',
        description: 'Steel bars',
        quantityOrdered: 10,
        quantityDelivered: 0,
        unitOfMeasure: 'pcs',
        unitPrice: 50,
        lineTotal: 500,
        costCode: null,
        expectedDeliveryDate: null,
        deliveryLocationId: null,
        notes: null,
      },
    ],
    documents: [],
    invoices: [],
    deliveries: [],
    deliveryLocation: null,
  };

  function mockGetPoAfterMutation() {
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue(fullPoDetail);
  }

  // ── createPurchaseOrder ───────────────────────────────────────────────────

  describe('createPurchaseOrder', () => {
    const baseDto = {
      projectId: 'proj-1',
      vendorId: 'v-1',
      deliveryLocationId: 'loc-1',
      lineItems: [
        {
          materialId: 'mat-1',
          materialCode: 'ST-01',
          description: 'Steel bars',
          quantityOrdered: 10,
          unitOfMeasure: 'pcs',
          unitPrice: 50,
        },
      ],
    };

    it('throws NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.createPurchaseOrder(baseDto as never, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'other' });
      await expect(service.createPurchaseOrder(baseDto as never, companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when vendor not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue(null);
      await expect(service.createPurchaseOrder(baseDto as never, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when delivery location is invalid', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue(null);
      await expect(service.createPurchaseOrder(baseDto as never, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates PO successfully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockGetPoAfterMutation();
      const result = await service.createPurchaseOrder(baseDto as never, companyAdmin);
      expect(result.id).toBe('po-new');
    });

    // ── FOR-210: multi-delivery rows ──────────────────────────────────────

    it('persists delivery rows with sequence and validated locations', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.projectLocation.findMany.mockResolvedValue([{ id: 'loc-2' }, { id: 'loc-3' }]);
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockGetPoAfterMutation();

      const dto = {
        ...baseDto,
        deliveries: [
          { deliveryLocationId: 'loc-2', deliveryDate: '2026-07-01T00:00:00.000Z', notes: 'AM' },
          { deliveryLocationId: 'loc-3' },
          { deliveryDate: '2026-07-05T00:00:00.000Z' },
        ],
      };

      await service.createPurchaseOrder(dto as never, companyAdmin);

      const createArg = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(createArg.data.deliveries.create).toEqual([
        {
          deliveryLocationId: 'loc-2',
          deliveryDate: new Date('2026-07-01T00:00:00.000Z'),
          notes: 'AM',
          sequence: 0,
        },
        { deliveryLocationId: 'loc-3', deliveryDate: null, notes: null, sequence: 1 },
        {
          deliveryLocationId: null,
          deliveryDate: new Date('2026-07-05T00:00:00.000Z'),
          notes: null,
          sequence: 2,
        },
      ]);
    });

    it('rejects a delivery row with neither location nor date', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.projectLocation.findMany.mockResolvedValue([]);

      const dto = { ...baseDto, deliveries: [{ notes: 'no location, no date' }] };

      await expect(service.createPurchaseOrder(dto as never, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.purchaseOrder.create).not.toHaveBeenCalled();
    });

    it('rejects a delivery location that does not belong to the project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      // findMany only returns locations that belong to the project — 'loc-x' absent
      mockPrisma.projectLocation.findMany.mockResolvedValue([]);

      const dto = { ...baseDto, deliveries: [{ deliveryLocationId: 'loc-x' }] };

      await expect(service.createPurchaseOrder(dto as never, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.purchaseOrder.create).not.toHaveBeenCalled();
    });

    // ── Drawdown-from-PO (US 5.09) ────────────────────────────────────────

    const drawdownDto = {
      projectId: 'proj-1',
      vendorId: 'v-1',
      deliveryLocationId: 'loc-1',
      sourceOfCreation: 'BULK_DRAWDOWN',
      bulkOrderId: 'bo-1',
      lineItems: [
        {
          materialId: 'mat-1',
          description: 'Steel bars',
          quantityOrdered: 4,
          unitOfMeasure: 'pcs',
          unitPrice: 50,
          bulkOrderLineItemId: 'bo-li-1',
        },
      ],
    };

    function setupDrawdownHappyPath(remaining = 10, ordered = 0, qty = 10) {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        bulkOrderNumber: 'BULK-00001',
      });
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue({
        id: 'bo-li-1',
        bulkOrderId: 'bo-1',
        itemReference: 'STEEL',
        description: 'Steel bars',
        qty,
        ordered,
        qtyRemaining: remaining,
      });
      mockPrisma.drawdown.create.mockResolvedValue({ id: 'dd-1' });
      mockPrisma.bulkOrderLineItem.update.mockResolvedValue({});
      mockPrisma.bulkOrder.update.mockResolvedValue({});
      mockGetPoAfterMutation();
    }

    it('forces poType=DRAWDOWN and writes a Drawdown decrementing remaining qty', async () => {
      setupDrawdownHappyPath(10, 2, 12);
      // After this drawdown 6 remain → bulk order stays ACTIVE
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([{ qtyRemaining: 6 }]);

      const result = await service.createPurchaseOrder(drawdownDto as never, companyAdmin);
      expect(result.id).toBe('po-new');

      // poType forced to DRAWDOWN on the create payload
      const createArg = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(createArg.data.poType).toBe('DRAWDOWN');
      // bulkOrderLineItemId is NOT persisted on the PO line
      expect(createArg.data.lineItems.create[0]).not.toHaveProperty('bulkOrderLineItemId');

      // Drawdown row written with qtyBeforeDrawdown = current remaining
      expect(mockPrisma.drawdown.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bulkOrderId: 'bo-1',
            lineItemId: 'bo-li-1',
            purchaseOrderId: 'po-new',
            quantity: 4,
            qtyBeforeDrawdown: 10,
            createdByUserId: 'ca-1',
          }),
        }),
      );
      // Line decremented (10-4=6), ordered incremented (2+4=6), util = 6/12 = 50%
      expect(mockPrisma.bulkOrderLineItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bo-li-1' },
          data: expect.objectContaining({ qtyRemaining: 6, ordered: 6, deliveriesPercent: 50 }),
        }),
      );
      // Not fully drawn → bulk order status untouched
      expect(mockPrisma.bulkOrder.update).not.toHaveBeenCalled();
    });

    it('marks the bulk order COMPLETED when every line reaches zero remaining', async () => {
      setupDrawdownHappyPath(4, 0, 4); // drawing 4 of 4 → 0 remaining
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([{ qtyRemaining: 0 }]);

      await service.createPurchaseOrder(drawdownDto as never, companyAdmin);

      expect(mockPrisma.bulkOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bo-1' },
          data: { status: 'COMPLETED' },
        }),
      );
    });

    it('throws 400 when a drawdown line exceeds the remaining quantity', async () => {
      setupDrawdownHappyPath(2); // only 2 remaining but the DTO draws 4
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([{ qtyRemaining: 2 }]);

      await expect(service.createPurchaseOrder(drawdownDto as never, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.drawdown.create).not.toHaveBeenCalled();
    });

    it('throws 404 when the source bulk order is missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockPrisma.bulkOrder.findUnique.mockResolvedValue(null);

      await expect(service.createPurchaseOrder(drawdownDto as never, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when a referenced bulk-order line does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({ id: 'bo-1', bulkOrderNumber: null });
      mockPrisma.bulkOrderLineItem.findFirst.mockResolvedValue(null);

      await expect(service.createPurchaseOrder(drawdownDto as never, companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('skips PO lines without a bulkOrderLineItemId and uses the bulk id when number is null', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      // bulkOrderNumber null → error/label path would fall back to id; here the
      // line has no bulkOrderLineItemId so the drawdown loop skips it entirely.
      mockPrisma.bulkOrder.findUnique.mockResolvedValue({ id: 'bo-1', bulkOrderNumber: null });
      mockPrisma.bulkOrderLineItem.findMany.mockResolvedValue([]); // no lines → not completed
      mockGetPoAfterMutation();

      const dtoNoBulkLine = {
        ...drawdownDto,
        lineItems: [{ ...drawdownDto.lineItems[0], bulkOrderLineItemId: undefined }],
      };
      await service.createPurchaseOrder(dtoNoBulkLine as never, companyAdmin);

      // poType still DRAWDOWN (sourced from bulk order), but no drawdown rows
      const createArg = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(createArg.data.poType).toBe('DRAWDOWN');
      expect(mockPrisma.drawdown.create).not.toHaveBeenCalled();
      expect(mockPrisma.bulkOrder.update).not.toHaveBeenCalled();
    });

    it('does NOT run drawdowns when bulkOrderId is absent even if source is BULK_DRAWDOWN', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockGetPoAfterMutation();

      const dto = { ...drawdownDto, bulkOrderId: undefined };
      await service.createPurchaseOrder(dto as never, companyAdmin);

      expect(mockPrisma.drawdown.create).not.toHaveBeenCalled();
      // poType not forced when there is no source bulk order
      const createArg = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(createArg.data.poType).not.toBe('DRAWDOWN');
    });
  });

  // ── updatePurchaseOrder ───────────────────────────────────────────────────

  describe('updatePurchaseOrder', () => {
    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePurchaseOrder('missing', {} as never, companyAdmin),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user company does not match', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'other',
        projectId: 'proj-1',
      });
      await expect(service.updatePurchaseOrder('po-1', {} as never, companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when PO is not DRAFT', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'SENT',
        companyId: 'comp-1',
        projectId: 'proj-1',
      });
      await expect(service.updatePurchaseOrder('po-1', {} as never, companyAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates metadata without line items', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      const result = await service.updatePurchaseOrder(
        'po-1',
        { vendorId: 'v-2' } as never,
        companyAdmin,
      );
      expect(result.id).toBe('po-new');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates with line items using transaction', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);
      const dto = {
        lineItems: [
          {
            materialId: 'mat-1',
            materialCode: 'ST-01',
            description: 'Steel',
            quantityOrdered: 20,
            unitOfMeasure: 'pcs',
            unitPrice: 60,
          },
        ],
      };
      const result = await service.updatePurchaseOrder('po-1', dto as never, companyAdmin);
      expect(result.id).toBe('po-new');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('allows SuperAdmin to update PO from any company', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'other',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      const result = await service.updatePurchaseOrder(
        'po-1',
        { vendorId: 'v-2' } as never,
        superAdmin,
      );
      expect(result.id).toBe('po-new');
    });

    it('validates deliveryLocationId when provided — not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        projectId: 'proj-1',
      });
      mockPrisma.projectLocation.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePurchaseOrder(
          'po-1',
          { deliveryLocationId: 'bad-loc' } as never,
          companyAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates deliveryLocationId — wrong project', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DRAFT',
        companyId: 'comp-1',
        projectId: 'proj-1',
      });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'proj-other',
      });
      await expect(
        service.updatePurchaseOrder('po-1', { deliveryLocationId: 'loc-1' } as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when holdForRelease=true without deadlineStart and no existing', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce({ deadlineStart: null });
      await expect(
        service.updatePurchaseOrder('po-1', { holdForRelease: true } as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows holdForRelease=true when PO already has deadlineStart', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce({ deadlineStart: new Date('2026-04-01') })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      const result = await service.updatePurchaseOrder(
        'po-1',
        { holdForRelease: true } as never,
        companyAdmin,
      );
      expect(result.id).toBe('po-new');
    });

    it('validates deliveryLocationId successfully when location matches', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'proj-1',
      });
      mockPrisma.purchaseOrder.update.mockResolvedValue({});
      const result = await service.updatePurchaseOrder(
        'po-1',
        { deliveryLocationId: 'loc-1' } as never,
        companyAdmin,
      );
      expect(result.id).toBe('po-new');
    });

    it('replaces line items and deliveries while clearing both deadlines', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.projectLocation.findMany.mockResolvedValue([{ id: 'loc-1' }]);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

      const dto = {
        lineItems: [
          {
            materialId: 'mat-1',
            description: 'Steel',
            quantityOrdered: 5,
            unitOfMeasure: 'pcs',
            unitPrice: 10,
          },
        ],
        deliveries: [{ deliveryLocationId: 'loc-1', deliveryDate: '2026-05-01' }],
        deadlineStart: null,
        deadlineEnd: null,
      };

      const result = await service.updatePurchaseOrder('po-1', dto as never, companyAdmin);
      expect(result.id).toBe('po-new');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('replaces deliveries and clears deadlines without line items', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.projectLocation.findMany.mockResolvedValue([{ id: 'loc-1' }]);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const dto = {
        vendorId: 'v-2',
        deliveries: [{ deliveryLocationId: 'loc-1', deliveryDate: '2026-05-01' }],
        deadlineStart: null,
        deadlineEnd: null,
      };

      const result = await service.updatePurchaseOrder('po-1', dto as never, companyAdmin);
      expect(result.id).toBe('po-new');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('createPurchaseOrder – holdForRelease', () => {
    const baseCreateDto = {
      projectId: 'proj-1',
      vendorId: 'v-1',
      deliveryLocationId: 'loc-1',
      lineItems: [
        {
          materialId: 'mat-1',
          materialCode: 'ST-01',
          description: 'Steel bars',
          quantityOrdered: 10,
          unitOfMeasure: 'pcs',
          unitPrice: 50,
        },
      ],
    };

    it('throws when holdForRelease is true and deadlineStart is missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        companyId: 'comp-1',
      });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'proj-1',
      });
      await expect(
        service.createPurchaseOrder(
          { ...baseCreateDto, holdForRelease: true } as never,
          companyAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows holdForRelease when deadlineStart is provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        companyId: 'comp-1',
      });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'proj-1',
      });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(fullPoDetail);
      const result = await service.createPurchaseOrder(
        {
          ...baseCreateDto,
          holdForRelease: true,
          deadlineStart: '2026-04-01',
        } as never,
        companyAdmin,
      );
      expect(result.id).toBe('po-new');
    });

    it('allows SuperAdmin to create PO for any project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        companyId: 'any',
      });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'v-1' });
      mockPrisma.projectLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        projectId: 'proj-1',
      });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new' });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(fullPoDetail);
      const result = await service.createPurchaseOrder(baseCreateDto as never, superAdmin);
      expect(result.id).toBe('po-new');
    });
  });

  // ── Additional branch-coverage tests ─────────────────────────────────────

  describe('listPurchaseOrders – default sortBy/sortDir (lines 36-37)', () => {
    beforeEach(() => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
    });

    it('defaults sortBy to createdDate and sortDir to desc when both are undefined', async () => {
      const query = q({ sortBy: undefined, sortDir: undefined });
      await service.listPurchaseOrders(query, companyAdmin);
      const orderBy = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].orderBy;
      expect(orderBy.createdAt).toBe('desc');
    });
  });

  describe('listPurchaseOrders – truthy monetary fields (lines 161-164)', () => {
    beforeEach(() => {
      mockPrisma.purchaseOrder.count.mockResolvedValue(1);
    });

    it('converts subtotal, discountAmount, taxAmount, totalAmount to numbers when truthy', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-money',
          poNumber: 'PO-MONEY',
          projectId: 'proj-1',
          status: 'DRAFT',
          poType: 'STANDARD',
          approvalStatus: 'NOT_REQUIRED',
          sourceOfCreation: 'MANUAL',
          revision: 1,
          priority: null,
          pickUp: false,
          holdForRelease: false,
          deliveryLocationId: null,
          pickUpLocation: null,
          paymentTermsDays: null,
          currency: 'AUD',
          subtotal: '500.50',
          discountAmount: '10.25',
          taxAmount: '49.00',
          totalAmount: '539.25',
          lineItemCount: 1,
          totalRequestedQty: 5,
          deadlineStart: null,
          deadlineEnd: null,
          plannedDeliveryDate: null,
          issuedAt: null,
          rfqId: null,
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          vendor: null,
          company: { legalName: 'TestCo' },
          createdBy: { id: 'u-1', name: 'User' },
          approvedBy: null,
          lastModifiedBy: null,
          lineItems: [],
          _count: { documents: 0 },
        },
      ]);

      const result = await service.listPurchaseOrders(q(), companyAdmin);
      const item = result.items[0];
      expect(item.subtotal).toBe(500.5);
      expect(item.discountAmount).toBe(10.25);
      expect(item.taxAmount).toBe(49);
      expect(item.totalAmount).toBe(539.25);
      expect(item.vendorName).toBeNull();
      expect(item.linkedRfqAvgPrice).toBeNull();
    });
  });

  describe('listPurchaseOrders – rfqId present but no avg match (line 183)', () => {
    beforeEach(() => {
      mockPrisma.purchaseOrder.count.mockResolvedValue(1);
    });

    it('returns null linkedRfqAvgPrice when rfqId exists but no avg found', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-rfq',
          poNumber: 'PO-RFQ',
          projectId: 'proj-1',
          status: 'DRAFT',
          poType: 'STANDARD',
          approvalStatus: 'NOT_REQUIRED',
          sourceOfCreation: 'MANUAL',
          revision: 1,
          priority: null,
          pickUp: false,
          holdForRelease: false,
          deliveryLocationId: null,
          pickUpLocation: null,
          paymentTermsDays: null,
          currency: 'AUD',
          subtotal: null,
          discountAmount: null,
          taxAmount: null,
          totalAmount: null,
          lineItemCount: 0,
          totalRequestedQty: 0,
          deadlineStart: null,
          deadlineEnd: null,
          plannedDeliveryDate: null,
          issuedAt: null,
          rfqId: 'rfq-no-match',
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          company: { legalName: 'TestCo' },
          createdBy: { id: 'u-1', name: 'User' },
          approvedBy: null,
          lastModifiedBy: null,
          lineItems: [],
          _count: { documents: 0 },
        },
      ]);
      // groupBy returns results but none matching rfq-no-match
      mockPrisma.quoteResponse.groupBy.mockResolvedValue([
        { rfqId: 'rfq-other', _avg: { totalCost: 100 } },
      ]);

      const result = await service.listPurchaseOrders(q(), companyAdmin);
      expect(result.items[0].linkedRfqAvgPrice).toBeNull();
    });

    it('skips null _avg.totalCost in rfq avg map', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-rfq2',
          poNumber: 'PO-RFQ2',
          projectId: 'proj-1',
          status: 'DRAFT',
          poType: 'STANDARD',
          approvalStatus: 'NOT_REQUIRED',
          sourceOfCreation: 'MANUAL',
          revision: 1,
          priority: null,
          pickUp: false,
          holdForRelease: false,
          deliveryLocationId: null,
          pickUpLocation: null,
          paymentTermsDays: null,
          currency: 'AUD',
          subtotal: null,
          discountAmount: null,
          taxAmount: null,
          totalAmount: null,
          lineItemCount: 0,
          totalRequestedQty: 0,
          deadlineStart: null,
          deadlineEnd: null,
          plannedDeliveryDate: null,
          issuedAt: null,
          rfqId: 'rfq-null-avg',
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          company: { legalName: 'TestCo' },
          createdBy: { id: 'u-1', name: 'User' },
          approvedBy: null,
          lastModifiedBy: null,
          lineItems: [],
          _count: { documents: 0 },
        },
      ]);
      mockPrisma.quoteResponse.groupBy.mockResolvedValue([
        { rfqId: 'rfq-null-avg', _avg: { totalCost: null } },
      ]);

      const result = await service.listPurchaseOrders(q(), companyAdmin);
      expect(result.items[0].linkedRfqAvgPrice).toBeNull();
    });
  });

  describe('getPurchaseOrder – null material and null uploadedBy (lines 267, 286-287)', () => {
    it('returns null materialName when line item has no material', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-nullmat',
        poNumber: 'PO-NULLMAT',
        documentName: null,
        projectId: 'proj-1',
        status: 'DRAFT',
        poType: 'STANDARD',
        approvalStatus: 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: 1,
        priority: null,
        pickUp: false,
        holdForRelease: false,
        deliveryLocationId: null,
        deliveryLocation: null,
        pickUpLocation: null,
        pickUpTimeExpectation: null,
        pickUpPersonName: null,
        pickUpPersonPhone: null,
        currency: 'AUD',
        subtotal: null,
        discountAmount: null,
        taxAmount: null,
        totalAmount: null,
        paymentTermsDays: null,
        costCode: null,
        lineItemCount: 1,
        totalRequestedQty: 5,
        deadlineStart: null,
        deadlineEnd: null,
        plannedDeliveryDate: null,
        deliveryNotes: null,
        message: null,
        deliveryResponsibleName: null,
        deliveryResponsibleEmail: null,
        issuedAt: null,
        parentPoId: null,
        rfqId: null,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        project: { name: 'Alpha' },
        vendor: null,
        company: { id: 'comp-1', legalName: 'TestCo' },
        createdBy: { id: 'u-1', name: 'User' },
        approvedBy: null,
        lastModifiedBy: null,
        lineItems: [
          {
            id: 'li-nullmat',
            lineNumber: 1,
            materialId: null,
            material: null,
            materialCode: null,
            description: 'Custom item',
            quantityOrdered: 5,
            quantityDelivered: 0,
            unitOfMeasure: 'pcs',
            unitPrice: 10,
            lineTotal: 50,
            costCode: null,
            expectedDeliveryDate: null,
            deliveryLocationId: null,
            notes: null,
            pickUp: false,
          },
        ],
        documents: [
          {
            id: 'doc-nouploader',
            fileId: 'f-2',
            createdAt: new Date('2026-03-01'),
            file: {
              filename: 'report.pdf',
              uploadedBy: null,
            },
          },
        ],
        invoices: [],
      });

      const result = await service.getPurchaseOrder('po-nullmat', companyAdmin);
      expect(result.lineItems[0].materialName).toBeNull();
      expect(result.documents[0].uploadedBy.name).toBe('');
      expect(result.documents[0].uploadedBy.email).toBe('');
    });
  });

  describe('createPurchaseOrder – optional fields and line item branches', () => {
    const createDtoWithOptionals = {
      projectId: 'proj-1',
      deliveryLocationId: 'loc-1',
      deadlineEnd: '2026-05-01',
      plannedDeliveryDate: '2026-04-15',
      lineItems: [
        {
          materialCode: 'ST-01',
          description: 'Steel bars',
          quantityOrdered: 10,
          unitOfMeasure: 'pcs',
          unitPrice: 50,
          expectedDeliveryDate: '2026-04-10',
          pickUp: true,
        },
        {
          materialId: null,
          materialCode: 'CU-01',
          description: 'Copper wire',
          quantityOrdered: 20,
          unitOfMeasure: 'm',
          unitPrice: 5,
        },
      ],
    };

    it('creates PO without vendorId and with date fields (lines 416-425, 439, 456-457)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', companyId: 'comp-1' });
      // No vendorId so company lookup should be skipped
      mockPrisma.projectLocation.findUnique.mockResolvedValue({ id: 'loc-1', projectId: 'proj-1' });
      mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-opts' });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(fullPoDetail);

      const result = await service.createPurchaseOrder(
        createDtoWithOptionals as never,
        companyAdmin,
      );
      expect(result.id).toBe('po-new');

      const createCall = mockPrisma.purchaseOrder.create.mock.calls[0][0];
      expect(createCall.data.vendorId).toBeNull();
      expect(createCall.data.deadlineEnd).toEqual(new Date('2026-05-01'));
      expect(createCall.data.plannedDeliveryDate).toEqual(new Date('2026-04-15'));

      // Check line items
      const createdLineItems = createCall.data.lineItems.create;
      expect(createdLineItems).toHaveLength(2);
      // First line item: no materialId provided, has expectedDeliveryDate and pickUp=true
      expect(createdLineItems[0].materialId).toBeNull();
      expect(createdLineItems[0].expectedDeliveryDate).toEqual(new Date('2026-04-10'));
      expect(createdLineItems[0].pickUp).toBe(true);
      // Second line item: materialId=null explicitly, no expectedDeliveryDate, pickUp defaults to false
      expect(createdLineItems[1].materialId).toBeNull();
      expect(createdLineItems[1].expectedDeliveryDate).toBeNull();
      expect(createdLineItems[1].pickUp).toBe(false);
    });
  });

  describe('updatePurchaseOrder – with lineItems transaction (lines 522-531, 544-596)', () => {
    it('updates PO with lineItems including all optional spread fields', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const dto = {
        documentName: 'Updated Doc',
        vendorId: 'v-2',
        deliveryLocationId: 'loc-2',
        plannedDeliveryDate: '2026-06-01',
        poType: 'BLANKET',
        priority: 'HIGH',
        holdForRelease: true,
        deadlineStart: '2026-04-01',
        deadlineEnd: '2026-05-01',
        pickUp: true,
        pickUpLocation: 'Warehouse B',
        pickUpTimeExpectation: 'MORNING',
        pickUpPersonName: 'John',
        pickUpPersonPhone: '+61400000000',
        currency: 'USD',
        paymentTermsDays: 60,
        costCode: 'CC-2',
        rfqId: 'rfq-99',
        deliveryNotes: 'Careful',
        message: 'Priority delivery',
        deliveryResponsibleName: 'Jane',
        deliveryResponsibleEmail: 'jane@test.com',
        lineItems: [
          {
            materialId: 'mat-2',
            materialCode: 'CU-01',
            description: 'Copper wire',
            quantityOrdered: 30,
            unitOfMeasure: 'm',
            unitPrice: 5,
            costCode: 'CC-LI',
            notes: 'fragile',
            expectedDeliveryDate: '2026-05-15',
            deliveryLocationId: 'loc-3',
            pickUp: true,
          },
          {
            materialCode: 'AL-01',
            description: 'Aluminum sheet',
            quantityOrdered: 10,
            unitOfMeasure: 'pcs',
            unitPrice: 20,
          },
        ],
      };

      const result = await service.updatePurchaseOrder('po-1', dto as never, companyAdmin);
      expect(result.id).toBe('po-new');
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify the transaction was called with the update that includes all spread fields
      const txArgs = mockPrisma.$transaction.mock.calls[0][0];
      expect(txArgs).toHaveLength(2);
    });
  });

  describe('updatePurchaseOrder – without lineItems, all optional fields (lines 599-630)', () => {
    it('updates PO metadata with all optional spread fields and no lineItems', async () => {
      mockPrisma.purchaseOrder.findUnique
        .mockResolvedValueOnce({
          id: 'po-1',
          status: 'DRAFT',
          companyId: 'comp-1',
          projectId: 'proj-1',
        })
        .mockResolvedValueOnce(fullPoDetail);
      mockPrisma.purchaseOrder.update.mockResolvedValue({});

      const dto = {
        documentName: 'New Name',
        vendorId: 'v-3',
        deliveryLocationId: 'loc-5',
        plannedDeliveryDate: '2026-07-01',
        poType: 'HOLD_FOR_RELEASE',
        priority: 'MEDIUM',
        holdForRelease: false,
        deadlineStart: '2026-05-01',
        deadlineEnd: '2026-06-01',
        pickUp: false,
        pickUpLocation: 'Office',
        pickUpTimeExpectation: 'AFTERNOON',
        pickUpPersonName: 'Bob',
        pickUpPersonPhone: '+61400111222',
        currency: 'EUR',
        paymentTermsDays: 45,
        costCode: 'CC-3',
        rfqId: 'rfq-50',
        deliveryNotes: 'Handle gently',
        message: 'Updated message',
        deliveryResponsibleName: 'Alice',
        deliveryResponsibleEmail: 'alice@test.com',
      };

      const result = await service.updatePurchaseOrder('po-1', dto as never, companyAdmin);
      expect(result.id).toBe('po-new');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({
            vendorId: 'v-3',
            deliveryLocationId: 'loc-5',
            plannedDeliveryDate: new Date('2026-07-01'),
            currency: 'EUR',
            paymentTermsDays: 45,
            costCode: 'CC-3',
            rfqId: 'rfq-50',
            deliveryNotes: 'Handle gently',
            message: 'Updated message',
            deliveryResponsibleName: 'Alice',
            deliveryResponsibleEmail: 'alice@test.com',
            pickUp: false,
            pickUpLocation: 'Office',
            pickUpPersonName: 'Bob',
            pickUpPersonPhone: '+61400111222',
            lastModifiedById: 'ca-1',
          }),
        }),
      );
    });
  });

  describe('listPurchaseOrders – page defaults (line 188)', () => {
    beforeEach(() => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
    });

    it('defaults page to 1 when not specified', async () => {
      const result = await service.listPurchaseOrders(q({ page: undefined }), companyAdmin);
      expect(result.meta.page).toBe(1);
    });
  });
});
