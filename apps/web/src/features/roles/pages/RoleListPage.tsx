import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserRole } from '@forethread/shared-types/client';
import { Spinner, EmptyState, EmptyBoxIllustration } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import { useEffect } from 'react';
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

  // Surface the page title in the global app bar (breadcrumb trail).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    setPageTitle(t('title'), null, null, [{ label: t('title') }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 py-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
          <ShieldIcon className="size-[15px]" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
            {t('title')}
          </h1>
          <p className="text-sm leading-tight text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-1 items-center justify-center rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          <EmptyState
            illustration={<EmptyBoxIllustration />}
            title={t('saveError')}
            description=""
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          {ROLE_ORDER.map((role) => {
            const count = new Map(data.map((r) => [r.role, r.permissionCount])).get(role) ?? 0;
            return (
              <button
                key={role}
                type="button"
                onClick={() => navigate(ROUTES.roleEdit.replace(':role', role))}
                data-testid={`role-${role}`}
                className="flex items-center gap-4 rounded-[10px] border border-gray-100 bg-white p-3 text-left shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-gray-25"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
                  <ShieldIcon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {t(`roleNames.${role}`)}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {t('permissionCount', { count })}
                  </p>
                </div>
                <ChevronRightIcon className="size-4 shrink-0 text-gray-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
