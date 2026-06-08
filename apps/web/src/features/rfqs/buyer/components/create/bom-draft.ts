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
  const existingNotes = item.notes?.trim() || undefined;

  if (description.length <= RFQ_MATERIAL_NAME_MAX) {
    return { materialName: description, notes: existingNotes };
  }

  // Reserve one char for the ellipsis so the result lands within the cap.
  const materialName = `${description.slice(0, RFQ_MATERIAL_NAME_MAX - 1).trimEnd()}…`;
  // Prepend the full description so nothing is lost when it's truncated above.
  const notes = existingNotes ? `${description}\n\n${existingNotes}` : description;
  return { materialName, notes };
}
