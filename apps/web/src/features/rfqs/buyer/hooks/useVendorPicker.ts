import type { ResolvedVendor, VendorListItem } from '@forethread/api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { VendorSelection } from '../components/create/SelectVendorsCard';
import { useAssignedVendors, useResolveVendorSelection } from '../services/rfqs.service';

/**
 * Backs the RFQ vendor picker (ADR-0018).
 *
 * Search and Vendor Category are applied **server-side**: the picker only ever
 * holds one page, so filtering in the browser would quietly reduce "every
 * Electrical vendor" to "every Electrical vendor among the 100 most recently
 * added", and would only offer categories that page happened to contain.
 *
 * "Add All" therefore cannot be a loop over the rendered rows — it resolves
 * through its own unpaginated endpoint, which also drops deactivated reps, so
 * bulk selection can never reach a recipient a single selection could not.
 */
export function useVendorPicker(
  selection: VendorSelection,
  onChange: (next: VendorSelection) => void,
) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data: vendors = [], isLoading } = useAssignedVendors({
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  });

  const resolve = useResolveVendorSelection();

  /**
   * Every vendor this session has seen, across filters and Add-All results.
   * The Selected panel reads it so a vendor stays rendered after the filter
   * that surfaced it is cleared — otherwise selecting 12 Electrical vendors and
   * switching to Plumbing would blank the panel while the selection lived on.
   */
  const directoryRef = useRef(new Map<string, ResolvedVendor>());
  const [directoryVersion, setDirectoryVersion] = useState(0);

  const remember = useCallback((entries: ResolvedVendor[]) => {
    let changed = false;
    for (const entry of entries) {
      if (!directoryRef.current.has(entry.companyId)) changed = true;
      directoryRef.current.set(entry.companyId, entry);
    }
    if (changed) setDirectoryVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (vendors.length === 0) return;
    remember(vendors.map(toResolved));
  }, [vendors, remember]);

  const extraSelected = useMemo(() => {
    void directoryVersion; // recompute when the directory grows
    return [...directoryRef.current.values()];
  }, [directoryVersion]);

  const addAll = useCallback(() => {
    resolve.mutate(
      {
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      },
      {
        onSuccess: ({ vendors: matched }) => {
          remember(matched);
          const vendorIds = new Set(selection.vendorIds);
          const repIds = new Set(selection.repIds);
          for (const vendor of matched) {
            vendorIds.add(vendor.companyId);
            for (const rep of vendor.reps) repIds.add(rep.id);
          }
          onChange({ vendorIds: [...vendorIds], repIds: [...repIds] });
        },
      },
    );
  }, [resolve, categoryFilter, debouncedSearch, selection, onChange, remember]);

  return {
    vendors,
    isLoading,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    addAll,
    isAddingAll: resolve.isPending,
    extraSelected,
  };
}

/**
 * Render a resolved vendor as a list row. Used for vendors that are selected
 * but absent from the loaded page — matched by Add All beyond it, or hidden by
 * the active filter.
 *
 * The reps are carried through so the Selected panel can NAME them. Dropping
 * them made a selected-but-off-page vendor render as "All contacts (company
 * email)" while specific reps were in fact selected — the summary quietly
 * misdescribing who the RFQ would reach.
 */
export function resolvedToListItem(vendor: ResolvedVendor): VendorListItem {
  return {
    id: vendor.companyId,
    userId: null,
    companyId: vendor.companyId,
    companyName: vendor.companyName,
    companyEmail: vendor.companyEmail,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    status: 'INVITED',
    assignedAt: '',
    specialisations: vendor.specialisations,
    categories: vendor.categories,
    // Every rep here is sendable by construction — the resolver excludes
    // INACTIVE server-side.
    representatives: vendor.reps.map((rep) => ({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      phone: null,
      position: rep.position,
      status: 'INVITED' as const,
      createdAt: '',
    })),
  };
}

function toResolved(vendor: VendorListItem): ResolvedVendor {
  return {
    companyId: vendor.companyId,
    companyName: vendor.companyName,
    companyEmail: vendor.companyEmail,
    categories: vendor.categories,
    specialisations: vendor.specialisations,
    reps: (vendor.representatives ?? [])
      .filter((rep) => rep.status !== 'INACTIVE')
      .map((rep) => ({
        id: rep.id,
        name: rep.name,
        email: rep.email,
        position: rep.position,
      })),
  };
}
