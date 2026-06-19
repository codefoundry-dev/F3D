import { getMaterials, queryKeys } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

/** Distinct, sorted facet option lists derived from the PUBLIC catalogue. */
export interface MaterialFacets {
  manufacturers: string[];
  uoms: string[];
  materialTypes: string[];
  countriesOfOrigin: string[];
}

const EMPTY_FACETS: MaterialFacets = {
  manufacturers: [],
  uoms: [],
  materialTypes: [],
  countriesOfOrigin: [],
};

/** Trim, drop blanks, de-duplicate (case-insensitively) and sort a value list. */
function distinctSorted(values: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Derives the catalogue filter facets (manufacturer / UoM / material type /
 * country of origin) so those filters can render as dropdowns instead of
 * free-text inputs (US 4.04). Fetches a single wide page of the PUBLIC catalogue
 * (the backend has no dedicated facets endpoint yet) and reduces it to distinct
 * sorted option lists. Cached for a few minutes since facets change rarely.
 */
export function useMaterialFacets(): {
  facets: MaterialFacets;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: [...queryKeys.materials.all(), 'facets'],
    queryFn: () => getMaterials({ status: 'PUBLIC', limit: 200 }),
    staleTime: 5 * 60 * 1000,
    select: (response): MaterialFacets => {
      const items = response.items ?? [];
      return {
        manufacturers: distinctSorted(items.map((m) => m.manufacturer)),
        uoms: distinctSorted(items.map((m) => m.uom)),
        materialTypes: distinctSorted(items.map((m) => m.materialType)),
        countriesOfOrigin: distinctSorted(items.map((m) => m.countryOfOrigin)),
      };
    },
  });

  return { facets: query.data ?? EMPTY_FACETS, isLoading: query.isLoading };
}
