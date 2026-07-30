/**
 * Normalizer for VENDOR_DOCUMENT extractions (FOR-259) — company compliance
 * documents (insurance certificates, licenses, certifications). The stored
 * result is surfaced in the document review step (FOR-260): a human approves
 * or corrects the extracted values before anything is written onto the
 * CompanyDocument.
 */

/** Mirrors the Prisma `DocumentType` enum on CompanyDocument. */
export type VendorDocumentType = 'INSURANCE' | 'LICENSE' | 'CERTIFICATION' | 'OTHER';

export interface VendorDocumentExtractionResult {
  documentType: VendorDocumentType | null;
  title: string | null;
  issuer: string | null;
  documentNumber: string | null;
  holderName: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  summary: string | null;
}

export const EMPTY_VENDOR_DOCUMENT_RESULT: VendorDocumentExtractionResult = {
  documentType: null,
  title: null,
  issuer: null,
  documentNumber: null,
  holderName: null,
  issuedDate: null,
  expiryDate: null,
  summary: null,
};

function normalizeString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Coerce the model's classification onto the CompanyDocument enum, tolerating
 *  close variants ("Licence", "insurance certificate") it might emit despite
 *  the response schema. Unrecognisable values become OTHER, not null, so a
 *  classified-but-misspelt result still autofills. */
function normalizeDocumentType(raw: unknown): VendorDocumentType | null {
  const value = normalizeString(raw)?.toUpperCase() ?? null;
  if (value === null) return null;
  if (value.includes('INSURANCE')) return 'INSURANCE';
  if (value.includes('LICEN')) return 'LICENSE';
  if (value.includes('CERTIF')) return 'CERTIFICATION';
  return 'OTHER';
}

/**
 * Parse a strict ISO `YYYY-MM-DD` string into a UTC-midnight Date; null for
 * anything else (including impossible dates like 2026-02-31, which `Date`
 * would silently roll over). Only unambiguous extracted dates should ever be
 * offered for `CompanyDocument.expiresAt`.
 */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Normalize the raw JSON Gemini returned for a VENDOR_DOCUMENT extraction,
 * mirroring `normalizeInvoiceResult`. Defensive: accepts arbitrary input and
 * always returns a valid result.
 */
export function normalizeVendorDocumentResult(raw: unknown): VendorDocumentExtractionResult {
  if (!raw || typeof raw !== 'object') return EMPTY_VENDOR_DOCUMENT_RESULT;
  const v = raw as Record<string, unknown>;

  return {
    documentType: normalizeDocumentType(v.documentType ?? v.type ?? v.category),
    title: normalizeString(v.title ?? v.documentTitle ?? v.heading),
    issuer: normalizeString(v.issuer ?? v.issuedBy ?? v.issuingAuthority),
    documentNumber: normalizeString(
      v.documentNumber ?? v.policyNumber ?? v.licenseNumber ?? v.certificateNumber ?? v.number,
    ),
    holderName: normalizeString(v.holderName ?? v.holder ?? v.companyName ?? v.insured),
    issuedDate: normalizeString(v.issuedDate ?? v.issueDate ?? v.effectiveDate),
    expiryDate: normalizeString(v.expiryDate ?? v.expirationDate ?? v.validUntil ?? v.expiresAt),
    summary: normalizeString(v.summary ?? v.description),
  };
}
