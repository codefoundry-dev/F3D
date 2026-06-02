/**
 * Normalise a list of CC email addresses captured on the RFQ "send" action.
 *
 * Trims surrounding whitespace, lower-cases for case-insensitive de-duplication,
 * drops blanks and entries that are obviously not addresses (no `@`), and
 * removes duplicates while preserving first-seen order.
 */
export function normalizeCcEmails(cc?: string[] | null): string[] {
  if (!cc || cc.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of cc) {
    if (typeof raw !== 'string') continue;
    const email = raw.trim().toLowerCase();
    if (!email?.includes('@')) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }

  return result;
}
