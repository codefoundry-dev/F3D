import type { QuoteExtractionResult } from '@forethread/shared-types/client';

import type { LineItemFormState } from './useRfqResponse';

/**
 * Maps the line items Gemini extracted from a vendor's quote PDF onto the RFQ's
 * own line items (FOR-206). The vendor's PDF lists items in their own wording
 * and order, so we match by description similarity rather than position.
 *
 * Matched RFQ lines are pre-filled (price, quantity, lead-time note) and left
 * included; RFQ lines with no match are de-selected so they don't block submit
 * (the backend records them as NO_QUOTE). The result is always reviewed and
 * editable by the vendor before submission.
 */

const MATCH_THRESHOLD = 0.34;

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gu, ' ')
      // Split sizes from their units ("12mm" → "12 mm", "4M" → "4 m") so the
      // number is compared on its own however the vendor spaces it.
      .replace(/(\d)([a-z])/gu, '$1 $2')
      .replace(/([a-z])(\d)/gu, '$1 $2')
      .split(/\s+/u)
      .filter((token) => token.length > 1 || isNumeric(token)),
  );
}

function isNumeric(token: string): boolean {
  return /^\d+$/u.test(token);
}

function countShared(ta: Set<string>, tb: Set<string>): number {
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared;
}

/** Overlap coefficient of the two token sets — 0 (disjoint) … 1 (one ⊆ other). */
export function descriptionSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  return countShared(ta, tb) / Math.min(ta.size, tb.size);
}

/**
 * True when each description carries a number the other lacks — "Ladder 4M" vs
 * "Ladder 6M", "Bar 12mm" vs "Bar 16mm". Numbers are sizes and ratings, so such
 * a pair is a different product however much of the wording is shared. One side
 * merely adding a number (a part code, an extra dimension) is not a conflict.
 */
export function hasConflictingSizes(a: string, b: string): boolean {
  const na = [...tokenize(a)].filter(isNumeric);
  const nb = new Set([...tokenize(b)].filter(isNumeric));
  const onlyInA = na.some((token) => !nb.has(token));
  const onlyInB = [...nb].some((token) => !na.includes(token));
  return onlyInA && onlyInB;
}

/** Jaccard index — unlike the overlap coefficient it rewards the closer wording. */
function wordingCloseness(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const shared = countShared(ta, tb);
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

export interface QuoteMatchResult {
  lineItems: LineItemFormState[];
  /** RFQ line items that were pre-filled from the PDF. */
  matchedCount: number;
  /** Extracted PDF rows that matched no RFQ line item (left out, shown to vendor). */
  unmatchedCount: number;
}

export function matchExtractedQuote(
  base: LineItemFormState[],
  extraction: QuoteExtractionResult,
): QuoteMatchResult {
  const extracted = extraction.items ?? [];

  // Score every (rfq line, extracted row) pair, then assign greedily best-first
  // so each side is used at most once. A pair whose sizes conflict is never a
  // candidate: a near-identical item of another size would otherwise fill the
  // line with the wrong price (and make two RFQ lines look like duplicates).
  interface Candidate {
    baseIdx: number;
    exIdx: number;
    score: number;
    closeness: number;
    sameQty: boolean;
  }
  const candidates: Candidate[] = [];
  base.forEach((line, baseIdx) => {
    extracted.forEach((item, exIdx) => {
      if (hasConflictingSizes(line.materialName, item.description)) return;
      const score = descriptionSimilarity(line.materialName, item.description);
      if (score < MATCH_THRESHOLD) return;
      candidates.push({
        baseIdx,
        exIdx,
        score,
        closeness: wordingCloseness(line.materialName, item.description),
        sameQty: item.quantity !== null && item.quantity === line.requestedQty,
      });
    });
  });
  // Ties are common (the same material on several RFQ lines, or a short name
  // contained in several PDF rows): prefer the closer wording, then the row
  // quoting the requested quantity, then document order.
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.closeness - a.closeness ||
      Number(b.sameQty) - Number(a.sameQty) ||
      a.baseIdx - b.baseIdx ||
      a.exIdx - b.exIdx,
  );

  const baseToEx = new Map<number, number>();
  const usedEx = new Set<number>();
  for (const { baseIdx, exIdx } of candidates) {
    if (baseToEx.has(baseIdx) || usedEx.has(exIdx)) continue;
    baseToEx.set(baseIdx, exIdx);
    usedEx.add(exIdx);
  }

  const lineItems = base.map((line, baseIdx) => {
    const exIdx = baseToEx.get(baseIdx);
    if (exIdx === undefined) {
      // No match — leave the price fields empty and de-select so an un-quoted
      // RFQ item doesn't trip line-item validation.
      return { ...line, included: false };
    }
    const item = extracted[exIdx];
    const leadTimeNote = item.leadTime ? `Lead time: ${item.leadTime}` : '';
    const notes = [line.notes, leadTimeNote].filter(Boolean).join(' · ');
    return {
      ...line,
      included: true,
      unitPrice: item.unitPrice !== null ? String(item.unitPrice) : line.unitPrice,
      availQty:
        item.quantity !== null && item.quantity > 0
          ? String(item.quantity)
          : String(line.requestedQty),
      notes,
    };
  });

  return {
    lineItems,
    matchedCount: baseToEx.size,
    unmatchedCount: extracted.length - usedEx.size,
  };
}
