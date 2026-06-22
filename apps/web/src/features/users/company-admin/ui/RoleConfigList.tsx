import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Spinner, EmptyState, EmptyBoxIllustration } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';

import { useRoleList } from '@/features/roles/services/roles.service';
import { useUserRole } from '@/shared/role';

const ROLE_ORDER: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
  UserRole.VENDOR,
];

interface RoleConfigListProps {
  /** Called when a role card is clicked. */
  onSelect: (role: UserRole) => void;
  /** Renders the secondary line under each role name (e.g. permission count). */
  renderSubtitle: (role: UserRole, permissionCount: number) => string;
}

/**
 * The clickable list of built-in roles, shared by the Role permissions and
 * Approval configuration tabs. Mirrors the standalone Roles & permissions page
 * but without the page header / breadcrumb wiring (the tab host owns those).
 */
export function RoleConfigList({ onSelect, renderSubtitle }: RoleConfigListProps) {
  const { t } = useTranslation('roles');
  const viewerRole = useUserRole();
  const { data, isLoading, isError } = useRoleList();

  // Only a Super Admin may view/configure the Super Admin role. Everyone else
  // (e.g. a Company Admin) sees every role except Super Admin.
  const visibleRoles = ROLE_ORDER.filter(
    (role) => role !== UserRole.SUPER_ADMIN || viewerRole === UserRole.SUPER_ADMIN,
  );

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState illustration={<EmptyBoxIllustration />} title={t('saveError')} description="" />
      </div>
    );
  }

  const countByRole = new Map(data.map((r) => [r.role, r.permissionCount]));

  return (
    <div className="flex flex-col gap-1.5">
      {visibleRoles.map((role) => {
        const count = countByRole.get(role) ?? 0;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onSelect(role)}
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
              <p className="truncate text-xs text-gray-500">{renderSubtitle(role, count)}</p>
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-gray-400" />
          </button>
        );
      })}
    </div>
  );
}

/** Back link + role name — the shared header for a role editor sub-view. */
export function RoleEditorHeader({ role, onBack }: { role: UserRole; onBack: () => void }) {
  const { t } = useTranslation('roles');
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('back')}
        className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-none hover:bg-gray-50 hover:text-gray-900"
      >
        <BackArrowIcon className="size-4" />
      </button>
      <h2 className="text-base font-semibold text-gray-900">{t(`roleNames.${role}`)}</h2>
    </div>
  );
}
