import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { UserRole } from '@forethread/shared-types/client';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useUserRole } from '@/shared/role';

interface SettingsLinkProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

function SettingsLink({ icon, title, subtitle, onClick }: SettingsLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[10px] border border-gray-100 bg-white p-3 text-left shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)] transition-colors hover:bg-gray-25"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-600 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] [&_svg]:size-[18px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        <p className="truncate text-xs text-gray-500">{subtitle}</p>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-gray-400" />
    </button>
  );
}

const USERS_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.VENDOR,
];

const COMPANY_PROFILE_ROLES: readonly UserRole[] = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.VENDOR,
];

const ROLES_ADMIN_ROLES: readonly UserRole[] = [UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN];

export default function SettingsPage() {
  const { t } = useTranslation('nav');
  const { t: tRoles } = useTranslation('roles');
  const navigate = useNavigate();
  const role = useUserRole();

  // Surface the page title in the global app bar (breadcrumb trail).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    const title = t('settings', { defaultValue: 'Settings' });
    setPageTitle(title, null, null, [{ label: title }]);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const items = [
    {
      key: 'users',
      icon: <NewUserIcon />,
      title: t('users'),
      subtitle: t('usersSubtitle'),
      route: ROUTES.users,
      visible: role !== null && USERS_ROLES.includes(role),
    },
    {
      key: 'company',
      icon: <DepartmentIcon />,
      title: t('company'),
      subtitle: t('companySubtitle'),
      route: ROUTES.companyProfile,
      visible: role !== null && COMPANY_PROFILE_ROLES.includes(role),
    },
    {
      key: 'roles',
      icon: <SettingsIcon />,
      title: tRoles('title'),
      subtitle: tRoles('subtitle'),
      route: ROUTES.roles,
      visible: role !== null && ROLES_ADMIN_ROLES.includes(role),
    },
  ].filter((item) => item.visible);

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 py-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white p-px text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
          <SettingsIcon className="size-[15px]" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
            {t('settings', { defaultValue: 'Settings' })}
          </h1>
          <p className="text-sm leading-tight text-gray-500">{t('settingsSubtitle')}</p>
        </div>
      </div>

      {/* ── Settings links ── */}
      {items.length > 0 && (
        <div className="flex max-w-2xl flex-col gap-1.5 rounded-[18px] border border-gray-100 bg-[#F9F9FA] p-3 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          {items.map((item) => (
            <SettingsLink
              key={item.key}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onClick={() => navigate(item.route)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
