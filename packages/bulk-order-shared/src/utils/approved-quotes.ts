import type { RfqDetail } from '@forethread/api-client';

/** One selectable approved RFQ response, derived from an RFQ detail. */
export interface ApprovedQuoteResponse {
  /** Quote response id — the dropdown option value. */
  responseId: string;
  rfqId: string;
  rfqReference: string;
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  lineItems: ApprovedQuoteLineItem[];
}

/** A single read-only line item derived from an approved quote response. */
export interface ApprovedQuoteLineItem {
  /** Stable key (responseId-rfqLineItemId). */
  id: string;
  itemReference: string;
  description: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  discountPercent: number;
  discountAmount: number;
  lineTotalWithTax: number;
}

const isApproved = (status: string): boolean =>
  status === 'APPROVED' || status === 'Approved';

/**
 * Derive the approved quote responses (with per-line pricing) from an RFQ detail.
 *
 * Mirrors the spreading used by the PO "from RFQ" flow (po-shared's
 * `deriveVendorGroups`) but additionally surfaces `vendorId`, which the bulk
 * order create payload requires. The per-item unit price is the response total
 * spread evenly across the RFQ's line items — the same approximation the PO
 * flow uses while the backend does not yet return per-line quoted prices.
 */
export function deriveApprovedQuoteResponses(rfq: RfqDetail): ApprovedQuoteResponse[] {
  const approved = rfq.quoteResponses.filter((qr) => isApproved(qr.status));
  const itemCount = rfq.lineItems.length || 1;

  return approved.map((qr) => {
    const totalCost = qr.totalCost ?? 0;
    const discountPct = qr.discountPercent ?? 0;
    const discountAmt = qr.discountAmount ?? 0;
    const perItemCost = totalCost / itemCount;

    const lineItems: ApprovedQuoteLineItem[] = rfq.lineItems.map((li) => ({
      id: `${qr.id}-${li.id}`,
      itemReference: li.materialName,
      description: li.description ?? '',
      unit: li.unit,
      quantity: li.quantity,
      pricePerUnit:
        perItemCost > 0 && li.quantity > 0
          ? Math.round((perItemCost / li.quantity) * 100) / 100
          : 0,
      discountPercent: discountPct,
      discountAmount: Math.round((discountAmt / itemCount) * 100) / 100,
      lineTotalWithTax: Math.round(perItemCost * 100) / 100,
    }));

    return {
      responseId: qr.id,
      rfqId: rfq.id,
      rfqReference: rfq.rfqNumber ?? rfq.name,
      vendorId: qr.vendorId,
      vendorName: qr.vendorName,
      projectId: rfq.projectId,
      projectName: rfq.projectName,
      lineItems,
    };
  });
}
