import { useTranslation } from '@forethread/i18n';
import {
  AvatarWithStatus,
  NotificationBell,
  PageHeader,
  SearchInput,
  Sidebar,
  type SidebarNavItem,
  type WorkStatusType,
} from '@forethread/ui-components';
import LogoIcon from '@forethread/ui-components/assets/icons/logo.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useLogout } from '@/features/auth/services/auth.service';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { useAvatarUrl, useProfile } from '@/features/profile/services/profile.service';

function usePageInfo() {
  const { t } = useTranslation('nav');
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (pathname.startsWith('/companies/')) {
    return {
      title: t('companyDetailPage'),
      subtitle: t('companyDetailPageSubtitle'),
      onBack: () => navigate(ROUTES.users),
    } as const;
  }

  if (pathname.startsWith('/settings/users/')) {
    return {
      title: t('userProfile'),
      subtitle: t('userProfileSubtitle'),
      onBack: () => navigate(ROUTES.users),
    } as const;
  }

  if (pathname === ROUTES.users) {
    return {
      title: t('userManagement'),
      subtitle: t('userManagementSubtitle'),
      onBack: () => navigate(ROUTES.settings),
    } as const;
  }

  if (pathname === ROUTES.adminPanel) {
    return {
      title: t('adminPanel'),
      subtitle: t('adminPanelSubtitle'),
      onBack: () => navigate(ROUTES.home),
    } as const;
  }

  const pages: Record<string, { title: string; subtitle: string }> = {
    [ROUTES.home]: { title: t('dashboard'), subtitle: t('dashboardSubtitle') },
    [ROUTES.settings]: { title: t('settings'), subtitle: t('settingsSubtitle') },
  };

  return { ...(pages[pathname] ?? { title: '', subtitle: '' }), onBack: undefined };
}

export function AppLayout() {
  const { t } = useTranslation(['common', 'nav', 'auth']);
  const currentUser = useAuthStore((s) => s.currentUser);
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const pageInfo = usePageInfo();
  const { data: avatarUrl } = useAvatarUrl();
  const { data: profile } = useProfile();

  const sidebarItems: SidebarNavItem[] = [
    {
      icon: <SettingsIcon className="w-5 h-5" />,
      label: t('nav:settings'),
      href: ROUTES.settings,
      isActive:
        location.pathname === ROUTES.settings ||
        location.pathname === ROUTES.users ||
        location.pathname.startsWith('/settings/users/') ||
        location.pathname.startsWith('/companies/'),
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        items={sidebarItems}
        onNavigate={navigate}
        logo={<LogoIcon className="w-8 h-8" />}
        onLogoClick={() => navigate(ROUTES.home)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navigation bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
          <PageHeader
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            onBack={pageInfo.onBack}
          />
          <div className="flex items-center gap-3">
            <SearchInput className="w-48 max-w-[450px]" placeholder={t('common:search')} />
            {/* TODO: pass hasNotifications when notification logic is implemented */}
            <NotificationBell aria-label={t('nav:notifications')} />

            {/* User avatar dropdown */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center text-sm text-card-foreground hover:text-foreground"
              >
                <AvatarWithStatus
                  name={currentUser?.name ?? ''}
                  avatarUrl={avatarUrl}
                  workStatus={profile?.workStatus as WorkStatusType}
                  size={34}
                />
              </button>

              <div className="absolute right-0 pt-1 w-48 hidden group-hover:block z-10">
                <div className="bg-card border border-border rounded-md shadow-lg">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                  >
                    {t('auth:logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
