/**
 * Small formatting helpers shared across the material-catalogue views (US 4.01).
 */

/** Format an ISO timestamp as dd/MM/yy (matches the design's "Updated" column). */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/** Format an ISO timestamp as a long, readable date, e.g. "Jan 20, 2025". */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format an ISO timestamp as date + time, e.g. "20/01/25 12:00". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const time = date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} ${time}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  AUD: '$',
  GBP: '£',
  EUR: '€',
};

/**
 * Format a decimal-string price with its currency symbol, e.g. "$12.50".
 * Returns "—" when no price is set.
 */
export function formatPrice(
  price: string | number | null | undefined,
  currency?: string | null,
): string {
  if (price === null || price === undefined || price === '') return '—';
  const value = typeof price === 'string' ? Number(price) : price;
  if (Number.isNaN(value)) return '—';
  const symbol = currency ? (CURRENCY_SYMBOLS[currency] ?? '') : '$';
  return `${symbol}${value.toFixed(2)}`;
}

/** Turn a snake_case / camelCase property key into a human label, e.g. "fireRating" → "Fire rating". */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
