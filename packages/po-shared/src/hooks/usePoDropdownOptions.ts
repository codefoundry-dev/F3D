import type { ProjectDetail, VendorAssignment } from '@forethread/api-client';
import { useMemo } from 'react';

/** An option a form value already references, supplied as a fallback. */
export interface PoDropdownFallback {
  id: string | null;
  name: string | null;
}

interface UsePoDropdownOptionsParams {
  projectsData?: { items: { id: string; name: string }[] };
  vendorsData?: VendorAssignment[];
  projectDetail?: ProjectDetail | null;
  /**
   * Options a form value already points at but that the fetched lists may not
   * contain — the project list is paginated (first 100 only), a delivery
   * location can be removed from the project or re-typed to STORAGE, and none of
   * the lists have resolved yet on first paint. `CustomDropdown` falls back to
   * its placeholder when no option matches its value, so a correctly prefilled
   * field reads as empty and invites the user to refill data that is already
   * set. Each list is appended after — and deduped against — the fetched one.
   */
  extraProjects?: PoDropdownFallback[];
  extraVendors?: PoDropdownFallback[];
  extraLocations?: PoDropdownFallback[];
}

/**
 * Merge fetched options with fallbacks, dropping unnamed ones — a bare uuid is a
 * worse label than the placeholder it would replace.
 */
function withFallbacks(
  options: { value: string; label: string }[],
  fallbacks: PoDropdownFallback[] | undefined,
): { value: string; label: string }[] {
  if (!fallbacks?.length) return options;
  const merged = [...options];
  const seen = new Set(merged.map((o) => o.value));
  for (const item of fallbacks) {
    if (!item.id || !item.name || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push({ value: item.id, label: item.name });
  }
  return merged;
}

export function usePoDropdownOptions({
  projectsData,
  vendorsData,
  projectDetail,
  extraProjects,
  extraVendors,
  extraLocations,
}: UsePoDropdownOptionsParams) {
  const deliveryLocations = useMemo(
    () => projectDetail?.locations?.filter((l) => l.type === 'DELIVERY') ?? [],
    [projectDetail],
  );

  const projectOptions = useMemo(
    () =>
      withFallbacks(
        projectsData?.items.map((p) => ({ value: p.id, label: p.name })) ?? [],
        extraProjects,
      ),
    [projectsData, extraProjects],
  );

  const vendorOptions = useMemo(
    () =>
      withFallbacks(
        vendorsData?.map((v) => ({
          value: v.id,
          label: v.legalName ?? v.tradeName ?? v.id,
        })) ?? [],
        extraVendors,
      ),
    [vendorsData, extraVendors],
  );

  const locationOptions = useMemo(
    () =>
      withFallbacks(
        deliveryLocations.map((l) => ({ value: l.id, label: l.label ?? l.address })),
        extraLocations,
      ),
    [deliveryLocations, extraLocations],
  );

  return { projectOptions, vendorOptions, locationOptions };
}
