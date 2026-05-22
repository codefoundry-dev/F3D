import { UserRole } from '@prisma/client';

/**
 * Canonical permission catalog.
 *
 * Each key is a stable identifier used by @RequirePermissions on controllers
 * and persisted as the `Permission.key` column in the database. The catalog
 * is the source of truth — the PermissionsBootstrap upserts each entry on
 * startup and assigns the role defaults below to RolePermission rows.
 *
 * A Company Admin can override these defaults per-company in a later
 * release (FOR-195). The mapping below preserves the exact authorisation
 * behaviour the codebase had before this refactor.
 */
export const PERMISSIONS = {
  // ── Dashboards ──────────────────────────────────────────────────────────
  'dashboard.viewPoCa': 'View Procurement/Company-Admin dashboard',
  'dashboard.viewVendor': 'View Vendor dashboard',
  'dashboard.viewFinance': 'View Finance dashboard',
  'dashboard.viewSuperAdmin': 'View SuperAdmin dashboard',
  'dashboard.viewAdminPanel': 'View admin panel platform state',
  'dashboard.viewWarehouse': 'View Warehouse dashboard',

  // ── Projects ────────────────────────────────────────────────────────────
  'project.list': 'List projects accessible to the user',
  'project.create': 'Create projects',
  'project.update': 'Update project details',
  'project.manageMembers': 'Add or remove project members',

  // ── Companies ───────────────────────────────────────────────────────────
  'company.create': 'Create company records',
  'company.assignVendors': 'Assign vendors to a contractor',
  'company.removeVendorAssignment': 'Remove a vendor assignment',

  // ── Invoices ────────────────────────────────────────────────────────────
  'invoice.list': 'List invoices',
  'invoice.read': 'Read a single invoice',
  'invoice.export': 'Export invoice list',
  'invoice.exportSingle': 'Export a single invoice',
  'invoice.approve': 'Approve a pending invoice',
  'invoice.reject': 'Reject an invoice',
  'invoice.bulkApprove': 'Bulk-approve invoices',
  'invoice.uploadDocument': 'Upload a document to an invoice',
  'invoice.deleteDocument': 'Delete an invoice document',

  // ── Materials ───────────────────────────────────────────────────────────
  'material.list': 'List materials',
  'material.listCategories': 'List material categories',
  'material.suggestions': 'Material autocomplete suggestions',
  'material.create': 'Create materials',

  // ── Bulk orders ─────────────────────────────────────────────────────────
  'bulkOrder.list': 'List bulk orders',
  'bulkOrder.create': 'Create bulk orders',
  'bulkOrder.read': 'Read a single bulk order',
  'bulkOrder.update': 'Update bulk orders',
  'bulkOrder.delete': 'Delete bulk orders',
  'bulkOrder.updateLineItem': 'Update a bulk-order line item',
  'bulkOrder.createDrawdown': 'Create a drawdown from a bulk order',
  'bulkOrder.proposeChange': 'Propose a change to a bulk order',
  'bulkOrder.listChangeRequests': 'List bulk-order change requests',
  'bulkOrder.approveChange': 'Approve a bulk-order change request',
  'bulkOrder.rejectChange': 'Reject a bulk-order change request',
  'bulkOrder.cancel': 'Cancel a bulk order',

  // ── Messages ────────────────────────────────────────────────────────────
  'message.createThread': 'Create a message thread',
  'message.listThreads': 'List message threads',
  'message.read': 'Read messages in a thread',
  'message.send': 'Send a message',

  // ── Vendors ─────────────────────────────────────────────────────────────
  'vendor.invite': 'Invite a vendor to the platform',
  'vendor.list': 'List vendors',
  'vendor.readProfile': 'Read a vendor profile',
  'vendor.updateProfile': 'Update a vendor profile',
  'vendor.warehouse.create': 'Add a vendor warehouse',
  'vendor.warehouse.update': 'Update a vendor warehouse',
  'vendor.warehouse.delete': 'Delete a vendor warehouse',
  'vendor.user.invite': 'Invite a user to a vendor company',
  'vendor.user.resendInvitation': 'Resend a vendor-user invitation',
  'vendor.user.cancelInvitation': 'Cancel a vendor-user invitation',
  'vendor.representatives.read': 'Read vendor representatives',

  // ── RFQs ────────────────────────────────────────────────────────────────
  'rfq.list': 'List RFQs',
  'rfq.create': 'Create an RFQ',
  'rfq.export': 'Export RFQs',
  'rfq.read': 'Read an RFQ',
  'rfq.update': 'Update an RFQ',
  'rfq.send': 'Send an RFQ to vendors',
  'rfq.cancel': 'Cancel an RFQ',
  'rfq.copy': 'Duplicate an RFQ',
  'rfq.archive': 'Archive an RFQ',
  'rfq.approveQuote': 'Approve (award) a quote',
  'rfq.declineQuote': 'Decline a quote',
  'rfq.updateLineItem': 'Update an RFQ line item',
  'rfq.deleteLineItem': 'Delete an RFQ line item',
  'rfq.uploadDocument': 'Upload an RFQ document',
  'rfq.deleteDocument': 'Delete an RFQ document',
  'rfq.submitQuote': 'Submit a quote response',
  'rfq.updateQuote': 'Update a submitted quote',
  'rfq.readQuoteDetail': 'Read quote response detail',

  // ── Purchase orders ─────────────────────────────────────────────────────
  'po.list': 'List purchase orders',
  'po.create': 'Create a purchase order',
  'po.validateItems': 'Validate PO line items against bulk orders/RFQs',
  'po.update': 'Update a purchase order',
  'po.issue': 'Issue a draft purchase order',
  'po.confirm': 'Vendor confirms a PO',
  'po.accept': 'Vendor accepts a PO',
  'po.vendorDecline': 'Vendor declines a PO',
  'po.export': 'Export purchase orders',
  'po.exportSingle': 'Export a single purchase order',
  'po.uploadDocument': 'Upload a PO document',
  'po.deleteDocument': 'Delete a PO document',
  'po.copy': 'Duplicate a purchase order',
  'po.archive': 'Archive a purchase order',
  'po.read': 'Read a purchase order',
  'po.approve': 'Approve a purchase order',
  'po.decline': 'Decline a purchase order',
  'po.proposeChange': 'Propose a PO change request',
  'po.listChangeRequests': 'List PO change requests',
  'po.approveChange': 'Approve a PO change request',
  'po.rejectChange': 'Reject a PO change request',

  // ── Roles & permissions (admin) ─────────────────────────────────────────
  'role.list': 'List built-in roles and the permissions granted to each',
  'role.update': 'Grant or revoke permissions on a built-in role',

  // ── Users ───────────────────────────────────────────────────────────────
  'user.list': 'List users',
  'user.create': 'Create and invite users',
  'user.update': 'Update users',
  'user.deactivate': 'Deactivate a user',
  'user.reactivate': 'Reactivate a user',
  'user.initiateResetPassword': 'Admin-initiate a user password reset',
  'user.resendInvitation': 'Resend a user invitation',
  'user.cancelInvitation': 'Cancel a pending user invitation',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

const ALL_KEYS_LIST: PermissionKey[] = ALL_PERMISSION_KEYS;

/**
 * Default permission grants per role. Mirrors the @Roles() configuration the
 * codebase had immediately before this refactor — anyone migrating an existing
 * deployment ends up with identical authorisation behaviour after the
 * PermissionsBootstrap runs.
 *
 * SUPER_ADMIN gets every permission; the engine treats it as a regular role
 * with the full catalog rather than as a hard-coded bypass — that keeps the
 * model uniform and lets a Company Admin override later if desired.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  SUPER_ADMIN: [...ALL_KEYS_LIST],

  COMPANY_ADMIN: [
    'dashboard.viewPoCa',

    'project.list',
    'project.create',
    'project.update',
    'project.manageMembers',

    'company.create',
    'company.assignVendors',

    'invoice.list',
    'invoice.read',
    'invoice.export',
    'invoice.exportSingle',
    'invoice.approve',
    'invoice.reject',
    'invoice.bulkApprove',
    'invoice.uploadDocument',
    'invoice.deleteDocument',

    'material.list',
    'material.listCategories',
    'material.suggestions',
    'material.create',

    'bulkOrder.list',
    'bulkOrder.create',
    'bulkOrder.read',
    'bulkOrder.update',
    'bulkOrder.delete',
    'bulkOrder.updateLineItem',
    'bulkOrder.createDrawdown',
    'bulkOrder.proposeChange',
    'bulkOrder.listChangeRequests',
    'bulkOrder.approveChange',
    'bulkOrder.rejectChange',
    'bulkOrder.cancel',

    'message.createThread',
    'message.listThreads',
    'message.read',
    'message.send',

    'vendor.invite',
    'vendor.list',
    'vendor.readProfile',
    'vendor.updateProfile',
    'vendor.warehouse.create',
    'vendor.warehouse.update',
    'vendor.warehouse.delete',
    'vendor.representatives.read',

    'rfq.list',
    'rfq.create',
    'rfq.export',
    'rfq.read',
    'rfq.update',
    'rfq.send',
    'rfq.cancel',
    'rfq.copy',
    'rfq.archive',
    'rfq.approveQuote',
    'rfq.declineQuote',
    'rfq.updateLineItem',
    'rfq.deleteLineItem',
    'rfq.uploadDocument',
    'rfq.deleteDocument',
    'rfq.readQuoteDetail',

    'po.list',
    'po.create',
    'po.validateItems',
    'po.update',
    'po.issue',
    'po.export',
    'po.exportSingle',
    'po.uploadDocument',
    'po.deleteDocument',
    'po.copy',
    'po.archive',
    'po.read',
    'po.approve',
    'po.decline',
    'po.proposeChange',
    'po.listChangeRequests',
    'po.approveChange',
    'po.rejectChange',

    'role.list',
    'role.update',

    'user.list',
    'user.create',
    'user.update',
    'user.deactivate',
    'user.reactivate',
    'user.initiateResetPassword',
    'user.resendInvitation',
    'user.cancelInvitation',
  ],

  PROCUREMENT_OFFICER: [
    'dashboard.viewPoCa',

    'project.list',
    'project.create',
    'project.update',

    'company.create',
    'company.assignVendors',

    'invoice.list',
    'invoice.read',
    'invoice.export',
    'invoice.exportSingle',
    'invoice.approve',
    'invoice.reject',
    'invoice.bulkApprove',
    'invoice.uploadDocument',
    'invoice.deleteDocument',

    'material.list',
    'material.listCategories',
    'material.suggestions',
    'material.create',

    'bulkOrder.list',
    'bulkOrder.create',
    'bulkOrder.read',
    'bulkOrder.update',
    'bulkOrder.delete',
    'bulkOrder.updateLineItem',
    'bulkOrder.createDrawdown',
    'bulkOrder.proposeChange',
    'bulkOrder.listChangeRequests',
    'bulkOrder.approveChange',
    'bulkOrder.rejectChange',
    'bulkOrder.cancel',

    'message.createThread',
    'message.listThreads',
    'message.read',
    'message.send',

    'vendor.invite',
    'vendor.list',
    'vendor.readProfile',
    'vendor.updateProfile',
    'vendor.warehouse.create',
    'vendor.warehouse.update',
    'vendor.warehouse.delete',
    'vendor.representatives.read',

    'rfq.list',
    'rfq.create',
    'rfq.export',
    'rfq.read',
    'rfq.update',
    'rfq.send',
    'rfq.cancel',
    'rfq.copy',
    'rfq.archive',
    'rfq.approveQuote',
    'rfq.declineQuote',
    'rfq.updateLineItem',
    'rfq.deleteLineItem',
    'rfq.uploadDocument',
    'rfq.deleteDocument',
    'rfq.readQuoteDetail',

    'po.list',
    'po.create',
    'po.validateItems',
    'po.update',
    'po.issue',
    'po.export',
    'po.exportSingle',
    'po.uploadDocument',
    'po.deleteDocument',
    'po.copy',
    'po.archive',
    'po.read',
    'po.approve',
    'po.decline',
    'po.proposeChange',
    'po.listChangeRequests',
    'po.approveChange',
    'po.rejectChange',

    'user.update',
  ],

  FINANCIAL_OFFICER: [
    'dashboard.viewFinance',

    'project.list',

    'invoice.list',
    'invoice.read',
    'invoice.export',
    'invoice.exportSingle',
    'invoice.approve',
    'invoice.reject',
    'invoice.bulkApprove',
    'invoice.uploadDocument',
    'invoice.deleteDocument',

    'material.list',
    'material.listCategories',
    'material.suggestions',

    'bulkOrder.list',
    'bulkOrder.read',
    'bulkOrder.listChangeRequests',

    'po.list',
    'po.read',
    'po.export',
    'po.listChangeRequests',
  ],

  WAREHOUSE_OFFICER: [
    'dashboard.viewWarehouse',

    'project.list',

    'material.list',
    'material.listCategories',
    'material.suggestions',
  ],

  FOREMAN: [
    'project.list',

    'material.list',
    'material.listCategories',
    'material.suggestions',

    'message.createThread',
    'message.listThreads',
    'message.read',
    'message.send',
  ],

  VENDOR: [
    'dashboard.viewVendor',

    'invoice.list',
    'invoice.read',
    'invoice.exportSingle',
    'invoice.uploadDocument',

    'material.list',
    'material.listCategories',
    'material.suggestions',

    'bulkOrder.list',
    'bulkOrder.read',
    'bulkOrder.proposeChange',
    'bulkOrder.listChangeRequests',
    'bulkOrder.approveChange',
    'bulkOrder.rejectChange',
    'bulkOrder.cancel',

    'message.createThread',
    'message.listThreads',
    'message.read',
    'message.send',

    'vendor.readProfile',
    'vendor.updateProfile',
    'vendor.warehouse.create',
    'vendor.warehouse.update',
    'vendor.warehouse.delete',
    'vendor.user.invite',
    'vendor.user.resendInvitation',
    'vendor.user.cancelInvitation',
    'vendor.representatives.read',

    'rfq.list',
    'rfq.export',
    'rfq.read',
    'rfq.submitQuote',
    'rfq.updateQuote',
    'rfq.readQuoteDetail',

    'po.list',
    'po.read',
    'po.confirm',
    'po.accept',
    'po.vendorDecline',
    'po.export',
    'po.exportSingle',
    'po.uploadDocument',
    'po.deleteDocument',
    'po.proposeChange',
    'po.listChangeRequests',
    'po.approveChange',
    'po.rejectChange',

    'user.list',
    'user.update',
  ],
};
