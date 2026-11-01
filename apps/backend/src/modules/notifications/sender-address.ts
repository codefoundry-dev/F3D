/**
 * Builds the `From` header for a branded email (FOR-383): the issuing company as
 * the display name on the platform's verified sending address, e.g.
 * `"Acme Builders via Forethread" <notifications@updates.forethread.com>`.
 *
 * Only the display name changes — the address stays the configured (verified)
 * sender, so SPF/DKIM alignment is unaffected. Without a company name the
 * configured value is returned untouched.
 */
export function withSenderDisplayName(configuredFrom: string, companyName?: string | null): string {
  const name = cleanDisplayName(companyName);
  if (!name) return configuredFrom;

  // The configured value may be a bare address or already "Name <address>".
  const address = /<([^>]+)>/.exec(configuredFrom)?.[1]?.trim() ?? configuredFrom.trim();
  return `"${name} via Forethread" <${address}>`;
}

/** Strip characters that would break or inject into a quoted header display name. */
function cleanDisplayName(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/["<>\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64)
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
