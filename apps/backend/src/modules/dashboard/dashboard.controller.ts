import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── GET /v1/dashboard/po-ca ────────────────────────────────────────────────

  @Get('po-ca')
  @RequirePermissions('dashboard.viewPoCa')
  @ApiOperation({ summary: 'Get PO/CA dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard aggregates for PO/CA roles' })
  async getPoCaDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getPoCaDashboard(user);
  }

  // ── GET /v1/dashboard/vendor ───────────────────────────────────────────────

  @Get('vendor')
  @RequirePermissions('dashboard.viewVendor')
  @ApiOperation({ summary: 'Get vendor dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data for vendor role' })
  async getVendorDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getVendorDashboard(user);
  }

  // ── GET /v1/dashboard/finance ──────────────────────────────────────────────

  @Get('finance')
  @RequirePermissions('dashboard.viewFinance')
  @ApiOperation({ summary: 'Get finance dashboard data' })
  @ApiResponse({ status: 200, description: 'KPI metrics and invoice data for finance role' })
  async getFinanceDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getFinanceDashboard(user);
  }

  // ── GET /v1/dashboard/super-admin ──────────────────────────────────────────

  @Get('super-admin')
  @RequirePermissions('dashboard.viewSuperAdmin')
  @ApiOperation({ summary: 'Get super admin dashboard data' })
  @ApiResponse({ status: 200, description: 'Platform-wide metrics for super admin' })
  async getSuperAdminDashboard() {
    return this.dashboardService.getSuperAdminDashboard();
  }

  // ── GET /v1/dashboard/admin-panel ──────────────────────────────────────────

  @Get('admin-panel')
  @RequirePermissions('dashboard.viewAdminPanel')
  @ApiOperation({ summary: 'Get admin panel platform state (integrations, jobs, notifications)' })
  @ApiResponse({ status: 200, description: 'Platform component statuses for admin panel' })
  async getAdminPanelState() {
    return this.dashboardService.getAdminPanelState();
  }

  // ── GET /v1/dashboard/warehouse ────────────────────────────────────────────

  @Get('warehouse')
  @RequirePermissions('dashboard.viewWarehouse')
  @ApiOperation({ summary: 'Get warehouse dashboard data' })
  @ApiResponse({ status: 200, description: 'Delivery and inventory data for warehouse role' })
  async getWarehouseDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getWarehouseDashboard(user);
  }
}
