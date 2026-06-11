import {
  awardQuote,
  createPurchaseOrder,
  getQuoteDetail,
  getRfqs,
  getRfq,
  getRfqEmailLog,
  getRfqQuoteAudit,
  getRfqQuoteComparison,
  updateQuoteLineItemStatuses,
  type QuoteLineItemReviewStatus,
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

/** Outbound email delivery log for the RFQ detail view (FOR-213). */
export function useRfqEmailLog(rfqId: string) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'emails'],
    queryFn: () => getRfqEmailLog(rfqId),
    enabled: !!rfqId,
  });
}

/** Full quote response detail (line items, attachments, bulk totals) — US 5.06. */
export function useQuoteDetail(rfqId: string, quoteId: string) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'quotes', quoteId],
    queryFn: () => getQuoteDetail(rfqId, quoteId),
    enabled: !!rfqId && !!quoteId,
  });
}

/**
 * Approve / decline / restore individual quote lines (US 5.19). Invalidates the
 * RFQ detail, quote detail and comparison caches so every review surface
 * refreshes.
 */
export function useUpdateQuoteLineItemStatuses(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      lineItemIds,
      status,
    }: {
      quoteId: string;
      lineItemIds: string[];
      status: QuoteLineItemReviewStatus;
    }) => updateQuoteLineItemStatuses(rfqId, quoteId, lineItemIds, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });
}

/**
 * Create draft PO(s) covering every quoted line of an approved quote — the
 * "Create draft" path of the post-approve prompt (US 5.19). Lines are grouped
 * by project (US 5.05 multi-project RFQs) so each draft PO targets one project.
 */
export function useCreateDraftPoFromQuote(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quoteResponseId: string) => {
      const comparison = await getRfqQuoteComparison(rfqId);
      const vendor = comparison.vendors.find((v) => v.quoteResponseId === quoteResponseId);
      if (!vendor) throw new Error('Quote not found in comparison');

      const byProject = new Map<
        string,
        {
          description: string | undefined;
          qty: number;
          unit: string;
          price: number;
          delivery: string | undefined;
        }[]
      >();
      for (const row of comparison.rows) {
        const cell = row.cells.find((c) => c.quoteResponseId === quoteResponseId);
        if (!cell?.hasQuote) continue;
        const lines = byProject.get(row.projectId) ?? [];
        lines.push({
          description: cell.substituteItemName ?? row.materialName ?? undefined,
          qty: cell.quotedQuantity ?? 0,
          unit: row.unit,
          price: cell.unitPrice ?? 0,
          delivery: cell.deliveryDate ?? undefined,
        });
        byProject.set(row.projectId, lines);
      }

      for (const [projectId, lines] of byProject) {
        await createPurchaseOrder({
          projectId,
          vendorId: vendor.vendorId,
          poType: 'STANDARD',
          sourceOfCreation: 'RFQ',
          currency: comparison.currency,
          pickUp: false,
          rfqId,
          lineItems: lines.map((line) => ({
            description: line.description,
            quantityOrdered: line.qty,
            unitOfMeasure: line.unit,
            unitPrice: line.price,
            expectedDeliveryDate: line.delivery,
          })),
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
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
