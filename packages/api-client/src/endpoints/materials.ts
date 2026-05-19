import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { MATERIALS_PATHS } from './paths';
import type { PaginationMeta } from './users';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface MaterialListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface CreateMaterialInput {
  name: string;
  code?: string;
  description?: string;
  categoryId?: string;
  unitOfMeasure: string;
}

// ── Response interfaces ──────────────────────────────────────────────────────

export interface MaterialCategoryDto {
  id: string;
  name: string;
  parentId: string | null;
}

export interface MaterialListItemDto {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitOfMeasure: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMaterialsResponse {
  items: MaterialListItemDto[];
  meta: PaginationMeta;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getMaterials(
  params?: MaterialListQueryParams,
  config?: AxiosRequestConfig,
): Promise<PaginatedMaterialsResponse> {
  const { data } = await getApiClient().get<{ data: PaginatedMaterialsResponse }>(
    MATERIALS_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getMaterialCategories(
  config?: AxiosRequestConfig,
): Promise<MaterialCategoryDto[]> {
  const { data } = await getApiClient().get<{ data: MaterialCategoryDto[] }>(
    MATERIALS_PATHS.CATEGORIES,
    config,
  );
  return data.data;
}

export async function getMaterialSuggestions(
  search: string,
  config?: AxiosRequestConfig,
): Promise<MaterialListItemDto[]> {
  const { data } = await getApiClient().get<{ data: MaterialListItemDto[] }>(
    MATERIALS_PATHS.SUGGESTIONS,
    { params: { search }, ...config },
  );
  return data.data;
}

export async function createMaterial(
  input: CreateMaterialInput,
  config?: AxiosRequestConfig,
): Promise<MaterialListItemDto> {
  const { data } = await getApiClient().post<{ data: MaterialListItemDto }>(
    MATERIALS_PATHS.ROOT,
    input,
    config,
  );
  return data.data;
}
