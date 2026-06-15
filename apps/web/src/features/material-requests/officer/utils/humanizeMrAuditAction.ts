import type { MrAuditEntry } from '@forethread/api-client';

/**
 * i18n translate function shape — matches react-i18next's `t(key, fallback)`
 * inline-fallback signature. The humanizer is pure and unit-testable: when no
 * `t` is supplied it falls back to the English defaults baked in below.
 */
export type TranslateFn = (key: string, fallback: string) => string;

const identityT: TranslateFn = (_key, fallback) => fallback;

/** A display-ready Material Request audit entry. */
export interface MrActivityEntry {
  id: string;
  /** Humanized action label (e.g. "Approved"). */
  label: string;
  /** Performer name, or null when the entry has no actor (system events). */
  performedBy: string | null;
  /** Optional reason (decline transitions). */
  reason: string | null;
  createdAt: string;
}

/** AuditAction enum value → i18n key + English fallback label. */
const ACTION_LABELS: Record<string, { key: string; fallback: string }> = {
  MATERIAL_REQUEST_CREATED: { key: 'auditActions.created', fallback: 'Request created' },
  MATERIAL_REQUEST_SUBMITTED: { key: 'auditActions.submitted', fallback: 'Submitted for approval' },
  MATERIAL_REQUEST_APPROVED: { key: 'auditActions.approved', fallback: 'Approved' },
  MATERIAL_REQUEST_DECLINED: { key: 'auditActions.declined', fallback: 'Declined' },
  MATERIAL_REQUEST_CANCELLED: { key: 'auditActions.cancelled', fallback: 'Cancelled' },
};

function readString(metadata: Record<string, unknown> | null, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Map a single Material Request audit entry to a display-ready activity entry.
 *
 * Returns `null` for unrecognised actions so callers can filter them out.
 *
 * `MATERIAL_REQUEST_CONVERTED` resolves to "Converted to RFQ" or
 * "Converted to purchase order" based on `metadata.target` ('RFQ' | 'PO').
 * Decline entries carry `metadata.reason` through on `reason`.
 */
export function humanizeMrAuditAction(
  entry: MrAuditEntry,
  t: TranslateFn = identityT,
): MrActivityEntry | null {
  let label: { key: string; fallback: string } | undefined;

  if (entry.action === 'MATERIAL_REQUEST_CONVERTED') {
    const target = readString(entry.metadata, 'target');
    label =
      target === 'PO'
        ? { key: 'auditActions.convertedToPo', fallback: 'Converted to purchase order' }
        : target === 'RFQ'
          ? { key: 'auditActions.convertedToRfq', fallback: 'Converted to RFQ' }
          : { key: 'auditActions.converted', fallback: 'Converted' };
  } else {
    label = ACTION_LABELS[entry.action];
  }

  if (!label) return null;

  return {
    id: entry.id,
    label: t(label.key, label.fallback),
    performedBy: entry.performedBy?.name ?? null,
    reason: readString(entry.metadata, 'reason') ?? null,
    createdAt: entry.createdAt,
  };
}
