import {
  createMaterial,
  type CreateMaterialInput,
  type MaterialDetailDto,
  queryKeys,
  updateMaterial,
  type UpdateMaterialInput,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';
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
 * Create a catalogue material (US 4.01 Phase 2 — "Add new material item"
 * wizard). Invalidates the materials list and toasts on success / failure.
 */
export function useCreateMaterial(): UseMutationResult<
  MaterialDetailDto,
  unknown,
  CreateMaterialInput
> {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMaterialInput) => createMaterial(input, { skipErrorHandler: true }),
    onSuccess: (material) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
      toast.success(t('create.toastSuccess'));
      return material;
    },
    onError: (error) => toast.error(errorMessage(error, t('create.toastError'))),
  });
}

/**
 * Patch a material (US 4.01 Phase 2 — Edit Core / Edit Additional). Each edit
 * page sends ONLY the fields its section owns. Invalidates the list + the
 * material's detail and surfaces a section-specific success / error toast.
 */
export function useUpdateMaterial(options?: {
  successMessageKey?: string;
  errorMessageKey?: string;
}): UseMutationResult<MaterialDetailDto, unknown, { id: string; input: UpdateMaterialInput }> {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();
  const successKey = options?.successMessageKey ?? 'editCore.toastSuccess';
  const errorKey = options?.errorMessageKey ?? 'editCore.toastError';

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMaterialInput }) =>
      updateMaterial(id, input, { skipErrorHandler: true }),
    onSuccess: (material) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(material.id) });
      toast.success(t(successKey as 'editCore.toastSuccess'));
      return material;
    },
    onError: (error) => toast.error(errorMessage(error, t(errorKey as 'editCore.toastError'))),
  });
}
