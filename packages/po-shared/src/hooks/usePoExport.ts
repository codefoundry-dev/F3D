import { exportPurchaseOrders } from '@forethread/api-client';
import type { SortDirection } from '@forethread/ui-components';
import { useCallback, useMemo } from 'react';

interface UsePoExportOptions {
  search: string;
  quickFilter: string;
  sortBy: string;
  sortDir: SortDirection;
  visibleColumns: string[];
  columnOrder: string[];
}

export function usePoExport({
  search,
  quickFilter,
  sortBy,
  sortDir,
  visibleColumns,
  columnOrder,
}: UsePoExportOptions) {
  /** Columns in display order, filtered to only visible ones */
  const orderedColumns = useMemo(() => {
    const visible = new Set(visibleColumns);
    return columnOrder.filter((c) => visible.has(c));
  }, [visibleColumns, columnOrder]);

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx') => {
      void exportPurchaseOrders(format, {
        search: search || undefined,
        quickFilter: quickFilter || undefined,
        sortBy: sortBy || undefined,
        sortDir: sortBy && sortDir ? sortDir : undefined,
        columns: orderedColumns.length ? orderedColumns.join(',') : undefined,
      }).then(({ url }) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        a.click();
      });
    },
    [search, quickFilter, sortBy, sortDir, orderedColumns],
  );

  return { handleExport };
}
