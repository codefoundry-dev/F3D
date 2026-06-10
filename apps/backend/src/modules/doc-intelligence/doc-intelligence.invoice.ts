import {
  type InvoiceExtractionLineItem,
  type InvoiceExtractionResult,
  EMPTY_INVOICE_EXTRACTION_RESULT,
} from '@forethread/shared-types';

import { canonicalizeUnit, parseNumber } from './doc-intelligence.bom';

function normalizeString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeItem(raw: unknown): InvoiceExtractionLineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;

  const description = normalizeString(v.description ?? v.item ?? v.material);
  const quantity = parseNumber(v.quantity ?? v.qty);
  const unit = canonicalizeUnit(
    normalizeString(v.unit) ?? normalizeString(v.uom) ?? normalizeString(v.units),
  );
  const unitPrice = parseNumber(v.unitPrice ?? v.price ?? v.unit_price ?? v.rate);
  const lineTotal = parseNumber(v.lineTotal ?? v.total ?? v.amount ?? v.line_total);

  // Drop header / subtotal / blank rows: nothing billable to reconcile.
  if (!description && unitPrice === null) return null;

  return {
    description: description ?? '',
    quantity,
    unit,
    unitPrice,
    lineTotal,
  };
}

/**
 * Normalize the raw JSON Gemini returned for an INVOICE extraction into the
 * canonical {@link InvoiceExtractionResult} shape, mirroring
 * `normalizeQuoteResult`. Defensive: accepts arbitrary input and always
 * returns a valid result.
 */
export function normalizeInvoiceResult(raw: unknown): InvoiceExtractionResult {
  if (!raw || typeof raw !== 'object') return EMPTY_INVOICE_EXTRACTION_RESULT;
  const v = raw as Record<string, unknown>;
  const itemsArray = Array.isArray(v.items)
    ? v.items
    : Array.isArray(v.lineItems)
      ? v.lineItems
      : [];

  const items = itemsArray
    .map(normalizeItem)
    .filter((item): item is InvoiceExtractionLineItem => item !== null);

  return {
    vendorName: normalizeString(v.vendorName ?? v.vendor ?? v.supplier),
    invoiceNumber: normalizeString(v.invoiceNumber ?? v.invoiceNo ?? v.invoice_number),
    poReference: normalizeString(v.poReference ?? v.poNumber ?? v.po_reference ?? v.reference),
    issuedDate: normalizeString(v.issuedDate ?? v.invoiceDate ?? v.issued_date ?? v.date),
    dueDate: normalizeString(v.dueDate ?? v.due_date),
    currency: normalizeString(v.currency)?.toUpperCase() ?? null,
    subTotal: parseNumber(v.subTotal ?? v.subtotal ?? v.sub_total),
    taxAmount: parseNumber(v.taxAmount ?? v.tax ?? v.vat ?? v.tax_amount),
    totalAmount: parseNumber(v.totalAmount ?? v.total ?? v.grandTotal),
    items,
    notes: normalizeString(v.notes ?? v.remarks),
  };
}
