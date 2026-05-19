import type { RfqDetail } from '@forethread/api-client';

/** Shared derived item shape used across RFQ-related modals */
export interface DerivedQuoteItem {
  id: string;
  lineItemId: string;
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
 * Derive vendor-grouped quote items from an RFQ detail.
 * Each approved response becomes a vendor group with per-item pricing
 * spread evenly across line items.
 */
export function deriveVendorGroups(rfq: RfqDetail): VendorGroup[] {
  const approved = rfq.quoteResponses.filter(
    (qr) => qr.status === 'APPROVED' || qr.status === 'Approved',
  );

  return approved.map((qr) => {
    const totalCost = qr.totalCost ?? 0;
    const discountPct = qr.discountPercent ?? 0;
    const discountAmt = qr.discountAmount ?? 0;
    const itemCount = rfq.lineItems.length || 1;
    const perItemCost = totalCost / itemCount;

    const items: DerivedQuoteItem[] = rfq.lineItems.map((li) => ({
      id: `${qr.id}-${li.id}`,
      lineItemId: li.id,
      materialName: li.materialName,
      description: li.description,
      unitPrice: perItemCost > 0 ? Math.round((perItemCost / li.quantity) * 100) / 100 : 0,
      discountPercent: discountPct,
      discountAmount: Math.round((discountAmt / itemCount) * 100) / 100,
      quantity: li.quantity,
      availableQuantity: li.quantity,
      unit: li.unit,
      lineTotalWithTax: perItemCost,
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
