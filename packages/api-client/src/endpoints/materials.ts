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
  /** 'PUBLIC' | 'PENDING_APPROVAL' | 'ARCHIVED' */
  status?: string;
  /** Facet filters (US 4.01) — backend matches these on the materials list. */
  manufacturer?: string;
  uom?: string;
  materialType?: string;
  countryOfOrigin?: string;
  /** Sortable columns: 'name' | 'createdAt' (defaults to 'name' on the backend). */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** When true, restricts the list to the current user's favourited materials (US 4.03). */
  favourite?: boolean;
}

export interface CreateMaterialInput {
  name: string;
  /** Required by the API. Optional here only so the legacy `unitOfMeasure` alias
   *  (used by the BOM "create private material" modal) keeps compiling; the
   *  catalogue create wizard always supplies it. */
  uom?: string;
  /** @deprecated Legacy alias for `uom`; normalized to `uom` before the request. */
  unitOfMeasure?: string;
  /** Required by the API. The catalogue create wizard always supplies it. */
  categoryId?: string;
  /** @deprecated No backing column on the catalogue model; stripped before send. */
  code?: string;
  description?: string;
  // ── Rich Core-identification + Additional-properties fields (US 4.01 P2) ──
  upc?: string;
  manufacturer?: string;
  sku?: string;
  brand?: string;
  manufacturerPartNumber?: string;
  subCategory?: string;
  imageUrl?: string;
  materialType?: string;
  itemType?: string;
  countryOfOrigin?: string;
  manufacturerSeriesModel?: string;
  gradeClass?: string;
  standardNorm?: string;
  colourFinish?: string;
  size?: string;
  pricePerUnit?: number;
  currency?: string;
  dimensions?: MaterialDimensions;
  properties?: MaterialProperties;
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
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Legacy aliases kept optional. The materials list endpoint returns `uom`
   * (not `unitOfMeasure`) and no longer returns `code`; these remain on the type
   * so older consumers/tests that referenced them keep compiling.
   */
  code?: string | null;
  unitOfMeasure?: string;
  description?: string | null;
  /**
   * Rich catalogue attributes surfaced on the list (FOR-228 / US 4.01). All
   * optional so existing consumers that only read name/category are unaffected.
   */
  uom?: string;
  upc?: string | null;
  sku?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  manufacturerPartNumber?: string | null;
  subCategory?: string | null;
  materialType?: string | null;
  countryOfOrigin?: string | null;
  /** Decimal serialised as a string, e.g. "12.50"; null when not priced. */
  pricePerUnit?: string | null;
  currency?: string;
  imageUrl?: string | null;
  /**
   * Owning company of a private material; null for the global PUBLIC catalogue
   * (US 4.03). Lets the UI distinguish a company's own contributions.
   */
  companyId?: string | null;
  /** Whether the current user has favourited this material (US 4.03). */
  isFavourite?: boolean;
}

export interface PaginatedMaterialsResponse {
  items: MaterialListItemDto[];
  meta: PaginationMeta;
}

/**
 * Distinct facet option lists for the catalogue filter dropdowns (US 4.04).
 * Each array holds the sorted, de-duplicated values present across the user's
 * visible catalogue.
 */
export interface MaterialFacetsDto {
  manufacturers: string[];
  uoms: string[];
  materialTypes: string[];
  countriesOfOrigin: string[];
}

// ── Detail / update shapes (US 4.01) ──────────────────────────────────────────

export interface MaterialDimensionValue {
  value: number | null;
  uom: string | null;
}

export interface MaterialPackaging {
  packagingUnit?: string | null;
  unitsPerPackage?: number | null;
  weightPerPackage?: number | null;
}

export interface MaterialDimensions {
  length?: MaterialDimensionValue;
  width?: MaterialDimensionValue;
  height?: MaterialDimensionValue;
  diameter?: MaterialDimensionValue;
  thickness?: MaterialDimensionValue;
  volume?: MaterialDimensionValue;
  weightPerUnit?: MaterialDimensionValue;
  packaging?: MaterialPackaging;
}

export type MaterialProperties = Record<string, string | number | null>;

export interface MaterialDetailDto {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  uom: string;
  upc: string | null;
  manufacturer: string | null;
  description: string | null;
  sku: string | null;
  brand: string | null;
  manufacturerPartNumber: string | null;
  subCategory: string | null;
  imageUrl: string | null;
  materialType: string | null;
  itemType: string | null;
  countryOfOrigin: string | null;
  manufacturerSeriesModel: string | null;
  gradeClass: string | null;
  standardNorm: string | null;
  colourFinish: string | null;
  size: string | null;
  pricePerUnit: string | null;
  currency: string;
  dimensions: MaterialDimensions | null;
  properties: MaterialProperties | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  /**
   * Owning company of a private material; null for the global PUBLIC catalogue
   * (US 4.03).
   */
  companyId?: string | null;
  /** Whether the current user has favourited this material (US 4.03). */
  isFavourite?: boolean;
}

export interface UpdateMaterialInput {
  name?: string;
  categoryId?: string;
  uom?: string;
  upc?: string;
  manufacturer?: string;
  description?: string;
  sku?: string;
  brand?: string;
  manufacturerPartNumber?: string;
  subCategory?: string;
  imageUrl?: string;
  materialType?: string;
  itemType?: string;
  countryOfOrigin?: string;
  manufacturerSeriesModel?: string;
  gradeClass?: string;
  standardNorm?: string;
  colourFinish?: string;
  size?: string;
  pricePerUnit?: number;
  currency?: string;
  dimensions?: MaterialDimensions;
  properties?: MaterialProperties;
}

export interface RejectMaterialInput {
  reason?: string;
}

/** Summary returned by POST /v1/materials/catalogue-import (FOR-228). */
export interface CatalogueImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  categoriesCreated: number;
}

// ── Duplicate detection (US 4.01 Phase 3) ─────────────────────────────────────

export interface DuplicateCandidateInput {
  name: string;
  sku?: string | null;
  upc?: string | null;
}

export type DuplicateMatchField = 'name' | 'sku' | 'upc';

export interface MaterialDuplicateMatch {
  id: string;
  name: string;
  /** Human-facing code shown in the wizard (SKU when present, else a short id). */
  code: string;
  status: string;
  matchedOn: DuplicateMatchField[];
}

/** Matches for a single candidate row, keyed back to its submitted index. */
export interface MaterialDuplicateResult {
  index: number;
  matches: MaterialDuplicateMatch[];
}

export interface DetectMaterialDuplicatesResponse {
  results: MaterialDuplicateResult[];
}

// ── Material change requests (US 4.01 Phase 3) ────────────────────────────────

export interface MaterialFieldChange {
  from: string | number | null;
  to: string | number | null;
}

/** A proposed edit to a PUBLIC material awaiting Super-Admin review. */
export interface MaterialChangeRequestDto {
  id: string;
  materialId: string;
  materialName: string;
  status: string;
  changes: Record<string, MaterialFieldChange>;
  reason: string | null;
  requestedBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ── Search suggestions (US 4.04 catalogue autocomplete) ───────────────────────

export interface MaterialSuggestionsParams {
  /** Search term: matches name / UPC / manufacturer. */
  q?: string;
  /** Max rows per group (results / recentlyUsed / frequentlyUsed). Default 8. */
  limit?: number;
}

/** A single autocomplete row (mirrors backend MaterialSuggestionDto). */
export interface MaterialSuggestionDto {
  id: string;
  name: string;
  categoryName: string | null;
  uom: string | null;
  description: string | null;
  imageUrl: string | null;
}

/** Grouped autocomplete payload. The two usage groups are empty when the user
 *  has no usage history yet. */
export interface MaterialSuggestionsResponse {
  results: MaterialSuggestionDto[];
  frequentlyUsed: MaterialSuggestionDto[];
  recentlyUsed: MaterialSuggestionDto[];
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

/**
 * Distinct filter facet values for the catalogue dropdowns (manufacturer / UoM /
 * material type / country of origin), derived from the whole visible catalogue
 * (GET /v1/materials/facets) — not a single page of results.
 */
export async function getMaterialFacets(config?: AxiosRequestConfig): Promise<MaterialFacetsDto> {
  const { data } = await getApiClient().get<{ data: MaterialFacetsDto }>(
    MATERIALS_PATHS.FACETS,
    config,
  );
  return data.data;
}

/**
 * Catalogue search autocomplete (US 4.04). Returns three groups:
 *  - `results`: name / UPC / manufacturer contains-match on visible materials.
 *  - `recentlyUsed` / `frequentlyUsed`: the caller's own usage signal (empty
 *    arrays when the user has no usage history yet).
 */
export async function getMaterialSuggestions(
  params?: MaterialSuggestionsParams,
  config?: AxiosRequestConfig,
): Promise<MaterialSuggestionsResponse> {
  const { data } = await getApiClient().get<{ data: MaterialSuggestionsResponse }>(
    MATERIALS_PATHS.SUGGESTIONS,
    { params, ...config },
  );
  return data.data;
}

export async function createMaterial(
  input: CreateMaterialInput,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  // Normalize the legacy aliases: map `unitOfMeasure` → `uom` and drop the
  // unbacked `code`, so the request body matches the backend CreateMaterialDto
  // (which runs under `forbidNonWhitelisted` and would 400 on stray fields).
  const { unitOfMeasure, code: _code, uom, ...rest } = input;
  const body = { ...rest, uom: uom ?? unitOfMeasure };
  const { data } = await getApiClient().post<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.ROOT,
    body,
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

// ── Material detail / lifecycle (US 4.01) ─────────────────────────────────────

export async function getMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  const { data } = await getApiClient().get<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.byId(id),
    config,
  );
  return data.data;
}

export async function updateMaterial(
  id: string,
  input: UpdateMaterialInput,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  const { data } = await getApiClient().patch<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.byId(id),
    input,
    config,
  );
  return data.data;
}

export async function approveMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  const { data } = await getApiClient().patch<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.approve(id),
    undefined,
    config,
  );
  return data.data;
}

export async function rejectMaterial(
  id: string,
  input?: RejectMaterialInput,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  const { data } = await getApiClient().patch<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.reject(id),
    input ?? {},
    config,
  );
  return data.data;
}

export async function archiveMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  const { data } = await getApiClient().patch<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.archive(id),
    undefined,
    config,
  );
  return data.data;
}

export async function restoreMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MaterialDetailDto> {
  const { data } = await getApiClient().patch<{ data: MaterialDetailDto }>(
    MATERIALS_PATHS.restore(id),
    undefined,
    config,
  );
  return data.data;
}

export async function deleteMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ success: true }> {
  const { data } = await getApiClient().delete<{ data: { success: true } }>(
    MATERIALS_PATHS.byId(id),
    config,
  );
  return data.data;
}

// ── Duplicate detection + change requests (US 4.01 Phase 3) ───────────────────

/**
 * Check a batch of candidate rows (upload/import wizard) against the existing
 * catalogue, returning the colliding materials per candidate index.
 */
export async function detectMaterialDuplicates(
  candidates: DuplicateCandidateInput[],
  config?: AxiosRequestConfig,
): Promise<DetectMaterialDuplicatesResponse> {
  const { data } = await getApiClient().post<{ data: DetectMaterialDuplicatesResponse }>(
    MATERIALS_PATHS.DETECT_DUPLICATES,
    { candidates },
    config,
  );
  return data.data;
}

/** List pending material change requests (Super-Admin Pending tab edit-diff cards). */
export async function getMaterialChangeRequests(
  params?: { status?: string },
  config?: AxiosRequestConfig,
): Promise<MaterialChangeRequestDto[]> {
  const { data } = await getApiClient().get<{ data: MaterialChangeRequestDto[] }>(
    MATERIALS_PATHS.CHANGE_REQUESTS,
    { params, ...config },
  );
  return data.data;
}

/** Approve a pending change request — applies the diff to the live material. */
export async function approveMaterialChangeRequest(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MaterialChangeRequestDto> {
  const { data } = await getApiClient().patch<{ data: MaterialChangeRequestDto }>(
    MATERIALS_PATHS.changeRequestApprove(id),
    undefined,
    config,
  );
  return data.data;
}

/** Reject a pending change request — discards it (material stays untouched). */
export async function rejectMaterialChangeRequest(
  id: string,
  input?: { reason?: string },
  config?: AxiosRequestConfig,
): Promise<MaterialChangeRequestDto> {
  const { data } = await getApiClient().patch<{ data: MaterialChangeRequestDto }>(
    MATERIALS_PATHS.changeRequestReject(id),
    input ?? {},
    config,
  );
  return data.data;
}

// ── Favourites (US 4.03) ──────────────────────────────────────────────────────

/** Add a material to the current user's favourites (PUT — idempotent). */
export async function favouriteMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ success: true }> {
  const { data } = await getApiClient().put<{ data: { success: true } }>(
    MATERIALS_PATHS.favourite(id),
    undefined,
    config,
  );
  return data.data;
}

/** Remove a material from the current user's favourites (DELETE — no-op safe). */
export async function unfavouriteMaterial(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ success: true }> {
  const { data } = await getApiClient().delete<{ data: { success: true } }>(
    MATERIALS_PATHS.favourite(id),
    config,
  );
  return data.data;
}
