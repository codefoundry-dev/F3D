import { getAuditLogs, type AuditLogResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Spinner, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { useQuery } from '@tanstack/react-query';

import { AUDIT_ACTION_LABELS, DEFAULT_PERMISSION_KEYS } from '../constants';

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-5 h-5 text-foreground">{icon}</span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function PermissionList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircleIcon className="w-4 h-4 text-success shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export interface RolePermissionsSectionProps {
  /**
   * Override the default permission i18n keys.
   * When omitted, defaults to DEFAULT_PERMISSION_KEYS (permissionRfq, permissionPo, permissionInventory).
   */
  permissionKeys?: readonly string[];
}

export function RolePermissionsSection({ permissionKeys }: RolePermissionsSectionProps = {}) {
  const { t } = useTranslation('profile');

  const keys = permissionKeys ?? DEFAULT_PERMISSION_KEYS;
  const permissions = keys.map((key) => t(key as 'permissionRfq'));

  return (
    <div className="border-t border-border mt-6 pt-6">
      <SectionHeader icon={<UserOutlineIcon className="w-5 h-5" />} title={t('rolePermissions')} />
      <div className="bg-muted rounded-[10px] p-5">
        <p className="text-xs text-muted-foreground mb-3">{t('permissions')}:</p>
        <PermissionList items={permissions} />
      </div>
    </div>
  );
}

export function ApprovalResponsibilitiesSection() {
  const { t } = useTranslation('profile');

  return (
    <div className="border-t border-border mt-6 pt-6">
      <SectionHeader
        icon={<CheckCircleIcon className="w-5 h-5" />}
        title={t('approvalResponsibilities')}
      />
      <div className="bg-muted rounded-[10px] p-5">
        <p className="text-sm text-muted-foreground">{t('noApprovalResponsibilities')}</p>
      </div>
    </div>
  );
}

export function ActivityLogSection({ userId }: { userId?: string }) {
  const { t } = useTranslation('profile');

  return (
    <div className="border-t border-border mt-6 pt-6">
      <SectionHeader icon={<ClockIcon className="w-5 h-5" />} title={t('activityLog')} />
      <ActivityLogTimeline userId={userId} />
    </div>
  );
}

function ActivityLogTimeline({ userId }: { userId?: string }) {
  const { t } = useTranslation('profile');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { performedById: userId }],
    queryFn: () => getAuditLogs({ performedById: userId, limit: 10 }),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Spinner size="sm" />
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noActivityLog')}</p>;
  }

  return (
    <div className="space-y-0">
      {items.map((log: AuditLogResponse, index: number) => (
        <div key={log.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <CheckCircleIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            {index < items.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
          </div>
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
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
