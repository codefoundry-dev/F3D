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

/**
 * Resolve the recipients for an RFQ invitation when the buyer chose specific
 * vendor sales reps (US 5.05). The selected reps win; a vendor with no chosen
 * reps (quick-added or legacy) falls back to the company's user accounts /
 * contact email via {@link resolveVendorEmailRecipients}.
 */
export function resolveSelectedRecipients(
  selectedReps: ReadonlyArray<{ email: string }>,
  fallbackUsers: ReadonlyArray<{ email: string }>,
  contactEmail?: string | null,
): string[] {
  const selected = dedupeEmails(selectedReps.map((r) => r.email));
  if (selected.length > 0) return selected;
  return resolveVendorEmailRecipients(fallbackUsers, contactEmail);
}

/** A vendor-side email recipient together with what kind of "View" link they can use. */
export interface VendorRecipient {
  email: string;
  /**
   * True when the person has a real login (User status `ACTIVE`) and should be
   * sent the authenticated app link; false for the tokenised-link audience
   * (`INVITED` reps and company contact emails). See CONTEXT.md → Sales Rep.
   */
  activated: boolean;
}

/** The user shape recipient resolution needs: an address plus account state. */
interface UserWithStatus {
  email: string;
  status: string;
}

/**
 * Resolve the recipients of a vendor-bound Purchase Order email (issue,
 * change-request proposed, …) together with each person's activation state, so
 * the caller can choose the "View" link **per recipient** (CONTEXT.md): an
 * `ACTIVE` user gets the authenticated app route; an `INVITED` rep or the
 * company contact email gets the tokenised PO link (ADR-0001).
 *
 * Recipient precedence mirrors {@link resolveSelectedRecipients}: the sales
 * reps selected on the source RFQ win; a vendor with no (sendable) selection
 * falls back to its user accounts, then to the company contact email.
 *
 * `INACTIVE` (deactivated) users are excluded outright — they must receive
 * neither a dead authenticated link nor, worse, a tokenised link that would
 * hand a deactivated person login-free authority over the document.
 */
export function resolveVendorRecipientsWithState(
  selectedReps: ReadonlyArray<UserWithStatus>,
  fallbackUsers: ReadonlyArray<UserWithStatus>,
  contactEmail?: string | null,
): VendorRecipient[] {
  const selected = dedupeRecipients(sendableRecipients(selectedReps));
  if (selected.length > 0) return selected;

  const users = dedupeRecipients(sendableRecipients(fallbackUsers));
  if (users.length > 0) return users;

  return dedupeRecipients([{ email: contactEmail ?? '', activated: false }]);
}

/** Map users to recipients, dropping deactivated (`INACTIVE`) accounts. */
function sendableRecipients(users: ReadonlyArray<UserWithStatus>): VendorRecipient[] {
  return users
    .filter((u) => u.status !== 'INACTIVE')
    .map((u) => ({ email: u.email, activated: u.status === 'ACTIVE' }));
}

/** Trim, drop blanks, and de-duplicate case-insensitively (first-seen wins). */
function dedupeRecipients(recipients: ReadonlyArray<VendorRecipient>): VendorRecipient[] {
  const seen = new Set<string>();
  const result: VendorRecipient[] = [];
  for (const raw of recipients) {
    const email = raw.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ email, activated: raw.activated });
  }
  return result;
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
