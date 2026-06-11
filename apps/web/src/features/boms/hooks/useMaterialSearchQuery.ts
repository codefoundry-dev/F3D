import { getMaterials, queryKeys } from '@forethread/api-client';
import type { MaterialItem } from '@forethread/ui-components';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/**
 * Debounced catalogue search for the BOM match popup. Returns rows mapped to
 * the MaterialSearchPanel item shape plus the total result count for the
 * "{n} results" header.
 */
export function useMaterialSearchQuery(search: string): {
  results: MaterialItem[];
  totalCount: number;
  isLoading: boolean;
} {
  const [debounced, setDebounced] = useState(search);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.materials.list({ search: debounced, limit: PAGE_SIZE, context: 'bom' }),
    queryFn: () => getMaterials({ search: debounced || undefined, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const results: MaterialItem[] = (data?.items ?? []).map((material) => ({
    id: material.id,
    name: material.name,
    category: material.categoryName ?? undefined,
    unit: material.unitOfMeasure,
    description: material.description ?? undefined,
    imageUrl: material.imageUrl ?? undefined,
  }));

  return { results, totalCount: data?.meta?.total ?? results.length, isLoading };
}
