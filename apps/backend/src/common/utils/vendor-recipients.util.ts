/**
 * Resolve the email recipients for a vendor-facing notification (RFQ
 * invitations, issued purchase orders, …).
 *
 * A vendor can exist in two shapes:
 *  - as one or more platform users (role VENDOR), created by the "invite
 *    vendor" flow, or
 *  - as a lightweight company carrying only a `contactEmail` — the quick
 *    "add vendor" path (US-3.01) stores a contact email but creates no user.
 *
 * Notifications must reach both. We prefer the vendor's user accounts and fall
 * back to the company contact email only when there are none, so the existing
 * behaviour is unchanged whenever users exist. De-duplicates case-insensitively,
 * trims, and drops blank entries; returns an empty array only when there is
 * genuinely nowhere to send.
 */
export function resolveVendorEmailRecipients(
  users: ReadonlyArray<{ email: string }>,
  contactEmail?: string | null,
): string[] {
  const userEmails = dedupeEmails(users.map((u) => u.email));
  if (userEmails.length > 0) return userEmails;
  return dedupeEmails([contactEmail]);
}

/** Trim, drop blanks, and de-duplicate case-insensitively (first-seen wins). */
function dedupeEmails(emails: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = raw?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
}
