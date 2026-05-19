import type { SortDirection } from '@forethread/ui-components';
import { useCallback } from 'react';

interface UseRfqSortOptions {
  sortBy: string;
  sortDir: SortDirection;
  setSortBy: (field: string) => void;
  setSortDir: (dir: SortDirection) => void;
  setPage: (page: number) => void;
}

/**
 * Sort cycling: unsorted -> asc -> desc -> unsorted.
 * Sorting is performed server-side — this hook only manages the sort params
 * that are sent to the backend via useRfqs query.
 */
export function useRfqSort({ sortBy, sortDir, setSortBy, setSortDir, setPage }: UseRfqSortOptions) {
  const handleSort = useCallback(
    (field: string) => {
      if (sortBy !== field) {
        setSortBy(field);
        setSortDir('asc');
      } else if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortBy('');
        setSortDir(null);
      }
      setPage(1);
    },
    [sortBy, sortDir, setSortBy, setSortDir, setPage],
  );

  return { handleSort };
}
