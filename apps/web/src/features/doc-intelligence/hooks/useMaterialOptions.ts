import { getMaterials, queryKeys } from '@forethread/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface MaterialOption {
  value: string;
  label: string;
}

const PARAMS = { status: 'PUBLIC', limit: 500 } as const;

/**
 * Loads the PUBLIC material catalogue as `{ value, label }` options for the
 * manual catalogue-match picker in the BOM review table. Mirrors the backend
 * matcher, which scores against PUBLIC materials. Cached for a few minutes and
 * only fetched when `enabled` (i.e. the user is editing a BOM extraction).
 */
export function useMaterialOptions(enabled = true): UseQueryResult<MaterialOption[]> {
  return useQuery<MaterialOption[]>({
    queryKey: queryKeys.materials.list(PARAMS),
    queryFn: async () => {
      const result = await getMaterials(PARAMS);
      return result.items.map((material) => ({ value: material.id, label: material.name }));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
