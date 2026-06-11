import {
  getMaterialCategories,
  getMaterials,
  type MaterialCategoryDto,
  type MaterialListQueryParams,
  type PaginatedMaterialsResponse,
  queryKeys,
} from '@forethread/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

/**
 * Lists the material catalogue (GET /v1/materials) with search, status tab,
 * facet filters, and pagination (US 4.01). Thin wrapper around the materials
 * endpoint so the catalogue page does not re-implement the query plumbing.
 * `keepPreviousData` avoids a flash of empty rows while paging / searching /
 * switching tabs.
 */
export function useMaterials(
  params: MaterialListQueryParams,
): UseQueryResult<PaginatedMaterialsResponse> {
  return useQuery<PaginatedMaterialsResponse>({
    queryKey: queryKeys.materials.list(params as Record<string, unknown>),
    queryFn: () => getMaterials(params),
    placeholderData: keepPreviousData,
  });
}

/** Categories for the "All categories" filter dropdown (GET /v1/materials/categories). */
export function useMaterialCategories(): UseQueryResult<MaterialCategoryDto[]> {
  return useQuery<MaterialCategoryDto[]>({
    queryKey: [...queryKeys.materials.all(), 'categories'],
    queryFn: () => getMaterialCategories(),
    staleTime: 5 * 60 * 1000,
  });
}
