/**
 * Vendor invoice extraction result. Specialises the generic DocExtraction
 * `editedResult` payload for INVOICE-typed jobs, mirroring the QUOTE shape:
 * the backend normalizer writes it, and invoice reconciliation reads it to
 * match extracted lines against the PO.
 */
export interface InvoiceExtractionLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface InvoiceExtractionResult {
  vendorName: string | null;
  invoiceNumber: string | null;
  poReference: string | null;
  issuedDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subTotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: InvoiceExtractionLineItem[];
  notes: string | null;
}

export const EMPTY_INVOICE_EXTRACTION_RESULT: InvoiceExtractionResult = {
  vendorName: null,
  invoiceNumber: null,
  poReference: null,
  issuedDate: null,
  dueDate: null,
  currency: null,
  subTotal: null,
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
