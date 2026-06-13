import {
  addMaterialListItems,
  createMaterialList,
  type CreateMaterialListInput,
  deleteMaterialList,
  getMaterialList,
  getMaterialLists,
  type MaterialListDetailDto,
  type MaterialListsParams,
  type MaterialListSummaryDto,
  queryKeys,
  removeMaterialListItem,
  updateMaterialList,
  type UpdateMaterialListInput,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
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

/**
 * Lists the current company's saved material lists (GET /v1/material-lists) for
 * the catalogue "Material list" tab and the add-to-list pickers (US 4.03).
 * Disabled until the caller is allowed to list them so non-list roles never
 * fire the request.
 */
export function useMaterialLists(
  params: MaterialListsParams = {},
  options: { enabled?: boolean } = {},
): UseQueryResult<MaterialListSummaryDto[]> {
  return useQuery<MaterialListSummaryDto[]>({
    queryKey: queryKeys.materialLists.list(params as Record<string, unknown>),
    queryFn: () => getMaterialLists(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Loads a single material list with its items (GET /v1/material-lists/:id). */
export function useMaterialList(id: string | undefined): UseQueryResult<MaterialListDetailDto> {
  return useQuery<MaterialListDetailDto>({
    queryKey: queryKeys.materialLists.detail(id ?? ''),
    queryFn: () => getMaterialList(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Create / update / delete a material list and add / remove its items (US 4.03).
 * Each mutation invalidates the lists cache (and the specific list detail) and
 * surfaces a success / error toast.
 */
export function useMaterialListMutations() {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  const invalidateLists = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.materialLists.all() });

  const invalidateDetail = (id: string) =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.materialLists.detail(id) });

  const create = useMutation({
    mutationFn: (input: CreateMaterialListInput) =>
      createMaterialList(input, { skipErrorHandler: true }),
    onSuccess: () => {
      invalidateLists();
      toast.success(t('materialLists.toasts.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('materialLists.toasts.createFailed'))),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMaterialListInput }) =>
      updateMaterialList(id, input, { skipErrorHandler: true }),
    onSuccess: (_data, { id }) => {
      invalidateLists();
      invalidateDetail(id);
      toast.success(t('materialLists.toasts.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('materialLists.toasts.updateFailed'))),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMaterialList(id, { skipErrorHandler: true }),
    onSuccess: () => {
      invalidateLists();
      toast.success(t('materialLists.toasts.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t('materialLists.toasts.deleteFailed'))),
  });

  const addItems = useMutation({
    mutationFn: ({ id, materialIds }: { id: string; materialIds: string[] }) =>
      addMaterialListItems(id, materialIds, { skipErrorHandler: true }),
    onSuccess: (_data, { id }) => {
      invalidateLists();
      invalidateDetail(id);
      toast.success(t('materialLists.toasts.itemsAdded'));
    },
    onError: (error) => toast.error(errorMessage(error, t('materialLists.toasts.itemsAddFailed'))),
  });

  const removeItem = useMutation({
    mutationFn: ({ id, itemId }: { id: string; itemId: string }) =>
      removeMaterialListItem(id, itemId, { skipErrorHandler: true }),
    onSuccess: (_data, { id }) => {
      invalidateLists();
      invalidateDetail(id);
      toast.success(t('materialLists.toasts.itemRemoved'));
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('materialLists.toasts.itemRemoveFailed'))),
  });

  return { create, update, remove, addItems, removeItem };
}
