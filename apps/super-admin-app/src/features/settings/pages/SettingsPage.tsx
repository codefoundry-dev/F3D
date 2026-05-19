import { useTranslation } from '@forethread/i18n';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
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
      <ChevronRightIcon className="w-5 h-5" />
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
          icon={<UsersGroupIcon className="w-6 h-6" />}
          title={t('users')}
          subtitle={t('usersSubtitle')}
          onClick={() => navigate(ROUTES.users)}
        />
      </div>
    </div>
  );
}
