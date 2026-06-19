import {
  getMaterialSuggestions,
  type MaterialListItemDto,
  type MaterialSuggestionDto,
  type MaterialSuggestionsResponse,
  queryKeys,
} from '@forethread/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

/** localStorage key for the user's recently-opened materials (US 4.04). */
const RECENT_MATERIALS_KEY = 'mc:recentMaterials';
const RECENT_MATERIALS_LIMIT = 5;

const EMPTY_SUGGESTIONS: MaterialSuggestionsResponse = {
  results: [],
  frequentlyUsed: [],
  recentlyUsed: [],
};

/**
 * Grouped autocomplete suggestions for the catalogue search dropdown (US 4.04).
 * Wraps GET /v1/materials/suggestions, which returns three groups (`results`,
 * `frequentlyUsed`, `recentlyUsed`). Only fires once the (already-debounced)
 * query is non-empty so an empty / closed search never hits the network.
 */
export function useMaterialSearchSuggestions(
  search: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<MaterialSuggestionsResponse> {
  const term = search.trim();
  return useQuery<MaterialSuggestionsResponse>({
    queryKey: [...queryKeys.materials.all(), 'suggestions', term],
    queryFn: () => getMaterialSuggestions({ q: term }),
    enabled: (options.enabled ?? true) && term.length > 0,
    staleTime: 30 * 1000,
  });
}

/** Shape persisted in localStorage for a recently-opened material. */
export type RecentMaterial = MaterialSuggestionDto;

function toSuggestion(
  material: MaterialListItemDto | MaterialSuggestionDto,
): MaterialSuggestionDto {
  return {
    id: material.id,
    name: material.name,
    categoryName: material.categoryName ?? null,
    uom: material.uom ?? null,
    description: material.description ?? null,
    imageUrl: material.imageUrl ?? null,
  };
}

function readRecent(): RecentMaterial[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_MATERIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Defensively keep only entries that look like a material record.
    return parsed
      .filter(
        (m): m is RecentMaterial => Boolean(m) && typeof (m as RecentMaterial).id === 'string',
      )
      .slice(0, RECENT_MATERIALS_LIMIT);
  } catch {
    return [];
  }
}

/**
 * The last few materials the user opened from the search dropdown (US 4.04),
 * persisted in localStorage so the "Recently used" group survives reloads and
 * works even before the backend has any usage history. Returns the list plus a
 * `record` callback to push the most-recently-opened material to the front
 * (de-duplicated, capped at five).
 */
export function useRecentMaterials(): {
  recent: RecentMaterial[];
  record: (material: MaterialListItemDto | MaterialSuggestionDto) => void;
} {
  const [recent, setRecent] = useState<RecentMaterial[]>(() => readRecent());

  // Keep multiple mounts / tabs in sync when localStorage changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_MATERIALS_KEY) setRecent(readRecent());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const record = useCallback((material: MaterialListItemDto | MaterialSuggestionDto) => {
    const entry = toSuggestion(material);
    setRecent((prev) => {
      const next = [entry, ...prev.filter((m) => m.id !== entry.id)].slice(
        0,
        RECENT_MATERIALS_LIMIT,
      );
      try {
        window.localStorage.setItem(RECENT_MATERIALS_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota / privacy-mode failures — the in-memory list still works.
      }
      return next;
    });
  }, []);

  return { recent, record };
}

/**
 * "Frequently used" materials for the search dropdown (US 4.04).
 *
 * The backend now returns a `frequentlyUsed` group on the suggestions endpoint,
 * so this is a thin selector over that response. Kept as its own hook (the
 * "frequently used" seam) so the source can be swapped without touching the
 * dropdown — e.g. point it at a dedicated endpoint or a richer usage signal.
 *
 * TODO(US4.04): if/when GET /materials grows a richer grouped-suggestions
 * feed (per-company usage ranking), swap the body to read from it here.
 */
export function useFrequentlyUsedMaterials(suggestions: MaterialSuggestionsResponse | undefined): {
  data: MaterialSuggestionDto[];
} {
  return { data: (suggestions ?? EMPTY_SUGGESTIONS).frequentlyUsed };
}
