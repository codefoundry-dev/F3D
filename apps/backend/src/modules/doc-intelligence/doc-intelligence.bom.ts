import {
  type BomExtractionResult,
  type BomLineItem,
  EMPTY_BOM_RESULT,
} from '@forethread/shared-types';

/**
 * Canonicalises a unit-of-measure string so downstream consumers can group
 * "EA", "ea", "Ea." together. We keep the mapping small and conservative —
 * units we don't recognise pass through lowercased so the user can correct
 * them in the review UI.
 */
const UNIT_ALIASES: Record<string, string> = {
  ea: 'ea',
  each: 'ea',
  pc: 'ea',
  pcs: 'ea',
  piece: 'ea',
  pieces: 'ea',
  unit: 'ea',
  units: 'ea',
  m: 'm',
  meter: 'm',
  metre: 'm',
  meters: 'm',
  metres: 'm',
  lm: 'm',
  m2: 'm2',
  sqm: 'm2',
  'sq.m': 'm2',
  'sq m': 'm2',
  'm²': 'm2',
  m3: 'm3',
  'm³': 'm3',
  cbm: 'm3',
  kg: 'kg',
  kgs: 'kg',
  t: 't',
  ton: 't',
  tons: 't',
  tonne: 't',
  tonnes: 't',
  l: 'l',
  ltr: 'l',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  bag: 'bag',
  bags: 'bag',
  box: 'box',
  boxes: 'box',
  pack: 'pack',
  packs: 'pack',
  pallet: 'pallet',
  pallets: 'pallet',
  roll: 'roll',
  rolls: 'roll',
  sheet: 'sheet',
  sheets: 'sheet',
};

export function canonicalizeUnit(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().toLowerCase().replace(/\.$/u, '');
  if (cleaned.length === 0) return null;
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

/**
 * Coerces an arbitrary value to a finite positive number.
 *  - Accepts numbers directly.
 *  - Accepts strings like "1,250.00", "$1,250", "1.250,00" (EU style), "12 ea".
 *  - Returns null for empty / non-numeric / negative values.
 */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Strip currency symbols, spaces, and trailing unit hints.
  let cleaned = trimmed.replace(/[\s$€£¥₦₵]/gu, '');
  // Some BOMs put the unit after the qty ("12 ea"); keep only leading digits/.,
  const match = cleaned.match(/-?[\d.,]+/u);
  if (!match) return null;
  cleaned = match[0];

  // Pick a thousands separator vs decimal separator heuristically.
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // EU style "1.250,00" → "1250.00"
      cleaned = cleaned.replace(/\./gu, '').replace(',', '.');
    } else {
      // US style "1,250.00" → "1250.00"
      cleaned = cleaned.replace(/,/gu, '');
    }
  } else if (hasComma) {
    // Comma alone — treat as thousands when there are exactly 3 digits after it.
    const afterComma = cleaned.split(',').pop() ?? '';
    cleaned = afterComma.length === 3 ? cleaned.replace(/,/gu, '') : cleaned.replace(',', '.');
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function normalizeString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeItem(raw: unknown): BomLineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;

  const description = normalizeString(v.description);
  const quantity = parseNumber(v.quantity ?? v.qty);
  const unit = canonicalizeUnit(
    normalizeString(v.unit) ?? normalizeString(v.uom) ?? normalizeString(v.units),
  );
  const targetPrice = parseNumber(v.targetPrice ?? v.unitPrice ?? v.price ?? v.target_price);
  const notes = normalizeString(v.notes ?? v.note ?? v.remarks);

  // Drop header / blank rows.
  if (!description && quantity === null) return null;

  return {
    description: description ?? '',
    quantity,
    unit,
    targetPrice,
    notes,
  };
}

/**
 * Normalize the raw JSON Gemini returned for a BOM extraction into the
 * canonical {@link BomExtractionResult} shape used by the review UI and any
 * downstream BOM consumer (e.g. RFQ creation in FOR-200).
 *
 * The function is defensive: it accepts arbitrary input (Gemini sometimes
 * returns slightly different keys) and always returns a valid result.
 */
export function normalizeBomResult(raw: unknown): BomExtractionResult {
  if (!raw || typeof raw !== 'object') return EMPTY_BOM_RESULT;
  const v = raw as Record<string, unknown>;
  const itemsArray = Array.isArray(v.items)
    ? v.items
    : Array.isArray(v.lineItems)
      ? v.lineItems
      : [];

  const items = itemsArray
    .map(normalizeItem)
    .filter((item): item is BomLineItem => item !== null);

  return {
    title: normalizeString(v.title ?? v.documentTitle),
    projectName: normalizeString(v.projectName ?? v.project),
    currency: normalizeString(v.currency)?.toUpperCase() ?? null,
    items,
    notes: normalizeString(v.notes ?? v.remarks),
  };
}
