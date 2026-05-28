/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { UserRole } from '@prisma/client';

import { DashboardService } from '../dashboard.service';

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
const financialOfficer = {
  id: 'fo-1',
  email: 'fo@test.com',
  role: UserRole.FINANCIAL_OFFICER,
  companyId: 'comp-1',
};
const warehouseOfficer = {
  id: 'wo-1',
  email: 'wo@test.com',
  role: UserRole.WAREHOUSE_OFFICER,
  companyId: 'comp-1',
};

const mockPrisma = {
  quoteResponse: { findMany: jest.fn(), count: jest.fn() },
  rfq: { findMany: jest.fn(), count: jest.fn() },
  purchaseOrder: { findMany: jest.fn(), count: jest.fn() },
  bulkOrder: { findMany: jest.fn(), count: jest.fn() },
  invoice: { findMany: jest.fn(), count: jest.fn() },
  project: { findMany: jest.fn(), count: jest.fn() },
  user: { count: jest.fn() },
  company: { count: jest.fn() },
  $queryRaw: jest.fn(),
  auditLog: { findFirst: jest.fn() },
};

// Save original env for restoration
const originalEnv = { ...process.env };

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(mockPrisma as never);
  });

  describe('getPoCaDashboard', () => {
    beforeEach(() => {
      mockPrisma.quoteResponse.findMany.mockResolvedValue([]);
      mockPrisma.quoteResponse.count.mockResolvedValue(0);
      mockPrisma.rfq.findMany.mockResolvedValue([]);
      mockPrisma.rfq.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.bulkOrder.findMany.mockResolvedValue([]);
      mockPrisma.bulkOrder.count.mockResolvedValue(0);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.project.findMany.mockResolvedValue([]);
    });

    it('returns dashboard shape with all sections', async () => {
      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result).toHaveProperty('quoteResponses');
      expect(result).toHaveProperty('recentOrders');
      expect(result).toHaveProperty('pendingPurchaseOrders');
      expect(result).toHaveProperty('invoicesPendingApproval');
      expect(result).toHaveProperty('kpiSummary');
      expect(result).toHaveProperty('projectSuggestions');
      expect(Array.isArray(result.quoteResponses)).toBe(true);
      expect(Array.isArray(result.recentOrders)).toBe(true);
    });

    it('filters by company for quote responses', async () => {
      await service.getPoCaDashboard(companyAdmin);
      const where = mockPrisma.quoteResponse.findMany.mock.calls[0][0].where;
      expect(where.rfq.companyId).toBe('comp-1');
    });

    it('limits quote responses to 5', async () => {
      await service.getPoCaDashboard(companyAdmin);
      expect(mockPrisma.quoteResponse.findMany.mock.calls[0][0].take).toBe(5);
    });

    it('maps quote response items with null discounts and dateRange', async () => {
      mockPrisma.quoteResponse.findMany.mockResolvedValue([
        {
          id: 'qr-1',
          totalCost: 15000,
          discountPercent: null,
          discountAmount: null,
          itemsCovered: 2,
          totalItems: 3,
          status: 'PENDING',
          vendor: { legalName: 'VendorCo', legalAddress: 'AU' },
          rfq: {
            id: 'rfq-1',
            deadlineStart: null,
            deadlineEnd: null,
            project: { name: 'Alpha' },
            _count: { lineItems: 3 },
          },
        },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.quoteResponses[0].vendorName).toBe('VendorCo');
      expect(result.quoteResponses[0].vendorCountry).toBe('AU');
      expect(result.quoteResponses[0].totalCost).toBe(15000);
      expect(result.quoteResponses[0].discountPercent).toBeNull();
      expect(result.quoteResponses[0].discountAmount).toBeNull();
      expect(result.quoteResponses[0].dateRange).toBeNull();
    });

    it('maps quote response with present discounts and date range', async () => {
      mockPrisma.quoteResponse.findMany.mockResolvedValue([
        {
          id: 'qr-2',
          totalCost: 20000,
          discountPercent: 10,
          discountAmount: 2000,
          itemsCovered: 5,
          totalItems: 5,
          status: 'ACCEPTED',
          vendor: { legalName: 'BigVendor', legalAddress: 'US' },
          rfq: {
            id: 'rfq-2',
            deadlineStart: new Date('2026-04-01'),
            deadlineEnd: new Date('2026-04-30'),
            project: { name: 'Beta' },
            _count: { lineItems: 5 },
          },
        },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.quoteResponses[0].discountPercent).toBe(10);
      expect(result.quoteResponses[0].discountAmount).toBe(2000);
      expect(result.quoteResponses[0].dateRange).toBe('2026-04-01 - 2026-04-30');
    });

    it('merges and sorts recent orders by createdAt including bulk orders', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-1',
          status: 'OPEN',
          deliveryLocationId: null,
          deadlineStart: new Date('2026-04-01'),
          deadlineEnd: new Date('2026-04-15'),
          createdAt: new Date('2026-03-03'),
          project: { name: 'Alpha' },
          _count: { lineItems: 2 },
        },
      ]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          status: 'SENT',
          deliveryLocationId: '123 St',
          deadlineStart: new Date('2026-05-01'),
          deadlineEnd: new Date('2026-05-15'),
          lineItemCount: 3,
          totalAmount: 15000,
          createdAt: new Date('2026-03-05'),
          project: { name: 'Beta' },
          vendor: { legalName: 'VendorCo' },
        },
      ]);
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-1',
          status: 'ACTIVE',
          totalAmount: 50000,
          createdAt: new Date('2026-03-04'),
          project: { name: 'Gamma' },
          vendor: { legalName: 'SupplyCo' },
          _count: { lineItems: 10 },
        },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      // PO (Mar 5) > BO (Mar 4) > RFQ (Mar 3)
      expect(result.recentOrders).toHaveLength(3);
      expect(result.recentOrders[0].id).toBe('po-1');
      expect(result.recentOrders[0].type).toBe('po');
      expect(result.recentOrders[0].vendorName).toBe('VendorCo');
      expect(result.recentOrders[0].totalCost).toBe(15000);
      expect(result.recentOrders[0].dateRange).toBe('2026-05-01 - 2026-05-15');

      expect(result.recentOrders[1].id).toBe('bo-1');
      expect(result.recentOrders[1].type).toBe('bulk-order');
      expect(result.recentOrders[1].vendorName).toBe('SupplyCo');
      expect(result.recentOrders[1].totalCost).toBe(50000);
      expect(result.recentOrders[1].itemCount).toBe(10);

      expect(result.recentOrders[2].id).toBe('rfq-1');
      expect(result.recentOrders[2].type).toBe('rfq');
      expect(result.recentOrders[2].vendorName).toBeNull();
      expect(result.recentOrders[2].dateRange).toBe('2026-04-01 - 2026-04-15');
    });

    it('maps pending purchase orders with all fields', async () => {
      // purchaseOrder.findMany is called multiple times:
      // 1st call: recentPos (in Promise.all)
      // 2nd call: pendingPos
      // We need to handle the call order. getPoCaDashboard calls findMany for POs twice.
      // First in the Promise.all for recentPos, second for pendingPos.
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([]) // recentPos
        .mockResolvedValueOnce([
          // pendingPos
          {
            id: 'po-pend1234',
            poNumber: 'PO-00003',
            lineItemCount: 6,
            pickUp: true,
            totalAmount: 30000,
            status: 'DRAFT',
            createdAt: new Date('2026-03-10T09:00:00Z'),
            project: { name: 'Tower' },
            vendor: { legalName: 'MetalCo', legalAddress: 'DE' },
          },
        ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.pendingPurchaseOrders).toHaveLength(1);
      const po = result.pendingPurchaseOrders[0];
      expect(po.id).toBe('po-pend1234');
      expect(po.vendorName).toBe('MetalCo');
      expect(po.vendorCountry).toBe('DE');
      expect(po.poNumber).toBe('PO-00003');
      expect(po.projectName).toBe('Tower');
      expect(po.itemCount).toBe(6);
      expect(po.deliveryType).toBe('Pick Up');
      expect(po.totalCost).toBe(30000);
      expect(po.status).toBe('DRAFT');
    });

    it('maps pending purchase orders with Delivery type and null totalAmount', async () => {
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([]) // recentPos
        .mockResolvedValueOnce([
          {
            id: 'po-deliv999',
            lineItemCount: 2,
            pickUp: false,
            totalAmount: null,
            status: 'SENT',
            createdAt: new Date('2026-03-08T10:00:00Z'),
            project: { name: 'Road' },
            vendor: { legalName: 'AsphaltCo', legalAddress: 'FR' },
          },
        ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      const po = result.pendingPurchaseOrders[0];
      expect(po.deliveryType).toBe('Delivery');
      expect(po.totalCost).toBeNull();
    });

    it('maps invoices pending approval', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-pend1234',
          status: 'PENDING',
          totalAmount: 9500,
          createdAt: new Date('2026-03-12T14:00:00Z'),
          project: { name: 'Bridge' },
          vendor: { legalName: 'SteelCo', legalAddress: 'JP' },
          relatedPo: { id: 'po-rel-1' },
        },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.invoicesPendingApproval).toHaveLength(1);
      const inv = result.invoicesPendingApproval[0];
      expect(inv.id).toBe('inv-pend1234');
      expect(inv.vendorName).toBe('SteelCo');
      expect(inv.vendorCountry).toBe('JP');
      expect(inv.invoiceId).toBe('INV-2026-0001');
      expect(inv.projectName).toBe('Bridge');
      expect(inv.poReference).toBeNull();
      expect(inv.totalCost).toBe(9500);
      expect(inv.status).toBe('PENDING');
    });

    it('maps invoices pending approval with null relatedPo', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-no-po12',
          status: 'PENDING',
          totalAmount: 1000,
          createdAt: new Date('2026-03-11T08:00:00Z'),
          project: { name: 'Test' },
          vendor: { legalName: 'Co', legalAddress: 'US' },
          relatedPo: null,
        },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.invoicesPendingApproval[0].poReference).toBeNull();
    });

    it('maps project suggestions', async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Highway' },
        { id: 'proj-2', name: 'Bridge' },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.projectSuggestions).toHaveLength(2);
      expect(result.projectSuggestions[0]).toEqual({ id: 'proj-1', name: 'Highway' });
    });

    it('returns KPI summary with counts', async () => {
      mockPrisma.rfq.count
        .mockResolvedValueOnce(10) // pending rfqs
        .mockResolvedValueOnce(2); // overdue rfqs
      mockPrisma.purchaseOrder.count
        .mockResolvedValueOnce(5) // pending pos
        .mockResolvedValueOnce(1); // overdue pos
      mockPrisma.quoteResponse.count
        .mockResolvedValueOnce(8) // pending quotes
        .mockResolvedValueOnce(3); // overdue quotes
      mockPrisma.invoice.count
        .mockResolvedValueOnce(12) // pending invoices
        .mockResolvedValueOnce(4); // overdue invoices

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.kpiSummary.rfqs).toEqual({ pending: 10, overdue: 2 });
      expect(result.kpiSummary.pos).toEqual({ pending: 5, overdue: 1 });
      expect(result.kpiSummary.quotes).toEqual({ pending: 8, overdue: 3 });
      expect(result.kpiSummary.invoices).toEqual({ pending: 12, overdue: 4 });
    });

    it('handles user with null companyId', async () => {
      const noCompanyUser = { ...companyAdmin, companyId: null };
      const result = await service.getPoCaDashboard(noCompanyUser);
      expect(result).toHaveProperty('kpiSummary');
      // companyId filter should be undefined
      const where = mockPrisma.quoteResponse.findMany.mock.calls[0][0].where;
      expect(where.rfq.companyId).toBeUndefined();
    });

    it('strips createdAt from recentOrders output', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-1',
          status: 'OPEN',
          deliveryLocationId: null,
          deadlineStart: null,
          deadlineEnd: null,
          createdAt: new Date('2026-03-03'),
          project: { name: 'Alpha' },
          _count: { lineItems: 2 },
        },
      ]);

      const result = await service.getPoCaDashboard(companyAdmin);
      expect(result.recentOrders[0]).not.toHaveProperty('createdAt');
    });
  });

  describe('getVendorDashboard', () => {
    beforeEach(() => {
      mockPrisma.rfq.findMany.mockResolvedValue([]);
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
    });

    it('returns dashboard shape', async () => {
      const result = await service.getVendorDashboard(vendor);
      expect(result).toHaveProperty('rfqsWaiting');
      expect(result).toHaveProperty('invoices');
      expect(result).toHaveProperty('activePOs');
    });

    it('filters active POs by vendor company', async () => {
      await service.getVendorDashboard(vendor);
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-comp-1');
      expect(where.status.notIn).toContain('CLOSED');
    });

    it('filters invoices by vendor company', async () => {
      await service.getVendorDashboard(vendor);
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-comp-1');
    });

    it('maps vendor RFQ items with null date range', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-1',
          deliveryLocationId: '123 St',
          deadlineStart: null,
          deadlineEnd: null,
          company: { legalName: 'TestCo', legalAddress: 'AU' },
          project: { name: 'Alpha' },
          _count: { lineItems: 5 },
        },
      ]);

      const result = await service.getVendorDashboard(vendor);
      expect(result.rfqsWaiting[0].companyName).toBe('TestCo');
      expect(result.rfqsWaiting[0].itemCount).toBe(5);
      expect(result.rfqsWaiting[0].dateRange).toBeNull();
    });

    it('maps vendor invoice items with all fields', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-123456789',
          status: 'PENDING',
          totalAmount: 7500,
          createdAt: new Date('2026-03-01T10:00:00Z'),
          company: { legalName: 'BuilderCo', legalAddress: 'US' },
          project: { name: 'Highway' },
          relatedPo: { id: 'po-99' },
        },
      ]);

      const result = await service.getVendorDashboard(vendor);
      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].companyName).toBe('BuilderCo');
      expect(result.invoices[0].companyCountry).toBe('US');
      expect(result.invoices[0].status).toBe('PENDING');
      expect(result.invoices[0].invoiceId).toBe('INV-2026-0001');
      expect(result.invoices[0].projectName).toBe('Highway');
      expect(result.invoices[0].poReference).toBeNull();
      expect(result.invoices[0].totalCost).toBe(7500);
      expect(result.invoices[0].itemCount).toBe(0);
      expect(result.invoices[0].date).toBe('2026-03-01T10:00:00.000Z');
    });

    it('maps vendor invoice with null relatedPo', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-abcdefgh',
          status: 'DISPUTED',
          totalAmount: 3000,
          createdAt: new Date('2026-02-15T08:00:00Z'),
          company: { legalName: 'Co', legalAddress: 'UK' },
          project: { name: 'Bridge' },
          relatedPo: null,
        },
      ]);

      const result = await service.getVendorDashboard(vendor);
      expect(result.invoices[0].poReference).toBeNull();
    });

    it('maps active PO items with all fields', async () => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-abcdefgh',
          poNumber: 'PO-00010',
          status: 'SENT',
          revision: 2,
          poType: 'STANDARD',
          pickUp: true,
          project: { id: 'proj-1', name: 'Tower' },
          company: { legalName: 'BuilderCo' },
        },
      ]);

      const result = await service.getVendorDashboard(vendor);
      expect(result.activePOs).toHaveLength(1);
      expect(result.activePOs[0].poNumber).toBe('PO-00010');
      expect(result.activePOs[0].projectName).toBe('Tower');
      expect(result.activePOs[0].projectId).toBe('proj-1');
      expect(result.activePOs[0].contractorName).toBe('BuilderCo');
      expect(result.activePOs[0].poStatus).toBe('SENT');
      expect(result.activePOs[0].revision).toBe(2);
      expect(result.activePOs[0].poType).toBe('STANDARD');
      expect(result.activePOs[0].pickUp).toBe(true);
    });

    it('maps vendor RFQ with date range', async () => {
      mockPrisma.rfq.findMany.mockResolvedValue([
        {
          id: 'rfq-2',
          deliveryLocationId: 'Warehouse A',
          deadlineStart: new Date('2026-04-01'),
          deadlineEnd: new Date('2026-04-15'),
          company: { legalName: 'TestCo', legalAddress: 'AU' },
          project: { name: 'Alpha' },
          _count: { lineItems: 3 },
        },
      ]);

      const result = await service.getVendorDashboard(vendor);
      expect(result.rfqsWaiting[0].dateRange).toBe('2026-04-01 - 2026-04-15');
      expect(result.rfqsWaiting[0].deliveryLocationId).toBeNull();
    });
  });

  describe('getFinanceDashboard', () => {
    beforeEach(() => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);
    });

    it('returns KPI metrics', async () => {
      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([]) // pending invoices
        .mockResolvedValueOnce([]) // due this week
        .mockResolvedValueOnce([]) // invoices pending approval
        .mockResolvedValueOnce([]); // disputed invoices

      const result = await service.getFinanceDashboard(financialOfficer);
      expect(result).toHaveProperty('totalPendingAmount');
      expect(result).toHaveProperty('pendingInvoiceCount');
      expect(result).toHaveProperty('invoicesDueThisWeek');
      expect(result).toHaveProperty('invoicesDueAmount');
      expect(result).toHaveProperty('disputedInvoiceCount');
      expect(result).toHaveProperty('disputedTrend');
      expect(result).toHaveProperty('invoicesPendingApproval');
      expect(result).toHaveProperty('disputedInvoices');
    });

    it('calculates pending amount from invoices', async () => {
      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([{ totalAmount: 5000 }, { totalAmount: 3000 }]) // pending
        .mockResolvedValueOnce([{ totalAmount: 2000 }]) // due this week
        .mockResolvedValueOnce([]) // invoices pending approval
        .mockResolvedValueOnce([]); // disputed

      const result = await service.getFinanceDashboard(financialOfficer);
      expect(result.totalPendingAmount).toBe(8000);
      expect(result.pendingInvoiceCount).toBe(2);
      expect(result.invoicesDueThisWeek).toBe(1);
      expect(result.invoicesDueAmount).toBe(2000);
    });

    it('scopes by company', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.getFinanceDashboard(financialOfficer);
      // All findMany calls should include companyId
      for (const call of mockPrisma.invoice.findMany.mock.calls) {
        expect(call[0].where.companyId).toBe('comp-1');
      }
    });

    it('handles user with null companyId (no company filter)', async () => {
      const noCompanyFO = { ...financialOfficer, companyId: null };
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      await service.getFinanceDashboard(noCompanyFO);
      // companyFilter should be empty object - no companyId key
      const firstCallWhere = mockPrisma.invoice.findMany.mock.calls[0][0].where;
      expect(firstCallWhere).not.toHaveProperty('companyId');
    });

    it('maps invoice items with mapInvoice function', async () => {
      const invoiceData = {
        id: 'inv-full-test',
        totalAmount: 12500,
        status: 'PENDING',
        createdAt: new Date('2026-01-15T10:00:00Z'),
        project: { name: 'Bridge' },
        vendor: { legalName: 'SupplyCo', legalAddress: 'DE' },
        relatedPo: { id: 'po-ref-abcdefghij', lineItemCount: 7 },
      };

      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([]) // pending invoices (KPI)
        .mockResolvedValueOnce([]) // due this week (KPI)
        .mockResolvedValueOnce([invoiceData]) // invoices pending approval
        .mockResolvedValueOnce([]); // disputed invoices
      mockPrisma.invoice.count
        .mockResolvedValueOnce(0) // disputed count
        .mockResolvedValueOnce(0); // disputed last month

      const result = await service.getFinanceDashboard(financialOfficer);
      expect(result.invoicesPendingApproval).toHaveLength(1);

      const mapped = result.invoicesPendingApproval[0];
      expect(mapped.id).toBe('inv-full-test');
      expect(mapped.vendorName).toBe('SupplyCo');
      expect(mapped.vendorCountry).toBe('DE');
      expect(mapped.invoiceId).toBe('INV-2026-001');
      expect(mapped.projectName).toBe('Bridge');
      expect(mapped.poReference).toBeNull();
      expect(mapped.date).toBe('2026-01-15T10:00:00.000Z');
      expect(mapped.totalCost).toBe(12500);
      expect(mapped.itemCount).toBe(7);
      expect(mapped.status).toBe('PENDING');
      expect(mapped.hasAttachments).toBe(true);
      expect(mapped.hasUnreadMessages).toBe(false);
    });

    it('maps disputed invoices correctly', async () => {
      const disputedData = {
        id: 'inv-disputed',
        totalAmount: 999,
        status: 'DISPUTED',
        createdAt: new Date('2026-02-20T14:00:00Z'),
        project: { name: 'Road' },
        vendor: { legalName: 'VendorX', legalAddress: 'FR' },
        relatedPo: null,
      };

      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([]) // pending (KPI)
        .mockResolvedValueOnce([]) // due this week (KPI)
        .mockResolvedValueOnce([]) // pending approval
        .mockResolvedValueOnce([disputedData]); // disputed
      mockPrisma.invoice.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const result = await service.getFinanceDashboard(financialOfficer);
      expect(result.disputedInvoiceCount).toBe(3);
      expect(result.disputedTrend).toBe(1);
      expect(result.disputedInvoices).toHaveLength(1);

      const mapped = result.disputedInvoices[0];
      expect(mapped.poReference).toBeNull();
      expect(mapped.itemCount).toBe(0);
      expect(mapped.hasAttachments).toBe(false);
    });
  });

  describe('getSuperAdminDashboard', () => {
    beforeEach(() => {
      // Default: all counts return 0
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.company.count.mockResolvedValue(0);
      mockPrisma.project.count.mockResolvedValue(0);
      mockPrisma.rfq.count.mockResolvedValue(0);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    });

    it('returns dashboard shape with all sections', async () => {
      const result = await service.getSuperAdminDashboard();
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('companies');
      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('procurement');
      expect(result).toHaveProperty('system');
    });

    it('populates users section with totals and byRole', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80) // activeUsers
        .mockResolvedValueOnce(5) // newUsersThisWeek
        // usersByRole (7 roles)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(33);

      const result = await service.getSuperAdminDashboard();
      expect(result.users.total).toBe(100);
      expect(result.users.active).toBe(80);
      expect(result.users.newThisWeek).toBe(5);
      expect(result.users.byRole).toHaveLength(7);
      expect(result.users.byRole[0]).toEqual({ role: 'SUPER_ADMIN', count: 2 });
    });

    it('populates companies section', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.company.count
        .mockResolvedValueOnce(50) // totalCompanies
        .mockResolvedValueOnce(20) // contractorCount
        .mockResolvedValueOnce(30) // vendorCount
        .mockResolvedValueOnce(3) // newCompaniesThisWeek
        .mockResolvedValueOnce(45); // activeCompanies

      const result = await service.getSuperAdminDashboard();
      expect(result.companies.total).toBe(50);
      expect(result.companies.contractors).toBe(20);
      expect(result.companies.vendors).toBe(30);
      expect(result.companies.newThisWeek).toBe(3);
      expect(result.companies.active).toBe(45);
    });

    it('populates projects section with byStatus breakdown', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.company.count.mockResolvedValue(0);
      mockPrisma.project.count
        .mockResolvedValueOnce(10) // PLANNED
        .mockResolvedValueOnce(5) // ONGOING
        .mockResolvedValueOnce(20) // COMPLETED
        .mockResolvedValueOnce(3); // ARCHIVED

      const result = await service.getSuperAdminDashboard();
      expect(result.projects.total).toBe(38);
      expect(result.projects.byStatus).toEqual({
        PLANNED: 10,
        ONGOING: 5,
        COMPLETED: 20,
        ARCHIVED: 3,
      });
    });

    it('populates procurement section', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.company.count.mockResolvedValue(0);
      mockPrisma.project.count.mockResolvedValue(0);
      mockPrisma.rfq.count
        .mockResolvedValueOnce(100) // totalRfqs
        .mockResolvedValueOnce(25); // openRfqs
      mockPrisma.purchaseOrder.count.mockResolvedValueOnce(60); // totalPos
      mockPrisma.invoice.count
        .mockResolvedValueOnce(40) // totalInvoices
        .mockResolvedValueOnce(15); // pendingInvoices

      const result = await service.getSuperAdminDashboard();
      expect(result.procurement.totalRfqs).toBe(100);
      expect(result.procurement.openRfqs).toBe(25);
      expect(result.procurement.totalPos).toBe(60);
      expect(result.procurement.totalInvoices).toBe(40);
      expect(result.procurement.pendingInvoices).toBe(15);
    });

    it('reports healthy system when DB responds fast', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getSuperAdminDashboard();
      expect(result.system.status).toBe('healthy');
      expect(typeof result.system.dbResponseMs).toBe('number');
      expect(result.system.dbResponseMs).toBeLessThan(500);
    });

    it('reports degraded system when DB responds slowly', async () => {
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ '?column?': 1 }]), 550)),
      );

      const result = await service.getSuperAdminDashboard();
      expect(result.system.status).toBe('degraded');
      expect(result.system.dbResponseMs).toBeGreaterThanOrEqual(500);
    });
  });

  describe('getAdminPanelState', () => {
    afterEach(() => {
      // Restore env vars
      process.env = { ...originalEnv };
    });

    it('returns 8 components', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue({
        createdAt: new Date('2026-03-10T12:00:00Z'),
      });

      const result = await service.getAdminPanelState();
      expect(result.components).toHaveLength(8);
    });

    it('marks DB as Healthy when response is fast', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const db = result.components.find((c: { id: string }) => c.id === 'db-primary');
      expect(db).toBeDefined();
      expect(db!.status).toBe('Healthy');
      expect(db!.category).toBe('integration');
      expect(db!.lastSuccessfulRun).toBeTruthy();
      expect(db!.lastError).toBeNull();
    });

    it('marks DB as Warning when response is slow', async () => {
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ '?column?': 1 }]), 550)),
      );
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const db = result.components.find((c: { id: string }) => c.id === 'db-primary');
      expect(db!.status).toBe('Warning');
      expect(db!.errorInfo).toContain('Slow response');
    });

    it('marks DB as Error when query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const db = result.components.find((c: { id: string }) => c.id === 'db-primary');
      expect(db!.status).toBe('Error');
      expect(db!.errorInfo).toBe('Connection refused');
      expect(db!.lastSuccessfulRun).toBeNull();
    });

    it('marks DB as Error with generic message for non-Error throws', async () => {
      mockPrisma.$queryRaw.mockRejectedValue('string error');
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const db = result.components.find((c: { id: string }) => c.id === 'db-primary');
      expect(db!.status).toBe('Error');
      expect(db!.errorInfo).toBe('Connection failed');
    });

    it('marks email service as Healthy when BREVO_API_KEY is set', async () => {
      process.env.BREVO_API_KEY = 'test-key';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const email = result.components.find((c: { id: string }) => c.id === 'email-service');
      expect(email!.status).toBe('Healthy');
    });

    it('marks email service as Healthy when RESEND_API_KEY is set', async () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.SMTP_HOST;
      delete process.env.MAILER_HOST;
      process.env.RESEND_API_KEY = 're_test_key';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const email = result.components.find((c: { id: string }) => c.id === 'email-service');
      expect(email!.status).toBe('Healthy');

      delete process.env.RESEND_API_KEY;
    });

    it('marks email service as Healthy when SMTP_HOST is set', async () => {
      delete process.env.BREVO_API_KEY;
      process.env.SMTP_HOST = 'smtp.test.com';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const email = result.components.find((c: { id: string }) => c.id === 'email-service');
      expect(email!.status).toBe('Healthy');
    });

    it('marks email service as Healthy when MAILER_HOST is set', async () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.SMTP_HOST;
      process.env.MAILER_HOST = 'mailer.test.com';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const email = result.components.find((c: { id: string }) => c.id === 'email-service');
      expect(email!.status).toBe('Healthy');
    });

    it('marks email service as Warning when no email env vars', async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.BREVO_API_KEY;
      delete process.env.SMTP_HOST;
      delete process.env.MAILER_HOST;
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const email = result.components.find((c: { id: string }) => c.id === 'email-service');
      expect(email!.status).toBe('Warning');
      expect(email!.errorInfo).toContain('not configured');
    });

    it('marks file storage as Healthy when MINIO_ENDPOINT is set', async () => {
      process.env.MINIO_ENDPOINT = 'http://localhost:9000';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const storage = result.components.find((c: { id: string }) => c.id === 'file-storage');
      expect(storage!.status).toBe('Healthy');
    });

    it('marks file storage as Healthy when S3_ENDPOINT is set', async () => {
      delete process.env.MINIO_ENDPOINT;
      process.env.S3_ENDPOINT = 'http://s3.test.com';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const storage = result.components.find((c: { id: string }) => c.id === 'file-storage');
      expect(storage!.status).toBe('Healthy');
    });

    it('marks file storage as Warning when no storage env vars', async () => {
      delete process.env.MINIO_ENDPOINT;
      delete process.env.S3_ENDPOINT;
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const storage = result.components.find((c: { id: string }) => c.id === 'file-storage');
      expect(storage!.status).toBe('Warning');
      expect(storage!.errorInfo).toContain('not configured');
    });

    it('marks Google Places as Healthy when API key is set', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const google = result.components.find((c: { id: string }) => c.id === 'google-places');
      expect(google!.status).toBe('Healthy');
    });

    it('marks Google Places as Warning when no API key', async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const google = result.components.find((c: { id: string }) => c.id === 'google-places');
      expect(google!.status).toBe('Warning');
    });

    it('includes disabled placeholder components', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const ocr = result.components.find((c: { id: string }) => c.id === 'ocr-processing');
      const erp = result.components.find((c: { id: string }) => c.id === 'erp-integration');
      const accounting = result.components.find(
        (c: { id: string }) => c.id === 'accounting-integration',
      );

      expect(ocr!.status).toBe('Disabled');
      expect(ocr!.category).toBe('backgroundJob');
      expect(erp!.status).toBe('Disabled');
      expect(accounting!.status).toBe('Disabled');
    });

    it('includes in-app notifications with audit log timestamp', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue({
        createdAt: new Date('2026-03-10T12:00:00Z'),
      });

      const result = await service.getAdminPanelState();
      const notif = result.components.find((c: { id: string }) => c.id === 'in-app-notifications');
      expect(notif!.status).toBe('Healthy');
      expect(notif!.category).toBe('notification');
      expect(notif!.lastSuccessfulRun).toBe('2026-03-10T12:00:00.000Z');
    });

    it('marks in-app notifications as Healthy with null audit log', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getAdminPanelState();
      const notif = result.components.find((c: { id: string }) => c.id === 'in-app-notifications');
      expect(notif!.status).toBe('Healthy');
      expect(notif!.lastSuccessfulRun).toBeNull();
    });

    it('marks in-app notifications as Error when audit query fails', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.auditLog.findFirst.mockRejectedValue(new Error('Query failed'));

      const result = await service.getAdminPanelState();
      const notif = result.components.find((c: { id: string }) => c.id === 'in-app-notifications');
      expect(notif!.status).toBe('Error');
      expect(notif!.errorInfo).toBe('Failed to query audit log');
    });
  });

  describe('getWarehouseDashboard', () => {
    beforeEach(() => {
      mockPrisma.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrder.count.mockResolvedValue(0);
      mockPrisma.bulkOrder.findMany.mockResolvedValue([]);
      mockPrisma.bulkOrder.count.mockResolvedValue(0);
    });

    it('returns dashboard shape with all sections', async () => {
      const result = await service.getWarehouseDashboard(warehouseOfficer);
      expect(result).toHaveProperty('kpi');
      expect(result).toHaveProperty('pendingDeliveries');
      expect(result).toHaveProperty('recentDeliveries');
      expect(result).toHaveProperty('activeBulkOrders');
    });

    it('returns KPI counts', async () => {
      mockPrisma.purchaseOrder.count
        .mockResolvedValueOnce(5) // pendingDeliveryCount
        .mockResolvedValueOnce(3) // deliveredCount
        .mockResolvedValueOnce(2); // overdueDeliveries (4th call)
      mockPrisma.bulkOrder.count.mockResolvedValueOnce(4); // activeBulkOrderCount

      const result = await service.getWarehouseDashboard(warehouseOfficer);
      expect(result.kpi.pendingDeliveries).toBe(5);
      expect(result.kpi.delivered).toBe(3);
      expect(result.kpi.activeBulkOrders).toBe(4);
      expect(result.kpi.overdueDeliveries).toBe(2);
    });

    it('filters pending deliveries by company', async () => {
      await service.getWarehouseDashboard(warehouseOfficer);
      // First findMany call is for pendingDeliveries
      const where = mockPrisma.purchaseOrder.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('comp-1');
      expect(where.status).toBe('SCHEDULED_FOR_DELIVERY');
    });

    it('maps PO items via mapPo function', async () => {
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([
          {
            id: 'po-12345678rest',
            poNumber: 'PO-00001',
            lineItemCount: 4,
            deliveryLocationId: 'Site A',
            pickUp: false,
            deadlineEnd: new Date('2026-04-15T00:00:00Z'),
            totalAmount: 8000,
            status: 'SCHEDULED_FOR_DELIVERY',
            project: { name: 'Highway' },
            vendor: { legalName: 'SupplyCo' },
            createdBy: { name: 'John' },
          },
        ])
        .mockResolvedValueOnce([]); // recentDeliveries

      const result = await service.getWarehouseDashboard(warehouseOfficer);
      expect(result.pendingDeliveries).toHaveLength(1);

      const mapped = result.pendingDeliveries[0];
      expect(mapped.poNumber).toBe('PO-00001');
      expect(mapped.projectName).toBe('Highway');
      expect(mapped.vendorName).toBe('SupplyCo');
      expect(mapped.requester).toBe('John');
      expect(mapped.itemCount).toBe(4);
      expect(mapped.deliveryLocationId).toBe('Site A');
      expect(mapped.pickUp).toBe(false);
      expect(mapped.deadlineEnd).toBe('2026-04-15T00:00:00.000Z');
      expect(mapped.totalAmount).toBe(8000);
      expect(mapped.status).toBe('SCHEDULED_FOR_DELIVERY');
    });

    it('maps PO with null optional fields', async () => {
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([
          {
            id: 'po-abcdefghrest',
            poNumber: 'PO-00002',
            lineItemCount: 0,
            deliveryLocationId: null,
            pickUp: true,
            deadlineEnd: null,
            totalAmount: null,
            status: 'SCHEDULED_FOR_DELIVERY',
            project: { name: 'Test' },
            vendor: { legalName: 'V' },
            createdBy: null,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getWarehouseDashboard(warehouseOfficer);
      const mapped = result.pendingDeliveries[0];
      expect(mapped.requester).toBeNull();
      expect(mapped.deadlineEnd).toBeNull();
      expect(mapped.totalAmount).toBeNull();
    });

    it('maps recent deliveries (second findMany call)', async () => {
      mockPrisma.purchaseOrder.findMany
        .mockResolvedValueOnce([]) // pendingDeliveries
        .mockResolvedValueOnce([
          {
            id: 'po-deliv123rest',
            lineItemCount: 2,
            deliveryLocationId: 'Warehouse B',
            pickUp: false,
            deadlineEnd: new Date('2026-03-20T00:00:00Z'),
            totalAmount: 5000,
            status: 'DELIVERED',
            project: { name: 'Bridge' },
            vendor: { legalName: 'BuildCo' },
            createdBy: { name: 'Jane' },
          },
        ]);

      const result = await service.getWarehouseDashboard(warehouseOfficer);
      expect(result.recentDeliveries).toHaveLength(1);
      expect(result.recentDeliveries[0].status).toBe('DELIVERED');
      expect(result.recentDeliveries[0].vendorName).toBe('BuildCo');
    });

    it('maps active bulk orders with line items', async () => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-1',
          totalAmount: 25000,
          status: 'ACTIVE',
          project: { name: 'Tower' },
          vendor: { legalName: 'SupplyHouse' },
          lineItems: [
            {
              description: 'Steel beams',
              qty: 100,
              qtyRemaining: 40,
              deliveriesPercent: 60,
            },
            {
              description: 'Concrete bags',
              qty: 200,
              qtyRemaining: 200,
              deliveriesPercent: 0,
            },
          ],
        },
      ]);

      const result = await service.getWarehouseDashboard(warehouseOfficer);
      expect(result.activeBulkOrders).toHaveLength(1);

      const bo = result.activeBulkOrders[0];
      expect(bo.id).toBe('bo-1');
      expect(bo.projectName).toBe('Tower');
      expect(bo.vendorName).toBe('SupplyHouse');
      expect(bo.totalAmount).toBe(25000);
      expect(bo.status).toBe('ACTIVE');
      expect(bo.lineItems).toHaveLength(2);
      expect(bo.lineItems[0]).toEqual({
        description: 'Steel beams',
        qty: 100,
        qtyRemaining: 40,
        deliveriesPercent: 60,
      });
      expect(bo.lineItems[1]).toEqual({
        description: 'Concrete bags',
        qty: 200,
        qtyRemaining: 200,
        deliveriesPercent: 0,
      });
    });

    it('maps bulk order with null totalAmount', async () => {
      mockPrisma.bulkOrder.findMany.mockResolvedValue([
        {
          id: 'bo-2',
          totalAmount: null,
          status: 'ACTIVE',
          project: { name: 'Park' },
          vendor: { legalName: 'GreenCo' },
          lineItems: [],
        },
      ]);

      const result = await service.getWarehouseDashboard(warehouseOfficer);
      expect(result.activeBulkOrders[0].totalAmount).toBeNull();
      expect(result.activeBulkOrders[0].lineItems).toEqual([]);
    });

    it('handles user with null companyId', async () => {
      const noCompanyUser = { ...warehouseOfficer, companyId: null };
      const result = await service.getWarehouseDashboard(noCompanyUser);
      // Should still return a valid shape (empty arrays)
      expect(result.kpi).toBeDefined();
      expect(result.pendingDeliveries).toEqual([]);
    });
  });
});
