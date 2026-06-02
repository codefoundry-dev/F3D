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
      .split(/\s+/u)
      .filter((token) => token.length > 1),
  );
}

/** Overlap coefficient of the two token sets — 0 (disjoint) … 1 (one ⊆ other). */
export function descriptionSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection += 1;
  return intersection / Math.min(ta.size, tb.size);
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
  // so each side is used at most once.
  const candidates: Array<{ baseIdx: number; exIdx: number; score: number }> = [];
  base.forEach((line, baseIdx) => {
    extracted.forEach((item, exIdx) => {
      const score = descriptionSimilarity(line.materialName, item.description);
      if (score >= MATCH_THRESHOLD) candidates.push({ baseIdx, exIdx, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);

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
