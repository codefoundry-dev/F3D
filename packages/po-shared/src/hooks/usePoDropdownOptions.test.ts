import type { ProjectDetail } from '@forethread/api-client';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { usePoDropdownOptions } from './usePoDropdownOptions';

function makeProjectDetail(
  locations: { id: string; type: string; address: string; label?: string }[],
): ProjectDetail {
  return { locations } as unknown as ProjectDetail;
}

describe('usePoDropdownOptions', () => {
  it('maps DELIVERY locations and ignores STORAGE ones', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectDetail: makeProjectDetail([
          { id: 'loc-1', type: 'DELIVERY', address: '1 Main St', label: 'Site A' },
          { id: 'loc-2', type: 'STORAGE', address: '2 Depot Rd', label: 'Yard' },
        ]),
      }),
    );

    expect(result.current.locationOptions).toEqual([{ value: 'loc-1', label: 'Site A' }]);
  });

  it('falls back to the address when a location has no label', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectDetail: makeProjectDetail([{ id: 'loc-1', type: 'DELIVERY', address: '1 Main St' }]),
      }),
    );

    expect(result.current.locationOptions).toEqual([{ value: 'loc-1', label: '1 Main St' }]);
  });

  // A prefilled change-request field must still render its label when the value
  // is outside the fetched list — otherwise it reads as empty and the user
  // "refills" data the PO already has.
  it('appends a fallback location the project list does not contain', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectDetail: makeProjectDetail([
          { id: 'loc-1', type: 'DELIVERY', address: '1 Main St', label: 'Site A' },
        ]),
        extraLocations: [{ id: 'loc-removed', name: 'Old Depot' }],
      }),
    );

    expect(result.current.locationOptions).toEqual([
      { value: 'loc-1', label: 'Site A' },
      { value: 'loc-removed', label: 'Old Depot' },
    ]);
  });

  it('supplies fallback locations while the project detail is still loading', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectDetail: undefined,
        extraLocations: [{ id: 'loc-1', name: 'Site A' }],
      }),
    );

    expect(result.current.locationOptions).toEqual([{ value: 'loc-1', label: 'Site A' }]);
  });

  it('does not duplicate a fallback already present in the project list', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectDetail: makeProjectDetail([
          { id: 'loc-1', type: 'DELIVERY', address: '1 Main St', label: 'Site A' },
        ]),
        extraLocations: [{ id: 'loc-1', name: 'Site A (stale name)' }],
      }),
    );

    expect(result.current.locationOptions).toEqual([{ value: 'loc-1', label: 'Site A' }]);
  });

  it('drops fallbacks with no id or no name rather than showing a bare uuid', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectDetail: makeProjectDetail([]),
        extraLocations: [
          { id: null, name: 'Nowhere' },
          { id: 'loc-unnamed', name: null },
        ],
      }),
    );

    expect(result.current.locationOptions).toEqual([]);
  });

  it('appends a fallback project outside the paginated project list', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        projectsData: { items: [{ id: 'p-1', name: 'Project One' }] },
        extraProjects: [{ id: 'p-101', name: 'Project One Hundred And One' }],
      }),
    );

    expect(result.current.projectOptions).toEqual([
      { value: 'p-1', label: 'Project One' },
      { value: 'p-101', label: 'Project One Hundred And One' },
    ]);
  });

  it('appends a fallback vendor the assignment list does not contain', () => {
    const { result } = renderHook(() =>
      usePoDropdownOptions({
        vendorsData: [],
        extraVendors: [{ id: 'v-1', name: 'Acme' }],
      }),
    );

    expect(result.current.vendorOptions).toEqual([{ value: 'v-1', label: 'Acme' }]);
  });
});
