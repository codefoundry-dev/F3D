import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  issuePurchaseOrder,
  proposePoChange,
  getProjects,
  getProject,
  getCompanyVendors,
  getMe,
  getRfq,
  type PoListParams,
  type CreatePurchaseOrderInput,
  type CreatePoChangeRequestInput,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/state/auth.store';

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

/** The RFQ a "Start now" PO is built from (FOR-391); idle without an id. */
export function useSourceRfq(rfqId: string | undefined) {
  return useQuery({
    queryKey: ['rfqs', rfqId],
    queryFn: () => getRfq(rfqId ?? ''),
    enabled: !!rfqId,
  });
}

export function useProjectsList() {
  return useQuery({
    queryKey: ['projects-list'],
    queryFn: () => getProjects({ limit: 100 }),
  });
}

export function useProjectDetail(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => getProject(id),
    enabled: !!id,
  });
}

export function useCompanyVendors() {
  const companyId = useAuthStore((s) => s.currentUser?.companyId);
  return useQuery({
    queryKey: ['company-vendors', companyId],
    queryFn: () => getCompanyVendors(companyId ?? ''),
    enabled: !!companyId,
  });
}

/**
 * FOR-210: surfaces the current user's profile (including `poApprovalThreshold`)
 * so the PO detail page can decide whether sending requires approval.
 */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(),
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) =>
      createPurchaseOrder(input, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function useIssuePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    // `nomineeIds` is the optional approver nomination (FOR-306); it only ever
    // applies when the backend routes the PO for approval.
    mutationFn: ({ id, nomineeIds }: { id: string; nomineeIds?: string[] }) =>
      issuePurchaseOrder(id, nomineeIds?.length ? { nomineeIds } : undefined),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      // The PO may now be PENDING_APPROVAL with a fresh Pool + nominees.
      void queryClient.invalidateQueries({ queryKey: ['approver-pool', 'PURCHASE_ORDER', id] });
    },
  });
}

/**
 * FLOW 3 — propose a PO change request from the change wizard. Invalidates the
 * PO detail + its change-request list so the new pending CR surfaces in the
 * "Changes request" tab on return.
 */
export function useProposePoChange(poId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePoChangeRequestInput) => proposePoChange(poId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', poId] });
      void queryClient.invalidateQueries({ queryKey: ['po-change-requests', poId] });
    },
  });
}
