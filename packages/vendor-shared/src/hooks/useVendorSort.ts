import { useCallback, useState } from 'react';

import type { SortDir, SortField } from '../constants';

export function useVendorSort() {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir | null>(null);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        if (sortDir === 'asc') {
          setSortDir('desc');
        } else {
          setSortField(null);
          setSortDir(null);
        }
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField, sortDir],
  );

  return { sortField, sortDir, handleSort };
}
