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

/** Minimal RFQ shape needed to harvest its projects' member emails. */
type ProjectMemberEmailSource = {
  /** Primary project (US 5.05). Legacy rows may carry their primary only here. */
  project?: { members?: { user: { email?: string | null } }[] | null } | null;
  /** Every project the RFQ spans, including the primary on newer rows (US 5.05). */
  projects?: { project: { members?: { user: { email?: string | null } }[] | null } }[] | null;
};

/**
 * Collect the email addresses of every member across all projects an RFQ spans
 * (FOR-255). Duplicates and blanks are tolerated — callers pass the result
 * through {@link normalizeCcEmails}, which lower-cases, validates and de-dupes.
 *
 * Both the primary `project` relation and the `projects` (rfq_projects) join are
 * read: newer RFQs list their primary in both, but legacy rows only carry it on
 * `project`, so reading both guarantees the primary's members are never missed.
 */
export function collectProjectMemberEmails(rfq: ProjectMemberEmailSource): string[] {
  const emails: string[] = [];

  for (const member of rfq.project?.members ?? []) {
    if (member.user.email) emails.push(member.user.email);
  }

  for (const rp of rfq.projects ?? []) {
    for (const member of rp.project.members ?? []) {
      if (member.user.email) emails.push(member.user.email);
    }
  }

  return emails;
}
