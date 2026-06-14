import {
  getPurchaseOrders,
  getPurchaseOrder,
  getPurchaseOrderEmailLog,
  listPoChangeRequests,
  type PoListParams,
} from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function usePurchaseOrders(params?: PoListParams) {
  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => getPurchaseOrders(params, { skipErrorHandler: true }),
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => getPurchaseOrder(id),
    enabled: !!id,
  });
}

/** Outbound email delivery log for the PO detail view (FOR-213). */
export function usePurchaseOrderEmailLog(poId: string) {
  return useQuery({
    queryKey: ['purchase-orders', poId, 'emails'],
    queryFn: () => getPurchaseOrderEmailLog(poId),
    enabled: !!poId,
  });
}

/**
 * FLOW 3 — list a PO's change requests. Drives the "Changes request" tab
 * (pending CR) + the Action log (resolved CRs). Query key matches the mutation
 * invalidations in {@link PoChangeRequestTab}.
 */
export function usePoChangeRequests(poId: string) {
  return useQuery({
    queryKey: ['po-change-requests', poId],
    queryFn: () => listPoChangeRequests(poId),
    enabled: !!poId,
  });
}
