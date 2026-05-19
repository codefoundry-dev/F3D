import {
  getBulkOrders,
  getBulkOrder,
  createBulkOrder,
  updateBulkOrder,
  deleteBulkOrder,
  updateBulkOrderLineItem,
  createDrawdown,
  listChangeRequests,
  proposeChange,
  approveChangeRequest,
  rejectChangeRequest,
  cancelBulkOrder,
  type BulkOrderListParams,
  type CreateBulkOrderPayload,
  type UpdateBulkOrderPayload,
  type UpdateBulkOrderLineItemPayload,
  type CreateDrawdownPayload,
  type CreateChangeRequestInput,
} from '@forethread/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useBulkOrders(params?: BulkOrderListParams) {
  return useQuery({
    queryKey: ['bulk-orders', params],
    queryFn: () => getBulkOrders(params, { skipErrorHandler: true }),
  });
}

export function useBulkOrder(id: string) {
  return useQuery({
    queryKey: ['bulk-orders', id],
    queryFn: () => getBulkOrder(id),
    enabled: !!id,
  });
}

export function useCreateBulkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBulkOrderPayload) => createBulkOrder(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
  });
}

export function useUpdateBulkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBulkOrderPayload }) =>
      updateBulkOrder(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
  });
}

export function useDeleteBulkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBulkOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
  });
}

export function useUpdateBulkOrderLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bulkOrderId,
      lineItemId,
      payload,
    }: {
      bulkOrderId: string;
      lineItemId: string;
      payload: UpdateBulkOrderLineItemPayload;
    }) => updateBulkOrderLineItem(bulkOrderId, lineItemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
  });
}

export function useCreateDrawdown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bulkOrderId,
      payload,
    }: {
      bulkOrderId: string;
      payload: CreateDrawdownPayload;
    }) => createDrawdown(bulkOrderId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
  });
}

// ── Change Requests ──────────────────────────────────────────────────────────

export function useChangeRequests(bulkOrderId: string) {
  return useQuery({
    queryKey: ['bulk-orders', bulkOrderId, 'change-requests'],
    queryFn: () => listChangeRequests(bulkOrderId),
    enabled: !!bulkOrderId,
  });
}

export function useProposeChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bulkOrderId,
      input,
    }: {
      bulkOrderId: string;
      input: CreateChangeRequestInput;
    }) => proposeChange(bulkOrderId, input),
    onSuccess: (_, { bulkOrderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders', bulkOrderId] });
    },
  });
}

export function useApproveChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bulkOrderId,
      changeRequestId,
    }: {
      bulkOrderId: string;
      changeRequestId: string;
    }) => approveChangeRequest(bulkOrderId, changeRequestId),
    onSuccess: (_, { bulkOrderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders', bulkOrderId] });
    },
  });
}

export function useRejectChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bulkOrderId,
      changeRequestId,
      reason,
    }: {
      bulkOrderId: string;
      changeRequestId: string;
      reason?: string;
    }) => rejectChangeRequest(bulkOrderId, changeRequestId, reason),
    onSuccess: (_, { bulkOrderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders', bulkOrderId] });
    },
  });
}

export function useCancelBulkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bulkOrderId: string) => cancelBulkOrder(bulkOrderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bulk-orders'] });
    },
  });
}
