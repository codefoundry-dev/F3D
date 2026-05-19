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
import BulkOrdersIcon from '@forethread/ui-components/assets/icons/bulk-orders.svg?react';
import LogoIcon from '@forethread/ui-components/assets/icons/logo.svg?react';
import PurchaseOrdersIcon from '@forethread/ui-components/assets/icons/purchase-orders.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useLogout } from '@/features/auth/services/auth.service';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { useAvatarUrl, useProfile } from '@/features/profile/services/profile.service';

function usePageInfo() {
  const { t } = useTranslation('nav');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pageTitleOverride = usePageTitleStore((s) => s.title);
  const pageSubtitleOverride = usePageTitleStore((s) => s.subtitle);

  if (pathname === ROUTES.users) {
    return {
      title: t('userManagement'),
      subtitle: '',
      onBack: () => navigate(ROUTES.home),
    } as const;
  }

  // User detail page: /users/:id
  if (pathname.startsWith('/users/')) {
    return {
      title: t('userProfile'),
      subtitle: t('userProfileSubtitle'),
      onBack: () => navigate(ROUTES.users),
    } as const;
  }

  if (pathname === ROUTES.me) {
    return {
      title: t('myProfile'),
      subtitle: t('myProfileSubtitle'),
      onBack: () => navigate(ROUTES.home),
    } as const;
  }

  if (pathname === ROUTES.companyProfile) {
    return {
      title: t('companyProfile', { defaultValue: 'Company Profile' }),
      subtitle: t('companyProfileSubtitle', {
        defaultValue: 'View and manage your company information',
      }),
      onBack: () => navigate(ROUTES.home),
    } as const;
  }

  // RFQ detail page: /rfqs/:id
  if (pathname.startsWith('/rfqs/') && pathname !== ROUTES.rfqs) {
    return {
      title: pageTitleOverride ?? t('rfqs'),
      subtitle: '',
      onBack: () => navigate(ROUTES.rfqs),
    } as const;
  }

  // PO detail page: /purchase-orders/:id
  if (pathname.startsWith('/purchase-orders/') && pathname !== ROUTES.purchaseOrders) {
    const poId = pathname.replace('/purchase-orders/', '').split('/')[0];
    const isComms = pathname.includes('/comms');
    return {
      title: pageTitleOverride ?? t('purchaseOrderDetail', { defaultValue: 'Purchase Order' }),
      onBack: () =>
        navigate(
          isComms ? `${ROUTES.purchaseOrders}/${poId}?tab=purchaseOrders` : ROUTES.purchaseOrders,
        ),
    } as const;
  }

  // Bulk order detail / sub-pages: /bulk-orders/:id, /bulk-orders/:id/change, etc.
  if (pathname.startsWith(ROUTES.bulkOrders + '/')) {
    return {
      title: pageTitleOverride ?? t('bulkOrders'),
      subtitle: pageSubtitleOverride ?? t('bulkOrdersSubtitle'),
      onBack: () => navigate(ROUTES.bulkOrders),
    } as const;
  }

  // Invoice detail page: /invoices/:id
  if (pathname.startsWith('/invoices/')) {
    return {
      title: pageTitleOverride ?? t('invoiceDetail', { defaultValue: 'Invoice' }),
      subtitle: '',
      onBack: () => navigate(ROUTES.home),
    } as const;
  }

  const pages: Record<string, { title: string; subtitle: string; onBack?: () => void }> = {
    [ROUTES.home]: { title: t('dashboard'), subtitle: t('dashboardSubtitle') },
    [ROUTES.rfqs]: {
      title: t('rfqs'),
      subtitle: t('rfqsSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.purchaseOrders]: {
      title: t('purchaseOrders'),
      subtitle: t('purchaseOrdersSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.bulkOrders]: {
      title: t('bulkOrders'),
      subtitle: t('bulkOrdersSubtitle'),
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
      icon: <RequestIcon className="w-5 h-5" />,
      label: t('nav:rfqs'),
      href: ROUTES.rfqs,
      isActive: location.pathname.startsWith(ROUTES.rfqs),
    },
    {
      icon: <PurchaseOrdersIcon className="w-5 h-5" />,
      label: t('nav:purchaseOrders'),
      href: ROUTES.purchaseOrders,
      isActive: location.pathname.startsWith(ROUTES.purchaseOrders),
    },
    {
      icon: <BulkOrdersIcon className="w-5 h-5" />,
      label: t('nav:bulkOrders'),
      href: ROUTES.bulkOrders,
      isActive: location.pathname.startsWith(ROUTES.bulkOrders),
    },
    {
      icon: <VendorsIcon className="w-5 h-5" />,
      label: t('nav:companyProfile', { defaultValue: 'Company' }),
      href: ROUTES.companyProfile,
      isActive: location.pathname.startsWith(ROUTES.companyProfile),
    },
    {
      icon: <UsersGroupIcon className="w-5 h-5" />,
      label: t('nav:userManagement'),
      href: ROUTES.users,
      isActive: location.pathname.startsWith(ROUTES.users),
    },
    {
      icon: <SettingsIcon className="w-5 h-5" />,
      label: t('nav:settings'),
      href: ROUTES.settings,
      isActive: location.pathname.startsWith(ROUTES.settings),
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
        <main className="flex-1 overflow-auto pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
