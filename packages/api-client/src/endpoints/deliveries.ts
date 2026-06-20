import type {
  CreateDeliveryReportInput,
  DeliveryDamagePhotoResponse,
  DeliveryLinkResponse,
  DeliveryPortalPoResponse,
  DeliveryReportAttachmentResponse,
  DeliveryReportDetailResponse,
  DeliveryReportListItem,
  PortalIdentifyInput,
  PortalIdentifyResponse,
  PortalSubmitInput,
  PortalSubmitResponse,
  PortalVerifyInput,
  PortalVerifyResponse,
} from '@forethread/shared-types/client';
import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { DELIVERY_PATHS, DELIVERY_PORTAL_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface DeliveryListParams {
  page?: number;
  limit?: number;
  search?: string;
  vendor?: string;
  status?: string;
  project?: string;
  location?: string;
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface PaginatedDeliveryReports {
  items: DeliveryReportListItem[];
  meta: PaginationMeta;
}

// ── Internal endpoint functions (session auth) ─────────────────────────────────

export async function getDeliveryReports(
  params?: DeliveryListParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedDeliveryReports> {
  const { data } = await getApiClient().get<{ data: PaginatedDeliveryReports }>(
    DELIVERY_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getDeliveryReport(
  id: string,
  config?: AxiosRequestConfig,
): Promise<DeliveryReportDetailResponse> {
  const { data } = await getApiClient().get<{ data: DeliveryReportDetailResponse }>(
    DELIVERY_PATHS.byId(id),
    config,
  );
  return data.data;
}

export async function createDeliveryReport(
  input: CreateDeliveryReportInput,
  config?: AxiosRequestConfig,
): Promise<DeliveryReportDetailResponse> {
  const { data } = await getApiClient().post<{ data: DeliveryReportDetailResponse }>(
    DELIVERY_PATHS.ROOT,
    input,
    config,
  );
  return data.data;
}

export async function approveDeliveryReport(
  id: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(DELIVERY_PATHS.approve(id), undefined, config);
}

export async function rejectDeliveryReport(
  id: string,
  body: { reason: string },
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().patch(DELIVERY_PATHS.reject(id), body, config);
}

export async function uploadDeliveryReportAttachment(
  id: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<DeliveryReportAttachmentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: DeliveryReportAttachmentResponse }>(
    DELIVERY_PATHS.attachments(id),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

export async function deleteDeliveryReportAttachment(
  id: string,
  attId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(DELIVERY_PATHS.attachment(id, attId), config);
}

export async function uploadDeliveryLinePhoto(
  id: string,
  lineId: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<DeliveryDamagePhotoResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: DeliveryDamagePhotoResponse }>(
    DELIVERY_PATHS.linePhotos(id, lineId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, ...config },
  );
  return data.data;
}

export async function deleteDeliveryLinePhoto(
  id: string,
  lineId: string,
  photoId: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(DELIVERY_PATHS.linePhoto(id, lineId, photoId), config);
}

/**
 * Mint (or fetch) the public delivery-portal link for a PO. The returned `url`
 * is embedded in the QR code rendered on the PO detail page (screenshot 09);
 * scanning it opens the unauthenticated delivery form (Part C).
 */
export async function createPoDeliveryLink(
  poId: string,
  config?: AxiosRequestConfig,
): Promise<DeliveryLinkResponse> {
  const { data } = await getApiClient().post<{ data: DeliveryLinkResponse }>(
    DELIVERY_PATHS.poDeliveryLink(poId),
    undefined,
    config,
  );
  return data.data;
}

// ── Public portal functions (X-Access-Token header, no session) ────────────────
//
// Mirrors `getPublicPurchaseOrder` (FOR-246): the QR token authorises the call
// via the `X-Access-Token` header (never a session), and `skipErrorHandler`
// opts out of the global toast so the public page can render its own state.
// For identify/verify the token is the QR token; `verify` returns a short-lived
// `sessionToken` that authorises submit/uploads/finalize. These functions are
// consumed by the Part C public mobile flow, not by the internal pages.

const ACCESS_TOKEN_HEADER = 'X-Access-Token';

function portalConfig(token: string, config?: AxiosRequestConfig): AxiosRequestConfig {
  return {
    headers: { [ACCESS_TOKEN_HEADER]: token, ...(config?.headers ?? {}) },
    skipErrorHandler: true,
    ...config,
  };
}

/** Read-only PO header + lines for the public delivery form (QR token). */
export async function getDeliveryPortalPo(
  token: string,
  config?: AxiosRequestConfig,
): Promise<DeliveryPortalPoResponse> {
  const { data } = await getApiClient().get<{ data: DeliveryPortalPoResponse }>(
    DELIVERY_PORTAL_PATHS.po,
    portalConfig(token, config),
  );
  return data.data;
}

/**
 * Identify the delivery person (name + email). Anti-enumeration: always returns
 * ok; if the email matches an expected recipient a 6-digit code is emailed.
 */
export async function identifyDeliveryPortal(
  token: string,
  input: PortalIdentifyInput,
  config?: AxiosRequestConfig,
): Promise<PortalIdentifyResponse> {
  const { data } = await getApiClient().post<{ data: PortalIdentifyResponse }>(
    DELIVERY_PORTAL_PATHS.identify,
    input,
    portalConfig(token, config),
  );
  return data.data;
}

/** Verify the emailed access code; returns a DELIVERY_SESSION token for submit/uploads. */
export async function verifyDeliveryPortal(
  token: string,
  input: PortalVerifyInput,
  config?: AxiosRequestConfig,
): Promise<PortalVerifyResponse> {
  const { data } = await getApiClient().post<{ data: PortalVerifyResponse }>(
    DELIVERY_PORTAL_PATHS.verify,
    input,
    portalConfig(token, config),
  );
  return data.data;
}

/**
 * Submit the delivery report via the portal. `sessionToken` is the value
 * returned by {@link verifyDeliveryPortal}; it authorises the write.
 */
export async function submitDeliveryPortal(
  sessionToken: string,
  input: PortalSubmitInput,
  config?: AxiosRequestConfig,
): Promise<PortalSubmitResponse> {
  const { data } = await getApiClient().post<{ data: PortalSubmitResponse }>(
    DELIVERY_PORTAL_PATHS.submit,
    input,
    portalConfig(sessionToken, config),
  );
  return data.data;
}

/** Attach a damage photo to a line via the portal (session token). */
export async function uploadDeliveryPortalLinePhoto(
  sessionToken: string,
  lineId: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<DeliveryDamagePhotoResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: DeliveryDamagePhotoResponse }>(
    DELIVERY_PORTAL_PATHS.linePhotos(lineId),
    formData,
    portalConfig(sessionToken, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }),
  );
  return data.data;
}

/** Attach a report-level supporting file via the portal (session token). */
export async function uploadDeliveryPortalAttachment(
  sessionToken: string,
  file: File,
  config?: AxiosRequestConfig,
): Promise<DeliveryReportAttachmentResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await getApiClient().post<{ data: DeliveryReportAttachmentResponse }>(
    DELIVERY_PORTAL_PATHS.attachments,
    formData,
    portalConfig(sessionToken, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }),
  );
  return data.data;
}

/** Finalize the portal submission (session token). Returns the created report. */
export async function finalizeDeliveryPortal(
  sessionToken: string,
  config?: AxiosRequestConfig,
): Promise<PortalSubmitResponse> {
  const { data } = await getApiClient().post<{ data: PortalSubmitResponse }>(
    DELIVERY_PORTAL_PATHS.finalize,
    undefined,
    portalConfig(sessionToken, config),
  );
  return data.data;
}
