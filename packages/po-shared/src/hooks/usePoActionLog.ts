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
 * Query key mirrors the mutation invalidations in the receive/decline flows
 * (`['po-action-log', poId]`).
 */
export function usePoActionLog(poId: string): {
  logs: PoActionLogEntry[];
  isLoading: boolean;
} {
  const { t } = useTranslation('purchaseOrders');

  const query = useQuery({
    queryKey: ['po-action-log', poId],
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
