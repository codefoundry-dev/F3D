export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  PROCUREMENT_OFFICER = 'PROCUREMENT_OFFICER',
  FINANCIAL_OFFICER = 'FINANCIAL_OFFICER',
  WAREHOUSE_OFFICER = 'WAREHOUSE_OFFICER',
  FOREMAN = 'FOREMAN',
  VENDOR = 'VENDOR',
}

export enum UserStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum CompanyType {
  CONTRACTOR = 'CONTRACTOR',
  VENDOR = 'VENDOR',
}

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum VendorCategory {
  CONCRETE_MASONRY = 'CONCRETE_MASONRY',
  METAL_STEEL = 'METAL_STEEL',
  TIMBER_WOOD = 'TIMBER_WOOD',
  ELECTRICAL = 'ELECTRICAL',
  LIGHTING = 'LIGHTING',
  PLUMBING = 'PLUMBING',
  HVAC_VENTILATION = 'HVAC_VENTILATION',
  FINISHING = 'FINISHING',
  DOORS_WINDOWS_GLAZING = 'DOORS_WINDOWS_GLAZING',
  INSULATION_WATERPROOFING = 'INSULATION_WATERPROOFING',
  ROOFING_FACADE = 'ROOFING_FACADE',
  FIXINGS_HARDWARE = 'FIXINGS_HARDWARE',
  SAFETY_PROTECTION = 'SAFETY_PROTECTION',
  GENERAL_CONSTRUCTION = 'GENERAL_CONSTRUCTION',
  GENERAL_RETAILER = 'GENERAL_RETAILER',
}

export enum ProjectStatus {
  PLANNED = 'PLANNED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum LocationType {
  DELIVERY = 'DELIVERY',
  STORAGE = 'STORAGE',
}

export enum DocumentType {
  RFQ = 'RFQ',
  PO = 'PO',
  INVOICE = 'Invoice',
  BULK_ORDER = 'BulkOrder',
  DELIVERY_REPORT = 'DeliveryReport',
}

export enum VendorListStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
}

export enum AuditAction {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  USER_INVITATION_RESENT = 'USER_INVITATION_RESENT',
  USER_INVITATION_CANCELLED = 'USER_INVITATION_CANCELLED',
  USER_PASSWORD_RESET_INITIATED = 'USER_PASSWORD_RESET_INITIATED',
  COMPANY_CREATED = 'COMPANY_CREATED',
  COMPANY_UPDATED = 'COMPANY_UPDATED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  FILE_DELETED = 'FILE_DELETED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  PROJECT_MEMBER_ADDED = 'PROJECT_MEMBER_ADDED',
  PROJECT_MEMBER_REMOVED = 'PROJECT_MEMBER_REMOVED',
  VENDOR_ASSIGNED = 'VENDOR_ASSIGNED',
  VENDOR_UNASSIGNED = 'VENDOR_UNASSIGNED',
  VENDOR_INVITED = 'VENDOR_INVITED',
}

export enum RfqStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  AWAITING_RESPONSE = 'AWAITING_RESPONSE',
  QUOTED = 'QUOTED',
  AWARDED = 'AWARDED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/** Vendor-facing RFQ statuses (computed from RfqStatus + QuoteResponseStatus) */
export enum VendorRfqStatus {
  INCOMING = 'INCOMING',
  RESPONDED = 'RESPONDED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export enum PoStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  SCHEDULED_FOR_DELIVERY = 'SCHEDULED_FOR_DELIVERY',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
  DELIVERED = 'DELIVERED',
  LATE_FOR_DELIVERY = 'LATE_FOR_DELIVERY',
  CANCELLED_BY_VENDOR = 'CANCELLED_BY_VENDOR',
  INVOICED = 'INVOICED',
  DISPUTE = 'DISPUTE',
  NOT_DELIVERED = 'NOT_DELIVERED',
  CHANGE_PENDING = 'CHANGE_PENDING',
}

export enum PoType {
  STANDARD = 'STANDARD',
  BULK = 'BULK',
  HOLD_FOR_RELEASE = 'HOLD_FOR_RELEASE',
  DRAWDOWN = 'DRAWDOWN',
  SPLIT = 'SPLIT',
}

export enum PoQuickFilter {
  ALL_OPEN = 'allOpen',
  PENDING_INT_APPROVAL = 'pendingIntApproval',
  PENDING_EXT_APPROVAL = 'pendingExtApproval',
  APPROVED_BY_VENDOR = 'approvedByVendor',
  PARTIALLY_DELIVERED = 'partiallyDelivered',
  CLOSED = 'closed',
  DUE_SOON = 'dueSoon',
  OPEN_REVISION = 'openRevision',
  WITH_UNREAD_MESSAGES = 'withUnreadMessages',
  RECENTLY_UPDATED = 'recentlyUpdated',
  SPLITED_POS = 'splitedPos',
}

export enum PickUpTimeExpectation {
  ASAP = 'ASAP',
  TOMORROW = 'TOMORROW',
  CUSTOM_DATE = 'CUSTOM_DATE',
}

export enum PoPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum ApprovalStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum PoSourceOfCreation {
  RFQ = 'RFQ',
  BULK_DRAWDOWN = 'BULK_DRAWDOWN',
  MATERIAL_REQUEST = 'MATERIAL_REQUEST',
  MANUAL = 'MANUAL',
}

export enum PoChangeType {
  COMMERCIAL = 'COMMERCIAL',
  INTERNAL = 'INTERNAL',
}

export enum BulkOrderStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BulkOrderChangeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum MessageContextType {
  RFQ = 'RFQ',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  MATERIAL_REQUEST = 'MATERIAL_REQUEST',
  WAREHOUSE_RELEASE_REQUEST = 'WAREHOUSE_RELEASE_REQUEST',
}

export enum QuoteLineItemAvailability {
  AVAILABLE = 'AVAILABLE',
  PARTIALLY_AVAILABLE = 'PARTIALLY_AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  NO_QUOTE = 'NO_QUOTE',
}

export enum QuoteLineItemStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DISPUTED = 'DISPUTED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

export enum QuoteResponseStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
}

export enum MaterialStatus {
  PUBLIC = 'PUBLIC',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Where an RFQ line item originated (FOR-204). CATALOG items reference an
 * approved Material; BOM items come from a parsed bill of materials and carry a
 * free-text material name with no catalog material (yet).
 */
export enum RfqLineItemSource {
  CATALOG = 'CATALOG',
  BOM = 'BOM',
}

export enum QuickFilter {
  // Values are camelCase to match the keys sent by the web clients
  // (PO_CA_QUICK_FILTERS / VENDOR_QUICK_FILTERS), the i18n keys, and the
  // sibling PoQuickFilter enum. INCOMING / APPROVED_FOR_ME are vendor-only.
  MY_RFQS = 'myRfqs',
  OPEN_RFQS = 'openRfqs',
  AWAITING_RESPONSES = 'awaitingResponses',
  NO_QUOTES = 'noQuotes',
  AWARDED_RFQS = 'awardedRfqs',
  CLOSED_RFQS = 'closedRfqs',
  INCOMING = 'incoming',
  APPROVED_FOR_ME = 'approvedForMe',
}

export enum DocExtractionType {
  BOM = 'BOM',
  QUOTE = 'QUOTE',
  INVOICE = 'INVOICE',
  GENERIC = 'GENERIC',
  CATALOGUE = 'CATALOGUE',
}

export enum DocExtractionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

/**
 * Rolled-up delivery status of a single outbound email (FOR-213), derived from
 * its Resend webhook event stream. Drives the per-row status badge in the RFQ/PO
 * email log.
 */
export enum EmailDeliveryStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  DELIVERY_DELAYED = 'DELIVERY_DELAYED',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
  BOUNCED = 'BOUNCED',
  COMPLAINED = 'COMPLAINED',
  FAILED = 'FAILED',
}

/** A single Resend webhook event type recorded against an outbound email (FOR-213). */
export enum EmailEventType {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  DELIVERY_DELAYED = 'DELIVERY_DELAYED',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
  BOUNCED = 'BOUNCED',
  COMPLAINED = 'COMPLAINED',
  FAILED = 'FAILED',
}
