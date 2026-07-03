import { getMaterials } from '@forethread/api-client';
import type { MaterialItem, SelectedMaterial, MaterialFilters } from '@forethread/ui-components';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

const EMPTY_FILTERS: MaterialFilters = {
  category: '',
  manufacturer: '',
  materialType: '',
  unitOfMeasurement: '',
  countryOfOrigin: '',
  colour: '',
};

const SEARCH_DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 20;

/**
 * Catalogue search behind the PO wizard's material pickers. `externalQuery`
 * (when defined) takes over as the query text — the per-cell pickers own their
 * own input state, while the top-bar panel uses this hook's `search`.
 */
export function useMaterialSearch(externalQuery?: string) {
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedMaterial[]>([]);
  const [filters, setFilters] = useState<MaterialFilters>(EMPTY_FILTERS);

  const effectiveSearch = externalQuery ?? search;

  // Debounce the query text so we don't hit the API on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(effectiveSearch), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [effectiveSearch]);

  const { data } = useQuery({
    queryKey: ['materials', 'po-line-search', debouncedSearch, filters],
    queryFn: () =>
      getMaterials({
        search: debouncedSearch || undefined,
        limit: RESULTS_LIMIT,
        categoryId: filters.category || undefined,
        manufacturer: filters.manufacturer || undefined,
        materialType: filters.materialType || undefined,
        uom: filters.unitOfMeasurement || undefined,
        countryOfOrigin: filters.countryOfOrigin || undefined,
      }),
    enabled: debouncedSearch.length > 0,
    placeholderData: keepPreviousData,
  });

  // Carry the catalogue id + identity/accounting codes on each result so a pick
  // can link the line to the material and snapshot its codes (US: PO/RFQ lines
  // show Material Code / UPC / MPN / Cost & Tax codes).
  const results: MaterialItem[] = useMemo(
    () =>
      (data?.items ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.categoryName ?? undefined,
        subCategory: m.subCategory ?? undefined,
        unit: m.uom ?? m.unitOfMeasure,
        description: m.description ?? undefined,
        imageUrl: m.imageUrl ?? undefined,
        sku: m.sku,
        upc: m.upc,
        manufacturerPartNumber: m.manufacturerPartNumber,
        costCode: m.costCode,
        taxCode: m.taxCode,
      })),
    [data],
  );

  const handleSelect = useCallback((item: MaterialItem) => {
    setSelected((prev) => [...prev, { ...item, quantity: 1 }]);
  }, []);

  const handleDeselect = useCallback((itemId: string) => {
    setSelected((prev) => prev.filter((m) => m.id !== itemId));
  }, []);

  const handleQtyChange = useCallback((itemId: string, qty: number) => {
    setSelected((prev) => prev.map((m) => (m.id === itemId ? { ...m, quantity: qty } : m)));
  }, []);

  const reset = useCallback(() => {
    setSelected([]);
    setPanelOpen(false);
    setSearch('');
  }, []);

  return {
    search,
    setSearch,
    panelOpen,
    setPanelOpen,
    selected,
    setSelected,
    filters,
    setFilters,
    results,
    handleSelect,
    handleDeselect,
    handleQtyChange,
    reset,
  };
}
