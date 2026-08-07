import {
  addApprovalNominations,
  getApproverPool,
  withdrawApprovalNomination,
  type ApprovalEntityType,
  type ApproverPoolView,
} from '@forethread/api-client';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

/**
 * Query key for a document's Approver Pool. Entity-typed so a PO and an invoice
 * that happened to share an id can never collide in the cache.
 */
export function approverPoolQueryKey(
  entityType: ApprovalEntityType,
  entityId: string,
  amount?: number | null,
) {
  // The preview amount is part of the key: the Pool is a function of the total,
  // so a preview for an unsaved figure must not overwrite the saved document's
  // cached Pool (or be served in its place).
  return amount === undefined || amount === null
    ? (['approver-pool', entityType, entityId] as const)
    : (['approver-pool', entityType, entityId, { amount }] as const);
}

/**
 * A document's Approver Pool, its nominees, and who resolved it.
 *
 * The Pool is recomputed server-side on every call rather than snapshotted, so
 * this is deliberately a normal query with no long cache life: a member whose
 * cap was lowered must drop out of the panel, not linger because the client
 * cached them.
 */
export function useApproverPool(
  entityType: ApprovalEntityType,
  entityId: string | undefined,
  options?: {
    enabled?: boolean;
    /** Preview the Pool for an as-yet-unsaved total (the invoice review case). */
    amount?: number | null;
  },
) {
  return useQuery({
    queryKey: approverPoolQueryKey(entityType, entityId ?? '', options?.amount),
    queryFn: () => getApproverPool(entityType, entityId as string, { amount: options?.amount }),
    enabled: Boolean(entityId) && (options?.enabled ?? true),
  } as UseQueryOptions<ApproverPoolView>);
}

/** Refresh everything a nomination change can be visible in. */
function useInvalidateAfterNomination(entityType: ApprovalEntityType, entityId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: approverPoolQueryKey(entityType, entityId) });
    // The nominee's notification bell gains a row; nothing about the document's
    // own status changes, because a Nomination confers no authority.
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
}

/**
 * Nominate further Pool members on a document already awaiting approval
 * (FOR-308). Append-only: re-nominating an existing nominee is a server-side
 * no-op, so this can be called without first diffing against the current list.
 */
export function useAddNominations(entityType: ApprovalEntityType, entityId: string) {
  const invalidate = useInvalidateAfterNomination(entityType, entityId);
  return useMutation({
    mutationFn: (userIds: string[]) => addApprovalNominations(entityType, entityId, { userIds }),
    onSuccess: invalidate,
  });
}

/**
 * Withdraw a nomination the caller made. Authority is untouched — the withdrawn
 * user keeps their place in the Pool and the document stays in their queue.
 */
export function useWithdrawNomination(entityType: ApprovalEntityType, entityId: string) {
  const invalidate = useInvalidateAfterNomination(entityType, entityId);
  return useMutation({
    mutationFn: (userId: string) => withdrawApprovalNomination(entityType, entityId, userId),
    onSuccess: invalidate,
  });
}
