import { getPurchaseOrderAuditTrail, type PoAuditEntry } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { PoActionLogEntry } from '../components/PoActionLogTab';
import { humanizeAuditAction } from '../utils/po-audit-log';

/**
 * Week-3 — drive the PO activity timeline from the real audit trail.
 *
 * Fetches a PO's audit entries (oldest first) via {@link getPurchaseOrderAuditTrail}
 * and maps the lifecycle actions to display-ready {@link PoActionLogEntry}s.
 * Change-request actions (PO_CHANGE_*) and unknown actions are dropped here —
 * they are surfaced richly via the `changeRequests` prop on {@link PoActionLogTab}.
 *
 * The query key nests under the PO's own key so every existing
 * `['purchase-orders', poId]` (or broader `['purchase-orders']`) mutation
 * invalidation refreshes the timeline too — no per-mutation wiring (FOR-353).
 */
export function usePoActionLog(poId: string): {
  logs: PoActionLogEntry[];
  isLoading: boolean;
} {
  const { t } = useTranslation('purchaseOrders');

  const query = useQuery({
    queryKey: ['purchase-orders', poId, 'action-log'],
    queryFn: () => getPurchaseOrderAuditTrail(poId),
    enabled: !!poId,
  });

  const logs = useMemo<PoActionLogEntry[]>(() => {
    const entries: PoAuditEntry[] = query.data ?? [];
    return entries
      .map((entry) => humanizeAuditAction(entry, (key, fallback) => t(key, fallback)))
      .filter((entry): entry is PoActionLogEntry => entry !== null);
  }, [query.data, t]);

  return { logs, isLoading: query.isLoading };
}
