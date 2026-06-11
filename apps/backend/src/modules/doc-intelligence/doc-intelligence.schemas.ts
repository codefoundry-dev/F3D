/**
 * Gemini structured-output (`responseSchema`) definitions, one per extraction
 * type. Passing these alongside `responseMimeType: 'application/json'` makes
 * Gemini constrain decoding to the schema, so the response always parses and
 * always uses the canonical keys — the type-specific normalizers then only
 * have to coerce values (numbers, units), not chase drifting key names.
 *
 * Schemas use the OpenAPI 3.0 subset Gemini supports (type / properties /
 * items / required / nullable / propertyOrdering). GENERIC has no schema: its
 * contract is free-form `fields` / `tables` maps, which the subset cannot
 * express, so that type stays on plain JSON mode.
 */
import { DocExtractionType } from '@prisma/client';

type GeminiSchema = Record<string, unknown>;

const NULLABLE_STRING: GeminiSchema = { type: 'string', nullable: true };
const NULLABLE_NUMBER: GeminiSchema = { type: 'number', nullable: true };

const BOM_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    title: NULLABLE_STRING,
    projectName: NULLABLE_STRING,
    currency: NULLABLE_STRING,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: NULLABLE_NUMBER,
          unit: NULLABLE_STRING,
          targetPrice: NULLABLE_NUMBER,
          notes: NULLABLE_STRING,
        },
        required: ['description'],
        propertyOrdering: ['description', 'quantity', 'unit', 'targetPrice', 'notes'],
      },
    },
    notes: NULLABLE_STRING,
  },
  required: ['items'],
  propertyOrdering: ['title', 'projectName', 'currency', 'items', 'notes'],
};

const QUOTE_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    vendorName: NULLABLE_STRING,
    quoteNumber: NULLABLE_STRING,
    rfqReference: NULLABLE_STRING,
    currency: NULLABLE_STRING,
    totalAmount: NULLABLE_NUMBER,
    validUntil: NULLABLE_STRING,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: NULLABLE_NUMBER,
          unit: NULLABLE_STRING,
          unitPrice: NULLABLE_NUMBER,
          lineTotal: NULLABLE_NUMBER,
          leadTime: NULLABLE_STRING,
        },
        required: ['description'],
        propertyOrdering: ['description', 'quantity', 'unit', 'unitPrice', 'lineTotal', 'leadTime'],
      },
    },
    notes: NULLABLE_STRING,
  },
  required: ['items'],
  propertyOrdering: [
    'vendorName',
    'quoteNumber',
    'rfqReference',
    'currency',
    'totalAmount',
    'validUntil',
    'items',
    'notes',
  ],
};

const INVOICE_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    vendorName: NULLABLE_STRING,
    invoiceNumber: NULLABLE_STRING,
    poReferences: { type: 'array', items: { type: 'string' } },
    issuedDate: NULLABLE_STRING,
    dueDate: NULLABLE_STRING,
    paymentTerms: NULLABLE_STRING,
    currency: NULLABLE_STRING,
    subTotal: NULLABLE_NUMBER,
    taxLabel: NULLABLE_STRING,
    taxRate: NULLABLE_NUMBER,
    taxAmount: NULLABLE_NUMBER,
    totalAmount: NULLABLE_NUMBER,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lineId: NULLABLE_STRING,
          description: { type: 'string' },
          quantity: NULLABLE_NUMBER,
          unit: NULLABLE_STRING,
          unitPrice: NULLABLE_NUMBER,
          lineTotal: NULLABLE_NUMBER,
        },
        required: ['description'],
        propertyOrdering: ['lineId', 'description', 'quantity', 'unit', 'unitPrice', 'lineTotal'],
      },
    },
    notes: NULLABLE_STRING,
  },
  required: ['items'],
  propertyOrdering: [
    'vendorName',
    'invoiceNumber',
    'poReferences',
    'issuedDate',
    'dueDate',
    'paymentTerms',
    'currency',
    'subTotal',
    'taxLabel',
    'taxRate',
    'taxAmount',
    'totalAmount',
    'items',
    'notes',
  ],
};

const CATALOGUE_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    sourceName: NULLABLE_STRING,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          sku: NULLABLE_STRING,
          materialCode: NULLABLE_STRING,
          brand: NULLABLE_STRING,
          manufacturerPartNumber: NULLABLE_STRING,
          upc: NULLABLE_STRING,
          uom: NULLABLE_STRING,
          description: NULLABLE_STRING,
          mainCategory: NULLABLE_STRING,
          subCategory: NULLABLE_STRING,
          countryOfOrigin: NULLABLE_STRING,
          pricePerUnit: NULLABLE_NUMBER,
        },
        required: ['name'],
        propertyOrdering: [
          'name',
          'sku',
          'materialCode',
          'brand',
          'manufacturerPartNumber',
          'upc',
          'uom',
          'description',
          'mainCategory',
          'subCategory',
          'countryOfOrigin',
          'pricePerUnit',
        ],
      },
    },
    notes: NULLABLE_STRING,
  },
  required: ['items'],
  propertyOrdering: ['sourceName', 'items', 'notes'],
};

const SCHEMAS: Partial<Record<DocExtractionType, GeminiSchema>> = {
  BOM: BOM_SCHEMA,
  QUOTE: QUOTE_SCHEMA,
  INVOICE: INVOICE_SCHEMA,
  CATALOGUE: CATALOGUE_SCHEMA,
};

/** Response schema for the given type, or undefined for free-form (GENERIC). */
export function buildResponseSchema(type: DocExtractionType): GeminiSchema | undefined {
  return SCHEMAS[type];
}
