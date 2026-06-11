/**
 * Catalogue extraction helpers (FOR-228).
 *
 * Two entry points feed the canonical {@link CatalogueExtractionResult} shape:
 *  - {@link normalizeCatalogueResult} — defensive normalizer for the LLM
 *    (PDF/image) path, mirroring `normalizeBomResult`.
 *  - {@link spreadsheetToCatalogue} — a DIRECT exceljs parser for spreadsheet
 *    uploads (no LLM). Catalogues are large (60k+ rows) and already tabular, so
 *    parsing them deterministically is faster, free, and exact.
 */
import {
  type CatalogueExtractionResult,
  type CatalogueLineItem,
  EMPTY_CATALOGUE_RESULT,
} from '@forethread/shared-types';

import { canonicalizeUnit, parseNumber } from './doc-intelligence.bom';

// ── exceljs typings (CommonJS module, see doc-intelligence.spreadsheet.ts) ────

interface ExcelCellValue {
  text?: string;
  result?: unknown;
  error?: unknown;
  hyperlink?: string;
  richText?: Array<{ text?: string }>;
}

interface ExcelRow {
  values?: unknown[];
}

interface ExcelWorksheet {
  name: string;
  eachRow(opts: { includeEmpty: boolean }, cb: (row: ExcelRow, rowNumber: number) => void): void;
}

interface ExcelWorkbook {
  xlsx: { load(buffer: Buffer): Promise<ExcelWorkbook> };
  worksheets: ExcelWorksheet[];
}

interface ExcelJsModule {
  Workbook: new () => ExcelWorkbook;
}

/** Flatten a single exceljs cell value into a plain string. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as ExcelCellValue;
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? '').join('');
    if (typeof v.text === 'string') return v.text;
    if ('result' in v) return cellToString(v.result);
    if (typeof v.error === 'string') return v.error;
    if (typeof v.hyperlink === 'string') return v.hyperlink;
  }
  return '';
}

function emptyToNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ── Header synonyms ───────────────────────────────────────────────────────────

/**
 * Logical field → accepted header labels (case-insensitive, trimmed). The first
 * matching header column wins for each field.
 *
 * `name` and `description` are deliberately disjoint: when a sheet has both a
 * "Material Description" column AND a separate "description"/"long description"
 * column, the former is the product NAME and the latter is the long blurb. We
 * resolve `name` first, then resolve `description` against any *remaining*
 * description-like column that is not already claimed as the name.
 */
type CatalogueField =
  | 'name'
  | 'sku'
  | 'materialCode'
  | 'brand'
  | 'manufacturerPartNumber'
  | 'upc'
  | 'uom'
  | 'mainCategory'
  | 'subCategory'
  | 'countryOfOrigin'
  | 'pricePerUnit'
  | 'imageUrl'
  | 'status';

const NAME_SYNONYMS = ['material description', 'name', 'product', 'product name', 'item'];
const DESCRIPTION_SYNONYMS = ['description', 'long description'];

const SYNONYMS: Record<Exclude<CatalogueField, 'name'>, string[]> = {
  sku: ['sku', 'code', 'item code', 'product code', 'stock code'],
  materialCode: ['material code', 'materialcode', 'mat code', 'material id', 'material no'],
  brand: ['brandname', 'brand'],
  manufacturerPartNumber: [
    'manufacturer part numbr',
    'manufacturer part number',
    'mfr part number',
    'mpn',
    'part number',
    'part no',
  ],
  upc: ['upc', 'barcode', 'ean', 'gtin'],
  uom: ['uom', 'unit', 'unit of measure', 'units'],
  mainCategory: ['main category', 'category'],
  subCategory: ['sub category', 'subcategory', 'sub-category', 'material type', 'mat. type'],
  countryOfOrigin: ['country of origin', 'country', 'origin', 'made in'],
  pricePerUnit: ['price per unit', 'unit price', 'price', 'list price', 'rrp'],
  imageUrl: ['imageurl', 'image url', 'image', 'image link'],
  status: ['status'],
};

const SKIP_STATUSES: ReadonlySet<string> = new Set(['obsolete', 'inactive', 'archived']);

interface ColumnMap {
  name: number | undefined;
  description: number | undefined;
  sku: number | undefined;
  materialCode: number | undefined;
  brand: number | undefined;
  manufacturerPartNumber: number | undefined;
  upc: number | undefined;
  uom: number | undefined;
  mainCategory: number | undefined;
  subCategory: number | undefined;
  countryOfOrigin: number | undefined;
  pricePerUnit: number | undefined;
  imageUrl: number | undefined;
  status: number | undefined;
}

/**
 * Build a header label → 0-based column index lookup, then resolve each logical
 * field to a column. `name` and `description` are disambiguated per the rule
 * above.
 */
function buildColumnMap(headerCells: string[]): ColumnMap {
  const labelToIndex = new Map<string, number>();
  headerCells.forEach((cell, idx) => {
    const key = cell.trim().toLowerCase();
    if (key.length > 0 && !labelToIndex.has(key)) labelToIndex.set(key, idx);
  });

  const find = (labels: string[]): number | undefined => {
    for (const label of labels) {
      const idx = labelToIndex.get(label);
      if (idx !== undefined) return idx;
    }
    return undefined;
  };

  const name = find(NAME_SYNONYMS);
  // Description prefers a description-like column that is NOT the name column.
  let description: number | undefined;
  for (const label of DESCRIPTION_SYNONYMS) {
    const idx = labelToIndex.get(label);
    if (idx !== undefined && idx !== name) {
      description = idx;
      break;
    }
  }

  return {
    name,
    description,
    sku: find(SYNONYMS.sku),
    materialCode: find(SYNONYMS.materialCode),
    brand: find(SYNONYMS.brand),
    manufacturerPartNumber: find(SYNONYMS.manufacturerPartNumber),
    upc: find(SYNONYMS.upc),
    uom: find(SYNONYMS.uom),
    mainCategory: find(SYNONYMS.mainCategory),
    subCategory: find(SYNONYMS.subCategory),
    countryOfOrigin: find(SYNONYMS.countryOfOrigin),
    pricePerUnit: find(SYNONYMS.pricePerUnit),
    imageUrl: find(SYNONYMS.imageUrl),
    status: find(SYNONYMS.status),
  };
}

function cellAt(cells: string[], idx: number | undefined): string | null {
  if (idx === undefined) return null;
  const raw = cells[idx];
  return raw === undefined ? null : emptyToNull(raw);
}

/**
 * How many leading rows to scan for a recognisable header row. Real catalogue
 * exports often put a title / export-date banner above the headers, so blindly
 * treating the first non-empty row as headers silently yields zero items.
 */
const HEADER_SCAN_LIMIT = 10;

/**
 * Directly parse an `.xlsx` catalogue buffer into a CatalogueExtractionResult —
 * no LLM. Reads the FIRST worksheet, finds the header row by scanning the
 * first {@link HEADER_SCAN_LIMIT} rows for one that resolves a `name` column,
 * then maps every following row through the synonym table. Rows with no name,
 * or whose status is OBSOLETE/INACTIVE/ARCHIVED, are skipped. Confidence is 1
 * for every directly parsed row (deterministic). Designed to handle 60k+ rows
 * efficiently — it streams rows and never materialises the sheet as one big
 * string.
 */
export async function spreadsheetToCatalogue(buffer: Buffer): Promise<CatalogueExtractionResult> {
  // exceljs is CommonJS; require keeps it consistent with the rest of the backend.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJS = require('exceljs') as ExcelJsModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { ...EMPTY_CATALOGUE_RESULT };

  let columns: ColumnMap | null = null;
  let headerSearchExhausted = false;
  const items: CatalogueLineItem[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // row.values is 1-based; index 0 is always empty. Slice to a 0-based array.
    const cells = (row.values ?? []).slice(1).map(cellToString);

    if (columns === null) {
      if (headerSearchExhausted) return;
      const candidate = buildColumnMap(cells);
      if (candidate.name !== undefined) {
        columns = candidate;
      } else if (rowNumber >= HEADER_SCAN_LIMIT) {
        headerSearchExhausted = true;
      }
      return;
    }

    const name = cellAt(cells, columns.name);
    if (name === null) return; // skip header-less / blank rows

    const status = cellAt(cells, columns.status);
    if (status !== null && SKIP_STATUSES.has(status.toLowerCase())) return;

    items.push({
      name,
      sku: cellAt(cells, columns.sku),
      materialCode: cellAt(cells, columns.materialCode),
      brand: cellAt(cells, columns.brand),
      manufacturerPartNumber: cellAt(cells, columns.manufacturerPartNumber),
      upc: cellAt(cells, columns.upc),
      uom: canonicalizeUnit(cellAt(cells, columns.uom)),
      description: cellAt(cells, columns.description),
      mainCategory: cellAt(cells, columns.mainCategory),
      subCategory: cellAt(cells, columns.subCategory),
      countryOfOrigin: cellAt(cells, columns.countryOfOrigin),
      pricePerUnit: parseNumber(cellAt(cells, columns.pricePerUnit)),
      imageUrl: cellAt(cells, columns.imageUrl),
      confidence: 1,
    });
  });

  return {
    sourceName: emptyToNull(sheet.name),
    items,
    // Surface the previously silent failure mode so the review UI can explain
    // an empty result instead of showing a blank table.
    notes:
      columns === null
        ? `No header row with a recognisable product name column was found in the first ${HEADER_SCAN_LIMIT} rows.`
        : null,
  };
}

// ── LLM-path normalizer (PDF / image) ─────────────────────────────────────────

function normalizeString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asNullableNumber(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function normalizeCatalogueItem(raw: unknown): CatalogueLineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;

  const name = normalizeString(v.name ?? v.description ?? v.product ?? v.productName);
  // Drop rows with no name.
  if (!name) return null;

  return {
    name,
    sku: normalizeString(v.sku ?? v.code ?? v.itemCode ?? v.productCode),
    materialCode: normalizeString(v.materialCode ?? v.material_code ?? v.matCode),
    brand: normalizeString(v.brand ?? v.brandName),
    manufacturerPartNumber: normalizeString(
      v.manufacturerPartNumber ?? v.mpn ?? v.partNumber ?? v.manufacturerPartNumbr,
    ),
    upc: normalizeString(v.upc ?? v.barcode ?? v.ean ?? v.gtin),
    uom: canonicalizeUnit(normalizeString(v.uom ?? v.unit ?? v.units)),
    description: normalizeString(v.description ?? v.longDescription),
    mainCategory: normalizeString(v.mainCategory ?? v.category),
    subCategory: normalizeString(v.subCategory ?? v.subcategory),
    countryOfOrigin: normalizeString(
      v.countryOfOrigin ?? v.country ?? v.origin ?? v.country_of_origin,
    ),
    pricePerUnit: parseNumber(v.pricePerUnit ?? v.price ?? v.unitPrice ?? v.listPrice),
    imageUrl: normalizeString(v.imageUrl ?? v.image ?? v.imageLink),
    confidence: asNullableNumber(v.confidence),
  };
}

/**
 * Normalize the raw JSON Gemini returned for a CATALOGUE extraction into the
 * canonical {@link CatalogueExtractionResult}. Defensive — accepts arbitrary
 * input (Gemini sometimes shifts keys) and always returns a valid result. Used
 * only on the PDF/image path; spreadsheets go through `spreadsheetToCatalogue`.
 */
export function normalizeCatalogueResult(raw: unknown): CatalogueExtractionResult {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_CATALOGUE_RESULT };
  const v = raw as Record<string, unknown>;
  const itemsArray = Array.isArray(v.items)
    ? v.items
    : Array.isArray(v.lineItems)
      ? v.lineItems
      : [];

  const items = itemsArray
    .map(normalizeCatalogueItem)
    .filter((item): item is CatalogueLineItem => item !== null);

  return {
    sourceName: normalizeString(v.sourceName ?? v.source ?? v.title),
    items,
    notes: normalizeString(v.notes ?? v.remarks),
  };
}
