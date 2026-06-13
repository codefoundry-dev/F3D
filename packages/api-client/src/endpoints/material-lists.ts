import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { MATERIAL_LISTS_PATHS } from './paths';

// ── Response interfaces (mirror shared-types material-list.dto.ts) ──────────

/** Row in GET /v1/material-lists. */
export interface MaterialListSummaryDto {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  updatedAt: string;
}

/** The catalogue material carried by a material-list item. */
export interface MaterialListMaterialDto {
  id: string;
  name: string;
  uom: string;
  manufacturer: string | null;
  description: string | null;
  // Catalogue columns surfaced for the US 4.03 single-list table.
  status: 'PUBLIC' | 'PENDING_APPROVAL' | 'ARCHIVED';
  materialType: string | null;
  upc: string | null;
  pricePerUnit: string | null;
  currency: string;
  imageUrl: string | null;
  updatedAt: string;
  category: { id: string; name: string };
}

/** One material + quantity entry of a material list. */
export interface MaterialListEntryDto {
  id: string;
  quantity: number;
  material: MaterialListMaterialDto;
}

/** Detail returned by GET /v1/material-lists/:id. */
export interface MaterialListDetailDto {
  id: string;
  name: string;
  description: string | null;
  items: MaterialListEntryDto[];
}

export interface MaterialListsParams {
  search?: string;
}

// ── Request interfaces (US 4.03) ──────────────────────────────────────────────

export interface CreateMaterialListInput {
  name: string;
  description?: string;
}

export interface UpdateMaterialListInput {
  name?: string;
  description?: string;
}

// ── Endpoint functions ───────────────────────────────────────────────────────

export async function getMaterialLists(
  params?: MaterialListsParams,
  config?: AxiosRequestConfig,
): Promise<MaterialListSummaryDto[]> {
  const { data } = await getApiClient().get<{ data: MaterialListSummaryDto[] }>(
    MATERIAL_LISTS_PATHS.ROOT,
    { params, ...config },
  );
  return data.data;
}

export async function getMaterialList(
  id: string,
  config?: AxiosRequestConfig,
): Promise<MaterialListDetailDto> {
  const { data } = await getApiClient().get<{ data: MaterialListDetailDto }>(
    MATERIAL_LISTS_PATHS.byId(id),
    config,
  );
  return data.data;
}

/** Create a material list (US 4.03). */
export async function createMaterialList(
  input: CreateMaterialListInput,
  config?: AxiosRequestConfig,
): Promise<MaterialListSummaryDto> {
  const { data } = await getApiClient().post<{ data: MaterialListSummaryDto }>(
    MATERIAL_LISTS_PATHS.ROOT,
    input,
    config,
  );
  return data.data;
}

/** Update a material list's name / description (US 4.03). */
export async function updateMaterialList(
  id: string,
  input: UpdateMaterialListInput,
  config?: AxiosRequestConfig,
): Promise<MaterialListSummaryDto> {
  const { data } = await getApiClient().patch<{ data: MaterialListSummaryDto }>(
    MATERIAL_LISTS_PATHS.byId(id),
    input,
    config,
  );
  return data.data;
}

/** Delete a material list (US 4.03). */
export async function deleteMaterialList(
  id: string,
  config?: AxiosRequestConfig,
): Promise<{ success: true }> {
  const { data } = await getApiClient().delete<{ data: { success: true } }>(
    MATERIAL_LISTS_PATHS.byId(id),
    config,
  );
  return data.data;
}

/** Add catalogue materials to a list; returns the updated list detail (US 4.03). */
export async function addMaterialListItems(
  id: string,
  materialIds: string[],
  config?: AxiosRequestConfig,
): Promise<MaterialListDetailDto> {
  const { data } = await getApiClient().post<{ data: MaterialListDetailDto }>(
    MATERIAL_LISTS_PATHS.items(id),
    { materialIds },
    config,
  );
  return data.data;
}

/** Remove an item from a list; returns the updated list detail (US 4.03). */
export async function removeMaterialListItem(
  id: string,
  itemId: string,
  config?: AxiosRequestConfig,
): Promise<MaterialListDetailDto> {
  const { data } = await getApiClient().delete<{ data: MaterialListDetailDto }>(
    MATERIAL_LISTS_PATHS.item(id, itemId),
    config,
  );
  return data.data;
}
