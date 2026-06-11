import { getMaterial, type MaterialDetailDto, queryKeys } from '@forethread/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

/**
 * Loads a single material's full detail (GET /v1/materials/:id) for the
 * material detail page (US 4.01). Disabled until an id is present.
 */
export function useMaterial(id: string | undefined): UseQueryResult<MaterialDetailDto> {
  return useQuery<MaterialDetailDto>({
    queryKey: queryKeys.materials.detail(id ?? ''),
    queryFn: () => getMaterial(id as string),
    enabled: Boolean(id),
  });
}
