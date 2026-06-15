import type { PoAuditEntry } from '@forethread/api-client';

import type { PoActionLogEntry } from '../components/PoActionLogTab';

/**
 * i18n translate function shape — matches react-i18next's `t(key, fallback)`
 * inline-fallback signature. The humanizer is pure and unit-testable: when no
 * `t` is supplied it falls back to the English defaults baked in below.
 */
export type TranslateFn = (key: string, fallback: string) => string;

const identityT: TranslateFn = (_key, fallback) => fallback;

/** Lifecycle action → i18n key + English fallback label. */
const ACTION_LABELS: Record<string, { key: string; fallback: string }> = {
  PO_ISSUED: { key: 'actionLog.issued', fallback: 'Purchase order issued' },
  PO_APPROVED: { key: 'actionLog.approved', fallback: 'Purchase order approved' },
  PO_DECLINED: { key: 'actionLog.declined', fallback: 'Purchase order declined' },
  PO_CANCELLED: { key: 'actionLog.cancelled', fallback: 'Purchase order cancelled' },
  PO_ACKNOWLEDGED: { key: 'actionLog.acknowledged', fallback: 'Acknowledged by vendor' },
  PO_ACCEPTED: { key: 'actionLog.accepted', fallback: 'Accepted by vendor' },
  PO_ACCEPTED_BY_VENDOR: { key: 'actionLog.accepted', fallback: 'Accepted by vendor' },
  PO_DECLINED_BY_VENDOR: { key: 'actionLog.declinedByVendor', fallback: 'Declined by vendor' },
  PO_SCHEDULED: { key: 'actionLog.scheduled', fallback: 'Scheduled for delivery' },
  PO_PARTIALLY_DELIVERED: { key: 'actionLog.partiallyDelivered', fallback: 'Partially delivered' },
  PO_DELIVERED: { key: 'actionLog.delivered', fallback: 'Delivered' },
  PO_ARCHIVED: { key: 'actionLog.archived', fallback: 'Archived' },
};

/** Special-case label when an issue submits the PO for approval. */
const SUBMITTED_FOR_APPROVAL = {
  key: 'actionLog.submittedForApproval',
  fallback: 'Submitted for approval',
};

/**
 * Change-request actions are surfaced via the dedicated `changeRequests` prop on
 * PoActionLogTab (rich diff + Commercial/Internal badge), so we drop them here.
 */
const CHANGE_REQUEST_ACTIONS = new Set([
  'PO_CHANGE_PROPOSED',
  'PO_CHANGE_APPROVED',
  'PO_CHANGE_REJECTED',
]);

function readString(metadata: Record<string, unknown> | null, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Map a single PO audit entry to a display-ready action-log entry.
 *
 * Returns `null` for change-request actions (PO_CHANGE_*) and any unrecognised
 * action — callers should filter nulls out of the mapped list.
 *
 * The `description` combines the performer ("Performed by {name}") with any
 * `metadata.reason` ("— {reason}") for decline transitions. `performedBy` is
 * passed through, or `{ id: '', name: 'System' }` when the entry has no actor.
 */
export function humanizeAuditAction(
  entry: PoAuditEntry,
  t: TranslateFn = identityT,
): PoActionLogEntry | null {
  if (CHANGE_REQUEST_ACTIONS.has(entry.action)) return null;

  let label = ACTION_LABELS[entry.action];
  if (!label) return null;

  // An issue that lands the PO in PENDING_APPROVAL is a "submit for approval".
  if (entry.action === 'PO_ISSUED' && readString(entry.metadata, 'to') === 'PENDING_APPROVAL') {
    label = SUBMITTED_FOR_APPROVAL;
  }

  const action = t(label.key, label.fallback);

  const performedBy = entry.performedBy
    ? { id: entry.performedBy.id, name: entry.performedBy.name }
    : { id: '', name: t('actionLog.system', 'System') };

  const parts: string[] = [];
  if (entry.performedBy?.name) {
    parts.push(
      t('actionLog.performedBy', 'Performed by {{name}}').replace(
        '{{name}}',
        entry.performedBy.name,
      ),
    );
  }
  const reason = readString(entry.metadata, 'reason');
  if (reason) parts.push(`— ${reason}`);

  return {
    id: entry.id,
    action,
    description: parts.length ? parts.join(' ') : null,
    performedBy,
    createdAt: entry.createdAt,
  };
}
