import { getAuditLogs, type AuditLogResponse, type AuditLogParams } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Spinner, TablePagination, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USER_DEACTIVATED: 'User deactivated',
  USER_REACTIVATED: 'User reactivated',
  USER_INVITATION_RESENT: 'Invitation resent',
  USER_INVITATION_CANCELLED: 'Invitation cancelled',
  USER_PASSWORD_RESET_INITIATED: 'Password reset initiated',
  COMPANY_CREATED: 'Company created',
  COMPANY_UPDATED: 'Company updated',
  FILE_UPLOADED: 'File uploaded',
  FILE_DELETED: 'File deleted',
  PROJECT_CREATED: 'Project created',
  PROJECT_UPDATED: 'Project updated',
  PROJECT_MEMBER_ADDED: 'Project member added',
  PROJECT_MEMBER_REMOVED: 'Project member removed',
  VENDOR_ASSIGNED: 'Vendor assigned',
  VENDOR_UNASSIGNED: 'Vendor unassigned',
};

export function ActionLogTab() {
  const { t } = useTranslation(['users', 'common']);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const params: AuditLogParams = { page, limit };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => getAuditLogs(params),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-6">{t('tabs.activityLogTitle')}</h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('tabs.actionLogPlaceholder')}</p>
      ) : (
        <div className="space-y-0">
          {items.map((log: AuditLogResponse, index: number) => (
            <div key={log.id} className="flex gap-4">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="w-5 h-5 text-muted-foreground" />
                </div>
                {index < items.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className="pb-6 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">
                    {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                  </p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {log.targetLabel
                    ? `${log.targetType}: ${log.targetLabel}`
                    : `${log.targetType} ${log.targetId.slice(0, 8)}`}
                  &nbsp; by {log.performedBy.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.total > limit && (
        <div className="mt-4 border-t border-border pt-4">
          <TablePagination
            page={page}
            totalItems={meta.total}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={(newSize: number) => {
              setLimit(newSize);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
