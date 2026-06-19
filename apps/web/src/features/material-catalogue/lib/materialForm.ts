import {
  type CreateMaterialInput,
  type MaterialDetailDto,
  type MaterialDimensions,
  type MaterialDimensionValue,
  type MaterialPackaging,
  type UpdateMaterialInput,
} from '@forethread/api-client';
import { type MaterialFormValues } from '@forethread/shared-types/client';

/**
 * Form ↔ API mappers for the material create / edit forms (US 4.01 Phase 2).
 *
 * The form keeps every numeric input as a STRING (so empty `<input>`s round-trip
 * cleanly) and models dimensions as `{ value: string, uom: string }`. These
 * helpers parse the strings into numbers, prune empty entries, and project the
 * "Specific data" card onto the API's open-ended `properties` map.
 */

/** Axes rendered as `{ number, uom }` pairs in the Dimensions card. */
const DIMENSION_AXES = [
  'length',
  'width',
  'height',
  'diameter',
  'thickness',
  'volume',
  'weightPerUnit',
] as const;

/** Blank form state for the create wizard. */
export const emptyMaterialForm: MaterialFormValues = {
  name: '',
  categoryId: '',
  uom: '',
  countryOfOrigin: '',
  materialType: '',
  itemType: '',
  manufacturer: '',
  manufacturerSeriesModel: '',
  manufacturerPartNumber: '',
  upc: '',
  sku: '',
  gradeClass: '',
  standardNorm: '',
  colourFinish: '',
  size: '',
  pricePerUnit: '',
  currency: 'AUD',
  description: '',
  imageUrl: '',
  dimensions: {
    length: { value: '', uom: '' },
    width: { value: '', uom: '' },
    height: { value: '', uom: '' },
    diameter: { value: '', uom: '' },
    thickness: { value: '', uom: '' },
    volume: { value: '', uom: '' },
    weightPerUnit: { value: '', uom: '' },
    packaging: { packagingUnit: '', unitsPerPackage: '', weightPerPackage: '' },
  },
  // Category-driven; AdditionalPropertiesFields seeds the active schema's keys.
  specificData: {},
};

// ── detail → form ─────────────────────────────────────────────────────────────

function numToStr(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

function dimToForm(d: MaterialDimensionValue | undefined): { value: string; uom: string } {
  return { value: numToStr(d?.value), uom: d?.uom ?? '' };
}

/** Build form values from a loaded material (Edit Core / Edit Additional). */
export function detailToForm(material: MaterialDetailDto): MaterialFormValues {
  const dims = material.dimensions ?? null;
  const packaging = dims?.packaging;

  // Surface every stored property as a string. The form's category-driven
  // "Specific data" section (AdditionalPropertiesFields) reconciles these
  // against the selected category's schema — keeping the material's own
  // attributes and preserving any custom / imported keys.
  const specificData: Record<string, string> = {};
  if (material.properties) {
    for (const [key, value] of Object.entries(material.properties)) {
      specificData[key] = value === null || value === undefined ? '' : String(value);
    }
  }

  return {
    name: material.name ?? '',
    categoryId: material.categoryId ?? '',
    uom: material.uom ?? '',
    countryOfOrigin: material.countryOfOrigin ?? '',
    materialType: material.materialType ?? '',
    itemType: material.itemType ?? '',
    manufacturer: material.manufacturer ?? material.brand ?? '',
    manufacturerSeriesModel: material.manufacturerSeriesModel ?? '',
    manufacturerPartNumber: material.manufacturerPartNumber ?? '',
    upc: material.upc ?? '',
    sku: material.sku ?? '',
    gradeClass: material.gradeClass ?? '',
    standardNorm: material.standardNorm ?? '',
    colourFinish: material.colourFinish ?? '',
    size: material.size ?? '',
    pricePerUnit: material.pricePerUnit ?? '',
    currency: material.currency ?? 'AUD',
    description: material.description ?? '',
    imageUrl: material.imageUrl ?? '',
    dimensions: {
      length: dimToForm(dims?.length),
      width: dimToForm(dims?.width),
      height: dimToForm(dims?.height),
      diameter: dimToForm(dims?.diameter),
      thickness: dimToForm(dims?.thickness),
      volume: dimToForm(dims?.volume),
      weightPerUnit: dimToForm(dims?.weightPerUnit),
      packaging: {
        packagingUnit: packaging?.packagingUnit ?? '',
        unitsPerPackage: numToStr(packaging?.unitsPerPackage),
        weightPerPackage: numToStr(packaging?.weightPerPackage),
      },
    },
    specificData,
  };
}

// ── form → API ────────────────────────────────────────────────────────────────

function trimOrUndefined(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

function parseNumber(v: string | undefined): number | undefined {
  const t = v?.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

/** Build a single `{ value, uom }` axis, or `undefined` when both are empty. */
function buildDimension(
  entry: { value?: string; uom?: string } | undefined,
): MaterialDimensionValue | undefined {
  const value = parseNumber(entry?.value);
  const uom = trimOrUndefined(entry?.uom);
  if (value === undefined && uom === undefined) return undefined;
  return { value: value ?? null, uom: uom ?? null };
}

function buildPackaging(
  packaging:
    | { packagingUnit?: string; unitsPerPackage?: string; weightPerPackage?: string }
    | undefined,
): MaterialPackaging | undefined {
  const packagingUnit = trimOrUndefined(packaging?.packagingUnit);
  const unitsPerPackage = parseNumber(packaging?.unitsPerPackage);
  const weightPerPackage = parseNumber(packaging?.weightPerPackage);
  if (
    packagingUnit === undefined &&
    unitsPerPackage === undefined &&
    weightPerPackage === undefined
  ) {
    return undefined;
  }
  const out: MaterialPackaging = {};
  if (packagingUnit !== undefined) out.packagingUnit = packagingUnit;
  if (unitsPerPackage !== undefined) out.unitsPerPackage = unitsPerPackage;
  if (weightPerPackage !== undefined) out.weightPerPackage = weightPerPackage;
  return out;
}

/** Project the Dimensions + Packaging cards onto the API shape, pruning empties.
 *  Returns `undefined` when nothing was filled in. */
function buildDimensions(values: MaterialFormValues): MaterialDimensions | undefined {
  const dims = values.dimensions;
  const out: MaterialDimensions = {};
  for (const axis of DIMENSION_AXES) {
    const built = buildDimension(dims?.[axis]);
    if (built) out[axis] = built;
  }
  const packaging = buildPackaging(dims?.packaging);
  if (packaging) out.packaging = packaging;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Project the Specific-data card onto the API `properties` map, pruning empties.
 *  Returns `undefined` when no property carries a value. */
function buildProperties(values: MaterialFormValues): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values.specificData ?? {})) {
    const v = raw?.trim();
    if (v) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The Core-identification fields, shared by create + edit-core. */
function coreFields(values: MaterialFormValues) {
  return {
    name: values.name.trim(),
    categoryId: values.categoryId,
    uom: values.uom,
    countryOfOrigin: trimOrUndefined(values.countryOfOrigin),
    materialType: trimOrUndefined(values.materialType),
    itemType: trimOrUndefined(values.itemType),
    manufacturer: trimOrUndefined(values.manufacturer),
    manufacturerSeriesModel: trimOrUndefined(values.manufacturerSeriesModel),
    manufacturerPartNumber: trimOrUndefined(values.manufacturerPartNumber),
    upc: trimOrUndefined(values.upc),
    sku: trimOrUndefined(values.sku),
    gradeClass: trimOrUndefined(values.gradeClass),
    standardNorm: trimOrUndefined(values.standardNorm),
    colourFinish: trimOrUndefined(values.colourFinish),
    size: trimOrUndefined(values.size),
    pricePerUnit: parseNumber(values.pricePerUnit),
    currency: trimOrUndefined(values.currency),
    description: trimOrUndefined(values.description),
    imageUrl: trimOrUndefined(values.imageUrl),
  };
}

/** Drop keys whose value is `undefined` so a PATCH only carries set fields. */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Full create payload (Core + Additional). */
export function formToCreateInput(values: MaterialFormValues): CreateMaterialInput {
  const input: CreateMaterialInput = {
    ...coreFields(values),
    name: values.name.trim(),
    dimensions: buildDimensions(values),
    properties: buildProperties(values),
  };
  return pruneUndefined(
    input as unknown as Record<string, unknown>,
  ) as unknown as CreateMaterialInput;
}

/** PATCH payload that owns ONLY the Core-identification fields. */
export function formToUpdateCore(values: MaterialFormValues): UpdateMaterialInput {
  return pruneUndefined(
    coreFields(values) as unknown as Record<string, unknown>,
  ) as unknown as UpdateMaterialInput;
}

/** PATCH payload that owns ONLY the Additional-properties fields. */
export function formToUpdateAdditional(values: MaterialFormValues): UpdateMaterialInput {
  return {
    dimensions: buildDimensions(values),
    properties: buildProperties(values),
  };
}
