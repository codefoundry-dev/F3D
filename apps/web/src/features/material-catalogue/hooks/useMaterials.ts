import {
  getMaterials,
  type MaterialListQueryParams,
  type PaginatedMaterialsResponse,
  queryKeys,
} from '@forethread/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

/**
 * Lists the material catalogue (GET /v1/materials) with search + pagination
 * (FOR-228). Thin wrapper around the existing materials endpoint so the
 * catalogue page does not re-implement the query plumbing. `keepPreviousData`
 * avoids a flash of empty rows while paging / searching.
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
