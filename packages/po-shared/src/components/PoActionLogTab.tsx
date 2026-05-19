import { useTranslation } from '@forethread/i18n';
import { Spinner, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';

export interface PoActionLogEntry {
  id: string;
  action: string;
  description: string | null;
  performedBy: { id: string; name: string };
  createdAt: string;
}

interface PoActionLogTabProps {
  logs: PoActionLogEntry[];
  isLoading?: boolean;
}

export function PoActionLogTab({ logs, isLoading }: PoActionLogTabProps) {
  const { t } = useTranslation('purchaseOrders');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-6">
        {t('detailFields.activityLog')}
      </h3>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detailFields.noActivityLogs')}</p>
      ) : (
        <div className="space-y-0">
          {logs.map((log, index) => (
            <div key={log.id} className="flex gap-4">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                {index < logs.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
              </div>

              {/* Content */}
              <div className="pb-6 min-w-0 flex flex-col gap-1.5 justify-center min-h-[50px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{log.action}</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
