import type { BomLineItem } from '@forethread/shared-types/client';

/**
 * Max length of an RFQ line item's material name. Mirrors both the
 * `material_name VARCHAR(255)` column (rfq.prisma) and the `.max(255)` cap in
 * `createRfqLineItemSchema` (rfq.schema.ts) — keep all three in lockstep.
 */
export const RFQ_MATERIAL_NAME_MAX = 255;

/**
 * Derive a schema-valid `materialName` + `notes` pair from a parsed BOM line.
 *
 * BOM descriptions are free text and routinely run past the 255-char
 * material_name cap, which previously failed the Materials-step validation with
 * a raw "String must contain at most 255 character(s)" error when the line was
 * selected and the user pressed Next. We truncate the name to fit (with an
 * ellipsis to signal it was shortened) and preserve the complete description in
 * notes, so the spec is never silently dropped — the vendor still quotes
 * against the full text. Short descriptions pass through unchanged.
 */
export function deriveBomLineNameAndNotes(item: BomLineItem): {
  materialName: string;
  notes: string | undefined;
} {
  const description = item.description.trim();
  // Treat blank/whitespace-only notes as absent (so they don't render as empty
  // notes). Testing `.length` rather than truthiness keeps the empty-string
  // collapse explicit without tripping prefer-nullish-coalescing.
  const trimmedNotes = item.notes?.trim() ?? '';
  const existingNotes = trimmedNotes.length > 0 ? trimmedNotes : undefined;

  if (description.length <= RFQ_MATERIAL_NAME_MAX) {
    return { materialName: description, notes: existingNotes };
  }

  // Reserve one char for the ellipsis so the result lands within the cap.
  const materialName = `${description.slice(0, RFQ_MATERIAL_NAME_MAX - 1).trimEnd()}…`;
  // Prepend the full description so nothing is lost when it's truncated above.
  const notes = existingNotes ? `${description}\n\n${existingNotes}` : description;
  return { materialName, notes };
}

/** The material-identity + display fields of an RFQ line item derived from a BOM line. */
export interface BomRfqDraftFields {
  /** Set only when the BOM line was matched to a catalogue material in review. */
  materialId?: string;
  materialName: string;
  notes: string | undefined;
}

/**
 * Resolve the material-identity + display fields for an RFQ line item derived
 * from a BOM line (FOR-200).
 *
 * A line that was matched to a catalogue material during review becomes a
 * catalogue-linked RFQ line: it carries the matched `materialId` (so the vendor
 * quotes against the real SKU and the name resolves from the Material relation)
 * and shows the catalogue name. The BOM's own free-text description is kept in
 * notes whenever it differs from the catalogue name, so a manually-matched spec
 * is never silently dropped. An unmatched line falls back to a free-text name
 * via {@link deriveBomLineNameAndNotes}.
 */
export function bomLineToRfqDraftFields(item: BomLineItem): BomRfqDraftFields {
  const matchedId = item.matchedMaterialId?.trim();
  if (!matchedId) {
    return deriveBomLineNameAndNotes(item);
  }

  const description = item.description.trim();
  const catalogueName = item.matchedMaterialName?.trim() ?? '';
  const existingNotes = item.notes?.trim() ?? '';
  // Redundant when the description already equals the catalogue name (the common
  // high-confidence case); keep it only when it adds information.
  const keepDescription =
    description.length > 0 && description.toLowerCase() !== catalogueName.toLowerCase();
  const notes = [keepDescription ? description : '', existingNotes]
    .filter((part) => part.length > 0)
    .join('\n\n');

  return {
    materialId: matchedId,
    materialName: catalogueName.length > 0 ? catalogueName : description || 'Material',
    notes: notes.length > 0 ? notes : undefined,
  };
}
