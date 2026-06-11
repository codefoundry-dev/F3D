/**
 * Unified route map for the single-frontend Forethread web app.
 *
 * URL conflicts between the original six per-role apps were resolved as
 * follows (documented in apps/web/MIGRATION.md):
 *   - /users (was /settings/users in company-admin / super-admin)
 *   - /me    (was /settings/profile in company-admin)
 *   - /company (was /settings/company in company-admin)
 *
 * Paths that render different pages for different roles (e.g. vendor vs.
 * company-admin view of /rfqs/:id) are still mounted at one canonical URL
 * here — the routes.tsx wires a `RoleSwitch` to choose the right page.
 */
export const ROUTES = {
  // ── Public / auth ──────────────────────────────────────────────────
  home: '/',
  login: '/login',
  verifyOtp: '/verify-otp',
  activate: '/activate',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  guestInvitation: '/invitation/:token',
  forbidden: '/forbidden',

  // ── RFQs ───────────────────────────────────────────────────────────
  rfqs: '/rfqs',
  rfqNew: '/rfqs/new',
  rfqFromBom: '/rfqs/from-bom',
  rfqDetail: '/rfqs/:id',
  rfqResponse: '/rfqs/:id/response',
  quoteResponseDetail: '/rfqs/:id/quotes/:quoteId',

  // ── Purchase orders ────────────────────────────────────────────────
  purchaseOrders: '/purchase-orders',
  purchaseOrderNew: '/purchase-orders/new',
  purchaseOrderDetail: '/purchase-orders/:id',
  purchaseOrderComms: '/purchase-orders/:id/comms',
  purchaseOrderChangeRequest: '/purchase-orders/:id/change-request',

  // ── Bulk orders ────────────────────────────────────────────────────
  bulkOrders: '/bulk-orders',
  bulkOrderDetail: '/bulk-orders/:id',
  bulkOrderDrawdown: '/bulk-orders/:id/drawdown',
  bulkOrderEdit: '/bulk-orders/:id/edit',
  bulkOrderChange: '/bulk-orders/:id/change',
  bulkOrderReviewChange: '/bulk-orders/:id/review-change',

  // ── Projects ───────────────────────────────────────────────────────
  projects: '/projects',
  projectsNew: '/projects/new',
  projectDetail: '/projects/:id',
  projectEdit: '/projects/:id/edit',
  projectBomCreate: '/projects/:id/bom/new',

  // ── Invoices ───────────────────────────────────────────────────────
  invoices: '/invoices',
  invoiceDetail: '/invoices/:id',
  invoiceUpload: '/invoices/upload',

  // ── Vendors / materials ────────────────────────────────────────────
  vendors: '/vendors',
  vendorNew: '/vendors/new',
  vendorDetail: '/vendors/:id',
  materialCatalogue: '/material-catalogue',
  materialCatalogueNew: '/material-catalogue/new',
  materialCatalogueUpload: '/material-catalogue/upload',
  materialCatalogueDetail: '/material-catalogue/:id',
  materialCatalogueEdit: '/material-catalogue/:id/edit',
  materialCatalogueEditAdditional: '/material-catalogue/:id/edit/additional',
  materialDetail: '/materials/:id',

  // ── Companies (super-admin) ────────────────────────────────────────
  companies: '/companies',
  companyDetail: '/companies/:id',
  adminPanel: '/admin-panel',

  // ── Users / self / settings ────────────────────────────────────────
  users: '/users',
  userDetail: '/users/:id',
  me: '/me',
  companyProfile: '/company',
  settings: '/settings',
  roles: '/settings/roles',
  roleEdit: '/settings/roles/:role',
} as const;

export type RouteKey = keyof typeof ROUTES;
