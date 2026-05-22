import { DocExtractionType } from '@prisma/client';

const BASE_INSTRUCTION = `You are a careful procurement document parser.
Extract structured data from the attached document and respond with a single JSON object.
Use null for values you cannot find; never invent data. Strip trailing whitespace and currency symbols from numeric fields.`;

const TYPE_PROMPTS: Record<DocExtractionType, string> = {
  BOM: `${BASE_INSTRUCTION}

Return JSON shaped exactly like:
{
  "title": string | null,
  "projectName": string | null,
  "items": Array<{
    "description": string,
    "quantity": number | null,
    "unit": string | null,
    "unitPrice": number | null,
    "notes": string | null
  }>,
  "notes": string | null
}`,
  QUOTE: `${BASE_INSTRUCTION}

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
    "lineTotal": number | null
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
