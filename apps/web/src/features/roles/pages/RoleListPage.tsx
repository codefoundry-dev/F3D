import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Spinner, EmptyState } from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useRoleList } from '../services/roles.service';

const ROLE_ORDER: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
  UserRole.VENDOR,
];

export default function RoleListPage() {
  const { t } = useTranslation('roles');
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRoleList();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <EmptyState title={t('saveError')} description="" />
      </div>
    );
  }

  const byRole = new Map(data.map((r) => [r.role, r.permissionCount]));
  const items = ROLE_ORDER.map((role) => ({ role, count: byRole.get(role) ?? 0 }));

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map(({ role, count }) => (
          <li key={role}>
            <button
              type="button"
              onClick={() => navigate(ROUTES.roleEdit.replace(':role', role))}
              className="w-full flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left"
              data-testid={`role-${role}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t(`roleNames.${role}`)}</p>
                <p className="text-xs text-muted-foreground">
                  {t('permissionCount', { count })}
                </p>
              </div>
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
