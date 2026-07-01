/**
 * Domain acronyms that must stay upper-cased when an audit action is humanized,
 * so "PO_ACCEPTED" reads "PO accepted" rather than "Po accepted".
 */
const AUDIT_ACRONYMS = new Set(['PO', 'RFQ', 'QR', 'CA', 'BOM', 'MR', 'ERP', 'API']);

/**
 * Nicer wording for the handful of actions whose plain humanized form reads
 * awkwardly (e.g. dropping a redundant "User" prefix). Everything else falls
 * back to acronym-aware humanization of the raw enum value, so new audit
 * actions render sensibly without needing an entry here.
 */
const AUDIT_ACTION_OVERRIDES: Record<string, string> = {
  USER_INVITATION_RESENT: 'Invitation resent',
  USER_INVITATION_CANCELLED: 'Invitation cancelled',
  USER_PASSWORD_RESET_INITIATED: 'Password reset initiated',
};

/**
 * Convert a raw SCREAMING_SNAKE_CASE audit action into a human-readable label,
 * preserving domain acronyms.
 *   "PO_ACCEPTED"       → "PO accepted"
 *   "QUOTE_SUBMITTED"   → "Quote submitted"
 *   "VENDOR_USER_ADDED" → "Vendor user added"
 */
export function formatAuditAction(action: string | null | undefined): string {
  if (!action) return '-';
  const override = AUDIT_ACTION_OVERRIDES[action];
  if (override) return override;

  return action
    .split('_')
    .map((word, i) => {
      if (AUDIT_ACRONYMS.has(word)) return word;
      const lower = word.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}
