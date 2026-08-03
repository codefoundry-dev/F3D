/**
 * Resend inbound-email webhook envelope (FOR-290). Only the fields we consume
 * are typed. The `email.received` payload carries metadata only — the actual
 * attachments are fetched afterwards through the Resend receiving API.
 */
export interface ResendInboundPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    id?: string;
    from?: unknown;
    to?: unknown;
    subject?: string;
  };
}

/** An `email.received` event normalised for {@link InvoiceIntakeService}. */
export interface ParsedInboundEmail {
  emailId: string;
  from: string | null;
  to: string[];
  subject: string | null;
}

/**
 * Pull a bare lowercase address out of whatever shape a provider sends:
 * `"a@b.com"`, `"Name <a@b.com>"`, or `{ email: "a@b.com" }`.
 */
export function extractEmailAddress(value: unknown): string | null {
  if (typeof value === 'object' && value !== null) {
    const email = (value as { email?: unknown }).email;
    return typeof email === 'string' ? extractEmailAddress(email) : null;
  }
  if (typeof value !== 'string') return null;

  const angled = /<([^<>\s]+@[^<>\s]+)>/.exec(value);
  const candidate = (angled ? angled[1] : value).trim().toLowerCase();
  return candidate.includes('@') ? candidate : null;
}

/** Normalise `to` (string, array of strings, or array of objects) to addresses. */
export function extractRecipients(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((entry) => extractEmailAddress(entry))
    .filter((email): email is string => email !== null);
}

/**
 * Normalise an inbound webhook payload. Returns null when the event is not
 * `email.received` or has no email id, so the caller can ack-and-skip rather
 * than error (Resend retries non-2xx responses).
 */
export function parseInboundEmail(payload: ResendInboundPayload): ParsedInboundEmail | null {
  if (payload.type !== 'email.received') return null;

  const emailId = payload.data?.email_id ?? payload.data?.id;
  if (!emailId) return null;

  return {
    emailId,
    from: extractEmailAddress(payload.data?.from),
    to: extractRecipients(payload.data?.to),
    subject: payload.data?.subject ?? null,
  };
}
