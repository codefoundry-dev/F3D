import { getPurchaseOrders, getPurchaseOrder, type PoListParams } from '@forethread/api-client';
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
