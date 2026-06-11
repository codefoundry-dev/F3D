import {
  approveMaterial,
  archiveMaterial,
  deleteMaterial,
  queryKeys,
  rejectMaterial,
  restoreMaterial,
  type RejectMaterialInput,
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

/**
 * Lifecycle mutations for a material (US 4.01): approve / reject / archive /
 * restore / delete. Each invalidates the materials cache (list + detail) and
 * surfaces a success / error toast. Delete maps a 409 (material referenced
 * elsewhere) to the backend's message so the user knows why it was blocked.
 */
export function useMaterialMutations() {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  const invalidate = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(id) });
    }
  };

  const approve = useMutation({
    mutationFn: (id: string) => approveMaterial(id, { skipErrorHandler: true }),
    onSuccess: (m) => {
      invalidate(m.id);
      toast.success(t('toasts.approved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('toasts.approveFailed'))),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectMaterial(id, { reason } as RejectMaterialInput, { skipErrorHandler: true }),
    onSuccess: (m) => {
      invalidate(m.id);
      toast.success(t('toasts.rejected'));
    },
    onError: (error) => toast.error(errorMessage(error, t('toasts.rejectFailed'))),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveMaterial(id, { skipErrorHandler: true }),
    onSuccess: (m) => {
      invalidate(m.id);
      toast.success(t('toasts.archived'));
    },
    onError: (error) => toast.error(errorMessage(error, t('toasts.archiveFailed'))),
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreMaterial(id, { skipErrorHandler: true }),
    onSuccess: (m) => {
      invalidate(m.id);
      toast.success(t('toasts.restored'));
    },
    onError: (error) => toast.error(errorMessage(error, t('toasts.restoreFailed'))),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMaterial(id, { skipErrorHandler: true }),
    onSuccess: (_data, id) => {
      invalidate(id);
      toast.success(t('toasts.deleted'));
    },
    // A 409 means the material is referenced (BOM / RFQ / PO); show the backend
    // message so the user knows it cannot be deleted yet.
    onError: (error) => toast.error(errorMessage(error, t('toasts.deleteFailed'))),
  });

  return { approve, reject, archive, restore, remove };
}
