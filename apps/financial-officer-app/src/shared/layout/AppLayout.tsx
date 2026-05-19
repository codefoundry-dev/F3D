import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  AvatarWithStatus,
  NotificationBell,
  PageHeader,
  SearchInput,
  Sidebar,
  type SidebarNavItem,
  type WorkStatusType,
} from '@forethread/ui-components';
import InvoiceIcon from '@forethread/ui-components/assets/icons/invoice.svg?react';
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
  const dynamicTitle = usePageTitleStore((s) => s.title);

  if (pathname === ROUTES.me) {
    return {
      title: t('myProfile'),
      subtitle: t('myProfileSubtitle'),
      onBack: () => navigate(ROUTES.home),
    } as const;
  }

  if (pathname.startsWith('/invoices/') && pathname !== ROUTES.invoices) {
    return {
      title: dynamicTitle ?? t('invoiceDetail', { defaultValue: 'Invoice Detail' }),
      onBack: () => navigate(ROUTES.invoices),
    } as const;
  }

  const pages: Record<string, { title: string; subtitle: string; onBack?: () => void }> = {
    [ROUTES.home]: { title: t('dashboard'), subtitle: t('dashboardSubtitle') },
    [ROUTES.invoices]: {
      title: t('invoices'),
      subtitle: t('invoicesSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.settings]: { title: t('settings'), subtitle: t('settingsSubtitle') },
  };

  return { ...(pages[pathname] ?? { title: '', subtitle: '' }), onBack: pages[pathname]?.onBack };
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
      icon: <InvoiceIcon className="w-5 h-5" />,
      label: t('nav:invoices'),
      href: ROUTES.invoices,
      isActive: location.pathname.startsWith(ROUTES.invoices),
    },
    {
      icon: <SettingsIcon className="w-5 h-5" />,
      label: t('nav:settings'),
      href: ROUTES.settings,
      isActive: location.pathname === ROUTES.settings,
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
            <SearchInput className="w-48" placeholder={t('common:search')} />
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
                    className="w-full text-left px-4 py-2 text-sm text-card-foreground hover:bg-accent"
                    onClick={() => navigate(ROUTES.me)}
                  >
                    {t('auth:myProfile')}
                  </button>
                  <hr className="border-border" />
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
        <main className="pb-14 md:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
