import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { DASHBOARD_PATHS } from './paths';

// ── Response interfaces ──────────────────────────────────────────────────────

export interface KpiCount {
  pending: number;
  overdue: number;
}

export interface KpiSummary {
  rfqs: KpiCount;
  pos: KpiCount;
  quotes: KpiCount;
  invoices: KpiCount;
}

export interface QuoteResponseItem {
  id: string;
  vendorName: string;
  vendorCountry: string | null;
  rfqId: string;
  rfqNumber: string;
  projectName: string;
  dateRange: string | null;
  totalCost: number;
  discountPercent: number | null;
  discountAmount: number | null;
  itemsCovered: number;
  totalItems: number;
  status: string;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

export interface RecentOrderItem {
  id: string;
  type: 'rfq' | 'po' | 'bulk-order';
  status: string;
  projectName: string;
  vendorName: string | null;
  location: string | null;
  dateRange: string | null;
  itemCount: number;
  totalCost: number | null;
  remainingPercent: number | null;
  hasMessages: boolean;
}

export interface PendingPoItem {
  id: string;
  vendorName: string;
  vendorCountry: string | null;
  poNumber: string;
  projectName: string;
  date: string;
  itemCount: number;
  deliveryType: string;
  totalCost: number | null;
  status: string;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

export interface InvoicePendingItem {
  id: string;
  vendorName: string;
  vendorCountry: string | null;
  invoiceId: string;
  projectName: string;
  poReference: string | null;
  date: string;
  totalCost: number | null;
  itemCount: number;
  status: string;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

export interface ProjectSuggestion {
  id: string;
  name: string;
}

export interface PoCaDashboard {
  kpiSummary: KpiSummary;
  quoteResponses: QuoteResponseItem[];
  recentOrders: RecentOrderItem[];
  pendingPurchaseOrders: PendingPoItem[];
  invoicesPendingApproval: InvoicePendingItem[];
  projectSuggestions: ProjectSuggestion[];
}

export interface VendorRfqItem {
  id: string;
  companyName: string;
  companyCountry: string | null;
  rfqId: string;
  projectName: string;
  dateRange: string | null;
  totalCost: number | null;
  itemCount: number;
  deliveryLocation: string | null;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

export interface VendorInvoiceItem {
  id: string;
  companyName: string;
  status: string;
  companyCountry: string | null;
  invoiceId: string;
  projectName: string;
  poReference: string | null;
  date: string;
  totalCost: number | null;
  itemCount: number;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

export interface VendorActivePo {
  id: string;
  poNumber: string;
  projectName: string;
  projectId: string;
  contractorName: string;
  poStatus: string;
  revision: number;
  poType: string;
  pickUp: boolean;
}

export interface VendorDashboard {
  rfqsWaiting: VendorRfqItem[];
  invoices: VendorInvoiceItem[];
  activePOs: VendorActivePo[];
}

export interface FinanceDashboard {
  totalPendingAmount: number;
  pendingInvoiceCount: number;
  invoicesDueThisWeek: number;
  invoicesDueAmount: number;
  disputedInvoiceCount: number;
  disputedTrend: number;
  invoicesPendingApproval: InvoicePendingItem[];
  disputedInvoices: InvoicePendingItem[];
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getPoCaDashboard(config?: AxiosRequestConfig): Promise<PoCaDashboard> {
  const { data } = await getApiClient().get<{ data: PoCaDashboard }>(DASHBOARD_PATHS.PO_CA, config);
  return data.data;
}

export async function getVendorDashboard(config?: AxiosRequestConfig): Promise<VendorDashboard> {
  const { data } = await getApiClient().get<{ data: VendorDashboard }>(
    DASHBOARD_PATHS.VENDOR,
    config,
  );
  return data.data;
}

export async function getFinanceDashboard(config?: AxiosRequestConfig): Promise<FinanceDashboard> {
  const { data } = await getApiClient().get<{ data: FinanceDashboard }>(
    DASHBOARD_PATHS.FINANCE,
    config,
  );
  return data.data;
}

// ── Super Admin Dashboard ───────────────────────────────────────────────────

export interface RoleCount {
  role: string;
  count: number;
}

export interface SuperAdminDashboard {
  users: {
    total: number;
    active: number;
    newThisWeek: number;
    byRole: RoleCount[];
  };
  companies: {
    total: number;
    active: number;
    contractors: number;
    vendors: number;
    newThisWeek: number;
  };
  projects: {
    total: number;
    byStatus: Record<string, number>;
  };
  procurement: {
    totalRfqs: number;
    openRfqs: number;
    totalPos: number;
    totalInvoices: number;
    pendingInvoices: number;
  };
  system: {
    dbResponseMs: number;
    status: string;
  };
}

export async function getSuperAdminDashboard(
  config?: AxiosRequestConfig,
): Promise<SuperAdminDashboard> {
  const { data } = await getApiClient().get<{ data: SuperAdminDashboard }>(
    DASHBOARD_PATHS.SUPER_ADMIN,
    config,
  );
  return data.data;
}

// ── Admin Panel (Platform State) ─────────────────────────────────────────────

export interface AdminPanelComponent {
  id: string;
  name: string;
  status: 'Healthy' | 'Error' | 'Warning' | 'Disabled';
  category: 'integration' | 'backgroundJob' | 'notification';
  lastSuccessfulRun: string | null;
  lastError: string | null;
  errorInfo: string | null;
}

export interface AdminPanelState {
  components: AdminPanelComponent[];
}

export async function getAdminPanelState(config?: AxiosRequestConfig): Promise<AdminPanelState> {
  const { data } = await getApiClient().get<{ data: AdminPanelState }>(
    DASHBOARD_PATHS.ADMIN_PANEL,
    config,
  );
  return data.data;
}

// ── Warehouse Dashboard ─────────────────────────────────────────────────────

export interface WarehousePoItem {
  id: string;
  poNumber: string;
  projectName: string;
  vendorName: string;
  requester: string | null;
  itemCount: number;
  deliveryLocation: string | null;
  pickUp: boolean;
  deadlineEnd: string | null;
  totalAmount: number | null;
  status: string;
}

export interface WarehouseBulkOrderItem {
  id: string;
  projectName: string;
  vendorName: string;
  totalAmount: number | null;
  status: string;
  lineItems: {
    description: string;
    qty: number;
    qtyRemaining: number;
    deliveriesPercent: number;
  }[];
}

export interface WarehouseDashboard {
  kpi: {
    pendingDeliveries: number;
    delivered: number;
    activeBulkOrders: number;
    overdueDeliveries: number;
  };
  pendingDeliveries: WarehousePoItem[];
  recentDeliveries: WarehousePoItem[];
  activeBulkOrders: WarehouseBulkOrderItem[];
}

export async function getWarehouseDashboard(
  config?: AxiosRequestConfig,
): Promise<WarehouseDashboard> {
  const { data } = await getApiClient().get<{ data: WarehouseDashboard }>(
    DASHBOARD_PATHS.WAREHOUSE,
    config,
  );
  return data.data;
}
