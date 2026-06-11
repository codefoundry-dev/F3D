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

/** Coerce the PO-reference field(s) into a string list (US 8.10 — one invoice → many POs). */
function normalizePoReferences(v: Record<string, unknown>): string[] {
  const list = v.poReferences ?? v.poNumbers ?? v.purchaseOrders;
  if (Array.isArray(list)) {
    return list.map((entry) => normalizeString(entry)).filter((s): s is string => s !== null);
  }
  const single = normalizeString(v.poReference ?? v.poNumber ?? v.po_reference ?? v.reference);
  return single ? [single] : [];
}

/** Pull a percentage out of a tax label like "GST 10%" → 10. */
function percentFromLabel(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/u);
  return match ? Number(match[1]) : null;
}

function normalizeItem(raw: unknown): InvoiceExtractionLineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;

  const lineId = normalizeString(v.lineId ?? v.lineItemId ?? v.lineNo ?? v.id ?? v.line_id);
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
    lineId,
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

  const taxLabel = normalizeString(v.taxLabel ?? v.taxDescription ?? v.tax_label);
  return {
    vendorName: normalizeString(v.vendorName ?? v.vendor ?? v.supplier),
    invoiceNumber: normalizeString(v.invoiceNumber ?? v.invoiceNo ?? v.invoice_number),
    poReferences: normalizePoReferences(v),
    issuedDate: normalizeString(v.issuedDate ?? v.invoiceDate ?? v.issued_date ?? v.date),
    dueDate: normalizeString(v.dueDate ?? v.due_date),
    paymentTerms: normalizeString(v.paymentTerms ?? v.terms ?? v.payment_terms),
    currency: normalizeString(v.currency)?.toUpperCase() ?? null,
    subTotal: parseNumber(v.subTotal ?? v.subtotal ?? v.sub_total),
    taxLabel,
    taxRate:
      parseNumber(v.taxRate ?? v.taxPercent ?? v.gstRate ?? v.tax_rate) ??
      percentFromLabel(taxLabel),
    taxAmount: parseNumber(v.taxAmount ?? v.tax ?? v.vat ?? v.tax_amount),
    totalAmount: parseNumber(v.totalAmount ?? v.total ?? v.grandTotal),
    items,
    notes: normalizeString(v.notes ?? v.remarks),
  };
}
