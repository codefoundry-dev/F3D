/**
 * FOR-273 — a quote line's available (quoted) quantity must never exceed the
 * buyer's requested quantity.
 *
 * Shared by the authenticated ({@link useRfqResponse}) and guest
 * ({@link useGuestRfqResponse}) validators and the line-items table so the rule
 * has a single source of truth. Kept dependency-free (structural param, no
 * `LineItemFormState` import) so the presentational table can use it without
 * pulling the hooks' data-layer into its unit test.
 *
 * Only meaningful for an included line that has a value entered; an excluded or
 * blank line is treated as "not exceeding" (those are caught by other rules).
 */
export function availExceedsRequested(item: {
  included: boolean;
  availQty: string;
  requestedQty: number;
}): boolean {
  if (!item.included) return false;
  if (item.availQty.trim() === '') return false;
  const parsed = parseFloat(item.availQty);
  const avail = Number.isFinite(parsed) ? parsed : 0;
  return avail > item.requestedQty;
}
