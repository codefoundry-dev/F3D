import { PickUpTimeExpectation } from '@forethread/shared-types/client';
import { z } from 'zod';

// ── PO creation mode types ───────────────────────────────────────────────────

export type PoCreationMode = 'manual' | 'from-rfq' | 'from-bulk-order';

export type LockedField = 'projectId' | 'vendorId' | 'deliveryLocationId' | 'plannedDeliveryDate';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const lineItemSchema = z.object({
  materialName: z.string().min(1, 'Required'),
  materialCode: z.string().optional(),
  costCode: z.string().optional(),
  unitOfMeasure: z.string().min(1, 'Required'),
  unitPrice: z.coerce.number().min(0, 'Must be >= 0'),
  quantityOrdered: z.coerce.number().int().min(1, 'Must be >= 1'),
  expectedDeliveryDate: z.string().optional(),
  deliveryLocationId: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

// FOR-210: a single header-level delivery row. Both fields are optional, but a
// non-empty row must carry at least a location or a date (mirrors the backend
// 400 rule). Fully-empty trailing rows are stripped via preprocess below.
export const deliveryRowSchema = z
  .object({
    deliveryLocationId: z.string().optional(),
    deliveryDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((row) => Boolean(row.deliveryLocationId) || Boolean(row.deliveryDate), {
    message: 'Add a location or a date',
    path: ['deliveryLocationId'],
  });

/** A delivery row is "empty" when it has neither a location nor a date. */
export function isEmptyDeliveryRow(row: {
  deliveryLocationId?: string;
  deliveryDate?: string;
  notes?: string;
}): boolean {
  return !row?.deliveryLocationId && !row?.deliveryDate;
}

export const formSchema = z.object({
  // Step 1
  documentName: z.string().min(1, 'Required'),
  projectId: z.string().min(1, 'Required'),
  vendorId: z.string().optional(),
  paymentTermsDays: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().int().min(0, 'Must be >= 0').max(365, 'Must be <= 365').optional(),
  ),
  deliveryLocationId: z.string().min(1, 'Required'),
  plannedDeliveryDate: z.string().min(1, 'Required'),
  pickUp: z.boolean().optional(),
  // US 5.15 — captured only when pickUp is enabled (collected from vendor, not delivered)
  pickUpTimeExpectation: z.nativeEnum(PickUpTimeExpectation).optional(),
  holdForRelease: z.boolean().optional(),
  // Step 2 — preprocess to strip empty trailing rows before validation
  lineItems: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) return val;
      return val.filter(
        (item: Record<string, unknown>) => item && typeof item === 'object' && item.materialName,
      );
    },
    z.array(lineItemSchema).min(1, 'At least one line item required'),
  ),
  // Step 1 — multi-delivery (FOR-210). Preprocess strips empty trailing rows
  // before validation, mirroring the lineItems pattern.
  deliveries: z
    .preprocess((val) => {
      if (!Array.isArray(val)) return val;
      return val.filter(
        (row: Record<string, unknown>) =>
          row && typeof row === 'object' && (row.deliveryLocationId || row.deliveryDate),
      );
    }, z.array(deliveryRowSchema))
    .optional(),
  // Step 3
  message: z.string().optional(),
});

/** Field names validated on each step — used by trigger() */
export const STEP1_FIELDS = [
  'documentName',
  'projectId',
  'deliveryLocationId',
  'plannedDeliveryDate',
] as const;

export const STEP2_FIELDS = ['lineItems'] as const;

export type FormValues = z.infer<typeof formSchema>;

export const EMPTY_LINE_ITEM = {
  materialName: '',
  materialCode: '',
  costCode: '',
  unitOfMeasure: '',
  unitPrice: 0,
  quantityOrdered: 0,
  expectedDeliveryDate: '',
  deliveryLocationId: '',
  description: '',
  notes: '',
};

export const EMPTY_DELIVERY_ROW = {
  deliveryLocationId: '',
  deliveryDate: '',
  notes: '',
};

/**
 * FOR-210: map form delivery rows to the API `PoDeliveryInput[]` shape, dropping
 * fully-empty rows and converting dates to ISO-8601. Extracted as a pure helper
 * so it can be unit-tested independently of the form.
 */
export function mapDeliveriesToPayload(
  rows: { deliveryLocationId?: string; deliveryDate?: string; notes?: string }[] | undefined,
): { deliveryLocationId?: string; deliveryDate?: string; notes?: string }[] | undefined {
  if (!rows) return undefined;
  const mapped = rows
    .filter((row) => !isEmptyDeliveryRow(row))
    .map((row) => ({
      deliveryLocationId: row.deliveryLocationId || undefined,
      deliveryDate: row.deliveryDate ? new Date(row.deliveryDate).toISOString() : undefined,
      notes: row.notes || undefined,
    }));
  return mapped.length > 0 ? mapped : undefined;
}
