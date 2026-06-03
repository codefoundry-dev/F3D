import {
  type QuoteExtractionResult,
  type QuoteLineItem,
  EMPTY_QUOTE_RESULT,
} from '@forethread/shared-types';

import { canonicalizeUnit, parseNumber } from './doc-intelligence.bom';

function normalizeString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeItem(raw: unknown): QuoteLineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;

  const description = normalizeString(v.description ?? v.item ?? v.material);
  const quantity = parseNumber(v.quantity ?? v.qty);
  const unit = canonicalizeUnit(
    normalizeString(v.unit) ?? normalizeString(v.uom) ?? normalizeString(v.units),
  );
  const unitPrice = parseNumber(v.unitPrice ?? v.price ?? v.unit_price ?? v.rate);
  const lineTotal = parseNumber(v.lineTotal ?? v.total ?? v.amount ?? v.line_total);
  const leadTime = normalizeString(v.leadTime ?? v.lead_time ?? v.delivery ?? v.deliveryTime);

  // Drop header / subtotal / blank rows: nothing usable to quote against.
  if (!description && unitPrice === null) return null;

  return {
    description: description ?? '',
    quantity,
    unit,
    unitPrice,
    lineTotal,
    leadTime,
  };
}

/**
 * Normalize the raw JSON Gemini returned for a QUOTE extraction into the
 * canonical {@link QuoteExtractionResult} shape consumed by the vendor portal,
 * which matches these items onto the RFQ line-item form (FOR-206).
 *
 * Defensive: accepts arbitrary input (Gemini occasionally varies its keys) and
 * always returns a valid result.
 */
export function normalizeQuoteResult(raw: unknown): QuoteExtractionResult {
  if (!raw || typeof raw !== 'object') return EMPTY_QUOTE_RESULT;
  const v = raw as Record<string, unknown>;
  const itemsArray = Array.isArray(v.items)
    ? v.items
    : Array.isArray(v.lineItems)
      ? v.lineItems
      : [];

  const items = itemsArray
    .map(normalizeItem)
    .filter((item): item is QuoteLineItem => item !== null);

  return {
    vendorName: normalizeString(v.vendorName ?? v.vendor ?? v.supplier),
    quoteNumber: normalizeString(v.quoteNumber ?? v.quoteNo ?? v.quote_number),
    rfqReference: normalizeString(v.rfqReference ?? v.rfqRef ?? v.reference),
    currency: normalizeString(v.currency)?.toUpperCase() ?? null,
    totalAmount: parseNumber(v.totalAmount ?? v.total ?? v.grandTotal),
    validUntil: normalizeString(v.validUntil ?? v.validity ?? v.valid_until),
    items,
    notes: normalizeString(v.notes ?? v.remarks),
  };
}
