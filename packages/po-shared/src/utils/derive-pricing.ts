import type { RfqDetail } from '@forethread/api-client';

import { isApprovedQuote, quotedLineFor } from './quoted-price';

/** Shared derived item shape used across RFQ-related modals */
export interface DerivedQuoteItem {
  id: string;
  lineItemId: string;
  /** The vendor's quote line this item is priced from (FOR-391). */
  quoteLineItemId: string;
  /** Catalogue material link + code snapshots carried from the RFQ line. */
  materialId: string | null;
  costCode: string | null;
  upc: string | null;
  manufacturerPartNumber: string | null;
  taxCode: string | null;
  materialName: string;
  description: string | null;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  quantity: number;
  availableQuantity: number;
  unit: string;
  lineTotalWithTax: number;
  projectName: string;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
}

/** Vendor group with derived per-item pricing from approved quote responses */
export interface VendorGroup {
  vendorName: string;
  totalCost: number;
  discountPercent: number;
  discountAmount: number;
  items: DerivedQuoteItem[];
}

/**
 * Derive vendor-grouped quote items from an RFQ detail. Each approved response
 * becomes a vendor group holding the lines that vendor quoted, each at its
 * quoted unit price (FOR-391 — previously the total was spread across lines).
 */
export function deriveVendorGroups(rfq: RfqDetail): VendorGroup[] {
  const approved = rfq.quoteResponses.filter(isApprovedQuote);

  return approved.map((qr) => {
    const totalCost = qr.totalCost ?? 0;
    const discountPct = qr.discountPercent ?? 0;
    const discountAmt = qr.discountAmount ?? 0;
    const quoted = rfq.lineItems.flatMap((li) => {
      const ql = quotedLineFor(qr, li.id);
      return ql ? [{ li, ql }] : [];
    });
    const itemCount = quoted.length || 1;

    const items: DerivedQuoteItem[] = quoted.map(({ li, ql }) => ({
      id: `${qr.id}-${li.id}`,
      lineItemId: li.id,
      quoteLineItemId: ql.id,
      materialId: li.materialId ?? null,
      costCode: li.costCode ?? null,
      upc: li.upc ?? null,
      manufacturerPartNumber: li.manufacturerPartNumber ?? null,
      taxCode: li.taxCode ?? null,
      materialName: li.materialName,
      description: li.description,
      unitPrice: ql.unitPrice,
      discountPercent: discountPct,
      discountAmount: Math.round((discountAmt / itemCount) * 100) / 100,
      quantity: ql.approvedQuantity ?? li.quantity,
      availableQuantity: ql.quotedQuantity,
      unit: li.unit,
      lineTotalWithTax: ql.unitPrice * (ql.approvedQuantity ?? li.quantity),
      projectName: li.projectName,
      expectedDeliveryDate: li.expectedDeliveryDate,
      deliveryLocation: li.deliveryLocation,
    }));

    return {
      vendorName: qr.vendorName,
      totalCost,
      discountPercent: discountPct,
      discountAmount: discountAmt,
      items,
    };
  });
}

/**
 * Derive a flat list of quote line items from the first approved response.
 * Used in ApprovedQuotesModal where vendor grouping is not needed.
 */
export function deriveQuoteLineItems(rfq: RfqDetail): DerivedQuoteItem[] {
  const groups = deriveVendorGroups(rfq);
  return groups.length > 0 ? groups[0].items : [];
}
