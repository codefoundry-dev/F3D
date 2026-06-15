import { useTranslation } from '@forethread/i18n';
import { useAvatarUrl, useProfile } from '@forethread/profile-shared';
import {
  AvatarWithStatus,
  NotificationBell,
  PageHeader,
  SearchInput,
  Sidebar,
  type WorkStatusType,
} from '@forethread/ui-components';
import LogoIcon from '@forethread/ui-components/assets/icons/logo.svg?react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useLogout } from '@/features/auth/services/auth.service';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { homePathForRole, useUserRole } from '@/shared/role';

import { getSidebarItemsForRole } from './sidebarConfig';

export function AppLayout() {
  const { t } = useTranslation(['common', 'nav', 'auth']);
  const currentUser = useAuthStore((s) => s.currentUser);
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const role = useUserRole();
  const { data: avatarUrl } = useAvatarUrl();
  const { data: profile } = useProfile();

  const sidebarItems = getSidebarItemsForRole(role, location.pathname, {
    projects: t('nav:projects'),
    materialRequests: t('nav:materialRequests'),
    rfqs: t('nav:rfqs'),
    purchaseOrders: t('nav:purchaseOrders'),
    bulkOrders: t('nav:bulkOrders'),
    invoices: t('nav:invoices'),
    vendors: t('nav:vendors'),
    materialCatalogue: t('nav:materialCatalogue'),
    settings: t('nav:settings', { defaultValue: 'Settings' }),
  });

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 h-screen">
        <Sidebar
          items={sidebarItems}
          onNavigate={navigate}
          logo={<LogoIcon className="w-8 h-8" />}
          onLogoClick={() => navigate(homePathForRole(role))}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <PageHeader title="" subtitle="" />
          <div className="flex items-center gap-3">
            <SearchInput className="w-48" placeholder={t('common:search')} />
            <NotificationBell aria-label={t('nav:notifications')} />

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
                    {t('auth:myProfile', { defaultValue: 'My profile' })}
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

        <main className="flex-1 overflow-auto pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
