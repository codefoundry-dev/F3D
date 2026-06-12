// ── Auth ─────────────────────────────────────────────────────────────────────
export const AUTH_PATHS = {
  LOGIN: '/auth/login',
  VERIFY_OTP: '/auth/verify-otp',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  ACTIVATE: '/auth/activate',
  VALIDATE_ACTIVATION_TOKEN: '/auth/validate-activation-token',
  REQUEST_NEW_INVITATION: '/auth/request-new-invitation',
} as const;

// ── Users ────────────────────────────────────────────────────────────────────
export const USERS_PATHS = {
  ROOT: '/users',
  ME: '/users/me',
  ME_AVATAR: '/users/me/avatar',
  ME_AVATAR_URL: '/users/me/avatar-url',
  ME_CHANGE_PASSWORD: '/users/me/change-password',
  byId: (id: string) => `/users/${id}`,
  deactivate: (id: string) => `/users/${id}/deactivate`,
  reactivate: (id: string) => `/users/${id}/reactivate`,
  resendInvitation: (id: string) => `/users/${id}/resend-invitation`,
  cancelInvitation: (id: string) => `/users/${id}/invitation`,
  initiateResetPassword: (id: string) => `/users/${id}/initiate-reset-password`,
} as const;

// ── Companies ────────────────────────────────────────────────────────────────
export const COMPANIES_PATHS = {
  ROOT: '/companies',
  byId: (id: string) => `/companies/${id}`,
  vendors: (id: string) => `/companies/${id}/vendors`,
  vendor: (id: string, vendorId: string) => `/companies/${id}/vendors/${vendorId}`,
  logo: (id: string) => `/companies/${id}/logo`,
  logoUrl: (id: string) => `/companies/${id}/logo-url`,
  documents: (id: string) => `/companies/${id}/documents`,
  document: (id: string, docId: string) => `/companies/${id}/documents/${docId}`,
  documentsExport: (id: string, format: string) => `/companies/${id}/documents/export/${format}`,
  profileExport: (id: string) => `/companies/${id}/profile/export`,
} as const;

// ── Audit Logs ──────────────────────────────────────────────────────────────
export const AUDIT_PATHS = {
  ROOT: '/audit-logs',
} as const;

// ── Roles & permissions ─────────────────────────────────────────────────────
export const ROLES_PATHS = {
  ROOT: '/roles',
  CATALOG: '/roles/permissions/catalog',
  byRole: (role: string) => `/roles/${role}`,
  permissions: (role: string) => `/roles/${role}/permissions`,
} as const;

export const STORAGE_PATHS = {
  UPLOAD: '/storage/upload',
  fileUrl: (id: string) => `/storage/${id}/url`,
  byId: (id: string) => `/storage/${id}`,
} as const;

// ── Document Intelligence ───────────────────────────────────────────────────
export const DOC_EXTRACTIONS_PATHS = {
  ROOT: '/doc-extractions',
  byId: (id: string) => `/doc-extractions/${id}`,
  confirm: (id: string) => `/doc-extractions/${id}/confirm`,
} as const;

// ── Projects ─────────────────────────────────────────────────────────────────
export const PROJECTS_PATHS = {
  ROOT: '/projects',
  byId: (id: string) => `/projects/${id}`,
  members: (id: string) => `/projects/${id}/members`,
  member: (id: string, userId: string) => `/projects/${id}/members/${userId}`,
} as const;

// ── BOMs (US 5.01) ──────────────────────────────────────────────────────────
export const BOMS_PATHS = {
  ROOT: '/boms',
  byId: (id: string) => `/boms/${id}`,
} as const;

// ── Material Lists ───────────────────────────────────────────────────────────
export const MATERIAL_LISTS_PATHS = {
  ROOT: '/material-lists',
  byId: (id: string) => `/material-lists/${id}`,
} as const;

// ── RFQs ─────────────────────────────────────────────────────────────────────
export const RFQS_PATHS = {
  ROOT: '/rfqs',
  DRAFT: '/rfqs/draft',
  byId: (id: string) => `/rfqs/${id}`,
  copy: (id: string) => `/rfqs/${id}/copy`,
  archive: (id: string) => `/rfqs/${id}/archive`,
  export: (format: 'csv' | 'xlsx' | 'pdf') => `/rfqs/export/${format}`,
  quotes: (rfqId: string) => `/rfqs/${rfqId}/quotes`,
  quote: (rfqId: string, quoteId: string) => `/rfqs/${rfqId}/quotes/${quoteId}`,
  quoteAudit: (rfqId: string) => `/rfqs/${rfqId}/quote-audit`,
  quoteComparison: (rfqId: string) => `/rfqs/${rfqId}/quote-comparison`,
  quoteLineItemStatus: (rfqId: string, quoteId: string) =>
    `/rfqs/${rfqId}/quotes/${quoteId}/line-items/status`,
  approveQuote: (rfqId: string, quoteId: string) => `/rfqs/${rfqId}/quotes/${quoteId}/approve`,
  awardQuote: (rfqId: string, quoteId: string) => `/rfqs/${rfqId}/quotes/${quoteId}/award`,
  declineQuote: (rfqId: string, quoteId: string) => `/rfqs/${rfqId}/quotes/${quoteId}/decline`,
  lineItem: (rfqId: string, lineItemId: string) => `/rfqs/${rfqId}/line-items/${lineItemId}`,
  send: (id: string) => `/rfqs/${id}/send`,
  checkBulk: (id: string) => `/rfqs/${id}/check-bulk`,
  confirmBulk: (id: string) => `/rfqs/${id}/confirm-bulk-suggestions`,
  CHECK_AVAILABILITY: '/rfqs/check-availability',
  confirmCoverage: (id: string) => `/rfqs/${id}/confirm-coverage`,
  documents: (rfqId: string) => `/rfqs/${rfqId}/documents`,
  document: (rfqId: string, docId: string) => `/rfqs/${rfqId}/documents/${docId}`,
  guestRfq: (token: string) => `/rfqs/invitation/${token}`,
  guestQuote: (token: string) => `/rfqs/invitation/${token}/quote`,
  guestQuoteExtraction: (token: string) => `/rfqs/invitation/${token}/quote-extraction`,
  guestQuoteExtractionStatus: (id: string) => `/rfqs/invitation/quote-extraction/${id}`,
  emails: (rfqId: string) => `/rfqs/${rfqId}/emails`,
} as const;

// ── Purchase Orders ──────────────────────────────────────────────────────────
export const PURCHASE_ORDERS_PATHS = {
  ROOT: '/purchase-orders',
  byId: (id: string) => `/purchase-orders/${id}`,
  approve: (id: string) => `/purchase-orders/${id}/approve`,
  decline: (id: string) => `/purchase-orders/${id}/decline`,
  copy: (id: string) => `/purchase-orders/${id}/copy`,
  archive: (id: string) => `/purchase-orders/${id}/archive`,
  issue: (id: string) => `/purchase-orders/${id}/issue`,
  export: (format: string) => `/purchase-orders/export/${format}`,
  confirm: (id: string) => `/purchase-orders/${id}/confirm`,
  accept: (id: string) => `/purchase-orders/${id}/accept`,
  vendorDecline: (id: string) => `/purchase-orders/${id}/vendor-decline`,
  validateItems: '/purchase-orders/validate-items',
  documents: (poId: string) => `/purchase-orders/${poId}/documents`,
  document: (poId: string, docId: string) => `/purchase-orders/${poId}/documents/${docId}`,
  exportSingle: (id: string, format: string) => `/purchase-orders/${id}/export/${format}`,
  changeRequests: (id: string) => `/purchase-orders/${id}/change-requests`,
  approveChange: (id: string, crId: string) =>
    `/purchase-orders/${id}/change-requests/${crId}/approve`,
  rejectChange: (id: string, crId: string) =>
    `/purchase-orders/${id}/change-requests/${crId}/reject`,
  emails: (poId: string) => `/purchase-orders/${poId}/emails`,
} as const;

// ── Bulk Orders ──────────────────────────────────────────────────────────────
export const BULK_ORDERS_PATHS = {
  ROOT: '/bulk-orders',
  byId: (id: string) => `/bulk-orders/${id}`,
  lineItem: (bulkOrderId: string, lineItemId: string) =>
    `/bulk-orders/${bulkOrderId}/line-items/${lineItemId}`,
  drawdowns: (bulkOrderId: string) => `/bulk-orders/${bulkOrderId}/drawdowns`,
  changeRequests: (id: string) => `/bulk-orders/${id}/change-requests`,
  approveChange: (id: string, crId: string) => `/bulk-orders/${id}/change-requests/${crId}/approve`,
  rejectChange: (id: string, crId: string) => `/bulk-orders/${id}/change-requests/${crId}/reject`,
  cancel: (id: string) => `/bulk-orders/${id}/cancel`,
} as const;

// ── Invoices ─────────────────────────────────────────────────────────────────
export const INVOICES_PATHS = {
  ROOT: '/invoices',
  byId: (id: string) => `/invoices/${id}`,
  approve: (id: string) => `/invoices/${id}/approve`,
  reject: (id: string) => `/invoices/${id}/reject`,
  BULK_APPROVE: '/invoices/bulk-approve',
  export: (format: 'csv' | 'xlsx' | 'pdf') => `/invoices/export/${format}`,
  exportSingle: (id: string, format: 'csv' | 'xlsx' | 'pdf') => `/invoices/${id}/export/${format}`,
  documents: (invoiceId: string) => `/invoices/${invoiceId}/documents`,
  document: (invoiceId: string, docId: string) => `/invoices/${invoiceId}/documents/${docId}`,
} as const;

// ── Views ───────────────────────────────────────────────────────────────────
export const VIEWS_PATHS = {
  ROOT: '/views',
  byId: (id: string) => `/views/${id}`,
} as const;

// ── Materials ────────────────────────────────────────────────────────────────
export const MATERIALS_PATHS = {
  ROOT: '/materials',
  CATEGORIES: '/materials/categories',
  SUGGESTIONS: '/materials/suggestions',
  CATALOGUE_IMPORT: '/materials/catalogue-import',
  DETECT_DUPLICATES: '/materials/detect-duplicates',
  CHANGE_REQUESTS: '/materials/change-requests',
  changeRequestApprove: (id: string) => `/materials/change-requests/${id}/approve`,
  changeRequestReject: (id: string) => `/materials/change-requests/${id}/reject`,
  byId: (id: string) => `/materials/${id}`,
  approve: (id: string) => `/materials/${id}/approve`,
  reject: (id: string) => `/materials/${id}/reject`,
  archive: (id: string) => `/materials/${id}/archive`,
  restore: (id: string) => `/materials/${id}/restore`,
} as const;

// ── Vendors ─────────────────────────────────────────────────────────────────
export const VENDORS_PATHS = {
  ROOT: '/vendors',
  INVITE: '/vendors/invite',
  profile: (id: string) => `/vendors/${id}/profile`,
  warehouses: (id: string) => `/vendors/${id}/warehouses`,
  warehouse: (id: string, whId: string) => `/vendors/${id}/warehouses/${whId}`,
  representatives: (id: string) => `/vendors/${id}/representatives`,
  inviteUser: (companyId: string) => `/vendors/${companyId}/users/invite`,
  resendUserInvitation: (companyId: string, userId: string) =>
    `/vendors/${companyId}/users/${userId}/resend-invitation`,
  cancelUserInvitation: (companyId: string, userId: string) =>
    `/vendors/${companyId}/users/${userId}/invitation`,
} as const;

// ── Messages ────────────────────────────────────────────────────────────────
export const MESSAGES_PATHS = {
  THREADS: '/messages/threads',
  threadMessages: (threadId: string) => `/messages/threads/${threadId}/messages`,
} as const;

// ── Dashboard ────────────────────────────────────────────────────────────────
export const DASHBOARD_PATHS = {
  PO_CA: '/dashboard/po-ca',
  VENDOR: '/dashboard/vendor',
  FINANCE: '/dashboard/finance',
  SUPER_ADMIN: '/dashboard/super-admin',
  ADMIN_PANEL: '/dashboard/admin-panel',
  WAREHOUSE: '/dashboard/warehouse',
} as const;
