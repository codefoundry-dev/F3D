import { QuoteLineItemAvailability } from '@prisma/client';

/**
 * FOR-208 / US 5.06 — Quote comparison aggregation.
 *
 * Pure, side-effect-free transforms that turn the RFQ + its received quotes into
 * the side-by-side comparison grid surfaced on the RFQ detail view: rows are RFQ
 * line items, columns are vendors, each cell carries the vendor's unit price,
 * line total (with tax), discount, delivery date, per-line review status and
 * substitute info, the lowest line total per row is flagged, and each vendor
 * gets a footer total (with taxes, shipment & handling and overall discount).
 * Kept free of Prisma/Nest so the aggregation + highlight logic can be
 * unit-tested in isolation.
 */

/** A vendor cell is excluded from totals / lowest-price comparison when it carries no real quote. */
const NO_QUOTE_AVAILABILITY: QuoteLineItemAvailability = QuoteLineItemAvailability.NO_QUOTE;

// ── Builder inputs (the minimal slice of the Prisma graph we need) ──────────────

export interface ComparisonRfqLineItemInput {
  id: string;
  materialName: string | null;
  quantity: number;
  unit: string;
  /** Line-level project (US 5.05 multi-project RFQs); null falls back to the RFQ's primary project. */
  projectId: string | null;
  projectName: string | null;
}

export interface ComparisonQuoteLineItemInput {
  id: string;
  rfqLineItemId: string;
  unitPrice: number;
  quotedQuantity: number;
  availability: QuoteLineItemAvailability;
  deliveryDate: Date | string | null;
  discount: number | null;
  discountType: string | null;
  lineTotal: number;
  status: string;
  notes: string | null;
  substituteItemId: string | null;
  substituteItemName: string | null;
}

export interface ComparisonQuoteInput {
  id: string;
  vendorId: string;
  vendorName: string;
  status: string;
  submittedAt: Date | string | null;
  paymentTerms: string | null;
  bulkDeliveryTime: Date | string | null;
  totalCost: number;
  discountPercent: number | null;
  discountAmount: number | null;
  bulkShipment: number | null;
  attachmentCount: number;
  lineItems: ComparisonQuoteLineItemInput[];
}

export interface ComparisonRfqInput {
  id: string;
  currency: string;
  projectId: string;
  projectName: string;
  lineItems: ComparisonRfqLineItemInput[];
}

// ── Builder outputs (the response contract) ────────────────────────────────────

export interface QuoteComparisonVendor {
  quoteResponseId: string;
  vendorId: string;
  vendorName: string;
  status: string;
  submittedAt: string | null;
  paymentTerms: string | null;
  /** Latest committed delivery across the vendor's quoted lines (bulk override wins). */
  leadTimeDate: string | null;
  /** Sum of extended costs across all lines the vendor actually quoted. */
  total: number;
  /** Vendor-submitted quote total (taxes, shipment and discounts applied). */
  totalWithTaxes: number;
  /** Overall quote discount, as submitted by the vendor. */
  discountPercent: number | null;
  discountAmount: number | null;
  /** Shipment & handling charge for the whole quote. */
  shipmentAndHandling: number | null;
  attachmentCount: number;
  /** True when the vendor left a note on the quote or any of its lines. */
  hasNotes: boolean;
  itemsCovered: number;
  totalItems: number;
}

export interface QuoteComparisonCell {
  vendorId: string;
  quoteResponseId: string;
  /** Quote line id — target for per-line approve/decline/restore (US 5.19). */
  quoteLineItemId: string | null;
  unitPrice: number | null;
  quotedQuantity: number | null;
  /** qty × unit — null when the vendor did not quote this line. */
  extendedCost: number | null;
  /** Vendor-computed line total with tax — null when the vendor did not quote this line. */
  lineTotal: number | null;
  /** Per-line discount as submitted (interpreted via discountType). */
  discount: number | null;
  discountType: string | null;
  availability: string | null;
  deliveryDate: string | null;
  /** Per-line review status: PENDING | APPROVED | DECLINED. */
  status: string | null;
  /** Vendor note on the line (drives the note indicator). */
  notes: string | null;
  /** Set when the vendor quoted a substitute material for this line. */
  substituteItemId: string | null;
  substituteItemName: string | null;
  hasQuote: boolean;
  /** True when this cell holds the lowest line total in its row. */
  isLowest: boolean;
}

export interface QuoteComparisonRow {
  rfqLineItemId: string;
  materialName: string | null;
  quantity: number;
  unit: string;
  projectId: string;
  projectName: string;
  cells: QuoteComparisonCell[];
  /** Vendor with the lowest line total for this line, or null when no one quoted it. */
  lowestVendorId: string | null;
}

export interface QuoteComparison {
  rfqId: string;
  currency: string;
  vendors: QuoteComparisonVendor[];
  rows: QuoteComparisonRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toIso(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** A quote line counts toward comparison only when it has a positive price and is not flagged NO_QUOTE. */
function isRealQuote(line: ComparisonQuoteLineItemInput): boolean {
  return line.availability !== NO_QUOTE_AVAILABILITY && line.unitPrice > 0;
}

/** Latest delivery date a vendor committed to, preferring the bulk override. */
function vendorLeadTime(quote: ComparisonQuoteInput): string | null {
  if (quote.bulkDeliveryTime) return toIso(quote.bulkDeliveryTime);
  const dates = quote.lineItems
    .map((li) => (li.deliveryDate ? new Date(li.deliveryDate).getTime() : null))
    .filter((t): t is number => t !== null);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates)).toISOString();
}

// ── Builder ────────────────────────────────────────────────────────────────────

/**
 * Build the side-by-side comparison grid. Vendors keep the order they are passed
 * in; every row exposes one cell per vendor (aligned to that order) so the
 * frontend can render a dense grid without lookups.
 */
export function buildQuoteComparison(
  rfq: ComparisonRfqInput,
  quotes: ComparisonQuoteInput[],
): QuoteComparison {
  // Index each vendor's quoted lines by RFQ line item for O(1) cell lookups.
  const linesByQuote = new Map<string, Map<string, ComparisonQuoteLineItemInput>>();
  for (const quote of quotes) {
    const byLine = new Map<string, ComparisonQuoteLineItemInput>();
    for (const line of quote.lineItems) byLine.set(line.rfqLineItemId, line);
    linesByQuote.set(quote.id, byLine);
  }

  const vendorTotals = new Map<string, number>();
  const vendorCovered = new Map<string, number>();

  const rows: QuoteComparisonRow[] = rfq.lineItems.map((rfqLine) => {
    const cells: QuoteComparisonCell[] = quotes.map((quote) => {
      const line = linesByQuote.get(quote.id)?.get(rfqLine.id) ?? null;
      const real = line !== null && isRealQuote(line);
      const extendedCost = line !== null && real ? line.unitPrice * line.quotedQuantity : null;

      if (extendedCost !== null) {
        vendorTotals.set(quote.vendorId, (vendorTotals.get(quote.vendorId) ?? 0) + extendedCost);
        vendorCovered.set(quote.vendorId, (vendorCovered.get(quote.vendorId) ?? 0) + 1);
      }

      return {
        vendorId: quote.vendorId,
        quoteResponseId: quote.id,
        quoteLineItemId: line?.id ?? null,
        unitPrice: line !== null && real ? line.unitPrice : null,
        quotedQuantity: line !== null && real ? line.quotedQuantity : null,
        extendedCost,
        lineTotal: line !== null && real ? line.lineTotal : null,
        discount: line !== null && real ? line.discount : null,
        discountType: line !== null && real ? line.discountType : null,
        availability: line !== null ? String(line.availability) : null,
        deliveryDate: line !== null ? toIso(line.deliveryDate) : null,
        status: line !== null ? line.status : null,
        notes: line !== null ? line.notes : null,
        substituteItemId: line !== null ? line.substituteItemId : null,
        substituteItemName: line !== null ? line.substituteItemName : null,
        hasQuote: real,
        isLowest: false,
      };
    });

    // Flag the lowest line total in the row (ties highlight every matching cell).
    // Falls back to extended cost when the vendor-computed line total is missing.
    const priceOf = (c: QuoteComparisonCell) => c.lineTotal ?? c.extendedCost;
    const pricedCosts = cells.map(priceOf).filter((cost): cost is number => cost !== null);
    let lowestVendorId: string | null = null;
    if (pricedCosts.length > 0) {
      const min = Math.min(...pricedCosts);
      for (const cell of cells) {
        const cost = priceOf(cell);
        if (cost !== null && cost === min) {
          cell.isLowest = true;
          lowestVendorId ??= cell.vendorId;
        }
      }
    }

    return {
      rfqLineItemId: rfqLine.id,
      materialName: rfqLine.materialName,
      quantity: rfqLine.quantity,
      unit: rfqLine.unit,
      projectId: rfqLine.projectId ?? rfq.projectId,
      projectName: rfqLine.projectName ?? rfq.projectName,
      cells,
      lowestVendorId,
    };
  });

  const totalItems = rfq.lineItems.length;
  const vendors: QuoteComparisonVendor[] = quotes.map((quote) => ({
    quoteResponseId: quote.id,
    vendorId: quote.vendorId,
    vendorName: quote.vendorName,
    status: quote.status,
    submittedAt: toIso(quote.submittedAt),
    paymentTerms: quote.paymentTerms,
    leadTimeDate: vendorLeadTime(quote),
    total: vendorTotals.get(quote.vendorId) ?? 0,
    totalWithTaxes: quote.totalCost,
    discountPercent: quote.discountPercent,
    discountAmount: quote.discountAmount,
    shipmentAndHandling: quote.bulkShipment,
    attachmentCount: quote.attachmentCount,
    hasNotes: quote.lineItems.some((li) => li.notes !== null && li.notes !== ''),
    itemsCovered: vendorCovered.get(quote.vendorId) ?? 0,
    totalItems,
  }));

  return { rfqId: rfq.id, currency: rfq.currency, vendors, rows };
}
