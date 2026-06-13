import {
  favouriteMaterial,
  type PaginatedMaterialsResponse,
  queryKeys,
  unfavouriteMaterial,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

/** Pull a human message off an axios error, falling back to a translated default. */
function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const message = data?.message;
    if (Array.isArray(message)) return message[0] ?? fallback;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/** Optimistically flip `isFavourite` for a material across every cached list page. */
function patchListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  isFavourite: boolean,
) {
  queryClient.setQueriesData<PaginatedMaterialsResponse>(
    { queryKey: queryKeys.materials.all() },
    (current) => {
      if (!current || !Array.isArray(current.items)) return current;
      let changed = false;
      const items = current.items.map((m) => {
        if (m.id !== id || m.isFavourite === isFavourite) return m;
        changed = true;
        return { ...m, isFavourite };
      });
      return changed ? { ...current, items } : current;
    },
  );
}

/**
 * Favourite / unfavourite a material (US 4.03). The star toggles optimistically
 * across all cached materials list pages (Public + Favourite tabs) and rolls
 * back on error. On settle we invalidate the materials cache so the Favourite
 * tab and the detail query reconcile with the server.
 */
export function useMaterialFavouriteMutations() {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  const reconcile = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(id) });
  };

  const favourite = useMutation({
    mutationFn: (id: string) => favouriteMaterial(id, { skipErrorHandler: true }),
    onMutate: (id: string) => {
      patchListCaches(queryClient, id, true);
    },
    onError: (error, id) => {
      patchListCaches(queryClient, id, false);
      toast.error(errorMessage(error, t('favourites.toasts.addFailed')));
    },
    onSettled: (_data, _err, id) => reconcile(id),
  });

  const unfavourite = useMutation({
    mutationFn: (id: string) => unfavouriteMaterial(id, { skipErrorHandler: true }),
    onMutate: (id: string) => {
      patchListCaches(queryClient, id, false);
    },
    onError: (error, id) => {
      patchListCaches(queryClient, id, true);
      toast.error(errorMessage(error, t('favourites.toasts.removeFailed')));
    },
    onSettled: (_data, _err, id) => reconcile(id),
  });

  /** Toggle based on the material's current favourite state. */
  const toggle = (id: string, isFavourite: boolean) => {
    if (isFavourite) unfavourite.mutate(id);
    else favourite.mutate(id);
  };

  return { favourite, unfavourite, toggle };
}
