import type { PoChangeRequest } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, Spinner, formatAuditAction, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';

import { PoChangeDiff } from './PoChangeDiff';

export interface PoActionLogEntry {
  id: string;
  action: string;
  description: string | null;
  performedBy: { id: string; name: string };
  createdAt: string;
}

interface PoActionLogTabProps {
  logs: PoActionLogEntry[];
  /**
   * FLOW 3 — resolved (APPROVED/REJECTED) change requests, rendered as timeline
   * entries with the diff + a Commercial/Internal badge ahead of the generic
   * audit entries (SPEC FLOW 3 / pc6). Sourced from `listPoChangeRequests` since
   * there is no PO-scoped audit feed in api-client.
   */
  changeRequests?: PoChangeRequest[];
  /** Resolve deliveryLocationId → label for the diff. */
  locationOptions?: { value: string; label: string }[];
  isLoading?: boolean;
}

export function PoActionLogTab({
  logs,
  changeRequests = [],
  locationOptions,
  isLoading,
}: PoActionLogTabProps) {
  const { t } = useTranslation('purchaseOrders');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  // Only resolved change requests appear in the action log; pending ones live in
  // the "Changes request" tab. Newest first.
  const resolvedCrs = changeRequests
    .filter((cr) => cr.status === 'APPROVED' || cr.status === 'REJECTED')
    .sort((a, b) => {
      const at = a.resolvedAt ?? a.createdAt;
      const bt = b.resolvedAt ?? b.createdAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });

  const hasEntries = resolvedCrs.length > 0 || logs.length > 0;
  const totalEntries = resolvedCrs.length + logs.length;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-6">
        {t('detailFields.activityLog')}
      </h3>

      {!hasEntries ? (
        <p className="text-sm text-muted-foreground">{t('detailFields.noActivityLogs')}</p>
      ) : (
        <div className="space-y-0">
          {/* Resolved change requests (with diff) */}
          {resolvedCrs.map((cr, index) => {
            const isLastOverall = index === totalEntries - 1;
            const approved = cr.status === 'APPROVED';
            const resolver = cr.resolvedByName ?? '-';
            const company = cr.requestedByCompanyName ?? '';
            const requester = cr.requestedByName ?? '';
            return (
              <div key={cr.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                    <CheckCircleIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  {!isLastOverall && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
                </div>

                <div className="pb-6 min-w-0 flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{cr.reference ?? '-'}</span>
                    <Badge className="bg-muted text-muted-foreground text-xs">
                      {cr.changeType === 'COMMERCIAL'
                        ? t('actionLogCr.commercial')
                        : t('actionLogCr.internal')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t('actionLogCr.suggested')}
                      </span>{' '}
                      {company ? `${company} (${requester})` : requester}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {approved
                        ? t('actionLogCr.approvedBy', { name: resolver })
                        : t('actionLogCr.rejectedBy', { name: resolver })}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {formatDateTime(cr.resolvedAt ?? cr.createdAt)}
                    </span>
                  </div>

                  <PoChangeDiff
                    changedFields={cr.changedFields}
                    locationOptions={locationOptions}
                  />

                  {cr.status === 'REJECTED' && cr.reason && (
                    <p className="text-sm text-destructive">
                      {t('changeRequest.reason', { reason: cr.reason })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Generic audit entries */}
          {logs.map((log, index) => {
            const overallIndex = resolvedCrs.length + index;
            const isLastOverall = overallIndex === totalEntries - 1;
            return (
              <div key={log.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                    <CheckCircleIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  {!isLastOverall && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
                </div>

                <div className="pb-6 min-w-0 flex flex-col gap-1.5 justify-center min-h-[50px]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      {formatAuditAction(log.action)}
                    </p>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                  {log.description && (
                    <p className="text-xs text-muted-foreground">{log.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
