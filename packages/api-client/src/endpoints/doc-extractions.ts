import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { DOC_EXTRACTIONS_PATHS } from './paths';

// Catalogue uploads can be large spreadsheets (a real Rexel export is ~30 MB),
// so the multipart upload routinely needs more than the api-client's default
// 30s timeout — the request also waits on the server-side S3 upload before it
// returns. Give it generous headroom.
const UPLOAD_TIMEOUT_MS = 120_000;

export type DocExtractionType =
  | 'BOM'
  | 'QUOTE'
  | 'INVOICE'
  | 'GENERIC'
  | 'CATALOGUE'
  | 'VENDOR_DOCUMENT';
export type DocExtractionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CONFIRMED' | 'FAILED';

export interface DocExtractionFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface DocExtractionUsage {
  promptTokens: number | null;
  completionTokens: number | null;
}

/** Lightweight stand-in for the result payload under resultView=summary. */
export interface DocExtractionResultSummary {
  itemCount: number | null;
  sourceName: string | null;
  notes: string | null;
}

export interface DocExtractionResponse {
  id: string;
  type: DocExtractionType;
  status: DocExtractionStatus;
  file: DocExtractionFile;
  rawResult: Record<string, unknown> | null;
  editedResult: Record<string, unknown> | null;
  /** Present (and results null) when fetched with resultView=summary. */
  resultSummary?: DocExtractionResultSummary | null;
  errorCode: string | null;
  errorMessage: string | null;
  model: string | null;
  usage: DocExtractionUsage | null;
  createdByUserId: string;
  lastEditedByUserId: string | null;
  confirmedByUserId: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastEditedAt: string | null;
  confirmedAt: string | null;
}

/** Window into a stored result's items (GET /doc-extractions/:id/items). */
export interface DocExtractionItemsResponse<TItem = Record<string, unknown>> {
  items: TItem[];
  /** Absolute index of each row in `items` (parallel arrays). */
  indexes: number[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** One ordered mutation of the stored result's items array. */
export interface DocExtractionItemOp {
  op: 'update' | 'remove' | 'duplicate';
  /** Absolute index at the time this op applies (earlier ops shift indexes). */
  index: number;
  /** Full replacement row — required for 'update'. */
  item?: Record<string, unknown>;
}

export interface DocExtractionItemOpsResult {
  itemCount: number;
}

export interface DocExtractionListParams {
  page?: number;
  limit?: number;
  type?: DocExtractionType;
  status?: DocExtractionStatus;
  createdByUserId?: string;
}

export interface PaginatedDocExtractionsResponse {
  items: DocExtractionResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function createDocExtraction(
  type: DocExtractionType,
  file: File,
  promptHint?: string,
  sheetNames?: string[],
): Promise<DocExtractionResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (promptHint) form.append('promptHint', promptHint);
  // Spreadsheet sheet selection: sent as a JSON string field so it survives the
  // multipart boundary as a single value (the backend DTO parses it back).
  if (sheetNames && sheetNames.length > 0) {
    form.append('sheetNames', JSON.stringify(sheetNames));
  }

  const { data } = await getApiClient().post<{ data: DocExtractionResponse }>(
    DOC_EXTRACTIONS_PATHS.ROOT,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT_MS },
  );
  return data.data;
}

/**
 * Pre-flight: list the worksheet names in a spreadsheet before extraction so the
 * UI can offer a sheet picker. Returns an empty array for non-spreadsheet files
 * (CSV/PDF), which have no sheets to choose between.
 */
export async function listSpreadsheetSheets(file: File): Promise<string[]> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await getApiClient().post<{ data: { sheets: string[] } }>(
    DOC_EXTRACTIONS_PATHS.SPREADSHEET_SHEETS,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT_MS },
  );
  return data.data.sheets;
}

export async function listDocExtractions(
  params?: DocExtractionListParams,
): Promise<PaginatedDocExtractionsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedDocExtractionsResponse }>(
    DOC_EXTRACTIONS_PATHS.ROOT,
    { params },
  );
  return data.data;
}

export async function getDocExtraction(
  id: string,
  config?: AxiosRequestConfig,
): Promise<DocExtractionResponse> {
  const { data } = await getApiClient().get<{ data: DocExtractionResponse }>(
    DOC_EXTRACTIONS_PATHS.byId(id),
    config,
  );
  return data.data;
}

/**
 * Poll variant whose response stays tiny even when the completed result is
 * tens of MB: results come back null, with counts in `resultSummary`.
 */
export async function getDocExtractionSummary(
  id: string,
  config?: AxiosRequestConfig,
): Promise<DocExtractionResponse> {
  return getDocExtraction(id, {
    ...config,
    params: { ...(config?.params as Record<string, unknown> | undefined), resultView: 'summary' },
  });
}

/**
 * Fetch a window of the stored result's items. Pass page/limit for a
 * contiguous window, or `indexes` (absolute positions, max 500) for scattered
 * rows — e.g. the duplicates flagged by detect-duplicates.
 */
export async function getDocExtractionItems<TItem = Record<string, unknown>>(
  id: string,
  params: { page?: number; limit?: number; indexes?: number[] },
  config?: AxiosRequestConfig,
): Promise<DocExtractionItemsResponse<TItem>> {
  const { indexes, ...rest } = params;
  const { data } = await getApiClient().get<{ data: DocExtractionItemsResponse<TItem> }>(
    `${DOC_EXTRACTIONS_PATHS.byId(id)}/items`,
    {
      ...config,
      params: {
        ...rest,
        ...(indexes && indexes.length > 0 ? { indexes: indexes.join(',') } : {}),
      },
    },
  );
  return data.data;
}

/**
 * Apply ordered sparse row ops (update / remove / duplicate) to the stored
 * result server-side — the full result never round-trips the network.
 */
export async function applyDocExtractionItemOps(
  id: string,
  ops: DocExtractionItemOp[],
  config?: AxiosRequestConfig,
): Promise<DocExtractionItemOpsResult> {
  const { data } = await getApiClient().patch<{ data: DocExtractionItemOpsResult }>(
    `${DOC_EXTRACTIONS_PATHS.byId(id)}/items`,
    { ops },
    config,
  );
  return data.data;
}

export async function updateDocExtraction(
  id: string,
  editedResult: Record<string, unknown>,
  config?: AxiosRequestConfig,
): Promise<DocExtractionResponse> {
  const { data } = await getApiClient().patch<{ data: DocExtractionResponse }>(
    DOC_EXTRACTIONS_PATHS.byId(id),
    { editedResult },
    config,
  );
  return data.data;
}

export async function confirmDocExtraction(
  id: string,
  editedResult?: Record<string, unknown>,
): Promise<DocExtractionResponse> {
  const { data } = await getApiClient().post<{ data: DocExtractionResponse }>(
    DOC_EXTRACTIONS_PATHS.confirm(id),
    editedResult ? { editedResult } : {},
  );
  return data.data;
}

export async function deleteDocExtraction(id: string): Promise<void> {
  await getApiClient().delete(DOC_EXTRACTIONS_PATHS.byId(id));
}
