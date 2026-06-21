import { useTranslation } from '@forethread/i18n';
import { useAvatarUrl, useProfile } from '@forethread/profile-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  AvatarWithStatus,
  Breadcrumbs,
  NotificationBell,
  Sidebar,
  type BreadcrumbItem,
  type WorkStatusType,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import HomeIcon from '@forethread/ui-components/assets/icons/home.svg?react';
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
  const pageTitle = usePageTitleStore((s) => s.title);
  const pageBreadcrumbs = usePageTitleStore((s) => s.breadcrumbs);

  const sidebarItems = getSidebarItemsForRole(role, location.pathname, {
    adminPanel: t('nav:adminPanelNav', { defaultValue: 'Admin panel' }),
    usersManagement: t('nav:usersManagement', { defaultValue: 'Users management' }),
    projects: t('nav:projects'),
    materialRequests: t('nav:materialRequests'),
    rfqs: t('nav:rfqs'),
    purchaseOrders: t('nav:purchaseOrders'),
    bulkOrders: t('nav:bulkOrders'),
    deliveries: t('nav:deliveries'),
    invoices: t('nav:invoices'),
    vendors: t('nav:vendors'),
    materialCatalogue: t('nav:materialCatalogue'),
    settings: t('nav:settings', { defaultValue: 'Settings' }),
  });

  // App-bar breadcrumb trail: a Home root (role landing page) + either the
  // explicit trail a page provided, or a `Home › {title}` fallback.
  const homePath = homePathForRole(role);
  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: t('nav:home', { defaultValue: 'Home' }),
      icon: <HomeIcon className="size-4 text-gray-700" />,
      onClick: () => navigate(homePath),
    },
    ...(pageBreadcrumbs && pageBreadcrumbs.length > 0
      ? pageBreadcrumbs.map((c) => ({
          label: c.label,
          onClick: c.to ? () => navigate(c.to as string) : undefined,
        }))
      : pageTitle
        ? [{ label: pageTitle }]
        : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 h-screen">
        <Sidebar
          items={sidebarItems}
          onNavigate={navigate}
          logo={<LogoIcon className="h-[34px] w-[34px]" />}
          companyName={t('common:appName', { defaultValue: 'Forethread' })}
          onLogoClick={() => navigate(homePathForRole(role))}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 h-16 bg-card border-b border-gray-100 flex items-center justify-between px-6">
          <Breadcrumbs items={breadcrumbItems} className="min-w-0" />
          <div className="flex items-center gap-2">
            <NotificationBell aria-label={t('nav:notifications')} hasNotifications />

            <div className="relative group">
              <button
                type="button"
                className="flex h-10 w-[180px] items-center gap-1.5 rounded-xl border border-gray-200 px-1 py-0.5 text-sm text-card-foreground transition-colors hover:bg-gray-50"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <AvatarWithStatus
                    name={currentUser?.name ?? ''}
                    avatarUrl={avatarUrl}
                    workStatus={profile?.workStatus as WorkStatusType}
                    size={32}
                  />
                  <span className="min-w-0 flex-1 truncate text-left text-card-foreground">
                    {currentUser?.name ?? ''}
                  </span>
                </span>
                <ChevronDownIcon className="mr-1.5 h-[18px] w-[18px] shrink-0 text-gray-500" />
              </button>

              <div className="absolute right-0 pt-1 w-48 hidden group-hover:block z-10">
                <div className="bg-white border border-gray-100 rounded-[12px] shadow-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-card-foreground hover:bg-gray-50"
                    onClick={() => navigate(ROUTES.me)}
                  >
                    {t('auth:myProfile', { defaultValue: 'My profile' })}
                  </button>
                  <hr className="border-gray-100" />
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
