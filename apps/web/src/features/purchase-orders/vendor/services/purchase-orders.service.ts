import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  issuePurchaseOrder,
  proposePoChange,
  getProjects,
  getProject,
  getCompanyVendors,
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
    mutationFn: (id: string) => issuePurchaseOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

/**
 * FLOW 3 (vendor) — propose a PO change request from the vendor change wizard.
 * Mirrors the buyer hook: invalidates the PO detail + its change-request list so
 * the new pending CR surfaces in the "Changes request" tab on return.
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
