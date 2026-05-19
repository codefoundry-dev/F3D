import type { ProjectDetail, VendorAssignment } from '@forethread/api-client';
import { useMemo } from 'react';

interface UsePoDropdownOptionsParams {
  projectsData?: { items: { id: string; name: string }[] };
  vendorsData?: VendorAssignment[];
  projectDetail?: ProjectDetail | null;
}

export function usePoDropdownOptions({
  projectsData,
  vendorsData,
  projectDetail,
}: UsePoDropdownOptionsParams) {
  const deliveryLocations = useMemo(
    () => projectDetail?.locations?.filter((l) => l.type === 'DELIVERY') ?? [],
    [projectDetail],
  );

  const projectOptions = useMemo(
    () => projectsData?.items.map((p) => ({ value: p.id, label: p.name })) ?? [],
    [projectsData],
  );

  const vendorOptions = useMemo(
    () =>
      vendorsData?.map((v) => ({
        value: v.id,
        label: v.legalName ?? v.tradeName ?? v.id,
      })) ?? [],
    [vendorsData],
  );

  const locationOptions = useMemo(
    () => deliveryLocations.map((l) => ({ value: l.id, label: l.label ?? l.address })),
    [deliveryLocations],
  );

  return { projectOptions, vendorOptions, locationOptions };
}
