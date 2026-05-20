import type { CreateRfqDto, UpdateRfqDto } from '@forethread/shared-types';
import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

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

export async function declineQuote(
  rfqId: string,
  quoteId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(RFQS_PATHS.declineQuote(rfqId, quoteId), undefined, config);
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

export async function sendRfq(id: string, config?: AxiosRequestConfig): Promise<RfqDetail> {
  const { data } = await getApiClient().post<{ data: RfqDetail }>(
    RFQS_PATHS.send(id),
    undefined,
    config,
  );
  return data.data;
}

export async function deleteRfq(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().delete(RFQS_PATHS.byId(id), config);
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
  message?: string;
  attachmentIds?: string[];
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
