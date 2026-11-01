import type { CustomRoleSummary } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import { Spinner, EmptyState, EmptyBoxIllustration } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import type { ReactNode } from 'react';

import { useCustomRoleList, useRoleList } from '@/features/roles/services/roles.service';
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
  /** Called when a built-in role card is clicked. */
  onSelect: (role: UserRole) => void;
  /** Renders the secondary line under each role name (e.g. permission count). */
  renderSubtitle: (role: UserRole, permissionCount: number) => string;
  /**
   * When provided, the company's custom roles (FOR-252) are listed under the
   * built-in roles and clicking one calls this instead of `onSelect` — so the
   * host tab can edit per-custom-role (i.e. per-user, via assignment) settings
   * such as approval limits (FOR-286).
   */
  onSelectCustom?: (role: CustomRoleSummary) => void;
  /** Secondary line for a custom role card. Required when `onSelectCustom` is set. */
  renderCustomSubtitle?: (role: CustomRoleSummary) => string;
  /** Optional slot rendered beside the custom-roles heading (e.g. a create button). */
  customHeadingSlot?: ReactNode;
}

/**
 * The clickable list of roles, shared by the Role permissions and Approval
 * configuration tabs. Mirrors the standalone Roles & permissions page but
 * without the page header / breadcrumb wiring (the tab host owns those).
 */
export function RoleConfigList({
  onSelect,
  renderSubtitle,
  onSelectCustom,
  renderCustomSubtitle,
  customHeadingSlot,
}: RoleConfigListProps) {
  const { t } = useTranslation('roles');
  const viewerRole = useUserRole();
  const { data, isLoading, isError } = useRoleList();
  const customQuery = useCustomRoleList(onSelectCustom !== undefined);

  // Only a Super Admin may view/configure the Super Admin role. Everyone else
  // (e.g. a Company Admin) sees every role except Super Admin.
  const visibleRoles = ROLE_ORDER.filter(
    (role) => role !== UserRole.SUPER_ADMIN || viewerRole === UserRole.SUPER_ADMIN,
  );

  if (isLoading || (onSelectCustom !== undefined && customQuery.isLoading)) {
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
  const customRoles = onSelectCustom !== undefined ? (customQuery.data ?? []) : [];
  const showCustomSection =
    onSelectCustom !== undefined && (customRoles.length > 0 || customHeadingSlot !== undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {visibleRoles.map((role) => {
        const count = countByRole.get(role) ?? 0;
        return (
          <RoleCard
            key={role}
            title={t(`roleNames.${role}`)}
            subtitle={renderSubtitle(role, count)}
            onClick={() => onSelect(role)}
            testId={`role-${role}`}
          />
        );
      })}

      {showCustomSection && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 px-1 pb-1">
            <h3 className="text-sm font-semibold text-gray-900">{t('custom.heading')}</h3>
            {customHeadingSlot}
          </div>
          {customRoles.length === 0 ? (
            <p className="px-1 text-xs text-gray-500">{t('custom.empty')}</p>
          ) : (
            customRoles.map((role) => (
              <RoleCard
                key={role.id}
                title={role.name}
                subtitle={renderCustomSubtitle?.(role) ?? role.description ?? ''}
                onClick={() => onSelectCustom?.(role)}
                testId={`custom-role-${role.id}`}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

interface RoleCardProps {
  title: string;
  subtitle: string;
  onClick: () => void;
  testId: string;
}

function RoleCard({ title, subtitle, onClick, testId }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex items-center gap-4 rounded-[10px] border border-gray-100 bg-white p-3 text-left shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-gray-25"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
        <ShieldIcon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        <p className="line-clamp-2 text-xs text-gray-500 md:truncate">{subtitle}</p>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-gray-400" />
    </button>
  );
}

/** Back link + role name — the shared header for a role editor sub-view. */
export function RoleEditorHeader({
  role,
  title,
  onBack,
}: {
  role?: UserRole;
  /** Explicit heading for custom roles; wins over the `role` name lookup. */
  title?: string;
  onBack: () => void;
}) {
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
      <h2 className="text-base font-semibold text-gray-900">
        {title ?? (role ? t(`roleNames.${role}`) : '')}
      </h2>
    </div>
  );
}
