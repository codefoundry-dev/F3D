/**
 * Vendor quote extraction result. Specialises the generic DocExtraction
 * `editedResult` payload for QUOTE-typed jobs (FOR-206 — vendor uploads their
 * quote PDF, Gemini extracts the priced line items).
 *
 * The shape is shared between the backend normalizer (which writes it) and the
 * vendor portal (which matches it onto the RFQ line-item form), so any change
 * here flows to both ends.
 */
export interface QuoteLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  leadTime: string | null;
}

export interface QuoteExtractionResult {
  vendorName: string | null;
  quoteNumber: string | null;
  rfqReference: string | null;
  currency: string | null;
  totalAmount: number | null;
  validUntil: string | null;
  items: QuoteLineItem[];
  notes: string | null;
}

export const EMPTY_QUOTE_RESULT: QuoteExtractionResult = {
  vendorName: null,
  quoteNumber: null,
  rfqReference: null,
  currency: null,
  totalAmount: null,
  validUntil: null,
  items: [],
  notes: null,
};

export function isQuoteLineItem(value: unknown): value is QuoteLineItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.description === 'string';
}

export function isQuoteExtractionResult(value: unknown): value is QuoteExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && v.items.every(isQuoteLineItem);
}
