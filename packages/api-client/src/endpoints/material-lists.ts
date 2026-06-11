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
