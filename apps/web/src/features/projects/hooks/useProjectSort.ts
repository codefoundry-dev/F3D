import { useState, useCallback } from 'react';

export function useProjectSort(defaultField = 'createdAt', defaultDir: 'asc' | 'desc' = 'desc') {
  const [sortBy, setSortBy] = useState(defaultField);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const handleSort = useCallback(
    (field: string) => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDir('asc');
      }
    },
    [sortBy],
  );

  return { sortBy, sortDir, setSortBy, setSortDir, handleSort };
}
