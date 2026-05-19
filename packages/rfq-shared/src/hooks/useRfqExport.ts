import { exportRfqs } from '@forethread/api-client';
import type { SortDirection } from '@forethread/ui-components';
import { useCallback, useMemo } from 'react';

interface UseRfqExportOptions {
  search: string;
  quickFilter: string;
  sortBy: string;
  sortDir: SortDirection;
  visibleColumns: string[];
  columnOrder: string[];
}

export function useRfqExport({
  search,
  quickFilter,
  sortBy,
  sortDir,
  visibleColumns,
  columnOrder,
}: UseRfqExportOptions) {
  const orderedColumns = useMemo(() => {
    const visible = new Set(visibleColumns);
    return columnOrder.filter((c) => visible.has(c));
  }, [visibleColumns, columnOrder]);

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx') => {
      void exportRfqs(format, {
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
