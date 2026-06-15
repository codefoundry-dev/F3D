import type { MrAuditEntry } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { formatDateTime, Spinner } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';

import { humanizeMrAuditAction } from '../utils/humanizeMrAuditAction';

interface MrActivityTimelineProps {
  entries: MrAuditEntry[];
  isLoading?: boolean;
}

/**
 * Material Request activity timeline (US 2.08). Renders the audit trail
 * (oldest→newest) using the shared humanizer; unrecognised actions are dropped.
 * Visual style mirrors the PO action-log timeline.
 */
export function MrActivityTimeline({ entries, isLoading }: MrActivityTimelineProps) {
  const { t } = useTranslation('materialRequests');
  const tFallback = (key: string, fallback: string) => {
    const translated = t(key as never) as string;
    return translated === key ? fallback : translated;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" />
      </div>
    );
  }

  const items = entries
    .map((entry) => humanizeMrAuditAction(entry, tFallback))
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('detail.noActivity')}</p>;
  }

  return (
    <div className="space-y-0" data-testid="mr-activity">
      {items.map((entry, index) => {
        const isLast = index === items.length - 1;
        const performer = entry.performedBy
          ? t('auditActions.performedBy', { name: entry.performedBy })
          : t('auditActions.system');
        return (
          <div key={entry.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/10">
                <CheckCircleIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              {!isLast && <div className="min-h-[24px] w-0.5 flex-1 bg-border" />}
            </div>
            <div className="flex min-w-0 flex-col gap-1 pb-6">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium text-foreground">{entry.label}</p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {performer}
                {entry.reason ? ` ${t('auditActions.reasonSuffix', { reason: entry.reason })}` : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
