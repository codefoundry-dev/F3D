import { useState, useCallback } from 'react';

/**
 * Shared state management for item selection modals
 * (ApprovedQuotesModal, BulkOrdersModal).
 *
 * Handles: search, item search, selection toggle, filter, back/close.
 */
export function useItemSelectionModal() {
  const [search, setSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterUom, setFilterUom] = useState('');

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const initSelectedItems = useCallback((ids: Set<string>) => {
    setSelectedItems(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const resetDetail = useCallback(() => {
    setItemSearch('');
    setSelectedItems(new Set());
    setShowFilters(false);
    setFilterUom('');
  }, []);

  const resetAll = useCallback(() => {
    setSearch('');
    resetDetail();
  }, [resetDetail]);

  return {
    search,
    setSearch,
    itemSearch,
    setItemSearch,
    selectedItems,
    toggleItem,
    showFilters,
    setShowFilters,
    toggleFilters: useCallback(() => setShowFilters((p) => !p), []),
    filterUom,
    setFilterUom,
    initSelectedItems,
    clearSelection,
    resetDetail,
    resetAll,
  };
}
