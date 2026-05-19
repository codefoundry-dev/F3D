/**
 * Convert a SCREAMING_SNAKE_CASE enum value to a human-readable label.
 * e.g. "PENDING_APPROVAL" → "Pending approval"
 *      "HOLD_FOR_RELEASE" → "Hold for release"
 *      "NOT_REQUIRED"     → "Not required"
 */
export function formatEnum(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .split('_')
    .map((word, i) =>
      i === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase(),
    )
    .join(' ');
}
