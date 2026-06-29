import { z } from 'zod';

/**
 * Client-side validation for the "Add new material item" wizard and the Edit
 * Core / Edit Additional forms (US 4.01 Phase 2).
 *
 * Numeric inputs (price, dimension values, package counts) are kept as STRINGS
 * in the form so native `<input type="number">` empties round-trip cleanly; the
 * UI mapper parses them into numbers when building the create/update payload.
 * `dimensions` mirrors the API `MaterialDimensions` shape (string-valued here);
 * `specificData` is the open-ended "Specific data" card, mapped onto the API's
 * `properties` JSON.
 */

const numericString = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || v === '' || !Number.isNaN(Number(v)), {
    message: 'Must be a number',
  });

const dimensionValueSchema = z
  .object({
    value: numericString,
    uom: z.string().optional(),
  })
  .optional();

const packagingSchema = z
  .object({
    packagingUnit: z.string().optional(),
    unitsPerPackage: numericString,
    weightPerPackage: numericString,
  })
  .optional();

const dimensionsSchema = z
  .object({
    length: dimensionValueSchema,
    width: dimensionValueSchema,
    height: dimensionValueSchema,
    diameter: dimensionValueSchema,
    thickness: dimensionValueSchema,
    volume: dimensionValueSchema,
    weightPerUnit: dimensionValueSchema,
    packaging: packagingSchema,
  })
  .optional();

export const materialFormSchema = z.object({
  // ── Core identification (mandatory fields carry the design's asterisk) ──
  name: z.string().trim().min(1, 'Material name is required').max(255),
  categoryId: z.string().min(1, 'Category is required'),
  uom: z.string().min(1, 'Unit of measure is required'),
  countryOfOrigin: z.string().min(1, 'Country of origin is required'),
  // ── Core identification (optional) ──
  materialType: z.string().optional(),
  itemType: z.string().optional(),
  manufacturer: z.string().optional(),
  manufacturerSeriesModel: z.string().optional(),
  manufacturerPartNumber: z.string().optional(),
  upc: z.string().optional(),
  sku: z.string().optional(),
  gradeClass: z.string().optional(),
  standardNorm: z.string().optional(),
  colourFinish: z.string().optional(),
  size: z.string().optional(),
  pricePerUnit: numericString,
  currency: z.string().optional(),
  costCode: z.string().optional(),
  taxCode: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  // ── Additional properties ──
  dimensions: dimensionsSchema,
  specificData: z.record(z.string(), z.string()).optional(),
});

export type MaterialFormValues = z.infer<typeof materialFormSchema>;
