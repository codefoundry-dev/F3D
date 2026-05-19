import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { VIEWS_PATHS } from './paths';

// ── Response interfaces ──────────────────────────────────────────────────────

export interface SavedViewResponse {
  id: string;
  name: string;
  tableName: string;
  visibleColumns: string[];
  columnOrder: string[];
  sortBy: string | null;
  sortDir: string | null;
  quickFilter: string | null;
  groupBy: string | null;
  createdAt: string;
}

// ── Request interfaces ───────────────────────────────────────────────────────

export interface CreateViewRequest {
  name: string;
  tableName: string;
  visibleColumns?: string[];
  columnOrder?: string[];
  sortBy?: string;
  sortDir?: string;
  quickFilter?: string;
  groupBy?: string;
}

export interface UpdateViewRequest {
  name?: string;
  visibleColumns?: string[];
  columnOrder?: string[];
  sortBy?: string | null;
  sortDir?: string | null;
  quickFilter?: string | null;
  groupBy?: string | null;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getViews(
  tableName: string,
  config?: AxiosRequestConfig,
): Promise<SavedViewResponse[]> {
  const { data } = await getApiClient().get<{ data: SavedViewResponse[] }>(VIEWS_PATHS.ROOT, {
    params: { tableName },
    ...config,
  });
  return data.data;
}

export async function createView(
  dto: CreateViewRequest,
  config?: AxiosRequestConfig,
): Promise<SavedViewResponse> {
  const { data } = await getApiClient().post<{ data: SavedViewResponse }>(
    VIEWS_PATHS.ROOT,
    dto,
    config,
  );
  return data.data;
}

export async function updateView(
  id: string,
  dto: UpdateViewRequest,
  config?: AxiosRequestConfig,
): Promise<SavedViewResponse> {
  const { data } = await getApiClient().patch<{ data: SavedViewResponse }>(
    VIEWS_PATHS.byId(id),
    dto,
    config,
  );
  return data.data;
}

export async function deleteView(id: string, config?: AxiosRequestConfig): Promise<void> {
  await getApiClient().delete(VIEWS_PATHS.byId(id), config);
}

export async function deleteAllViews(
  tableName: string,
  config?: AxiosRequestConfig,
): Promise<void> {
  await getApiClient().delete(VIEWS_PATHS.ROOT, { params: { tableName }, ...config });
}
