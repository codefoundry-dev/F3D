/**
 * Buyer RFQ statuses are shown under the documented state names. The docs have no
 * separate "Closed" buyer state — they fold a closed RFQ into "Cancelled" — so the
 * buyer renders CLOSED with the CANCELLED label. (The vendor view keeps its own
 * CLOSED label, which is why this maps the i18n key rather than changing it.)
 *
 * Kept dependency-free on purpose so importing it never drags in heavier modules.
 */
export const buyerRfqStatusKey = (status: string): string =>
  status === 'CLOSED' ? 'CANCELLED' : status;
