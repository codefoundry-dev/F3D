/**
 * Lifetime of a tokenised vendor PO link. A fixed 30-day cap — a deliberate
 * deviation from the base ADR's "lifetime of the document" rule, per the
 * ADR-0002 Release-1 PO token amendment (2026-06-16). The window comfortably
 * covers acknowledge/accept (which happen within days); later lifecycle emails
 * (change-request proposed, delivery confirmation, …) re-issue a fresh token.
 */
export const PO_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
