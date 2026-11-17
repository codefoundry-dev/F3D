import type { BomItemDto, CreateBomItemInput } from '@forethread/api-client';
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
  /**
   * Catalogue image of the matched material — display only. Never sent:
   * `rowsToCreateItems` and `rowsToBomResult` build their payloads field by
   * field and leave it out.
   */
  matchedImageUrl?: string | null;
  /** Auto/candidate similarity score; null once the user picked manually. */
  matchConfidence: number | null;
  candidates: BomCatalogueCandidate[];
  /** Resolved by hand this session (manual pick / created material) — blue row tint. */
  manuallyResolved: boolean;
  /** The user ignored this row's suggestion; it is no longer offered. */
  suggestionDismissed?: boolean;
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
  // Only high-confidence lines arrive matched (matchedMaterialId set by the
  // extractor). A lower-confidence line arrives with ranked suggestions and
  // stays unmatched: its top suggestion is shown as pending until the user
  // accepts or ignores it (see pendingSuggestion). A line with no candidates
  // at all is simply unmatched.
  const matchedMaterialId = item.matchedMaterialId ?? null;
  const source = matchedMaterialId
    ? candidates.find((candidate) => candidate.materialId === matchedMaterialId)
    : undefined;
  return {
    materialName: item.description,
    description: item.description,
    uom: item.unit ?? '',
    quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '',
    // Category / Material type come from the matched catalogue material; blank
    // until the line has one.
    category: source?.category ?? '',
    materialType: source?.subCategory ?? '',
    matchedMaterialId,
    matchedMaterialName: matchedMaterialId
      ? (item.matchedMaterialName ?? source?.name ?? null)
      : null,
    matchedImageUrl: source?.imageUrl ?? null,
    matchConfidence: matchedMaterialId
      ? (item.matchConfidence ?? source?.confidence ?? null)
      : null,
    candidates,
    manuallyResolved: false,
  };
}

/**
 * The suggestion waiting for the user's decision on this row: the top-ranked
 * candidate of a line that is not matched and whose suggestion has not been
 * ignored. Null when there is nothing to accept or ignore.
 */
export function pendingSuggestion(row: BomDraftRow): BomCatalogueCandidate | null {
  if (isRowEmpty(row) || row.matchedMaterialId || row.suggestionDismissed) return null;
  return row.candidates[0] ?? null;
}

/** How many rows have a suggestion waiting to be accepted or ignored. */
export function pendingSuggestionCount(rows: BomDraftRow[]): number {
  return rows.filter((row) => pendingSuggestion(row) !== null).length;
}

/** Match the row to its pending suggestion (no-op without one). */
export function acceptSuggestion(row: BomDraftRow): BomDraftRow {
  const suggestion = pendingSuggestion(row);
  if (!suggestion) return row;
  return {
    ...row,
    matchedMaterialId: suggestion.materialId,
    matchedMaterialName: suggestion.name,
    matchedImageUrl: suggestion.imageUrl ?? null,
    // The score is kept so the confidence badge still shows how sure the
    // matcher was about a suggestion the user accepted.
    matchConfidence: suggestion.confidence,
    uom: firstNonEmpty(row.uom, suggestion.uom),
    category: firstNonEmpty(suggestion.category, row.category),
    materialType: firstNonEmpty(suggestion.subCategory, row.materialType),
  };
}

/**
 * Ignore the row's pending suggestion (no-op without one). The line stays
 * unmatched and can still be matched from the catalogue search.
 */
export function dismissSuggestion(row: BomDraftRow): BomDraftRow {
  return pendingSuggestion(row) ? { ...row, suggestionDismissed: true } : row;
}

/** Map a completed BOM extraction result into editable review rows. */
export function rowsFromExtraction(result: unknown): BomDraftRow[] {
  if (!isBomExtractionResult(result)) return [];
  return result.items.map(rowFromLineItem);
}

/**
 * Map a saved BOM's persisted items into editable review rows (US 5.02 Edit
 * BOM). Saved items are already resolved to a catalogue material, so there are
 * no ranked candidates to carry; an item with a blank match falls back to
 * unmatched so the edit table flags it like the create wizard.
 */
export function rowsFromBomItems(items: BomItemDto[]): BomDraftRow[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      materialName: item.materialName,
      description: item.description ?? '',
      uom: item.uom ?? '',
      quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '',
      category: item.category ?? '',
      materialType: item.materialType ?? '',
      matchedMaterialId: item.matchedMaterialId ?? null,
      matchedMaterialName: item.matchedMaterialName,
      matchedImageUrl: item.matchedMaterialId ? (item.imageUrl ?? null) : null,
      matchConfidence: item.matchConfidence,
      candidates: [],
      manuallyResolved: false,
    }));
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

/** Real rows with no catalogue match, in display order. */
export function unmatchedRows(rows: BomDraftRow[]): BomDraftRow[] {
  return realRows(rows).filter((row) => !row.matchedMaterialId);
}

/**
 * How many rows have no catalogue match. They don't block saving — the user is
 * asked to confirm, and the lines are saved unmatched.
 */
export function unmatchedCount(rows: BomDraftRow[]): number {
  return unmatchedRows(rows).length;
}

/** Map the reviewed rows to the POST /boms payload. */
export function rowsToCreateItems(rows: BomDraftRow[]): CreateBomItemInput[] {
  return realRows(rows).map((row, index) => ({
    materialName: row.materialName.trim() || row.description.trim(),
    matchedMaterialId: row.matchedMaterialId ?? undefined,
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
