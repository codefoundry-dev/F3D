/**
 * FOR-392: compare a vendor's quoted delivery date with the buyer's expected
 * one. Mirrors the backend `deliveryVarianceDays` (quote-comparison.ts) so the
 * vendor quote form can flag a late pick before the quote is submitted.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the calendar day a date string (YYYY-MM-DD or ISO) falls on. */
function utcDay(value: string): number {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole calendar days from `expected` to `quoted` (positive = late); null if either is missing. */
export function deliveryVarianceDays(
  quoted: string | null | undefined,
  expected: string | null | undefined,
): number | null {
  if (!quoted || !expected) return null;
  const q = utcDay(quoted);
  const e = utcDay(expected);
  if (Number.isNaN(q) || Number.isNaN(e)) return null;
  return Math.round((q - e) / DAY_MS);
}
