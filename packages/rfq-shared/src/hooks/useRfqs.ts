import {
  awardQuote,
  getRfqs,
  getRfq,
  getRfqQuoteAudit,
  getRfqQuoteComparison,
  type RfqListParams,
} from '@forethread/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

/** Per-RFQ quote audit trail for the RFQ detail view (FOR-207). */
export function useRfqQuoteAudit(rfqId: string) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'quote-audit'],
    queryFn: () => getRfqQuoteAudit(rfqId),
    enabled: !!rfqId,
  });
}

/** Side-by-side quote comparison grid for the RFQ detail view (FOR-208). */
export function useRfqQuoteComparison(rfqId: string) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'quote-comparison'],
    queryFn: () => getRfqQuoteComparison(rfqId),
    enabled: !!rfqId,
  });
}

/**
 * Award a quote from the comparison view (FOR-209): approves it and auto-creates
 * a draft PO. Invalidates the RFQ and purchase-order caches so the awarded state
 * and the new draft PO are reflected immediately.
 */
export function useAwardQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rfqId, quoteId }: { rfqId: string; quoteId: string }) =>
      awardQuote(rfqId, quoteId, { skipErrorHandler: true }),
    onSuccess: (_result, { rfqId }) => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
      void queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}
