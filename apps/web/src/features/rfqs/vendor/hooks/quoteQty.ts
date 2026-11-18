/**
 * Quantity rules for a vendor quote line, shared by the authenticated
 * ({@link useRfqResponse}) and guest ({@link useGuestRfqResponse}) forms and the
 * line-items table. Kept dependency-free (structural params) so the
 * presentational table can use them without pulling in the hooks' data layer.
 *
 * A vendor may have more stock than the buyer asked for; that is fine and is
 * not flagged. Having less is flagged (but never blocks submit — a partial
 * quote is valid). Either way the buyer is only ever quoted for what they
 * requested: the priced quantity is the smaller of available and required.
 */

function parseQty(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True when an included line has an available quantity below the required one. */
export function availBelowRequested(item: {
  included: boolean;
  availQty: string;
  requestedQty: number;
}): boolean {
  if (!item.included) return false;
  if (item.availQty.trim() === '') return false;
  return parseQty(item.availQty) < item.requestedQty;
}

/** The quantity a line is priced and quoted for: min(available, required). */
export function quotedQty(item: { availQty: string; requestedQty: number }): number {
  return Math.min(parseQty(item.availQty), item.requestedQty);
}
