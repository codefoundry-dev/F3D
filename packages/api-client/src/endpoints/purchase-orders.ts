import type {
  EmailLogEntryResponse,
  PoDeliveryInput,
  PoDeliveryResponse,
} from '@forethread/shared-types/client';
import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { PURCHASE_ORDERS_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface PoListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  quickFilter?: string;
  projectId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  columns?: string;
}

export interface CreatePoLineItemInput {
  materialId?: string;
  /**
   * The bulk-order line this PO line draws from (US 5.09 drawdown). Set only
   * when the parent PO is sourced from a bulk order; the backend validates it
   * against `qtyRemaining` and writes the Drawdown row on create.
   */
  bulkOrderLineItemId?: string;
  materialCode?: string;
  description?: string;
  quantityOrdered: number;
  unitOfMeasure: string;
  unitPrice: number;
  costCode?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  deliveryLocationId?: string;
  pickUp?: boolean;
}

export interface CreatePurchaseOrderInput {
  documentName?: string;
  projectId: string;
  vendorId?: string;
  /**
   * Source bulk order for a drawdown PO (US 5.09). When set together with
   * `sourceOfCreation: 'BULK_DRAWDOWN'`, each line item's `bulkOrderLineItemId`
   * is drawn down against the bulk order and `poType` is forced to `DRAWDOWN`.
   */
  bulkOrderId?: string;
  poType: string;
  sourceOfCreation?: string;
  currency: string;
  priority?: string;
  pickUp: boolean;
  holdForRelease?: boolean;
  deliveryLocationId?: string;
  pickUpLocation?: string;
  pickUpTimeExpectation?: string;
  pickUpPersonName?: string;
  pickUpPersonPhone?: string;
  paymentTermsDays?: number;
  costCode?: string;
  deadlineStart?: string;
  deadlineEnd?: string;
  plannedDeliveryDate?: string;
  deliveryNotes?: string;
  deliveryResponsibleName?: string;
  deliveryResponsibleEmail?: string;
  message?: string;
  rfqId?: string;
  lineItems: CreatePoLineItemInput[];
  /** FOR-210: optional header-level multi-delivery rows. */
  deliveries?: PoDeliveryInput[];
}

export type UpdatePurchaseOrderInput = Partial<Omit<CreatePurchaseOrderInput, 'projectId'>>;

// ── Response interfaces ──────────────────────────────────────────────────────

export interface PoListItem {
  id: string;
  poNumber: string | null;
  projectName: string;
  projectId: string;
  status: string;
  poType: string | null;
  revision: number | null;
  pickUp: boolean;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  pickUpLocation: string | null;
  pickUpTimeExpectation: string | null;
  pickUpPersonName: string | null;
  pickUpPersonPhone: string | null;
  paymentTermsDays: number | null;
  totalAmount: number | null;
  lineItemCount: number;
  totalRequestedQty: number;
  deadlineStart: string | null;
  deadlineEnd: string | null;
  plannedDeliveryDate: string | null;
  issuedAt: string | null;
  approvalStatus: string | null;
  approvedBy: string | null;
  createdDate: string;
  createdBy: string;
  lastModifiedBy: string | null;
  updatedAt: string;
  contractorName: string | null;
  vendorName: string | null;
  priority: string | null;
  sourceOfCreation: string | null;
  holdForRelease: boolean;
  currency: string;
  subtotal: number | null;
  discountAmount: number | null;
  taxAmount: number | null;
  lineItemsDelivered: number;
  quantityDelivered: number;
  linkedRfqAvgPrice: number | null;
  attachmentsCount: number;
  hasMessages: boolean;
  message: string | null;
  deliveryResponsibleName: string | null;
  deliveryResponsibleEmail: string | null;
  /* Legacy aliases kept for backward compat */
  reqQuantities?: number;
  recVendors?: number;
  lineItems?: number;
  deadlineRange?: string | null;
}

export interface PoLineItemDetail {
  id: string;
  lineNumber: number;
  materialId: string | null;
  materialName: string | null;
  materialCode: string | null;
  description: string | null;
  quantityOrdered: number;
  quantityDelivered: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineTotal: number;
  costCode: string | null;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
  notes: string | null;
  pickUp: boolean;
}

export interface PoDocumentDetail {
  id: string;
  name: string;
  fileId: string;
  uploadedBy: { name: string; email: string; avatarUrl: string | null };
  uploadedAt: string;
}

export interface PoDetail {
  id: string;
  poNumber: string;
  documentName: string | null;
  projectName: string;
  projectId: string;
  status: string;
  poType: string;
  approvalStatus: string | null;
  sourceOfCreation: string | null;
  revision: number;
  priority: string | null;
  pickUp: boolean;
  holdForRelease: boolean;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  pickUpLocation: string | null;
  pickUpTimeExpectation: string | null;
  pickUpPersonName: string | null;
  pickUpPersonPhone: string | null;
  currency: string;
  subtotal: number | null;
  discountAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  paymentTermsDays: number | null;
  costCode: string | null;
  message: string | null;
  deliveryResponsibleName: string | null;
  deliveryResponsibleEmail: string | null;
  lineItemCount: number;
  totalRequestedQty: number;
  deadlineStart: string | null;
  deadlineEnd: string | null;
  plannedDeliveryDate: string | null;
  deliveryNotes: string | null;
  issuedAt: string | null;
  parentPoId: string | null;
  rfqId: string | null;
  approvedBy: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  lastModifiedBy: { id: string; name: string } | null;
  vendor: { id: string; name: string };
  company: { id: string; name: string };
  lineItems: PoLineItemDetail[];
  documents: PoDocumentDetail[];
  /** FOR-210: header-level multi-delivery rows. */
  deliveries: PoDeliveryResponse[];
  invoices: Array<{ id: string; status: string; totalAmount: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPosResponse {
  items: PoListItem[];
  meta: PaginationMeta;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getPurchaseOrders(
  params?: PoListParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedPosResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedPosResponse }>(
    PURCHASE_ORDERS_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getPurchaseOrder(id: string, config?: AxiosRequestConfig): Promise<PoDetail> {
  const { data } = await getApiClient().get<{ data: PoDetail }>(
    PURCHASE_ORDERS_PATHS.byId(id),
    config,
  );
  return data.data;
}

/** Fetch the outbound email delivery log for a PO (newest event first). FOR-213. */
export async function getPurchaseOrderEmailLog(
  poId: string,
  config?: AxiosRequestConfig,
): Promise<EmailLogEntryResponse[]> {
  const { data } = await getApiClient().get<{ data: EmailLogEntryResponse[] }>(
    PURCHASE_ORDERS_PATHS.emails(poId),
    config,
  );
  return data.data;
}

export async function approvePurchaseOrder(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.approve(id), undefined, config);
}

export async function declinePurchaseOrder(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.decline(id), undefined, config);
}

export async function copyPurchaseOrder(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ id: string }> {
  const { data } = await getApiClient().post<{ data: { id: string } }>(
    PURCHASE_ORDERS_PATHS.copy(id),
    undefined,
    config,
  );
  return data.data;
}

export async function archivePurchaseOrder(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.archive(id), undefined, config);
}

export async function exportPurchaseOrders(
  format: 'csv' | 'xlsx' | 'pdf',
  params?: PoListParams,
  config?: AxiosRequestConfig,
): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    PURCHASE_ORDERS_PATHS.export(format),
    { params, ...config },
  );
  return data.data;
}

export async function uploadPoDocument(
  poId: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<PoDocumentDetail> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: PoDocumentDetail }>(
    PURCHASE_ORDERS_PATHS.documents(poId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  config?: AxiosRequestConfig,
): Promise<PoDetail> {
  const { data } = await getApiClient().post<{ data: PoDetail }>(
    PURCHASE_ORDERS_PATHS.ROOT,
    input,
    config,
  );
  return data.data;
}

export async function updatePurchaseOrder(
  id: string,
  input: UpdatePurchaseOrderInput,
  config?: AxiosRequestConfig,
): Promise<PoDetail> {
  const { data } = await getApiClient().patch<{ data: PoDetail }>(
    PURCHASE_ORDERS_PATHS.byId(id),
    input,
    config,
  );
  return data.data;
}

export async function issuePurchaseOrder(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().post(PURCHASE_ORDERS_PATHS.issue(id), undefined, config);
}

export async function confirmPurchaseOrder(
  id: string,
  config?: AxiosRequestConfig,
): Promise<PoDetail> {
  const { data } = await getApiClient().post<{ data: PoDetail }>(
    PURCHASE_ORDERS_PATHS.confirm(id),
    undefined,
    config,
  );
  return data.data;
}

export interface ValidateItemLine {
  materialId?: string;
  materialName?: string;
  quantity: number;
}

export interface ValidatePoItemsInput {
  projectId: string;
  lineItems: ValidateItemLine[];
}

export interface ValidatePoItemsSuggestion {
  lineItemIndex: number;
  materialId: string | null;
  materialName: string | null;
  bulkOrderMatch: {
    bulkOrderId: string;
    remainingQty: number;
    agreedPrice: number;
    vendorId: string;
    vendorName: string;
  } | null;
  rfqMatch: {
    rfqId: string;
    rfqNumber: string;
    quoteId: string;
    vendorId: string;
    vendorName: string;
    agreedPrice: number;
  } | null;
}

export interface ValidatePoItemsResponse {
  suggestions: ValidatePoItemsSuggestion[];
}

export async function validatePoItems(
  input: ValidatePoItemsInput,
  config?: AxiosRequestConfig,
): Promise<ValidatePoItemsResponse> {
  const { data } = await getApiClient().post<{ data: ValidatePoItemsResponse }>(
    PURCHASE_ORDERS_PATHS.validateItems,
    input,
    config,
  );
  return data.data;
}

export async function deletePoDocument(
  poId: string,
  docId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(PURCHASE_ORDERS_PATHS.document(poId, docId), config);
}

// ── Vendor PO Actions (US-3.08) ────────────────────────────────────────────

export interface VendorAcceptPoInput {
  paymentTermsDays?: number;
  warehouseLocationId?: string;
}

export interface VendorDeclinePoInput {
  reason?: string;
}

export async function acceptPurchaseOrder(
  id: string,
  input?: VendorAcceptPoInput,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.accept(id), input ?? {}, config);
}

export async function vendorDeclinePurchaseOrder(
  id: string,
  input?: VendorDeclinePoInput,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.vendorDecline(id), input ?? {}, config);
}

// ── PO Change Requests ──────────────────────────────────────────────────────

/** A single old→new diff entry inside a `changedFields` payload. */
export interface PoChangeFieldDiff {
  from: unknown;
  to: unknown;
}

/** One changed line item card in the diff (heading + per-attribute old→new). */
export interface PoChangeLineItem {
  lineItemId: string;
  name: string;
  changes: Record<string, PoChangeFieldDiff>;
}

/**
 * The agreed cross-package `changedFields` shape (PLAN §B). `fields` are
 * PO-level attributes (paymentTermsDays, pickUpTimeExpectation, pickUpLocation,
 * plannedDeliveryDate, deliveryLocationId, deliveryNotes, …); `lineItems` are
 * per-line attribute diffs (unitPrice, costCode, expectedDeliveryDate, discount,
 * quantityOrdered, …). Approving applies these to the PO.
 */
export interface PoChangedFields {
  fields?: Record<string, PoChangeFieldDiff>;
  lineItems?: PoChangeLineItem[];
}

export interface CreatePoChangeRequestInput {
  changeType: 'COMMERCIAL' | 'INTERNAL';
  changedFields: PoChangedFields;
  message?: string;
}

export interface PoChangeRequest {
  id: string;
  purchaseOrderId: string;
  /** Sequential per-PO human reference, e.g. "CR-001". */
  reference: string | null;
  changeType: string;
  changedFields: PoChangedFields;
  message: string | null;
  status: string;
  reason: string | null;
  requestedByName: string | null;
  requestedByCompanyName: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export async function proposePoChange(
  poId: string,
  input: CreatePoChangeRequestInput,
): Promise<PoChangeRequest> {
  const { data } = await getApiClient().post<{ data: PoChangeRequest }>(
    PURCHASE_ORDERS_PATHS.changeRequests(poId),
    input,
  );
  return data.data;
}

export async function listPoChangeRequests(poId: string): Promise<PoChangeRequest[]> {
  const { data } = await getApiClient().get<{ data: PoChangeRequest[] }>(
    PURCHASE_ORDERS_PATHS.changeRequests(poId),
  );
  return data.data;
}

export async function approvePoChange(poId: string, crId: string): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.approveChange(poId, crId));
}

export async function rejectPoChange(poId: string, crId: string, reason?: string): Promise<void> {
  await getApiClient().patch(PURCHASE_ORDERS_PATHS.rejectChange(poId, crId), { reason });
}

export async function exportSinglePo(id: string, format: string): Promise<{ url: string }> {
  const { data } = await getApiClient().get<{ data: { url: string } }>(
    PURCHASE_ORDERS_PATHS.exportSingle(id, format),
  );
  return data.data;
}
