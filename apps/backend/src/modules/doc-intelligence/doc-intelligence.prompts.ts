import { DocExtractionType } from '@prisma/client';

const BASE_INSTRUCTION = `You are a careful procurement document parser.
Extract structured data from the attached document and respond with a single JSON object.
Use null for values you cannot find; never invent data. Strip trailing whitespace and currency symbols from numeric fields.`;

const TYPE_PROMPTS: Record<DocExtractionType, string> = {
  BOM: `${BASE_INSTRUCTION}

This document is a construction Bill of Materials (BOM). Each row represents
a material the contractor needs to source. Extract every line item — do not
collapse rows. Preserve the order they appear in the document.

For each item:
- "description": full material description as written (trim whitespace).
- "quantity": numeric quantity, parsed from the qty column. Use null if absent.
- "unit": unit of measure (e.g. "ea", "m", "m2", "kg", "bag", "pallet"). Lowercase.
- "targetPrice": the contractor's target / estimated unit price as a plain number.
  Strip currency symbols and thousand separators. Null if no price column.
- "notes": any per-row note (size, grade, spec reference). Null when empty.

Drop rows that have no description AND no quantity (header / blank rows).

Return JSON shaped exactly like:
{
  "title": string | null,
  "projectName": string | null,
  "currency": string | null,
  "items": Array<{
    "description": string,
    "quantity": number | null,
    "unit": string | null,
    "targetPrice": number | null,
    "notes": string | null
  }>,
  "notes": string | null
}`,
  QUOTE: `${BASE_INSTRUCTION}

This document is a vendor's price quotation responding to a request. Extract every
priced line item — do not collapse rows. Preserve the order they appear.

For each item:
- "description": full item / material description as written (trim whitespace).
- "quantity": numeric quantity quoted. Null if absent.
- "unit": unit of measure (e.g. "ea", "m", "m2", "kg", "bag", "pallet"). Lowercase.
- "unitPrice": price per unit as a plain number. Strip currency symbols and
  thousand separators. Null if not stated.
- "lineTotal": extended line total (qty × unit price) as a plain number. Null if absent.
- "leadTime": delivery / lead time exactly as written (e.g. "2 weeks", "in stock",
  "5 business days"). Null when no per-row lead time is given.

Drop rows that have no description AND no unit price (header / subtotal / blank rows).

Return JSON shaped exactly like:
{
  "vendorName": string | null,
  "quoteNumber": string | null,
  "rfqReference": string | null,
  "currency": string | null,
  "totalAmount": number | null,
  "validUntil": string | null,
  "items": Array<{
    "description": string,
    "quantity": number | null,
    "unit": string | null,
    "unitPrice": number | null,
    "lineTotal": number | null,
    "leadTime": string | null
  }>,
  "notes": string | null
}`,
  INVOICE: `${BASE_INSTRUCTION}

Return JSON shaped exactly like:
{
  "vendorName": string | null,
  "invoiceNumber": string | null,
  "poReference": string | null,
  "issuedDate": string | null,
  "dueDate": string | null,
  "currency": string | null,
  "subTotal": number | null,
  "taxAmount": number | null,
  "totalAmount": number | null,
  "items": Array<{
    "description": string,
    "quantity": number | null,
    "unit": string | null,
    "unitPrice": number | null,
    "lineTotal": number | null
  }>,
  "notes": string | null
}`,
  GENERIC: `${BASE_INSTRUCTION}

Return JSON with whatever fields and tables you find. Top-level keys must be camelCase.
At minimum include:
{
  "title": string | null,
  "summary": string | null,
  "fields": Record<string, string | number | null>,
  "tables": Array<{
    "name": string | null,
    "rows": Array<Record<string, string | number | null>>
  }>
}`,
};

export function buildExtractionPrompt(type: DocExtractionType, hint?: string): string {
  const base = TYPE_PROMPTS[type];
  if (!hint || hint.trim().length === 0) return base;
  return `${base}\n\nAdditional caller hint: ${hint.trim()}`;
}
