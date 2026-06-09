/**
 * Buyer purchase orders are shown under the documented PO lifecycle vocabulary
 * (Draft → Requested → Approved → Ordered → Confirmed → Partially Shipped →
 * Shipped → Delivered → Cancelled). The vendor portal keeps the implementation
 * vocabulary, so the two views cannot share one label set even though they share
 * the `PoStatus` enum.
 *
 * Rather than rewrite the shared `status.*` i18n keys (which the vendor UI also
 * reads), the buyer looks up a parallel `buyerStatus.*` block. The `PoStatus`
 * enum and stored data are unchanged — this only swaps the i18n key the buyer
 * resolves, and the badge colour stays keyed to the real enum.
 *
 * Kept dependency-free on purpose so importing it never drags in heavier modules.
 */
export const buyerPoStatusKey = (status: string): string => `buyerStatus.${status}`;
