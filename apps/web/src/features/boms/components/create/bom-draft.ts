import type { CreateBomItemInput } from '@forethread/api-client';
import {
  isBomExtractionResult,
  type BomCatalogueCandidate,
  type BomExtractionResult,
  type BomLineItem,
} from '@forethread/shared-types/client';

/**
 * Editable state of one review-table row (Step 2 of the Create BOM wizard).
 * Quantity is kept as the raw input string so partial entries ("12.") don't
 * fight the keyboard.
 */
export interface BomDraftRow {
  materialName: string;
  description: string;
  uom: string;
  quantity: string;
  category: string;
  materialType: string;
  matchedMaterialId: string | null;
  matchedMaterialName: string | null;
  /** Auto/candidate similarity score; null once the user picked manually. */
  matchConfidence: number | null;
  candidates: BomCatalogueCandidate[];
  /** Resolved by hand this session (manual pick / created material) — blue row tint. */
  manuallyResolved: boolean;
}

/** First value that is a non-blank string, else ''. */
export function firstNonEmpty(...values: (string | undefined | null)[]): string {
  for (const value of values) {
    if (value && value.trim() !== '') return value;
  }
  return '';
}

export function emptyRow(): BomDraftRow {
  return {
    materialName: '',
    description: '',
    uom: '',
    quantity: '',
    category: '',
    materialType: '',
    matchedMaterialId: null,
    matchedMaterialName: null,
    matchConfidence: null,
    candidates: [],
    manuallyResolved: false,
  };
}

/** True when the user hasn't typed anything into the row (trailing add-row). */
export function isRowEmpty(row: BomDraftRow): boolean {
  return (
    row.materialName.trim() === '' &&
    row.description.trim() === '' &&
    row.quantity.trim() === '' &&
    row.uom.trim() === '' &&
    row.matchedMaterialId === null
  );
}

function rowFromLineItem(item: BomLineItem): BomDraftRow {
  const candidates = item.matchCandidates ?? [];
  // Resolve the catalogue material this line is matched to. High-confidence
  // lines arrive already matched (matchedMaterialId set by the extractor).
  // Lower-confidence lines arrive as ranked suggestions instead — accept the
  // top one by default so the user isn't forced to confirm every row to proceed,
  // but the row stays flagged for review (amber + confidence badge, see
  // rowTint) so a wrong guess is easy to spot and override. A line with no
  // candidates at all stays unmatched and must be resolved by hand.
  const matchedMaterialId = item.matchedMaterialId ?? candidates[0]?.materialId ?? null;
  const source = matchedMaterialId
    ? candidates.find((candidate) => candidate.materialId === matchedMaterialId)
    : undefined;
  return {
    materialName: item.description,
    description: item.description,
    uom: item.unit ?? '',
    quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '',
    // Category / Material type come from the matched (or accepted) catalogue
    // material; both stay user-editable, blank only with no associated material.
    category: source?.category ?? '',
    materialType: source?.subCategory ?? '',
    matchedMaterialId,
    matchedMaterialName: item.matchedMaterialName ?? source?.name ?? null,
    matchConfidence: item.matchConfidence ?? source?.confidence ?? null,
    candidates,
    manuallyResolved: false,
  };
}

/** Map a completed BOM extraction result into editable review rows. */
export function rowsFromExtraction(result: unknown): BomDraftRow[] {
  if (!isBomExtractionResult(result)) return [];
  return result.items.map(rowFromLineItem);
}

function parseQuantity(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed.replace(/[,\s]/gu, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return numeric;
}

/** Non-empty rows, in display order. */
export function realRows(rows: BomDraftRow[]): BomDraftRow[] {
  return rows.filter((row) => !isRowEmpty(row));
}

/** Rows that still need a catalogue match before the wizard may continue. */
export function unmatchedCount(rows: BomDraftRow[]): number {
  return realRows(rows).filter((row) => !row.matchedMaterialId).length;
}

/** Map the reviewed rows to the POST /boms payload. */
export function rowsToCreateItems(rows: BomDraftRow[]): CreateBomItemInput[] {
  return realRows(rows).map((row, index) => ({
    materialName: row.materialName.trim() || row.description.trim(),
    matchedMaterialId: row.matchedMaterialId as string,
    description: row.description.trim() || undefined,
    uom: row.uom.trim() || undefined,
    quantity: parseQuantity(row.quantity),
    category: row.category.trim() || undefined,
    materialType: row.materialType.trim() || undefined,
    matchConfidence: row.matchConfidence ?? undefined,
    sortOrder: index,
  }));
}

/**
 * Map the reviewed rows back into the canonical extraction-result shape, used
 * to confirm the source doc extraction with the user's final edits (keeps
 * "RFQ from BOM" and the extraction history consistent with the saved BOM).
 */
export function rowsToBomResult(
  rows: BomDraftRow[],
  base?: BomExtractionResult | null,
): BomExtractionResult {
  return {
    title: base?.title ?? null,
    projectName: base?.projectName ?? null,
    currency: base?.currency ?? null,
    notes: base?.notes ?? null,
    items: realRows(rows).map((row) => ({
      description: row.materialName.trim() || row.description.trim(),
      quantity: parseQuantity(row.quantity) ?? null,
      unit: row.uom.trim() || null,
      targetPrice: null,
      notes: null,
      matchedMaterialId: row.matchedMaterialId,
      matchedMaterialName: row.matchedMaterialName,
      matchConfidence: row.matchConfidence,
      matchCandidates: row.candidates,
    })),
  };
}
