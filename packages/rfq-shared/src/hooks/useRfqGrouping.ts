import type { RfqListItem } from '@forethread/api-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useRfqGrouping(
  items: RfqListItem[],
  groupBy: string,
  groupFieldMap: Record<string, keyof RfqListItem>,
) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupedItems = useMemo(() => {
    const field = groupFieldMap[groupBy];
    if (!field) return null;
    const groups = new Map<string, RfqListItem[]>();
    for (const item of items) {
      const key = String(item[field] ?? '-');
      const arr = groups.get(key);
      if (arr) {
        arr.push(item);
      } else {
        groups.set(key, [item]);
      }
    }
    return groups;
  }, [items, groupBy, groupFieldMap]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Reset all groups to collapsed when grouping changes
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupBy]);

  return { groupedItems, expandedGroups, toggleGroup };
}
