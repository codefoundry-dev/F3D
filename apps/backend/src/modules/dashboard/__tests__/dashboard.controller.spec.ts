import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

const mockService = {
  getPoCaDashboard: jest.fn(),
  getVendorDashboard: jest.fn(),
  getFinanceDashboard: jest.fn(),
  getSuperAdminDashboard: jest.fn(),
  getAdminPanelState: jest.fn(),
  getWarehouseDashboard: jest.fn(),
};

const caUser = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const vendorUser = {
  id: 'v-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};
const foUser = {
  id: 'fo-1',
  email: 'fo@test.com',
  role: UserRole.FINANCIAL_OFFICER,
  companyId: 'comp-1',
};

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  describe('getPoCaDashboard', () => {
    it('delegates to service', async () => {
      const expected = {
        quoteResponses: [],
        recentOrders: [],
        pendingPurchaseOrders: [],
        invoicesPendingApproval: [],
      };
      mockService.getPoCaDashboard.mockResolvedValue(expected);

      const result = await controller.getPoCaDashboard(caUser);
      expect(mockService.getPoCaDashboard).toHaveBeenCalledWith(caUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getVendorDashboard', () => {
    it('delegates to service', async () => {
      const expected = { rfqsWaiting: [], invoices: [], activePOs: [] };
      mockService.getVendorDashboard.mockResolvedValue(expected);

      const result = await controller.getVendorDashboard(vendorUser);
      expect(mockService.getVendorDashboard).toHaveBeenCalledWith(vendorUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getFinanceDashboard', () => {
    it('delegates to service', async () => {
      const expected = {
        totalPendingAmount: 0,
        pendingInvoiceCount: 0,
        invoicesDueThisWeek: 0,
        invoicesDueAmount: 0,
        disputedInvoiceCount: 0,
        disputedTrend: 0,
        invoicesPendingApproval: [],
        disputedInvoices: [],
      };
      mockService.getFinanceDashboard.mockResolvedValue(expected);

      const result = await controller.getFinanceDashboard(foUser);
      expect(mockService.getFinanceDashboard).toHaveBeenCalledWith(foUser);
      expect(result).toEqual(expected);
    });
  });

  describe('getSuperAdminDashboard', () => {
    it('delegates to service', async () => {
      const expected = { totalCompanies: 5, totalUsers: 50 };
      mockService.getSuperAdminDashboard.mockResolvedValue(expected);

      const result = await controller.getSuperAdminDashboard();
      expect(mockService.getSuperAdminDashboard).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('getAdminPanelState', () => {
    it('delegates to service', async () => {
      const expected = { integrations: [], jobs: [], notifications: [] };
      mockService.getAdminPanelState.mockResolvedValue(expected);

      const result = await controller.getAdminPanelState();
      expect(mockService.getAdminPanelState).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('getWarehouseDashboard', () => {
    it('delegates to service', async () => {
      const whUser = {
        id: 'wh-1',
        email: 'wh@test.com',
        role: UserRole.WAREHOUSE_OFFICER,
        companyId: 'comp-1',
      };
      const expected = { deliveries: [], inventory: [] };
      mockService.getWarehouseDashboard.mockResolvedValue(expected);

      const result = await controller.getWarehouseDashboard(whUser);
      expect(mockService.getWarehouseDashboard).toHaveBeenCalledWith(whUser);
      expect(result).toEqual(expected);
    });
  });
});
