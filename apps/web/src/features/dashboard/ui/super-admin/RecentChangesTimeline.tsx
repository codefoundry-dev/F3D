import { type AuditLogResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Spinner, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';

import { AUDIT_ACTION_LABELS } from '../../constants/super-admin/dashboard.constants';

interface RecentChangesTimelineProps {
  logs: AuditLogResponse[];
  isLoading: boolean;
}

export function RecentChangesTimeline({ logs, isLoading }: RecentChangesTimelineProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold text-foreground mb-4">{t('recentChanges.title')}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="md" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('recentChanges.noChanges')}</p>
      ) : (
        <div className="space-y-0">
          {logs.map((log, index) => (
            <div key={log.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="w-5 h-5 text-muted-foreground" />
                </div>
                {index < logs.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
              </div>
              <div className="pb-6 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">
                    {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                    {log.performedBy.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-muted-foreground">{log.performedBy.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {log.targetLabel
                    ? `${log.targetType}: ${log.targetLabel}`
                    : `${log.targetType} ${log.targetId.slice(0, 8)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
