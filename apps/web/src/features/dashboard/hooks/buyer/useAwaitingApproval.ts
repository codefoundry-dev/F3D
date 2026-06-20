import { listPendingApproval } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

/**
 * Week-3 — the entitled approver inbox. Fetches POs in PENDING_APPROVAL that the
 * current user is allowed to approve (already threshold-scoped server-side by
 * `listPendingApproval`). Surfaced as the Decline/Approve cards inside the buyer
 * dashboard's "Purchase orders" section (PendingPurchaseOrders), gated on the
 * caller's `po.approve` permission.
 */
export function useAwaitingApproval(enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'awaiting-approval'],
    queryFn: () => listPendingApproval(),
    // Gated by the caller's `po.approve` permission: the endpoint itself
    // requires po.approve, so firing it for a non-approver would just 403.
    enabled,
    staleTime: 30000,
  });

  return { items: data?.items ?? [], isLoading: enabled && isLoading };
}
