import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { MATERIAL_REQUESTS_PATHS } from './paths';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface MrListParams {
  status?: string;
  projectId?: string;
  priority?: string;
  /** Only the current user's own requests. */
  mine?: boolean;
  /** Quick filter: requests awaiting approval (SUBMITTED). */
  awaitingApproval?: boolean;
  /** Quick filter: approved requests. */
  approved?: boolean;
  /** Quick filter: high-urgency requests (HIGH or URGENT). */
  urgent?: boolean;
  /** Quick filter: past their needed-by date and still open. */
  overdue?: boolean;
}

export interface CreateMrLineItemInput {
  /** Catalogue material id; omit for a free-text line (then `materialName` is required). */
  materialId?: string;
  materialName?: string;
  description?: string;
  quantity: number;
  /** Unit of measure (e.g. pcs, m, kg). */
  unit: string;
  priority?: string;
  expectedDeliveryDate?: string;
  /** Wanted delivery time of day, 24-hour "HH:MM". */
  deliveryTime?: string;
  deliveryLocationId?: string;
  notes?: string;
  /** File id from {@link uploadMaterialRequestLinePhoto} (FOR-404). */
  photoFileId?: string;
}

/** A requester's photo of a line item, uploaded before the request is created. */
export interface MrLinePhotoUpload {
  fileId: string;
  fileName: string;
  /** Short-lived preview URL; null if it could not be signed. */
  url: string | null;
}

export interface CreateMaterialRequestInput {
  projectId: string;
  priority?: string;
  neededByDate?: string;
  deliveryLocationId?: string;
  note?: string;
  /** Submit immediately (create directly in SUBMITTED instead of DRAFT). */
  submit?: boolean;
  /**
   * Approver Pool members to nominate on submission (FOR-347). Routing only —
   * narrows who is notified, never who may approve. Requires `submit: true`;
   * omitted or empty = notify the whole Pool.
   */
  nomineeIds?: string[];
  lineItems: CreateMrLineItemInput[];
}

export type UpdateMaterialRequestInput = Partial<Omit<CreateMaterialRequestInput, 'projectId'>>;

export interface MrConvertToRfqInput {
  name?: string;
}

export interface MrConvertToPoInput {
  vendorId: string;
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface MrListItem {
  id: string;
  mrNumber: string;
  status: string;
  priority: string;
  projectId: string;
  project: { id: string; name: string };
  requestedBy: { id: string; name: string };
  lineItemCount: number;
  neededByDate: string | null;
  createdAt: string;
}

export interface MrLineItemDetail {
  id: string;
  materialId: string | null;
  materialName: string | null;
  /**
   * Image to show for the line: the requester's uploaded photo when there is
   * one (FOR-404), otherwise the linked material's catalogue image.
   */
  imageUrl?: string | null;
  /** File id of the requester's uploaded photo, if any. */
  photoFileId?: string | null;
  description: string | null;
  quantity: number;
  unit: string;
  priority: string | null;
  expectedDeliveryDate: string | null;
  /** Wanted delivery time of day, 24-hour "HH:MM". */
  deliveryTime?: string | null;
  deliveryLocationId: string | null;
  /** Resolved location label/address, or null. */
  deliveryLocation: string | null;
  notes: string | null;
}

export interface MrDetail {
  id: string;
  mrNumber: string;
  status: string;
  priority: string;
  projectId: string;
  project: { id: string; name: string };
  company: { id: string; name: string };
  requestedBy: { id: string; name: string; email: string };
  reviewedBy: { id: string; name: string; email: string } | null;
  reviewedAt: string | null;
  declineReason: string | null;
  neededByDate: string | null;
  deliveryLocationId: string | null;
  deliveryLocation: string | null;
  note: string | null;
  convertedToRfq: { id: string; rfqNumber: string } | null;
  convertedToPo: { id: string; poNumber: string } | null;
  convertedAt: string | null;
  lineItems: MrLineItemDetail[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One entry in a Material Request's audit/activity trail. `action` is an
 * AuditAction enum value (e.g. 'MATERIAL_REQUEST_SUBMITTED') humanized for
 * display; `metadata` carries transition context such as `{ from, to, reason }`.
 */
export interface MrAuditEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  performedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
}

export interface MaterialRequestsListResponse {
  items: MrListItem[];
}

export interface MrConvertToRfqResponse {
  rfqId: string;
  rfqNumber: string;
}

export interface MrConvertToPoResponse {
  poId: string;
  poNumber: string;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getMaterialRequests(
  params?: MrListParams,
  config?: AxiosRequestConfig,
): Promise<MaterialRequestsListResponse> {
  const { data } = await getApiClient().get<{ data: MaterialRequestsListResponse }>(
    MATERIAL_REQUESTS_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getMaterialRequest(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().get<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.byId(id),
    config,
  );
  return data.data;
}

/** Fetch a Material Request's audit/activity trail (oldest event first). */
export async function getMaterialRequestAuditTrail(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MrAuditEntry[]> {
  const { data } = await getApiClient().get<{ data: MrAuditEntry[] }>(
    MATERIAL_REQUESTS_PATHS.audit(id),
    config,
  );
  return data.data;
}

/** Upload a photo for a request line; send the returned `fileId` as `photoFileId`. */
export async function uploadMaterialRequestLinePhoto(
  file: File,
  config?: AxiosRequestConfig,
): Promise<MrLinePhotoUpload> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: MrLinePhotoUpload }>(
    `${MATERIAL_REQUESTS_PATHS.ROOT}/line-photos`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

export async function createMaterialRequest(
  input: CreateMaterialRequestInput,
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().post<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.ROOT,
    input,
    config,
  );
  return data.data;
}

export async function updateMaterialRequest(
  id: string,
  input: UpdateMaterialRequestInput,
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().patch<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.byId(id),
    input,
    config,
  );
  return data.data;
}

export async function submitMaterialRequest(
  id: string,
  /** Optional Pool members to nominate as part of this submission (FOR-347). */
  body?: { nomineeIds?: string[] },
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().post<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.submit(id),
    body,
    config,
  );
  return data.data;
}

export async function approveMaterialRequest(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().post<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.approve(id),
    undefined,
    config,
  );
  return data.data;
}

/**
 * Decline a submitted Material Request. A reason is REQUIRED by the backend; it
 * is stored on the MR and recorded in its audit trail.
 */
export async function declineMaterialRequest(
  id: string,
  body: { reason: string },
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().post<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.decline(id),
    body,
    config,
  );
  return data.data;
}

export async function cancelMaterialRequest(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MrDetail> {
  const { data } = await getApiClient().post<{ data: MrDetail }>(
    MATERIAL_REQUESTS_PATHS.cancel(id),
    undefined,
    config,
  );
  return data.data;
}

/** Convert an APPROVED Material Request into a draft RFQ. */
export async function convertMaterialRequestToRfq(
  id: string,
  input?: MrConvertToRfqInput,
  config?: AxiosRequestConfig,
): Promise<MrConvertToRfqResponse> {
  const { data } = await getApiClient().post<{ data: MrConvertToRfqResponse }>(
    MATERIAL_REQUESTS_PATHS.convertToRfq(id),
    input ?? {},
    config,
  );
  return data.data;
}

/** Convert an APPROVED Material Request into a draft purchase order. */
export async function convertMaterialRequestToPo(
  id: string,
  input: MrConvertToPoInput,
  config?: AxiosRequestConfig,
): Promise<MrConvertToPoResponse> {
  const { data } = await getApiClient().post<{ data: MrConvertToPoResponse }>(
    MATERIAL_REQUESTS_PATHS.convertToPo(id),
    input,
    config,
  );
  return data.data;
}
