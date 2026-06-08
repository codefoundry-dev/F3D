import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { DOC_EXTRACTIONS_PATHS } from './paths';

export type DocExtractionType = 'BOM' | 'QUOTE' | 'INVOICE' | 'GENERIC' | 'CATALOGUE';
export type DocExtractionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'FAILED';

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

export interface DocExtractionResponse {
  id: string;
  type: DocExtractionType;
  status: DocExtractionStatus;
  file: DocExtractionFile;
  rawResult: Record<string, unknown> | null;
  editedResult: Record<string, unknown> | null;
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
): Promise<DocExtractionResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (promptHint) form.append('promptHint', promptHint);

  const { data } = await getApiClient().post<{ data: DocExtractionResponse }>(
    DOC_EXTRACTIONS_PATHS.ROOT,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
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

export async function getDocExtraction(id: string): Promise<DocExtractionResponse> {
  const { data } = await getApiClient().get<{ data: DocExtractionResponse }>(
    DOC_EXTRACTIONS_PATHS.byId(id),
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
