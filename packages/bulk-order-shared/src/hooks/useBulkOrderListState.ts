import { useDebounce } from '@forethread/ui-components';
import { useMemo, useState } from 'react';

import { useBulkOrders } from '../services/bulk-orders.service';

import { useBulkOrderSort } from './useBulkOrderSort';

export function useBulkOrderListState(counterpartyType: 'vendor' | 'contractor' = 'vendor') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { sortBy, sortDir, handleSort: onSort } = useBulkOrderSort();
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [counterpartyFilter, setCounterpartyFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // API supports single-value filters; send first selected value to narrow results
  const { data, isLoading } = useBulkOrders({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    projectId: projectFilter.length > 0 ? projectFilter[0] : undefined,
    vendorId:
      counterpartyType === 'vendor' && counterpartyFilter.length > 0
        ? counterpartyFilter[0]
        : undefined,
    status: statusFilter.length > 0 ? statusFilter[0] : undefined,
    sortBy: sortBy || undefined,
    sortDir: sortBy ? sortDir : undefined,
  });

  // Client-side filtering for multi-select (API only supports single value)
  const rawItems = data?.items ?? [];
  const items = useMemo(() => {
    let filtered = rawItems;
    if (counterpartyFilter.length > 0) {
      const idSet = new Set(counterpartyFilter);
      const field = counterpartyType === 'contractor' ? 'companyId' : 'vendorId';
      filtered = filtered.filter((item) => idSet.has(item[field]));
    }
    if (projectFilter.length > 1) {
      const projectSet = new Set(projectFilter);
      filtered = filtered.filter((item) => projectSet.has(item.projectId));
    }
    return filtered;
  }, [rawItems, counterpartyFilter, counterpartyType, projectFilter]);
  const isClientFiltered =
    (counterpartyType === 'contractor' && counterpartyFilter.length > 0) ||
    counterpartyFilter.length > 1 ||
    projectFilter.length > 1;
  const totalCount = isClientFiltered ? items.length : (data?.meta.total ?? 0);

  const handleSort = (field: string) => {
    onSort(field);
    setPage(1);
  };

  const handleProjectFilterChange = (values: string[]) => {
    setProjectFilter(values);
    setPage(1);
  };

  const handleCounterpartyFilterChange = (values: string[]) => {
    setCounterpartyFilter(values);
    setPage(1);
  };

  const handleStatusFilterChange = (values: string[]) => {
    setStatusFilter(values);
    setPage(1);
  };

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    sortBy,
    sortDir,
    handleSort,
    projectFilter,
    handleProjectFilterChange,
    counterpartyFilter,
    handleCounterpartyFilterChange,
    statusFilter,
    handleStatusFilterChange,
    items,
    totalCount,
    isLoading,
  };
}
