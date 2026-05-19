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
import InvoiceIcon from '@forethread/ui-components/assets/icons/invoice.svg?react';
import LogoIcon from '@forethread/ui-components/assets/icons/logo.svg?react';
import MaterialCatalogueIcon from '@forethread/ui-components/assets/icons/material-catalogue.svg?react';
import ProjectsIcon from '@forethread/ui-components/assets/icons/projects.svg?react';
import PurchaseOrdersIcon from '@forethread/ui-components/assets/icons/purchase-orders.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
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
  const dynamicTitle = usePageTitleStore((s) => s.title);
  const dynamicSubtitle = usePageTitleStore((s) => s.subtitle);

  if (pathname.startsWith(ROUTES.bulkOrders + '/')) {
    return {
      title: dynamicTitle ?? t('bulkOrders'),
      subtitle: dynamicSubtitle ?? t('bulkOrdersSubtitle'),
      onBack: () => navigate(ROUTES.bulkOrders),
    } as const;
  }

  if (pathname === ROUTES.rfqNew) {
    return {
      title: t('createRfq', { defaultValue: 'Create RFQ' }),
      onBack: () => navigate(ROUTES.rfqs),
    } as const;
  }

  if (pathname.startsWith(ROUTES.rfqs + '/')) {
    const rfqId = pathname.replace(ROUTES.rfqs + '/', '').split('/')[0];
    const isQuoteDetail = pathname.includes('/quotes/');
    return {
      title: dynamicTitle ?? '',
      onBack: () => navigate(isQuoteDetail ? `${ROUTES.rfqs}/${rfqId}?tab=responses` : ROUTES.rfqs),
    } as const;
  }

  if (pathname === ROUTES.purchaseOrderNew) {
    return {
      title: t('createPurchaseOrder', { defaultValue: 'Create Purchase Order' }),
      onBack: () => navigate(ROUTES.purchaseOrders),
    } as const;
  }

  if (pathname.startsWith(ROUTES.purchaseOrders + '/')) {
    const poId = pathname.replace(ROUTES.purchaseOrders + '/', '').split('/')[0];
    const isComms = pathname.includes('/comms');
    return {
      title: dynamicTitle ?? t('purchaseOrderDetail', { defaultValue: 'Purchase Order' }),
      onBack: () =>
        navigate(
          isComms ? `${ROUTES.purchaseOrders}/${poId}?tab=purchaseOrders` : ROUTES.purchaseOrders,
        ),
    } as const;
  }

  if (pathname === ROUTES.invoiceUpload) {
    return {
      title: t('uploadInvoice', { defaultValue: 'Upload Invoice' }),
      onBack: () => navigate(ROUTES.invoices),
    } as const;
  }

  if (pathname.startsWith(ROUTES.invoices + '/')) {
    return {
      title: dynamicTitle ?? t('invoiceDetail', { defaultValue: 'Invoice Detail' }),
      onBack: () => navigate(ROUTES.invoices),
    } as const;
  }

  if (pathname === ROUTES.vendorNew) {
    return {
      title: t('addVendor', { defaultValue: 'Add Vendor' }),
      onBack: () => navigate(ROUTES.vendors),
    } as const;
  }

  if (pathname.startsWith(ROUTES.vendors + '/') && pathname !== ROUTES.vendorNew) {
    return {
      title: t('vendorCompanyProfile', { defaultValue: 'Vendor Company Profile' }),
      subtitle: t('vendorCompanyProfileSubtitle', {
        defaultValue: 'View and manage vendor information',
      }),
      onBack: () => navigate(ROUTES.vendors),
    } as const;
  }

  if (pathname.startsWith(ROUTES.projects + '/')) {
    return {
      title: t('projects'),
      subtitle: t('projectsSubtitle'),
      onBack: () => navigate(ROUTES.projects),
    } as const;
  }

  if (pathname.startsWith(ROUTES.users + '/')) {
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

  if (pathname === ROUTES.profile) {
    return {
      title: t('myProfile'),
      subtitle: t('myProfileSubtitle'),
      onBack: () => navigate(ROUTES.settings),
    } as const;
  }

  if (pathname === ROUTES.companyProfile) {
    return {
      title: t('companyProfile'),
      subtitle: t('companyProfileSubtitle'),
      onBack: () => navigate(ROUTES.settings),
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
    [ROUTES.projects]: {
      title: t('projects'),
      subtitle: t('projectsSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.bulkOrders]: {
      title: t('bulkOrders'),
      subtitle: t('bulkOrdersSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.invoices]: {
      title: t('invoices'),
      subtitle: t('invoicesSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.vendors]: {
      title: t('vendors'),
      subtitle: t('vendorsSubtitle'),
      onBack: () => navigate(ROUTES.home),
    },
    [ROUTES.materialCatalogue]: {
      title: t('materialCatalogue'),
      subtitle: t('materialCatalogueSubtitle'),
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
      icon: <ProjectsIcon className="w-5 h-5" />,
      label: t('nav:projects'),
      href: ROUTES.projects,
      isActive: location.pathname.startsWith(ROUTES.projects),
    },
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
      icon: <InvoiceIcon className="w-5 h-5" />,
      label: t('nav:invoices'),
      href: ROUTES.invoices,
      isActive: location.pathname.startsWith(ROUTES.invoices),
    },
    {
      icon: <VendorsIcon className="w-5 h-5" />,
      label: t('nav:vendors'),
      href: ROUTES.vendors,
      isActive: location.pathname.startsWith(ROUTES.vendors),
    },
    {
      icon: <MaterialCatalogueIcon className="w-5 h-5" />,
      label: t('nav:materialCatalogue'),
      href: ROUTES.materialCatalogue,
      isActive: location.pathname.startsWith(ROUTES.materialCatalogue),
    },
    {
      icon: <SettingsIcon className="w-5 h-5" />,
      label: t('nav:companySettings'),
      href: ROUTES.settings,
      isActive:
        location.pathname === ROUTES.settings ||
        location.pathname.startsWith(ROUTES.settings + '/'),
      hasSubmenu: true,
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 h-screen">
        <Sidebar
          items={sidebarItems}
          onNavigate={navigate}
          logo={<LogoIcon className="w-8 h-8" />}
          onLogoClick={() => navigate(ROUTES.home)}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navigation bar */}
        <header className="sticky top-0 z-10 h-16 bg-card border-b border-border flex items-center justify-between px-6">
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
                    onClick={() => navigate(ROUTES.profile)}
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
