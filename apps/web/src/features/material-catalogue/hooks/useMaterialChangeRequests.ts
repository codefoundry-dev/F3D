import {
  approveMaterialChangeRequest,
  getMaterialChangeRequests,
  type MaterialChangeRequestDto,
  queryKeys,
  rejectMaterialChangeRequest,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { toast } from '@forethread/ui-components';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

const CHANGE_REQUEST_STATUS = 'PENDING';

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
 * Pending material change requests (US 4.01 Phase 3). Surfaces edit-diff cards
 * on the Pending tab. Only enabled when the caller can list change requests, so
 * non-Super-Admins never fire the request.
 */
export function useMaterialChangeRequests(
  enabled: boolean,
): UseQueryResult<MaterialChangeRequestDto[]> {
  return useQuery<MaterialChangeRequestDto[]>({
    queryKey: queryKeys.materials.changeRequests({ status: CHANGE_REQUEST_STATUS }),
    queryFn: () => getMaterialChangeRequests({ status: CHANGE_REQUEST_STATUS }),
    enabled,
  });
}

/**
 * Approve / reject mutations for a pending change request. Each invalidates the
 * change-requests list (the card disappears) and the materials cache (an approve
 * mutates the live material). Errors surface the backend message via a toast.
 */
export function useMaterialChangeRequestMutations() {
  const { t } = useTranslation(['materialCatalogue']);
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.materials.changeRequests({ status: CHANGE_REQUEST_STATUS }),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.materials.all() });
  };

  const approve = useMutation({
    mutationFn: (id: string) => approveMaterialChangeRequest(id, { skipErrorHandler: true }),
    onSuccess: () => {
      invalidate();
      toast.success(t('toasts.changeApproved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('toasts.changeApproveFailed'))),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectMaterialChangeRequest(id, { reason }, { skipErrorHandler: true }),
    onSuccess: () => {
      invalidate();
      toast.success(t('toasts.changeRejected'));
    },
    onError: (error) => toast.error(errorMessage(error, t('toasts.changeRejectFailed'))),
  });

  return { approve, reject };
}
