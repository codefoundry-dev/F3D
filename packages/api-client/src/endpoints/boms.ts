import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { BOMS_PATHS } from './paths';

// ── Request interfaces ───────────────────────────────────────────────────────

export interface CreateBomItemInput {
  materialName: string;
  matchedMaterialId: string;
  description?: string;
  uom?: string;
  quantity?: number;
  category?: string;
  materialType?: string;
  matchConfidence?: number;
  sortOrder?: number;
}

export interface CreateBomInput {
  projectId: string;
  /** Source doc-intelligence extraction the BOM was reviewed from. */
  extractionId?: string;
  items: CreateBomItemInput[];
}

export interface UpdateBomInput {
  /**
   * Replacement line items for the BOM. The full set is replaced IN PLACE
   * (existing lines deleted, these recreated) — editing a BOM does NOT create a
   * new version / does not supersede. An empty array clears all lines.
   */
  items: CreateBomItemInput[];
}

// ── Response interfaces (mirror apps/backend boms.mapper.ts) ─────────────────

export type BomStatusValue = 'ACTIVE' | 'SUPERSEDED';

export interface BomItemDto {
  id: string;
  materialName: string;
  matchedMaterialId: string;
  matchedMaterialName: string | null;
  description: string | null;
  uom: string | null;
  quantity: number | null;
  category: string | null;
  materialType: string | null;
  matchConfidence: number | null;
  sortOrder: number;
}

export interface BomListItemDto {
  id: string;
  bomNumber: string;
  projectId: string;
  status: BomStatusValue;
  extractionId: string | null;
  itemCount: number;
  matchedCount: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface BomDetailDto extends BomListItemDto {
  items: BomItemDto[];
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function createBom(
  input: CreateBomInput,
  config?: AxiosRequestConfig,
): Promise<BomDetailDto> {
  const { data } = await getApiClient().post<{ data: BomDetailDto }>(
    BOMS_PATHS.ROOT,
    input,
    config,
  );
  return data.data;
}

export async function getBoms(
  projectId?: string,
  config?: AxiosRequestConfig,
): Promise<BomListItemDto[]> {
  const { data } = await getApiClient().get<{ data: BomListItemDto[] }>(BOMS_PATHS.ROOT, {
    params: projectId ? { projectId } : undefined,
    ...config,
  });
  return data.data;
}

export async function getBom(id: string, config?: AxiosRequestConfig): Promise<BomDetailDto> {
  const { data } = await getApiClient().get<{ data: BomDetailDto }>(BOMS_PATHS.byId(id), config);
  return data.data;
}

/**
 * Edit an existing BOM's line items in place (US 4.04). Replaces the whole
 * line-item set; does NOT create a new BOM version. Returns the updated BOM in
 * the same shape as {@link getBom}.
 */
export async function updateBom(
  id: string,
  input: UpdateBomInput,
  config?: AxiosRequestConfig,
): Promise<BomDetailDto> {
  const { data } = await getApiClient().patch<{ data: BomDetailDto }>(
    BOMS_PATHS.byId(id),
    input,
    config,
  );
  return data.data;
}
