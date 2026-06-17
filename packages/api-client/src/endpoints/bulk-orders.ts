import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { BULK_ORDERS_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface BulkOrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  vendorId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  status?: string;
}

export interface CreateBulkOrderPayload {
  projectId: string;
  vendorId: string;
  rfqId?: string;
  brands?: string;
  endDate?: string;
  lineItems: CreateBulkOrderLineItemPayload[];
}

export interface CreateBulkOrderLineItemPayload {
  itemReference: string;
  description: string;
  qty: number;
  unit: string;
  pricePerUnit: number;
}

export interface UpdateBulkOrderPayload {
  brands?: string;
  endDate?: string;
  status?: string;
  projectId?: string;
}

export interface UpdateBulkOrderLineItemPayload {
  itemReference?: string;
  description?: string;
  qty?: number;
  unit?: string;
  pricePerUnit?: number;
}

export interface CreateDrawdownPayload {
  quantity: number;
  lineItemId: string;
  purchaseOrderId?: string;
}

export interface DrawdownResponse {
  id: string;
  bulkOrderId: string;
  lineItemId: string;
  quantity: number;
  createdAt: string;
}

export interface DrawdownHistoryItem {
  id: string;
  purchaseOrderId: string | null;
  poNumber: string | null;
  material: string | null;
  quantity: number;
  qtyBeforeDrawdown: number | null;
  remainingQty: number | null;
  date: string;
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface BulkOrderListItem {
  id: string;
  bulkOrderNumber?: string;
  projectName: string;
  projectId: string;
  companyId: string;
  contractorName: string;
  vendorId: string;
  vendorName: string;
  status: string;
  brands: string | null;
  lineItems: number;
  deliveriesPercent: number;
  amountCount: number;
  totalAmount: number;
  solidGold: string | null;
  date: string;
  validUntil: string | null;
  totalQtyOrdered?: number;
  totalQtyRemaining?: number;
  consumptionPercent?: number;
}

export interface BulkOrderLineItemDetail {
  lineItemId: string;
  itemReference: string;
  description: string;
  qty: number;
  unit: string;
  ordered: number;
  qtyRemaining: number;
  deliveriesPercent: number;
  pricePerUnit: number;
  totalLineInc: number;
  consumptionPercent?: number;
}

export interface BulkOrderDetail {
  /** Primary key — use this for routing to the detail page and sub-resources. */
  id: string;
  /** Human-readable bulk order number, e.g. BULK-0001 (display only). */
  bulkId: string;
  rfqReference: string | null;
  contractorName: string;
  vendorName: string;
  projectName: string;
  createdDate: string;
  endDate: string | null;
  createdBy: string;
  status?: string;
  overallConsumptionPercent?: number;
  lineItems: BulkOrderLineItemDetail[];
  drawdowns?: DrawdownHistoryItem[];
}

export interface PaginatedBulkOrdersResponse {
  items: BulkOrderListItem[];
  meta: PaginationMeta;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getBulkOrders(
  params?: BulkOrderListParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedBulkOrdersResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedBulkOrdersResponse }>(
    BULK_ORDERS_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getBulkOrder(
  id: string,
  config?: AxiosRequestConfig,
): Promise<BulkOrderDetail> {
  const { data } = await getApiClient().get<{ data: BulkOrderDetail }>(
    BULK_ORDERS_PATHS.byId(id),
    config,
  );
  return data.data;
}

export async function createBulkOrder(
  payload: CreateBulkOrderPayload,
  config?: AxiosRequestConfig,
): Promise<BulkOrderDetail> {
  const { data } = await getApiClient().post<{ data: BulkOrderDetail }>(
    BULK_ORDERS_PATHS.ROOT,
    payload,
    config,
  );
  return data.data;
}

export async function updateBulkOrder(
  id: string,
  payload: UpdateBulkOrderPayload,
  config?: AxiosRequestConfig,
): Promise<BulkOrderDetail> {
  const { data } = await getApiClient().patch<{ data: BulkOrderDetail }>(
    BULK_ORDERS_PATHS.byId(id),
    payload,
    config,
  );
  return data.data;
}

export async function deleteBulkOrder(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().delete(BULK_ORDERS_PATHS.byId(id), config);
}

export async function updateBulkOrderLineItem(
  bulkOrderId: string,
  lineItemId: string,
  payload: UpdateBulkOrderLineItemPayload,
  config?: AxiosRequestConfig,
): Promise<BulkOrderLineItemDetail> {
  const { data } = await getApiClient().patch<{ data: BulkOrderLineItemDetail }>(
    BULK_ORDERS_PATHS.lineItem(bulkOrderId, lineItemId),
    payload,
    config,
  );
  return data.data;
}

export async function createDrawdown(
  bulkOrderId: string,
  payload: CreateDrawdownPayload,
  config?: AxiosRequestConfig,
): Promise<DrawdownResponse> {
  const { data } = await getApiClient().post<{ data: DrawdownResponse }>(
    BULK_ORDERS_PATHS.drawdowns(bulkOrderId),
    payload,
    config,
  );
  return data.data;
}

// ── Change Requests (US-5.20) ──────────────────────────────────────────────

export interface ChangeLineItemInput {
  lineItemId?: string;
  action: 'update' | 'add' | 'remove';
  unitPrice?: number;
  quantity?: number;
  uom?: string;
  itemReference?: string;
  description?: string;
}

export interface CreateChangeRequestInput {
  endDate?: string;
  lineItems?: ChangeLineItemInput[];
  message?: string;
}

export interface BulkOrderChangeRequest {
  id: string;
  bulkOrderId: string;
  requestedBy: { id: string; name: string };
  changes: Record<string, unknown>;
  message: string | null;
  status: string;
  reason: string | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

export async function proposeChange(
  bulkOrderId: string,
  input: CreateChangeRequestInput,
): Promise<BulkOrderChangeRequest> {
  const { data } = await getApiClient().post<{ data: BulkOrderChangeRequest }>(
    BULK_ORDERS_PATHS.changeRequests(bulkOrderId),
    input,
  );
  return data.data;
}

export async function listChangeRequests(bulkOrderId: string): Promise<BulkOrderChangeRequest[]> {
  const { data } = await getApiClient().get<{ data: BulkOrderChangeRequest[] }>(
    BULK_ORDERS_PATHS.changeRequests(bulkOrderId),
  );
  return data.data;
}

export async function approveChangeRequest(
  bulkOrderId: string,
  changeRequestId: string,
): Promise<void> {
  await getApiClient().patch(BULK_ORDERS_PATHS.approveChange(bulkOrderId, changeRequestId));
}

export async function rejectChangeRequest(
  bulkOrderId: string,
  changeRequestId: string,
  reason?: string,
): Promise<void> {
  await getApiClient().patch(BULK_ORDERS_PATHS.rejectChange(bulkOrderId, changeRequestId), {
    reason,
  });
}

export async function cancelBulkOrder(bulkOrderId: string): Promise<void> {
  await getApiClient().post(BULK_ORDERS_PATHS.cancel(bulkOrderId));
}
