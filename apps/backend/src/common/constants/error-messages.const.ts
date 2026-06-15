/**
 * Centralised error messages for the backend.
 *
 * All human-readable text lives in the i18n JSON file
 * (`packages/i18n/src/locales/en/errors.json`) so it can be translated.
 *
 * Usage:
 *   throw new NotFoundException(ERR.projects.notFound);
 *   throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));
 */
import errors from '@forethread/i18n/locales/en/errors.json';

// Simple interpolation helper:  "Hello {{name}}" + { name: "World" } → "Hello World"
function t(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

export const ERR = {
  // ── General ──────────────────────────────────────────────
  general: {
    accessDenied: errors.general.accessDenied,
    accessDeniedRoles: (roles: string) => t(errors.general.accessDeniedRoles, { roles }),
    accessDeniedPermissions: (permissions: string) =>
      t(errors.general.accessDeniedPermissions, { permissions }),
    notFound: errors.general.notFound,
    internalServerError: errors.general.internalServerError,
    badRequest: errors.general.badRequest,
  },

  // ── Auth ─────────────────────────────────────────────────
  auth: {
    invalidCredentials: errors.auth.invalidCredentials,
    accountNotActivated: errors.auth.accountNotActivated,
    invalidOtp: errors.auth.invalidOtp,
    otpNotFound: errors.auth.otpNotFound,
    otpExpired: errors.auth.otpExpired,
    accountLocked: errors.auth.accountLocked,
    sessionExpired: errors.auth.sessionExpired,
    invalidResetToken: errors.auth.invalidResetToken,
    invalidInvitationToken: errors.auth.invalidInvitationToken,
    invalidOrExpiredInvitationToken: errors.auth.invalidOrExpiredInvitationToken,
    refreshTokenMissing: errors.auth.refreshTokenMissing,
    invalidRefreshToken: errors.auth.invalidRefreshToken,
    accountNotActive: errors.auth.accountNotActive,
    authenticationRequired: errors.auth.authenticationRequired,
  },

  // ── Users ────────────────────────────────────────────────
  users: {
    notFound: errors.users.notFound,
    cannotCreateForOtherCompanies: errors.users.cannotCreateForOtherCompanies,
    cannotAssignRole: errors.users.cannotAssignRole,
    emailAlreadyInUse: errors.users.emailAlreadyInUse,
    alreadyInactive: errors.users.alreadyInactive,
    notInactive: errors.users.notInactive,
    alreadyActivated: errors.users.alreadyActivated,
    onlyResetActiveUsers: errors.users.onlyResetActiveUsers,
    cannotCancelInvitation: errors.users.cannotCancelInvitation,
    noPasswordSet: errors.users.noPasswordSet,
    currentPasswordIncorrect: errors.users.currentPasswordIncorrect,
    cannotDeactivateSelf: errors.users.cannotDeactivateSelf,
    cannotDeactivateLastAdmin: errors.users.cannotDeactivateLastAdmin,
    cannotChangeLastAdminRole: errors.users.cannotChangeLastAdminRole,
  },

  // ── Companies ────────────────────────────────────────────
  companies: {
    notFound: (id: string) => t(errors.companies.notFound, { id }),
    notFoundGeneric: errors.companies.notFoundGeneric,
    contractorNotFound: errors.companies.contractorNotFound,
    notContractor: errors.companies.notContractor,
    invalidVendorIds: errors.companies.invalidVendorIds,
    vendorAssignmentNotFound: errors.companies.vendorAssignmentNotFound,
    contactEmailRequired: errors.companies.contactEmailRequired,
  },

  // ── Projects ─────────────────────────────────────────────
  projects: {
    notFound: errors.projects.notFound,
    notMember: errors.projects.notMember,
    endDateBeforeStart: errors.projects.endDateBeforeStart,
    duplicateName: errors.projects.duplicateName,
    cannotChangeAssignedUsers: errors.projects.cannotChangeAssignedUsers,
    cannotArchive: errors.projects.cannotArchive,
    invalidStatusTransition: (from: string, to: string) =>
      t(errors.projects.invalidStatusTransition, { from, to }),
    userNotMember: errors.projects.userNotMember,
    cannotRemoveLastMember: errors.projects.cannotRemoveLastMember,
    cannotRemoveLastAdmin: errors.projects.cannotRemoveLastAdmin,
    cannotRemoveCreator: errors.projects.cannotRemoveCreator,
    usersNotFoundOrInactive: (ids: string) => t(errors.projects.usersNotFoundOrInactive, { ids }),
    deliveryLocationRequired: errors.projects.deliveryLocationRequired,
    storageLocationRequired: errors.projects.storageLocationRequired,
    defaultDeliveryRequired: errors.projects.defaultDeliveryRequired,
    defaultStorageRequired: errors.projects.defaultStorageRequired,
    onlyOneDefaultDelivery: errors.projects.onlyOneDefaultDelivery,
    onlyOneDefaultStorage: errors.projects.onlyOneDefaultStorage,
    duplicateLocationName: (name: string) => t(errors.projects.duplicateLocationName, { name }),
  },

  // ── RFQs ─────────────────────────────────────────────────
  rfqs: {
    notFound: errors.rfqs.notFound,
    onlyClosedCanArchive: errors.rfqs.onlyClosedCanArchive,
    lineItemNotFound: errors.rfqs.lineItemNotFound,
    quoteNotFound: errors.rfqs.quoteNotFound,
    quoteLineItemNotFound: errors.rfqs.quoteLineItemNotFound,
    invalidQuoteAction: (action: string, status: string) =>
      t(errors.rfqs.invalidQuoteAction, { action, status }),
    projectNotFound: errors.rfqs.projectNotFound,
    invalidDeliveryLocation: errors.rfqs.invalidDeliveryLocation,
    invalidMaterialIds: errors.rfqs.invalidMaterialIds,
    invalidLineItem: errors.rfqs.invalidLineItem,
    invalidVendorIds: errors.rfqs.invalidVendorIds,
    holdForReleaseRequiresEarliestDelivery: errors.rfqs.holdForReleaseRequiresEarliestDelivery,
    cannotEditStatus: (status: string) => t(errors.rfqs.cannotEditStatus, { status }),
    cannotSendNotDraft: (status: string) => t(errors.rfqs.cannotSendNotDraft, { status }),
    mustHaveLineItems: errors.rfqs.mustHaveLineItems,
    mustHaveVendors: errors.rfqs.mustHaveVendors,
    invalidProjectIds: errors.rfqs.invalidProjectIds,
    lineItemProjectNotInRfq: errors.rfqs.lineItemProjectNotInRfq,
    coverageOnlyDraft: errors.rfqs.coverageOnlyDraft,
    coverageExceedsLineQuantity: errors.rfqs.coverageExceedsLineQuantity,
  },

  // ── Purchase Orders ──────────────────────────────────────
  purchaseOrders: {
    notFound: errors.purchaseOrders.notFound,
    projectNotFound: errors.purchaseOrders.projectNotFound,
    vendorNotFound: errors.purchaseOrders.vendorNotFound,
    invalidDeliveryLocation: errors.purchaseOrders.invalidDeliveryLocation,
    invalidDeliveryRow: errors.purchaseOrders.invalidDeliveryRow,
    cannotApprove: (status: string) => t(errors.purchaseOrders.cannotApprove, { status }),
    cannotDecline: (status: string) => t(errors.purchaseOrders.cannotDecline, { status }),
    cannotEditNonDraft: errors.purchaseOrders.cannotEditNonDraft,
    cannotIssue: (status: string) => t(errors.purchaseOrders.cannotIssue, { status }),
    holdForReleaseRequiresDeadline: errors.purchaseOrders.holdForReleaseRequiresDeadline,
    cannotConfirm: (status: string) => t(errors.purchaseOrders.cannotConfirm, { status }),
    cannotAccept: (status: string) => t(errors.purchaseOrders.cannotAccept, { status }),
    cannotVendorDecline: (status: string) =>
      t(errors.purchaseOrders.cannotVendorDecline, { status }),
    onlyClosedCanArchive: errors.purchaseOrders.onlyClosedCanArchive,
    approvalThresholdExceeded: (amount: string, threshold: string, currency: string) =>
      t(errors.purchaseOrders.approvalThresholdExceeded, { amount, threshold, currency }),
    bulkOrderNotFound: errors.purchaseOrders.bulkOrderNotFound,
    bulkOrderLineNotFound: errors.purchaseOrders.bulkOrderLineNotFound,
    drawdownExceedsRemaining: (
      requested: number,
      line: string,
      remaining: number,
      bulkOrderNumber: string,
    ) =>
      t(errors.purchaseOrders.drawdownExceedsRemaining, {
        requested,
        line,
        remaining,
        bulkOrderNumber,
      }),
    lineNotFound: (lineItemId: string) => t(errors.purchaseOrders.lineNotFound, { lineItemId }),
    deliveredExceedsOrdered: (delivered: number, ordered: number) =>
      t(errors.purchaseOrders.deliveredExceedsOrdered, { delivered, ordered }),
  },

  // ── Bulk Orders ──────────────────────────────────────────
  bulkOrders: {
    notFound: errors.bulkOrders.notFound,
    lineItemNotFound: errors.bulkOrders.lineItemNotFound,
    cannotModifyClosed: errors.bulkOrders.cannotModifyClosed,
    insufficientQuantity: errors.bulkOrders.insufficientQuantity,
    changeRequestNotFound: errors.bulkOrders.changeRequestNotFound,
    changeRequestNotPending: errors.bulkOrders.changeRequestNotPending,
    cannotChangeOwnRequest: errors.bulkOrders.cannotChangeOwnRequest,
    alreadyCancelled: errors.bulkOrders.alreadyCancelled,
  },

  // ── Invoices ─────────────────────────────────────────────
  invoices: {
    notFound: errors.invoices.notFound,
    documentNotFound: errors.invoices.documentNotFound,
    cannotApprove: (status: string) => t(errors.invoices.cannotApprove, { status }),
    cannotReject: (status: string) => t(errors.invoices.cannotReject, { status }),
    noIdsProvided: errors.invoices.noIdsProvided,
  },

  // ── Storage / Files ──────────────────────────────────────
  storage: {
    noFileProvided: errors.storage.noFileProvided,
    fileTooLarge: (size: string) => t(errors.storage.fileTooLarge, { size }),
    fileTypeNotAllowed: errors.storage.fileTypeNotAllowed,
    onlyImagesAllowed: errors.storage.onlyImagesAllowed,
    onlyImagesAllowedFormats: errors.storage.onlyImagesAllowedFormats,
    fileNotFound: errors.storage.fileNotFound,
  },

  // ── Export ───────────────────────────────────────────────
  export: {
    invalidFormatCsvPdfXlsx: errors.export.invalidFormatCsvPdfXlsx,
    invalidFormatPdfCsv: errors.export.invalidFormatPdfCsv,
  },

  // ── Materials ──────────────────────────────────────────────
  materials: {
    notFound: errors.materials.notFound,
    duplicateName: errors.materials.duplicateName,
    referenced: (count: number) => t(errors.materials.referenced, { count }),
    invalidStatusTransition: (status: string) =>
      t(errors.materials.invalidStatusTransition, { status }),
    changeRequestNotFound: errors.materials.changeRequestNotFound,
    changeRequestNotPending: errors.materials.changeRequestNotPending,
  },

  // ── Material lists (US 5.05) ───────────────────────────────
  materialLists: {
    notFound: errors.materialLists.notFound,
    invalidMaterialIds: errors.materialLists.invalidMaterialIds,
  },

  // ── Material requests (Epic 6) ─────────────────────────────
  materialRequests: {
    notFound: errors.materialRequests.notFound,
    projectNotFound: errors.materialRequests.projectNotFound,
    invalidLineItem: errors.materialRequests.invalidLineItem,
    invalidMaterialIds: errors.materialRequests.invalidMaterialIds,
    invalidDeliveryLocation: errors.materialRequests.invalidDeliveryLocation,
    cannotUpdateNonDraft: errors.materialRequests.cannotUpdateNonDraft,
    cannotCancel: (status: string) => t(errors.materialRequests.cannotCancel, { status }),
    cannotConvertNotApproved: errors.materialRequests.cannotConvertNotApproved,
    vendorRequired: errors.materialRequests.vendorRequired,
  },

  // ── Vendors ─────────────────────────────────────────────
  vendors: {
    alreadyAssigned: errors.vendors.alreadyAssigned,
    companyEmailInUse: errors.vendors.companyEmailInUse,
    userEmailInUse: errors.vendors.userEmailInUse,
    notFound: errors.vendors.notFound,
    accessDenied: errors.vendors.accessDenied,
    warehouseNotFound: errors.vendors.warehouseNotFound,
  },

  // ── Messages ───────────────────────────────────────────
  messages: {
    threadNotFound: errors.messages.threadNotFound,
    notParticipant: errors.messages.notParticipant,
    documentClosed: errors.messages.documentClosed,
  },

  // ── Quotes ─────────────────────────────────────────────
  quotes: {
    rfqNotOpen: errors.quotes.rfqNotOpen,
    notInvited: errors.quotes.notInvited,
    alreadySubmitted: errors.quotes.alreadySubmitted,
    notFound: errors.quotes.notFound,
    notOwner: errors.quotes.notOwner,
    onlyVendor: errors.quotes.onlyVendor,
    vendorNoCompany: errors.quotes.vendorNoCompany,
  },

  // ── Views ────────────────────────────────────────────────
  views: {
    notFound: errors.views.notFound,
  },

  // ── Roles & permissions ──────────────────────────────────
  roles: {
    unknownRole: (role: string) => t(errors.roles.unknownRole, { role }),
    unknownPermission: (key: string) => t(errors.roles.unknownPermission, { key }),
    cannotModifySuperAdmin: errors.roles.cannotModifySuperAdmin,
    thresholdNotSupported: (key: string) => t(errors.roles.thresholdNotSupported, { key }),
    thresholdRequiresGrant: (key: string) => t(errors.roles.thresholdRequiresGrant, { key }),
    invalidThreshold: (key: string) => t(errors.roles.invalidThreshold, { key }),
  },

  // ── Document extractions ─────────────────────────────────
  // ── Bills of materials (US 5.01) ─────────────────────────
  boms: {
    notFound: errors.boms.notFound,
  },

  docExtractions: {
    notFound: errors.docExtractions.notFound,
    notReadyForEdit: errors.docExtractions.notReadyForEdit,
    notReadyForConfirm: errors.docExtractions.notReadyForConfirm,
    alreadyConfirmed: errors.docExtractions.alreadyConfirmed,
    geminiNotConfigured: errors.docExtractions.geminiNotConfigured,
  },

  // ── Access tokens (tokenized vendor links — FOR-201) ─────
  accessTokens: {
    missing: errors.accessTokens.missing,
    malformed: errors.accessTokens.malformed,
    invalid: errors.accessTokens.invalid,
    expired: errors.accessTokens.expired,
    alreadyUsed: errors.accessTokens.alreadyUsed,
    revoked: errors.accessTokens.revoked,
    tooManyAttempts: errors.accessTokens.tooManyAttempts,
    wrongPurpose: errors.accessTokens.wrongPurpose,
  },
} as const;
