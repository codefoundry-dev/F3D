import { useTranslation } from '@forethread/i18n';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

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

export default function SettingsPage() {
  const { t } = useTranslation('nav');
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex flex-col gap-3">
        <SettingsLink
          icon={<NewUserIcon className="w-6 h-6" />}
          title={t('users')}
          subtitle={t('usersSubtitle')}
          onClick={() => navigate(ROUTES.users)}
        />
        <SettingsLink
          icon={<DepartmentIcon className="w-6 h-6" />}
          title={t('company')}
          subtitle={t('companySubtitle')}
          onClick={() => navigate(ROUTES.companyProfile)}
        />
      </div>
    </div>
  );
}
