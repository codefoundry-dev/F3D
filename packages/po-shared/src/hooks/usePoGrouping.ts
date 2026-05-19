import type { PoListItem } from '@forethread/api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePoGrouping(
  items: PoListItem[],
  groupBy: string,
  groupFieldMap: Record<string, keyof PoListItem>,
) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupedItems = useMemo(() => {
    const field = groupFieldMap[groupBy];
    if (!field) return null;
    const groups = new Map<string, PoListItem[]>();
    for (const item of items) {
      const key = String(item[field] ?? '-');
      const arr = groups.get(key);
      if (arr) arr.push(item);
      else groups.set(key, [item]);
    }
    return groups;
  }, [items, groupBy, groupFieldMap]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);

  return { groupedItems, expandedGroups, toggleGroup };
}
