import type {
  CreateRfqDto,
  SaveRfqDraftDto,
  SendRfqDto,
  UpdateRfqDto,
} from '@forethread/shared-types';
import type { EmailLogEntryResponse } from '@forethread/shared-types/client';
import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import type { DocExtractionResponse } from './doc-extractions';
import { RFQS_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface RfqListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  quickFilter?: string;
  projectId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  groupBy?: string;
  deliveryLocation?: string;
  createdByUserId?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  minApprovedQuotes?: number;
  minApprovedVendors?: number;
  columns?: string;
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface RfqListItem {
  id: string;
  rfqNumber: string | null;
  projectName: string;
  projectId: string;
  /** Human-readable project code (PRJ-YYYY-NNN) — matches the Projects table. */
  projectCode: string;
  status: string;
  reqQuantities: number;
  pickUp: boolean;
  deliveryLocation: string | null;
  pickUpLocation: string | null;
  recVendors: number;
  recQuotes: number;
  applVendors: number;
  lineItems: number;
  deadlineRange: string | null;
  applIssues: number;
  totalRequestedQty: number;
  arcBlocksDist: string | null;
  /** Count of vendors invited to the RFQ (Inv. Vendors column). */
  invitedVendors: number;
  /** Count of quote-response line items approved on review (Appr. items column). */
  approvedItems: number;
  /** Count of quote-response line items declined on review (Decline items column). */
  declinedItems: number;
  /** Average total cost across received quote responses; null when no quotes (Avr. Quote Cost column). */
  avgQuoteCost: number | null;
  createdDate: string;
  createdBy: string;
  createdByUserId: string;
  approvalStatus: string | null;
  approvedBy: string | null;
  lastModifiedBy: string | null;
}

export interface RfqVendorContact {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string;
}

export interface RfqVendor {
  id: string;
  name: string;
  avatarUrl: string | null;
  category: string | null;
  location: string | null;
  approved: boolean;
  contacts: RfqVendorContact[];
}

export interface RfqDocument {
  id: string;
  name: string;
  fileId: string;
  fileUrl?: string;
  uploadedBy: { name: string; email: string; avatarUrl: string | null };
  uploadedAt: string;
}

export interface RfqLineItem {
  id: string;
  projectName: string;
  materialName: string;
  description: string | null;
  quantity: number;
  unit: string;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
  hasNotes?: boolean;
}

export interface RfqDetail {
  id: string;
  name: string;
  rfqNumber: string | null;
  projectName: string;
  projectId: string;
  /** Human-readable project code (PRJ-YYYY-NNN); shown wherever a "Project ID" is labelled. */
  projectCode: string;
  status: string;
  rfqType: string | null;
  paymentTerms: string | null;
  pickUp: boolean;
  pickUpDate: string | null;
  deliveryLocation: string | null;
  pickUpLocation: string | null;
  deadlineStart: string | null;
  deadlineEnd: string | null;
  needByDate: string | null;
  totalRequestedQty: number;
  approvalStatus: string | null;
  approvedBy: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  lastModifiedBy: { id: string; name: string } | null;
  lineItems: RfqLineItem[];
  vendors: RfqVendor[];
  quoteResponses: Array<{
    id: string;
    vendorId: string;
    vendorName: string;
    totalCost: number;
    discountPercent: number | null;
    discountAmount: number | null;
    itemsCovered: number;
    totalItems: number;
    status: string;
    submittedAt: string | null;
    /** Committed delivery window across the vendor's quoted lines (US 5.06). */
    earliestDeliveryDate?: string | null;
    latestDeliveryDate?: string | null;
    attachmentCount?: number;
    /** True when the vendor left a note on the quote or any of its lines. */
    hasNotes?: boolean;
  }>;
  documents: RfqDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRfqsResponse {
  items: RfqListItem[];
  meta: PaginationMeta;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getRfqs(
  params?: RfqListParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedRfqsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedRfqsResponse }>(RFQS_PATHS.ROOT, {
    params,
    ...config,
  });
  return data.data;
}

export async function getRfq(id: string, config?: AxiosRequestConfig): Promise<RfqDetail> {
  const { data } = await getApiClient().get<{ data: RfqDetail }>(RFQS_PATHS.byId(id), config);
  return data.data;
}

export async function approveQuote(
  rfqId: string,
  quoteId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(RFQS_PATHS.approveQuote(rfqId, quoteId), undefined, config);
}

/** Result of awarding a quote: the approved quote plus the draft PO it spawned. FOR-209. */
export interface AwardQuoteResult {
  /** The awarded quote's id. */
  id: string;
  vendorName: string;
  status: string;
  totalCost: number;
  /** Id of the draft PO auto-created from the awarded quote — redirect target. */
  purchaseOrderId: string;
  poNumber: string;
}

/**
 * Award a quote: approve it and auto-create a draft Purchase Order pre-filled
 * from the awarded quote. Returns the new PO id so the caller can redirect. FOR-209.
 */
export async function awardQuote(
  rfqId: string,
  quoteId: string,
  config?: AxiosRequestConfig,
): Promise<AwardQuoteResult> {
  const { data } = await getApiClient().post<{ data: AwardQuoteResult }>(
    RFQS_PATHS.awardQuote(rfqId, quoteId),
    undefined,
    config,
  );
  return data.data;
}

export async function declineQuote(
  rfqId: string,
  quoteId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(RFQS_PATHS.declineQuote(rfqId, quoteId), undefined, config);
}

/** One awarded vendor line in a split award (US 5.19). */
export interface AwardSplitAllocation {
  quoteResponseId: string;
  quoteLineItemId: string;
  /** Quantity granted to this vendor for the line (1..quoted; sum across vendors ≤ requested). */
  approvedQuantity: number;
}

export interface AwardSplitRequest {
  allocations: AwardSplitAllocation[];
}

/** Result of a split award: the SPLIT parent PO plus its per-vendor child POs. */
export interface AwardSplitResult {
  parentPoId: string;
  parentPoNumber: string;
  children: { id: string; poNumber: string; vendorId: string; vendorName: string }[];
}

/**
 * Award line items across vendors for an RFQ and split into per-vendor child POs
 * under a consolidated SPLIT parent (US 5.19 / PRD §4.5.4). Each child is a DRAFT
 * the contractor can review and issue.
 */
export async function awardSplit(
  rfqId: string,
  body: AwardSplitRequest,
  config?: AxiosRequestConfig,
): Promise<AwardSplitResult> {
  const { data } = await getApiClient().post<{ data: AwardSplitResult }>(
    RFQS_PATHS.awardSplit(rfqId),
    body,
    config,
  );
  return data.data;
}

export async function copyRfq(id: string, config?: AxiosRequestConfig): Promise<{ id: string }> {
  const { data } = await getApiClient().post<{ data: { id: string } }>(
    RFQS_PATHS.copy(id),
    undefined,
    config,
  );
  return data.data;
}

export async function archiveRfq(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(RFQS_PATHS.archive(id), undefined, config);
}

export async function exportRfqs(
  format: 'csv' | 'xlsx' | 'pdf',
  params?: RfqListParams,
  config?: AxiosRequestConfig,
): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(RFQS_PATHS.export(format), {
    params,
    ...config,
  });
  return data.data;
}

// ── Create / Update / Send / Delete ─────────────────────────────────────────

export async function createRfq(
  data: CreateRfqDto,
  config?: AxiosRequestConfig,
): Promise<RfqDetail> {
  const { data: resp } = await getApiClient().post<{ data: RfqDetail }>(
    RFQS_PATHS.ROOT,
    data,
    config,
  );
  return resp.data;
}

export async function saveRfqDraft(
  data: SaveRfqDraftDto,
  config?: AxiosRequestConfig,
): Promise<RfqDetail> {
  const { data: resp } = await getApiClient().post<{ data: RfqDetail }>(
    RFQS_PATHS.DRAFT,
    data,
    config,
  );
  return resp.data;
}

export async function updateRfq(
  id: string,
  data: UpdateRfqDto,
  config?: AxiosRequestConfig,
): Promise<RfqDetail> {
  const { data: resp } = await getApiClient().patch<{ data: RfqDetail }>(
    RFQS_PATHS.byId(id),
    data,
    config,
  );
  return resp.data;
}

export async function sendRfq(
  id: string,
  data?: SendRfqDto,
  config?: AxiosRequestConfig,
): Promise<RfqDetail> {
  const { data: resp } = await getApiClient().post<{ data: RfqDetail }>(
    RFQS_PATHS.send(id),
    data,
    config,
  );
  return resp.data;
}

export async function deleteRfq(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().delete(RFQS_PATHS.byId(id), config);
}

// ── Availability check / bulk-order coverage (US 5.05) ─────────────────────

export interface RfqAvailabilityVendor {
  vendorId: string;
  vendorName: string;
}

export interface RfqAvailabilityMatch {
  bulkOrderId: string;
  bulkOrderNumber: string | null;
  bulkOrderLineItemId: string;
  vendorId: string;
  qtyRemaining: number;
  /** Bulk order endDate (ISO 8601) — null when open-ended. */
  expirationDate: string | null;
  pricePerUnit: number;
}

export interface RfqAvailabilityItem {
  index: number;
  matches: RfqAvailabilityMatch[];
}

export interface RfqAvailabilityResult {
  vendors: RfqAvailabilityVendor[];
  items: RfqAvailabilityItem[];
}

export interface CheckRfqAvailabilityPayload {
  lineItems: Array<{
    index: number;
    materialId?: string;
    materialName?: string;
    quantity: number;
    uom: string;
  }>;
}

export interface ConfirmRfqCoveragePayload {
  allocations: Array<{
    rfqLineItemId: string;
    bulkOrderLineItemId: string;
    quantity: number;
  }>;
}

export interface ConfirmRfqCoverageResult {
  rfq: RfqDetail;
  drawdownsCreated: number;
  remainingLineItems: number;
}

/** Check prospective line items against the company's active bulk orders. */
export async function checkRfqAvailability(
  payload: CheckRfqAvailabilityPayload,
  config?: AxiosRequestConfig,
): Promise<RfqAvailabilityResult> {
  const { data } = await getApiClient().post<{ data: RfqAvailabilityResult }>(
    RFQS_PATHS.CHECK_AVAILABILITY,
    payload,
    config,
  );
  return data.data;
}

/**
 * Confirm bulk-order coverage on a DRAFT RFQ: creates drawdowns, decrements the
 * bulk lines and removes/reduces the covered RFQ line items.
 */
export async function confirmRfqCoverage(
  id: string,
  payload: ConfirmRfqCoveragePayload,
  config?: AxiosRequestConfig,
): Promise<ConfirmRfqCoverageResult> {
  const { data } = await getApiClient().post<{ data: ConfirmRfqCoverageResult }>(
    RFQS_PATHS.confirmCoverage(id),
    payload,
    config,
  );
  return data.data;
}

// ── Bulk Suggestions ────────────────────────────────────────────────────────

export interface BulkSuggestion {
  lineItemId: string;
  materialName: string;
  bulkOrderId: string;
  availableQuantity: number;
  suggestedQuantity: number;
  vendor: { id: string; name: string };
}

export interface BulkSuggestionsResponse {
  suggestions: BulkSuggestion[];
}

export interface ConfirmBulkSuggestionsPayload {
  confirmedLineItemIds: string[];
  rejectedLineItemIds: string[];
}

export async function checkBulkSuggestions(
  id: string,
  config?: AxiosRequestConfig,
): Promise<BulkSuggestionsResponse> {
  const { data } = await getApiClient().post<{ data: BulkSuggestionsResponse }>(
    RFQS_PATHS.checkBulk(id),
    undefined,
    config,
  );
  return data.data;
}

export async function confirmBulkSuggestions(
  id: string,
  payload: ConfirmBulkSuggestionsPayload,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().post(RFQS_PATHS.confirmBulk(id), payload, config);
}

// ── Line Item CRUD ──────────────────────────────────────────────────────────

export interface UpdateLineItemPayload {
  materialName?: string;
  quantity?: number;
  unit?: string;
  description?: string | null;
}

export async function updateLineItem(
  rfqId: string,
  lineItemId: string,
  payload: UpdateLineItemPayload,
  config?: AxiosRequestConfig,
): Promise<RfqLineItem> {
  const { data } = await getApiClient().patch<{ data: RfqLineItem }>(
    RFQS_PATHS.lineItem(rfqId, lineItemId),
    payload,
    config,
  );
  return data.data;
}

export async function deleteLineItem(
  rfqId: string,
  lineItemId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(RFQS_PATHS.lineItem(rfqId, lineItemId), config);
}

// ── Document CRUD ────────────────────────────────────────────────────────

export async function uploadRfqDocument(
  rfqId: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<RfqDocument> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: RfqDocument }>(
    RFQS_PATHS.documents(rfqId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

export async function deleteRfqDocument(
  rfqId: string,
  docId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(RFQS_PATHS.document(rfqId, docId), config);
}

// ── Vendor Quote Response ───────────────────────────────────────────────────

export interface SubmitQuoteLineItemInput {
  rfqLineItemId: string;
  unitPrice: number;
  quotedQuantity: number;
  availability?: string;
  deliveryDate: string;
  substituteItemId?: string;
  discount?: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  tax?: number;
  taxIncluded?: boolean;
  backOrderQty?: number;
  backOrderDeliveryDate?: string;
  notes?: string;
}

export interface SubmitQuoteInput {
  lineItems: SubmitQuoteLineItemInput[];
  bulkDeliveryTime?: string;
  bulkDiscount?: number;
  bulkTax?: number;
  bulkShipment?: number;
  warehouseLocationId?: string;
  validityPeriod?: string;
  paymentTerms?: string;
  message?: string;
  attachmentIds?: string[];
  /** How the quote was entered: by hand (FORM) or via PDF upload (PDF). FOR-207. */
  source?: 'FORM' | 'PDF';
}

// ── Quote audit trail (FOR-207) ───────────────────────────────────────────────

export type QuoteAuditAction = 'SUBMITTED' | 'UPDATED' | 'APPROVED' | 'DECLINED';

/** Summary of a quote's figures at the time an audit entry was recorded. */
export interface QuoteAuditSnapshot {
  totalCost: number;
  itemsCovered: number;
  totalItems: number;
  bulkDiscount: number | null;
  bulkTax: number | null;
  bulkShipment: number | null;
  lineItems: Array<{
    rfqLineItemId: string;
    unitPrice: number;
    quotedQuantity: number;
    lineTotal: number;
  }>;
}

export interface QuoteAuditChanges {
  snapshot: QuoteAuditSnapshot;
  /** Present on UPDATED entries: scalar fields the vendor changed. */
  fields?: Record<string, { from: unknown; to: unknown }>;
  /** Present on UPDATED entries: line-item churn during confirmation. */
  lineItems?: { changed: number; added: number; removed: number };
}

export interface QuoteAuditEntry {
  id: string;
  quoteResponseId: string;
  action: QuoteAuditAction;
  source: 'FORM' | 'PDF' | null;
  vendorId: string;
  vendorName: string;
  performedByName: string;
  changes: QuoteAuditChanges | null;
  createdAt: string;
}

export interface QuoteAttachmentDto {
  id: string;
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface QuoteResponseDetail {
  id: string;
  rfqId: string;
  vendorId: string;
  vendor?: { id: string; legalName: string };
  totalCost: number;
  discountPercent: number | null;
  discountAmount: number | null;
  itemsCovered: number;
  totalItems: number;
  status: string;
  submittedAt: string | null;
  bulkDeliveryTime: string | null;
  bulkDiscount: number | null;
  bulkTax: number | null;
  bulkShipment: number | null;
  warehouseLocationId: string | null;
  validityPeriod: string | null;
  message: string | null;
  lineItems: QuoteResponseLineItem[];
  attachments?: QuoteAttachmentDto[];
}

export interface QuoteResponseLineItem {
  id: string;
  rfqLineItemId: string;
  unitPrice: number;
  quotedQuantity: number;
  availability: string;
  deliveryDate: string;
  substituteItemId: string | null;
  /** Substitute material suggested by the vendor (suggestion-replace, US 5.06). */
  substituteItem?: { id: string; name: string; uom: string | null } | null;
  /** The RFQ line this quote line answers — carries the requested material/qty. */
  rfqLineItem?: {
    id: string;
    materialName: string | null;
    quantity: number;
    unit: string;
    material?: { id: string; name: string; uom: string | null } | null;
  };
  discount: number | null;
  discountType: 'PERCENT' | 'AMOUNT' | null;
  tax: number | null;
  taxIncluded: boolean;
  backOrderQty: number | null;
  backOrderDeliveryDate: string | null;
  notes: string | null;
  lineTotal: number;
  status: string;
}

/** Per-line review status set by the buyer while reviewing quotes (US 5.19). */
export type QuoteLineItemReviewStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

/**
 * Approve / decline / restore individual lines of a vendor quote (US 5.19).
 * `PENDING` restores a previously approved/declined line.
 */
export async function updateQuoteLineItemStatuses(
  rfqId: string,
  quoteId: string,
  lineItemIds: string[],
  status: QuoteLineItemReviewStatus,
): Promise<{ updated: number; lineItems: { id: string; status: string }[] }> {
  const { data } = await getApiClient().patch<{
    data: { updated: number; lineItems: { id: string; status: string }[] };
  }>(RFQS_PATHS.quoteLineItemStatus(rfqId, quoteId), { lineItemIds, status });
  return data.data;
}

export async function submitQuote(
  rfqId: string,
  input: SubmitQuoteInput,
): Promise<QuoteResponseDetail> {
  const { data } = await getApiClient().post<{ data: QuoteResponseDetail }>(
    RFQS_PATHS.quotes(rfqId),
    input,
  );
  return data.data;
}

export async function updateQuote(
  rfqId: string,
  quoteId: string,
  input: SubmitQuoteInput,
): Promise<QuoteResponseDetail> {
  const { data } = await getApiClient().patch<{ data: QuoteResponseDetail }>(
    RFQS_PATHS.quote(rfqId, quoteId),
    input,
  );
  return data.data;
}

export async function getQuoteDetail(rfqId: string, quoteId: string): Promise<QuoteResponseDetail> {
  const { data } = await getApiClient().get<{ data: QuoteResponseDetail }>(
    RFQS_PATHS.quote(rfqId, quoteId),
  );
  return data.data;
}

/** Fetch the per-RFQ quote audit trail (newest first). FOR-207. */
export async function getRfqQuoteAudit(
  rfqId: string,
  config?: AxiosRequestConfig,
): Promise<QuoteAuditEntry[]> {
  const { data } = await getApiClient().get<{ data: QuoteAuditEntry[] }>(
    RFQS_PATHS.quoteAudit(rfqId),
    config,
  );
  return data.data;
}

/** Fetch the outbound email delivery log for an RFQ (newest event first). FOR-213. */
export async function getRfqEmailLog(
  rfqId: string,
  config?: AxiosRequestConfig,
): Promise<EmailLogEntryResponse[]> {
  const { data } = await getApiClient().get<{ data: EmailLogEntryResponse[] }>(
    RFQS_PATHS.emails(rfqId),
    config,
  );
  return data.data;
}

// ── Quote comparison (FOR-208) ────────────────────────────────────────────────

/** One vendor column header in the comparison grid. */
export interface QuoteComparisonVendor {
  quoteResponseId: string;
  vendorId: string;
  vendorName: string;
  status: string;
  submittedAt: string | null;
  paymentTerms: string | null;
  /** Latest committed delivery date across the vendor's quoted lines. */
  leadTimeDate: string | null;
  /** Sum of extended costs across the lines this vendor quoted. */
  total: number;
  /** Vendor-submitted quote total (taxes, shipment and discounts applied). */
  totalWithTaxes: number;
  /** Overall quote discount, as submitted by the vendor. */
  discountPercent: number | null;
  discountAmount: number | null;
  /** Shipment & handling charge for the whole quote. */
  shipmentAndHandling: number | null;
  attachmentCount: number;
  /** True when the vendor left a note on the quote or any of its lines. */
  hasNotes: boolean;
  itemsCovered: number;
  totalItems: number;
}

/** One vendor's quote for a single RFQ line item (a grid cell). */
export interface QuoteComparisonCell {
  vendorId: string;
  quoteResponseId: string;
  /** Quote line id — target for per-line approve/decline/restore (US 5.19). */
  quoteLineItemId: string | null;
  unitPrice: number | null;
  quotedQuantity: number | null;
  /** qty × unit; null when the vendor did not quote this line. */
  extendedCost: number | null;
  /** Vendor-computed line total with tax; null when the vendor did not quote this line. */
  lineTotal: number | null;
  /** Per-line discount as submitted (interpreted via discountType). */
  discount: number | null;
  discountType: string | null;
  availability: string | null;
  deliveryDate: string | null;
  /** Per-line review status: PENDING | APPROVED | DECLINED. */
  status: string | null;
  /** Per-vendor approved quantity once the line is awarded (US 5.19); null otherwise. */
  approvedQuantity: number | null;
  /** Vendor note on the line (drives the note indicator). */
  notes: string | null;
  /** Set when the vendor quoted a substitute material for this line. */
  substituteItemId: string | null;
  substituteItemName: string | null;
  hasQuote: boolean;
  /** True when this cell holds the lowest line total in its row. */
  isLowest: boolean;
}

/** One RFQ line item row, with a cell per vendor (aligned to `vendors` order). */
export interface QuoteComparisonRow {
  rfqLineItemId: string;
  materialName: string | null;
  quantity: number;
  unit: string;
  projectId: string;
  projectName: string;
  cells: QuoteComparisonCell[];
  lowestVendorId: string | null;
}

export interface QuoteComparison {
  rfqId: string;
  currency: string;
  vendors: QuoteComparisonVendor[];
  rows: QuoteComparisonRow[];
}

/** Fetch the side-by-side quote comparison grid for an RFQ (contractor-only). FOR-208. */
export async function getRfqQuoteComparison(
  rfqId: string,
  config?: AxiosRequestConfig,
): Promise<QuoteComparison> {
  const { data } = await getApiClient().get<{ data: QuoteComparison }>(
    RFQS_PATHS.quoteComparison(rfqId),
    config,
  );
  return data.data;
}

// ── Guest (invitation link) endpoints ─────────────────────────────────────

export interface GuestRfqDetail {
  id: string;
  rfqNumber: string | null;
  contractorName: string;
  projectName: string | null;
  status: string;
  deliveryLocation: string | null;
  needByDate: string | null;
  message: string | null;
  lineItems: Array<{
    id: string;
    materialName: string;
    unit: string;
    quantity: number;
    description: string | null;
    costCode: string | null;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  vendorName: string;
  vendorId: string;
}

export async function getGuestRfq(token: string): Promise<GuestRfqDetail> {
  const { data } = await getApiClient().get<{ data: GuestRfqDetail }>(RFQS_PATHS.guestRfq(token));
  return data.data;
}

export async function submitGuestQuote(
  token: string,
  input: SubmitQuoteInput,
): Promise<QuoteResponseDetail> {
  const { data } = await getApiClient().post<{ data: QuoteResponseDetail }>(
    RFQS_PATHS.guestQuote(token),
    input,
  );
  return data.data;
}

// ── Guest quote PDF extraction (FOR-206) ──────────────────────────────────────

/**
 * Upload a quote PDF from the vendor portal and start a Gemini extraction.
 * Returns the extraction job (PENDING/PROCESSING); poll it with
 * {@link getGuestQuoteExtraction}.
 */
export async function submitGuestQuoteExtraction(
  token: string,
  file: File,
): Promise<DocExtractionResponse> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await getApiClient().post<{ data: DocExtractionResponse }>(
    RFQS_PATHS.guestQuoteExtraction(token),
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

/** Poll a guest quote extraction by its id (token-less; the id is unguessable). */
export async function getGuestQuoteExtraction(id: string): Promise<DocExtractionResponse> {
  const { data } = await getApiClient().get<{ data: DocExtractionResponse }>(
    RFQS_PATHS.guestQuoteExtractionStatus(id),
  );
  return data.data;
}

// ── Approved RFQ responses (US 5.08 — bulk-order creation) ──────────────────

/** A line item on an approved RFQ response, shaped for seeding a bulk order. */
export interface ApprovedResponseLineItem {
  materialId: string | null;
  itemReference: string;
  description: string;
  unitPrice: number;
  uom: string;
  quantity: number;
  discount: number | null;
}

/** An awarded RFQ quote response a contractor can convert into a bulk order. */
export interface ApprovedRfqResponse {
  rfqId: string;
  responseId: string;
  rfqReference: string;
  vendorId: string;
  vendorName: string;
  discountPercent: number | null;
  lineItems: ApprovedResponseLineItem[];
}

/**
 * List a project's approved (awarded) RFQ responses with their quoted line
 * items, for the "Create from approved RFQ response" bulk-order page (US 5.08).
 */
export async function getApprovedRfqResponses(
  projectId: string,
  config?: AxiosRequestConfig,
): Promise<ApprovedRfqResponse[]> {
  const { data } = await getApiClient().get<{ data: ApprovedRfqResponse[] }>(
    RFQS_PATHS.APPROVED_RESPONSES,
    { params: { projectId }, ...config },
  );
  return data.data;
}
