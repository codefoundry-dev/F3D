import {
  BOM_MATCH_CANDIDATE_FLOOR,
  BOM_MATCH_CONFIDENCE_THRESHOLD,
  BOM_MATCH_MAX_CANDIDATES,
  type BomCatalogueCandidate,
  type BomExtractionResult,
  type BomLineItem,
} from '@forethread/shared-types';

/**
 * Catalogue → BOM matching (FOR — Epic 5).
 *
 * After a BOM is extracted we score every line's free-text description against
 * the public material catalogue and attach the best match (+ alternatives) with
 * a 0–1 confidence. Lines at or above {@link BOM_MATCH_CONFIDENCE_THRESHOLD} are
 * auto-matched; the rest are surfaced for manual resolution in the review table.
 *
 * The scorer is the same token-based family already shipped for vendor-quote
 * matching (`matchExtractedQuote.descriptionSimilarity`), but aggregated with a
 * Sørensen–Dice coefficient instead of an overlap coefficient: Dice penalises
 * length mismatch, so a short/generic BOM line ("cement") does not score a
 * misleading 1.0 against a specific SKU ("cement bag 50kg"). That calibration
 * matters here because the 0.85 auto-match threshold is applied to the score.
 */

export interface CatalogueMaterial {
  id: string;
  name: string;
}

/** Matching fields the scorer contributes to a {@link BomLineItem}. */
export type BomLineMatch = Pick<
  BomLineItem,
  'matchedMaterialId' | 'matchedMaterialName' | 'matchConfidence' | 'matchCandidates'
>;

const UNMATCHED: BomLineMatch = {
  matchedMaterialId: null,
  matchedMaterialName: null,
  matchConfidence: null,
  matchCandidates: [],
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Tokenise a description: lowercase, replace punctuation with spaces, split on
 * whitespace, and drop single-character tokens (matches the quote matcher).
 */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .split(/\s+/u)
    .filter((token) => token.length > 1);
}

/**
 * Token Sørensen–Dice similarity of two descriptions, in [0, 1].
 * 1 = same token set; 0 = disjoint (or either side has no usable tokens).
 */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection += 1;
  return (2 * intersection) / (ta.size + tb.size);
}

/**
 * Score one BOM description against the catalogue and decide the match outcome.
 * Returns the top {@link BOM_MATCH_MAX_CANDIDATES} candidates at or above
 * {@link BOM_MATCH_CANDIDATE_FLOOR}; auto-selects the best only when it clears
 * {@link BOM_MATCH_CONFIDENCE_THRESHOLD}.
 */
export function matchLineToCatalogue(
  description: string,
  catalogue: CatalogueMaterial[],
): BomLineMatch {
  if (!description || description.trim().length === 0) return { ...UNMATCHED };

  const candidates: BomCatalogueCandidate[] = catalogue
    .map((material) => ({
      materialId: material.id,
      name: material.name,
      confidence: round2(tokenSimilarity(description, material.name)),
    }))
    .filter((candidate) => candidate.confidence >= BOM_MATCH_CANDIDATE_FLOOR)
    // Best first; break ties by name so output is deterministic.
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
    .slice(0, BOM_MATCH_MAX_CANDIDATES);

  const best = candidates[0];
  if (best && best.confidence >= BOM_MATCH_CONFIDENCE_THRESHOLD) {
    return {
      matchedMaterialId: best.materialId,
      matchedMaterialName: best.name,
      matchConfidence: best.confidence,
      matchCandidates: candidates,
    };
  }

  return {
    matchedMaterialId: null,
    matchedMaterialName: null,
    matchConfidence: null,
    matchCandidates: candidates,
  };
}

/**
 * Annotate every line of an extracted BOM with its catalogue match. Pure: the
 * caller supplies the catalogue (the service reads PUBLIC materials from the
 * DB). Returns a new result; the input is not mutated.
 *
 * Every extracted line is preserved here — the obvious ones are auto-matched
 * and the rest carry `matchCandidates` for the user to resolve in the review
 * table. Lines that are still unmatched after review are dropped later, at the
 * confirm/proceed step ({@link dropUnmatchedBomLines}), not at extraction.
 */
export function annotateBomWithMatches(
  bom: BomExtractionResult,
  catalogue: CatalogueMaterial[],
): BomExtractionResult {
  if (!Array.isArray(bom.items) || bom.items.length === 0) return bom;
  return {
    ...bom,
    items: bom.items.map((item) => ({
      ...item,
      ...matchLineToCatalogue(item.description, catalogue),
    })),
  };
}

/**
 * Drop every BOM line that is still unmatched (no `matchedMaterialId`). Applied
 * when the user proceeds past the review table (confirm): by then the obvious
 * lines were auto-matched and the user has had the chance to manually match the
 * rest, so anything left without a catalogue material is discarded before the
 * BOM moves downstream. Returns a new result; the input is not mutated.
 */
export function dropUnmatchedBomLines(bom: BomExtractionResult): BomExtractionResult {
  if (!Array.isArray(bom.items) || bom.items.length === 0) return bom;
  return {
    ...bom,
    items: bom.items.filter(
      (item) => item.matchedMaterialId !== null && item.matchedMaterialId !== undefined,
    ),
  };
}
