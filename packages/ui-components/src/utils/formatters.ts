const defaultCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: string,
): string {
  if (amount === null || amount === undefined || amount === '') return '-';
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num)) return '-';
  if (!currency || currency === 'USD') return defaultCurrencyFormatter.format(num);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return '-';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

/**
 * Convert a SCREAMING_SNAKE_CASE enum value to a human-readable label.
 * e.g. "PENDING_APPROVAL" → "Pending approval"
 *      "HOLD_FOR_RELEASE" → "Hold for release"
 *      "NOT_REQUIRED"     → "Not required"
 */
export function formatEnum(value: string | null | undefined): string {
  if (!value) return '-';
  return value
    .split('_')
    .map((word, i) =>
      i === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase(),
    )
    .join(' ');
}
