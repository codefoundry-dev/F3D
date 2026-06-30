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
  PO_ISSUED = 'PO_ISSUED',
  PO_APPROVED = 'PO_APPROVED',
  PO_DECLINED = 'PO_DECLINED',
  PO_CANCELLED = 'PO_CANCELLED',
  PO_ACKNOWLEDGED = 'PO_ACKNOWLEDGED',
  PO_ACCEPTED = 'PO_ACCEPTED',
  PO_SCHEDULED = 'PO_SCHEDULED',
  PO_PARTIALLY_DELIVERED = 'PO_PARTIALLY_DELIVERED',
  PO_DELIVERED = 'PO_DELIVERED',
  PO_ARCHIVED = 'PO_ARCHIVED',
  PO_ACCEPTED_BY_VENDOR = 'PO_ACCEPTED_BY_VENDOR',
  PO_DECLINED_BY_VENDOR = 'PO_DECLINED_BY_VENDOR',
  PO_CHANGE_PROPOSED = 'PO_CHANGE_PROPOSED',
  PO_CHANGE_APPROVED = 'PO_CHANGE_APPROVED',
  PO_CHANGE_REJECTED = 'PO_CHANGE_REJECTED',
  MATERIAL_REQUEST_CREATED = 'MATERIAL_REQUEST_CREATED',
  MATERIAL_REQUEST_SUBMITTED = 'MATERIAL_REQUEST_SUBMITTED',
  MATERIAL_REQUEST_APPROVED = 'MATERIAL_REQUEST_APPROVED',
  MATERIAL_REQUEST_DECLINED = 'MATERIAL_REQUEST_DECLINED',
  MATERIAL_REQUEST_CANCELLED = 'MATERIAL_REQUEST_CANCELLED',
  MATERIAL_REQUEST_CONVERTED = 'MATERIAL_REQUEST_CONVERTED',
  DELIVERY_REPORT_CREATED = 'DELIVERY_REPORT_CREATED',
  DELIVERY_REPORT_APPROVED = 'DELIVERY_REPORT_APPROVED',
  DELIVERY_REPORT_REJECTED = 'DELIVERY_REPORT_REJECTED',
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
  /**
   * The vendorless consolidated parent of a multi-vendor award (US 5.19). Never
   * issued — it only owns its per-vendor child POs — so "Split" stands in for a
   * lifecycle status to surface the parent/child relationship on the PO views.
   */
  SPLIT = 'SPLIT',
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

/**
 * Lifecycle of an internal Material Request (Epic 6). An MR is raised against a
 * project (DRAFT or straight to SUBMITTED), reviewed by a Procurement Officer
 * (APPROVED / DECLINED), then an APPROVED MR is CONVERTED into a draft RFQ or PO.
 * DECLINED / CONVERTED / CANCELLED are terminal. Mirrors the RfqStatus /
 * PoStatus string-enum convention.
 */
export enum MaterialRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  CONVERTED = 'CONVERTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

/** Urgency of a Material Request (header-level default and optional per-line). */
export enum MaterialRequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Direction of a single inventory ledger row (Epic 7). The recorded `quantity`
 * is always positive; `type` carries whether stock came IN (PO receipt) or went
 * OUT (MR issue). Mirrors the StockMovement Prisma enum.
 */
export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
}

/**
 * Origin of an inventory movement. PO_RECEIPT is written by the PO delivery
 * (push-in) hook, MR_ISSUE by the MR-approval (push-out) hook, and ADJUSTMENT is
 * reserved for manual corrections (not yet exposed). Mirrors the StockMovement
 * Prisma enum.
 */
export enum StockMovementSource {
  PO_RECEIPT = 'PO_RECEIPT',
  MR_ISSUE = 'MR_ISSUE',
  ADJUSTMENT = 'ADJUSTMENT',
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
 * Lifecycle of a proposed edit to a PUBLIC catalogue material (US 4.01 Phase 3).
 * A Company-Admin / Procurement-Officer edit does not touch the live material —
 * it is captured as a PENDING change request the catalogue Super-Admin then
 * approves (applied to the material) or rejects (discarded). Mirrors
 * BulkOrderChangeRequestStatus / PoChangeRequestStatus.
 */
export enum MaterialChangeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Lifecycle of a project Bill of Materials (US 5.01). The newest BOM for a
 * project is ACTIVE; creating a new one supersedes it ("Historical BOM
 * versions" in the project BOM tab).
 */
export enum BomStatus {
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
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

/**
 * Epic 6 — Delivery. Lifecycle of a Delivery Report. A report is created as
 * SUBMITTED (by internal staff, or externally by a delivery person via the QR
 * portal), then reviewed by the buyer: APPROVED flows the received quantities
 * onto the PO lines + inventory (advancing PO status), while REJECTED stores a
 * reason and leaves the PO untouched. Mirrors the DeliveryReport Prisma enum.
 */
export enum DeliveryReportStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * How a Delivery Report was created: INTERNAL (a logged-in user via the web app)
 * or EXTERNAL (an unauthenticated delivery person via the public QR-code portal).
 */
export enum DeliveryReportSource {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Per-line delivery outcome on a Delivery Report. Drives the approve-time
 * inventory delta: NOT_DELIVERED / REJECTED contribute 0, DAMAGED nets off the
 * returned damaged quantity, everything else flows the full received quantity.
 */
export enum DeliveryOutcome {
  DELIVERED = 'DELIVERED',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
  NOT_DELIVERED = 'NOT_DELIVERED',
  DAMAGED = 'DAMAGED',
  REJECTED = 'REJECTED',
}

/** Category of damage recorded on a damaged delivery line (options confirmed against the Figma dropdown). */
export enum DamageType {
  IN_TRANSIT = 'IN_TRANSIT',
  MANUFACTURING_DEFECT = 'MANUFACTURING_DEFECT',
  PACKAGING = 'PACKAGING',
  WATER = 'WATER',
  OTHER = 'OTHER',
}

/**
 * What happens to damaged goods on a delivery line: RETURNED to the vendor
 * (excluded from received stock at approval) or ACCEPTED (counted into stock).
 */
export enum DamageDisposition {
  RETURNED = 'RETURNED',
  ACCEPTED = 'ACCEPTED',
}
