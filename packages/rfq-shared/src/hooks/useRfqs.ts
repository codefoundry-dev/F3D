import { getRfqs, getRfq, type RfqListParams } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function useRfqs(params?: RfqListParams) {
  return useQuery({
    queryKey: ['rfqs', params],
    queryFn: () => getRfqs(params, { skipErrorHandler: true }),
  });
}

export function useRfq(id: string) {
  return useQuery({
    queryKey: ['rfqs', id],
    queryFn: () => getRfq(id),
    enabled: !!id,
  });
}
