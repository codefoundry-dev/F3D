import type { MaterialItem, SelectedMaterial, MaterialFilters } from '@forethread/ui-components';
import { useCallback, useState } from 'react';

const EMPTY_FILTERS: MaterialFilters = {
  category: '',
  manufacturer: '',
  materialType: '',
  unitOfMeasurement: '',
  countryOfOrigin: '',
  colour: '',
};

export function useMaterialSearch() {
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedMaterial[]>([]);
  const [filters, setFilters] = useState<MaterialFilters>(EMPTY_FILTERS);

  // TODO: Replace with actual API call when Material Catalogue is implemented (Epic 4)
  const results: MaterialItem[] = [];

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
