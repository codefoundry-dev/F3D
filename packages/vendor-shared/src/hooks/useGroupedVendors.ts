import type { VendorListItem } from '@forethread/api-client';
import { useMemo } from 'react';

export interface VendorGroup {
  companyId: string;
  companyName: string;
  companyEmail: string | null;
  vendors: VendorListItem[];
}

function groupVendorsByCompany(items: VendorListItem[]): VendorGroup[] {
  const map = new Map<string, VendorGroup>();
  for (const item of items) {
    let group = map.get(item.companyId);
    if (!group) {
      group = {
        companyId: item.companyId,
        companyName: item.companyName,
        companyEmail: item.companyEmail,
        vendors: [],
      };
      map.set(item.companyId, group);
    }
    group.vendors.push(item);
  }
  return Array.from(map.values());
}

export function useGroupedVendors(items: VendorListItem[] | undefined, companyFilter: string[]) {
  const groups = useMemo(() => {
    if (!items) return [];
    return groupVendorsByCompany(items);
  }, [items]);

  const companyOptions = useMemo(() => {
    return groups.map((g) => ({ value: g.companyId, label: g.companyName }));
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (companyFilter.length === 0) return groups;
    return groups.filter((g) => companyFilter.includes(g.companyId));
  }, [groups, companyFilter]);

  return { groups, companyOptions, filteredGroups };
}
