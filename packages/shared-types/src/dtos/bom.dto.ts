/**
 * A candidate catalogue match for a BOM line, produced by the post-extraction
 * matcher. `confidence` is a 0–1 token-similarity score (1 = identical
 * descriptions). Candidates are ordered best-first.
 */
export interface BomCatalogueCandidate {
  materialId: string;
  name: string;
  confidence: number;
  /**
   * Catalogue attributes of the candidate material, attached by the matcher so
   * the review row (Category / Material type) and the match-picker popup
   * (name / UoM / description / category) render without a second lookup.
   * Optional: present when the matcher was given a catalogue carrying these
   * fields, omitted in lightweight/unit contexts.
   */
  uom?: string | null;
  category?: string | null;
  subCategory?: string | null;
  description?: string | null;
}

/**
 * Bill of Materials extraction result. Specialises the generic
 * DocExtraction `editedResult` payload for BOM-typed jobs (FOR-200).
 *
 * The shape is shared between the backend normalizer (which writes it) and
 * the frontend review table (which edits it), so any change here flows to
 * both ends.
 */
export interface BomLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  targetPrice: number | null;
  notes: string | null;
  /**
   * Catalogue-matching fields (optional — added after extraction by the
   * matcher and editable in the review table). A line is considered
   * "auto-matched" when `matchedMaterialId` is set; for an auto-match
   * `matchConfidence` carries the similarity score, while a user-picked match
   * leaves `matchConfidence` null (the human is the authority). Lines below the
   * confidence threshold keep `matchedMaterialId` null and surface
   * `matchCandidates` for manual resolution.
   */
  matchedMaterialId?: string | null;
  matchedMaterialName?: string | null;
  matchConfidence?: number | null;
  matchCandidates?: BomCatalogueCandidate[];
}

/**
 * Minimum similarity for a line to be auto-matched to a catalogue item.
 * Mirrors the spec default (US-16, FR-R1-020). Lines below this are held for
 * manual review. Not yet Contractor-configurable (future story).
 */
export const BOM_MATCH_CONFIDENCE_THRESHOLD = 0.85;

/** Lowest similarity worth surfacing as a manual-review candidate. */
export const BOM_MATCH_CANDIDATE_FLOOR = 0.4;

/** Max candidates retained per line for the manual-match picker. */
export const BOM_MATCH_MAX_CANDIDATES = 3;

export interface BomExtractionResult {
  title: string | null;
  projectName: string | null;
  currency: string | null;
  items: BomLineItem[];
  notes: string | null;
}

export const EMPTY_BOM_RESULT: BomExtractionResult = {
  title: null,
  projectName: null,
  currency: null,
  items: [],
  notes: null,
};

export function isBomLineItem(value: unknown): value is BomLineItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.description === 'string';
}

export function isBomExtractionResult(value: unknown): value is BomExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && v.items.every(isBomLineItem);
}
