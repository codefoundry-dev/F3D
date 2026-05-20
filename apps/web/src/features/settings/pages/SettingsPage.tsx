import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
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
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ArrowRightIcon className="w-5 h-5" />
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

export default function SettingsPage() {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();
  const role = useUserRole();

  const items = [
    {
      key: 'users',
      icon: <NewUserIcon className="w-6 h-6" />,
      title: t('users'),
      subtitle: t('usersSubtitle'),
      route: ROUTES.users,
      visible: role !== null && USERS_ROLES.includes(role),
    },
    {
      key: 'company',
      icon: <DepartmentIcon className="w-6 h-6" />,
      title: t('company'),
      subtitle: t('companySubtitle'),
      route: ROUTES.companyProfile,
      visible: role !== null && COMPANY_PROFILE_ROLES.includes(role),
    },
  ].filter((item) => item.visible);

  if (items.length === 0) {
    return (
      <div className="p-8 max-w-2xl">
        <p className="text-muted-foreground">{t('settingsSubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex flex-col gap-3">
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
    </div>
  );
}
