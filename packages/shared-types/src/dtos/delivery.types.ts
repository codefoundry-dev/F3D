// Dependency-free Epic 6 — Delivery types (no class-validator / @nestjs/swagger).
// Safe to ship to the browser via the client barrel. This is the canonical
// request/response contract shared across the stack: backend DTOs/responses are
// shaped to these interfaces (CreateDeliveryReportDto implements
// CreateDeliveryReportInput, etc.) and the api-client (B1) consumes them.

import type {
  DamageDisposition,
  DamageType,
  DeliveryOutcome,
  DeliveryReportSource,
  DeliveryReportStatus,
} from '../enums/index';

// ── Sub-entities ──────────────────────────────────────────────────────────────

/** A single damage-evidence photo on a damaged delivery line (→ File). */
export interface DeliveryDamagePhotoResponse {
  id: string;
  fileId: string;
  fileName: string;
  /** Short-lived presigned download URL for the photo, or null. */
  url: string | null;
}

/** A report-level supporting attachment (→ File). Mirrors PoDocumentDetail. */
export interface DeliveryReportAttachmentResponse {
  id: string;
  fileId: string;
  fileName: string;
  /** Short-lived presigned download URL, or null. */
  url: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedAt: string;
}

/** One line of a Delivery Report (review table row, screenshots 04/08). */
export interface DeliveryReportLineResponse {
  id: string;
  poLineItemId: string;
  /** The PO line's human reference (material code, else line number). */
  lineItemRef: string;
  /** Material snapshot for inventory; null for free-text PO lines. */
  materialId: string | null;
  /** Resolved name shown in the "Item/Material" column. */
  materialName: string;
  /** Catalogue image of the linked material; null for free-text lines or no image. */
  imageUrl?: string | null;
  description: string | null;
  /** Unit of measure (e.g. pcs, rolls, units). */
  uom: string;
  quantityOrdered: number;
  /** Quantity received in this delivery; may exceed quantityOrdered (over-receipt). */
  quantityReceived: number;
  outcome: DeliveryOutcome;
  notes: string | null;
  // Inline damage details — populated when outcome === DAMAGED.
  damagedQuantity: number | null;
  damageType: DamageType | null;
  damageDisposition: DamageDisposition | null;
  damagePhotos: DeliveryDamagePhotoResponse[];
}

// ── List (US 2.09, screenshot 01) ─────────────────────────────────────────────

/** One card in the Deliveries management list. */
export interface DeliveryReportListItem {
  id: string;
  reportNumber: string;
  status: DeliveryReportStatus;
  source: DeliveryReportSource;
  purchaseOrderId: string;
  poNumber: string | null;
  /** ISO-8601 delivery date, or null. */
  deliveryDate: string | null;
  projectId: string | null;
  projectName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  /** Human RFQ reference of the PO's source RFQ (e.g. "RFQ-1234567"), or null. */
  linkedRfqNumber: string | null;
  /** Human invoice reference linked to the PO (e.g. "INV-12345678"), or null. */
  invoiceNumber: string | null;
  submitterName: string;
  /** ISO-8601 creation timestamp ("Submitted Date"). */
  createdAt: string;
}

// ── Expected deliveries (FOR-356) ─────────────────────────────────────────────

/**
 * Where an expected delivery stands on receipt, derived from the PO's line
 * quantities the same way the delivery close-out derives the PO status: anything
 * received → PARTIALLY_DELIVERED, else AWAITING_DELIVERY. Fully-delivered POs
 * leave the deliverable status set and drop off the expected list entirely.
 */
export type ExpectedDeliveryProgress = 'AWAITING_DELIVERY' | 'PARTIALLY_DELIVERED';

/**
 * One PO awaiting delivery, derived at read time from deliverable-status POs —
 * no Delivery row is materialised. `expectedDeliveryDate` coalesces the PO's
 * plannedDeliveryDate → deadlineEnd → earliest delivery-schedule row → earliest
 * line-level expected date; `isOverdue` flags a passed date on an undelivered PO.
 */
export interface ExpectedDeliveryListItem {
  purchaseOrderId: string;
  poNumber: string | null;
  /** Raw PO lifecycle status (always one of the deliverable statuses). */
  poStatus: string;
  progress: ExpectedDeliveryProgress;
  /** ISO-8601 expected delivery date, or null when the PO carries no date. */
  expectedDeliveryDate: string | null;
  /** True when the expected date has passed and the PO is not fully delivered. */
  isOverdue: boolean;
  /** Number of line items on the PO. */
  itemCount: number;
  projectId: string | null;
  projectName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  /** True when a SUBMITTED delivery report is already pending review for this PO. */
  hasPendingReport: boolean;
  /** ISO-8601 PO creation timestamp. */
  createdAt: string;
}

// ── Detail / review (screenshots 04/08) ───────────────────────────────────────

export interface DeliveryReportDetailResponse {
  id: string;
  reportNumber: string;
  status: DeliveryReportStatus;
  source: DeliveryReportSource;
  purchaseOrderId: string;
  poNumber: string | null;
  projectId: string | null;
  projectName: string | null;
  deliveryDate: string | null;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  submitterName: string;
  submitterEmail: string;
  contactPerson: string | null;
  contactPhone: string | null;
  overallNotes: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
  /** ISO-8601, or null until reviewed. */
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: DeliveryReportLineResponse[];
  attachments: DeliveryReportAttachmentResponse[];
}

// ── Requests (internal create / review) ───────────────────────────────────────

export interface CreateDeliveryReportLineInput {
  poLineItemId: string;
  /** Quantity received this delivery; may exceed the ordered quantity. */
  quantityReceived: number;
  outcome: DeliveryOutcome;
  notes?: string;
  /** Required when outcome === DAMAGED. */
  damagedQuantity?: number;
  damageType?: DamageType;
  damageDisposition?: DamageDisposition;
}

export interface CreateDeliveryReportInput {
  purchaseOrderId: string;
  /** ISO-8601 date string. */
  deliveryDate?: string;
  deliveryLocationId?: string;
  projectId?: string;
  vendorId?: string;
  contactPerson?: string;
  contactPhone?: string;
  overallNotes?: string;
  lines: CreateDeliveryReportLineInput[];
}

export interface RejectDeliveryReportInput {
  reason: string;
}

// ── PO → delivery link (QR code, screenshot 09) ───────────────────────────────

export interface DeliveryLinkResponse {
  token: string;
  /** Absolute public URL embedded in the QR: `${WEB_APP_URL}/delivery/${token}`. */
  url: string;
  poNumber: string | null;
}

// ── Public QR portal (mobile, screenshots 10–14) ──────────────────────────────

/** One read-only PO line surfaced to the public delivery form. */
export interface DeliveryPortalLine {
  /** The PO line id — becomes poLineItemId on the submitted report. */
  id: string;
  lineItemRef: string;
  materialName: string;
  /** Catalogue image of the linked material; null for free-text lines or no image. */
  imageUrl?: string | null;
  description: string | null;
  uom: string;
  quantityOrdered: number;
}

/** Read-only PO header + lines for the public delivery form (no auth). */
export interface DeliveryPortalPoResponse {
  poNumber: string | null;
  projectName: string | null;
  vendorName: string | null;
  deliveryLocationName: string | null;
  /** ISO-8601 expected delivery date, or null. */
  deliveryDate: string | null;
  lines: DeliveryPortalLine[];
}

export interface PortalIdentifyInput {
  name: string;
  email: string;
}

/** Anti-enumeration: always returns ok regardless of whether a code was sent. */
export interface PortalIdentifyResponse {
  ok: true;
}

export interface PortalVerifyInput {
  email: string;
  /** 6-digit access code emailed to the delivery person. */
  code: string;
}

export interface PortalVerifyResponse {
  /** Short-lived DELIVERY_SESSION token authorizing submit + uploads. */
  sessionToken: string;
}

/** Public submit — submitter identity comes from the session token, not the body. */
export interface PortalSubmitInput {
  /** ISO-8601 date string. */
  deliveryDate?: string;
  contactPerson?: string;
  contactPhone?: string;
  overallNotes?: string;
  lines: CreateDeliveryReportLineInput[];
}

export interface PortalSubmitResponse {
  deliveryReportId: string;
  reportNumber: string;
}
