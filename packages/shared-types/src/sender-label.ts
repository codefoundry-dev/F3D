/**
 * Who an in-app notification (or a message) came from (FOR-366). Both parts
 * are optional: a system event has neither, a vendor company quick-added
 * without a user has only the company.
 */
export interface SenderParts {
  name?: string | null;
  companyName?: string | null;
}

/** The sender shown for events the platform raises on its own (reminders, routing fallbacks). */
export const SYSTEM_SENDER_LABEL = 'Forethread';

/** Trim, collapse inner whitespace and drop stray separators; empty → null. */
function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^[\s,·|-]+|[\s,·|-]+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * The one sender format used everywhere in-app: `"{full name} · {company}"`,
 * falling back to the company alone, then the name alone, then "Forethread".
 * A name that merely repeats the company is shown once.
 */
export function formatSenderLabel(sender: SenderParts | null | undefined): string {
  const name = clean(sender?.name);
  const company = clean(sender?.companyName);
  if (name && company) {
    return name.toLowerCase() === company.toLowerCase() ? company : `${name} · ${company}`;
  }
  return company ?? name ?? SYSTEM_SENDER_LABEL;
}
