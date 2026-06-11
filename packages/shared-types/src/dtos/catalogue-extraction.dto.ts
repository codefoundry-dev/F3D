/**
 * Catalogue extraction result (FOR-228). Specialises the generic DocExtraction
 * `editedResult` payload for CATALOGUE-typed jobs.
 *
 * Two producers write this shape:
 *  - the direct Excel parser (`spreadsheetToCatalogue`) for spreadsheet uploads
 *    (deterministic, confidence = 1), and
 *  - the Gemini normalizer (`normalizeCatalogueResult`) for PDF/image uploads.
 *
 * It is consumed by the catalogue review table (frontend) and the bulk import
 * endpoint, so any change here flows to both ends. Dependency-free (no
 * @nestjs/swagger / class-validator) so it is safe to ship to the browser.
 */
export interface CatalogueLineItem {
  name: string;
  sku: string | null;
  /** Supplier's internal material code — distinct from sku / mpn / upc (US 4.01). */
  materialCode: string | null;
  brand: string | null;
  manufacturerPartNumber: string | null;
  upc: string | null;
  uom: string | null;
  description: string | null;
  mainCategory: string | null;
  subCategory: string | null;
  /** Country of manufacture / origin, when the catalogue states it. */
  countryOfOrigin: string | null;
  /** List / unit price as a plain number, when the catalogue carries pricing. */
  pricePerUnit: number | null;
  imageUrl: string | null;
  /**
   * 0–1 extraction confidence. Direct Excel parsing is deterministic (1); the
   * LLM path carries the model's per-row confidence or null when unknown.
   */
  confidence: number | null;
}

export interface CatalogueExtractionResult {
  sourceName: string | null;
  items: CatalogueLineItem[];
  notes: string | null;
}

export const EMPTY_CATALOGUE_RESULT: CatalogueExtractionResult = {
  sourceName: null,
  items: [],
  notes: null,
};

export function isCatalogueLineItem(value: unknown): value is CatalogueLineItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string';
}

export function isCatalogueExtractionResult(value: unknown): value is CatalogueExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && v.items.every(isCatalogueLineItem);
}
