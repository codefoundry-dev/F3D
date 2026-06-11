/**
 * Vendor invoice extraction result. Specialises the generic DocExtraction
 * `editedResult` payload for INVOICE-typed jobs, mirroring the QUOTE shape:
 * the backend normalizer writes it, and invoice reconciliation reads it to
 * match extracted lines against the PO.
 */
export interface InvoiceExtractionLineItem {
  /** The invoice's own line identifier ("Line Item ID"), when the document prints one. */
  lineId: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  /**
   * PO-line pairing, attached post-extraction by the invoice↔PO reconciler —
   * Gemini cannot see the PO, so these stay undefined until reconciliation runs.
   * Satisfies US16's `item_match_candidates[]` for the invoice match surface
   * (the US 8.04 "PO Line Item" column).
   */
  matchedPoLineItemId?: string | null;
  matchConfidence?: number | null;
}

export interface InvoiceExtractionResult {
  vendorName: string | null;
  invoiceNumber: string | null;
  /**
   * PO numbers the invoice references. US 8.10 allows one invoice to bill against
   * several POs, so this is a list (empty when the invoice cites none).
   */
  poReferences: string[];
  issuedDate: string | null;
  dueDate: string | null;
  /** Payment terms exactly as written, e.g. "Net 30", "15-30". */
  paymentTerms: string | null;
  currency: string | null;
  subTotal: number | null;
  /** Tax label as written, e.g. "GST 10%" — preserves the rate + label the design shows. */
  taxLabel: string | null;
  /** Tax rate as a percentage number, e.g. 10 for "GST 10%". */
  taxRate: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: InvoiceExtractionLineItem[];
  notes: string | null;
}

export const EMPTY_INVOICE_EXTRACTION_RESULT: InvoiceExtractionResult = {
  vendorName: null,
  invoiceNumber: null,
  poReferences: [],
  issuedDate: null,
  dueDate: null,
  paymentTerms: null,
  currency: null,
  subTotal: null,
  taxLabel: null,
  taxRate: null,
  taxAmount: null,
  totalAmount: null,
  items: [],
  notes: null,
};

export function isInvoiceExtractionLineItem(value: unknown): value is InvoiceExtractionLineItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.description === 'string';
}

export function isInvoiceExtractionResult(value: unknown): value is InvoiceExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && v.items.every(isInvoiceExtractionLineItem);
}
