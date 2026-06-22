import { getMaterialFacets, type MaterialFacetsDto, queryKeys } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

/** Distinct, sorted facet option lists derived from the visible catalogue. */
export type MaterialFacets = MaterialFacetsDto;

const EMPTY_FACETS: MaterialFacets = {
  manufacturers: [],
  uoms: [],
  materialTypes: [],
  countriesOfOrigin: [],
};

/**
 * Loads the catalogue filter facets (manufacturer / UoM / material type /
 * country of origin) so those filters can render as dropdowns instead of
 * free-text inputs (US 4.04). Backed by the dedicated `/materials/facets`
 * endpoint, which returns the DISTINCT values across the whole visible catalogue
 * — so every choice is offered, not just those on the first page of results.
 * Cached for a few minutes since facets change rarely.
 */
export function useMaterialFacets(): {
  facets: MaterialFacets;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: queryKeys.materials.facets(),
    queryFn: () => getMaterialFacets(),
    staleTime: 5 * 60 * 1000,
  });

  return { facets: query.data ?? EMPTY_FACETS, isLoading: query.isLoading };
}
