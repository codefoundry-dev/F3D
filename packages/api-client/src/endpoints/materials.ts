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
  /**
   * Catalogue ingest fields (FOR-228). The materials list now also surfaces the
   * richer catalogue attributes; kept optional so existing consumers that only
   * read name/code/unitOfMeasure are unaffected.
   */
  uom?: string;
  sku?: string | null;
  brand?: string | null;
  manufacturerPartNumber?: string | null;
  subCategory?: string | null;
  imageUrl?: string | null;
}

export interface PaginatedMaterialsResponse {
  items: MaterialListItemDto[];
  meta: PaginationMeta;
}

/** Summary returned by POST /v1/materials/catalogue-import (FOR-228). */
export interface CatalogueImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  categoriesCreated: number;
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

/**
 * Bulk-imports the materials from a confirmed CATALOGUE extraction (FOR-228).
 * The backend reads the extraction's edited result and upserts the catalogue
 * (SKU-keyed), returning a summary of what changed.
 */
export async function importCatalogue(
  extractionId: string,
  config?: AxiosRequestConfig,
): Promise<CatalogueImportSummary> {
  const { data } = await getApiClient().post<{ data: CatalogueImportSummary }>(
    MATERIALS_PATHS.CATALOGUE_IMPORT,
    { extractionId },
    config,
  );
  return data.data;
}
