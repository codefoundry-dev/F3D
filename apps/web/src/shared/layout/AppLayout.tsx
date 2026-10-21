import { useTranslation } from '@forethread/i18n';
import { useAvatarUrl, useProfile } from '@forethread/profile-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  AvatarWithStatus,
  Breadcrumbs,
  ConfirmDialog,
  MobileActionBarSlot,
  MobileHeaderActionsSlot,
  Sidebar,
  cn,
  useMobileExit,
  useMobileNavHidden,
  type BreadcrumbItem,
  type WorkStatusType,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import HomeIcon from '@forethread/ui-components/assets/icons/home.svg?react';
import LogoIcon from '@forethread/ui-components/assets/icons/logo.svg?react';
import UserIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useLogout } from '@/features/auth/services/auth.service';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { NotificationCenter } from '@/features/notifications';
import { homePathForRole, useUserRole } from '@/shared/role';

import { getMobilePrimaryHrefs, getSidebarItemsForRole } from './sidebarConfig';

export function AppLayout() {
  const { t } = useTranslation(['common', 'nav', 'auth']);
  const currentUser = useAuthStore((s) => s.currentUser);
  const logoutMutation = useLogout();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const role = useUserRole();
  const { data: avatarUrl } = useAvatarUrl();
  const { data: profile } = useProfile();
  const pageTitle = usePageTitleStore((s) => s.title);
  const pageBreadcrumbs = usePageTitleStore((s) => s.breadcrumbs);
  const pageBackTo = usePageTitleStore((s) => s.backTo);
  // Wizards hide the bottom nav and may intercept the back arrow (B8).
  const navHidden = useMobileNavHidden();
  const mobileExit = useMobileExit();

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
    rfqsShort: t('nav:rfqsShort', { defaultValue: 'RFQs' }),
    purchaseOrdersShort: t('nav:purchaseOrdersShort', { defaultValue: 'POs' }),
    materialRequestsShort: t('nav:materialRequestsShort', { defaultValue: 'Requests' }),
    materialCatalogueShort: t('nav:materialCatalogueShort', { defaultValue: 'Catalogue' }),
    usersManagementShort: t('nav:usersManagementShort', { defaultValue: 'Users' }),
    bulkOrdersShort: t('nav:bulkOrdersShort', { defaultValue: 'Bulk orders' }),
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

  // Phone top bar (ADR-0019 / FOR-369): the page's own title in place of the
  // breadcrumb trail, with a back arrow to the page's own `backTo`, else the
  // nearest linked parent crumb.
  const mobileTitle = pageBreadcrumbs?.length
    ? pageBreadcrumbs[pageBreadcrumbs.length - 1].label
    : (pageTitle ?? '');
  const backTo =
    pageBackTo ??
    pageBreadcrumbs
      ?.slice(0, -1)
      .reverse()
      .find((c) => c.to)?.to;

  const moreRowClass =
    'flex h-12 w-full items-center gap-3 rounded-[10px] px-2 text-left text-[15px] font-semibold';
  const moreExtras = (
    <>
      <button
        type="button"
        className={`${moreRowClass} text-gray-700`}
        onClick={() => {
          setMoreOpen(false);
          navigate(ROUTES.me);
        }}
      >
        <span className="flex size-6 items-center justify-center">
          <UserIcon className="size-5" />
        </span>
        {t('auth:myProfile', { defaultValue: 'My profile' })}
      </button>
      <button
        type="button"
        className={`${moreRowClass} text-destructive`}
        onClick={() => {
          setMoreOpen(false);
          setShowLogoutConfirm(true);
        }}
        disabled={logoutMutation.isPending}
      >
        <span className="size-6" aria-hidden />
        {t('auth:logout')}
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 h-screen">
        <Sidebar
          items={sidebarItems}
          onNavigate={navigate}
          logo={<LogoIcon className="h-[34px] w-[34px]" />}
          companyName={t('common:appName', { defaultValue: 'Forethread' })}
          onLogoClick={() => navigate(homePathForRole(role))}
          mobilePrimaryHrefs={getMobilePrimaryHrefs(role)}
          moreLabel={t('nav:more', { defaultValue: 'More' })}
          moreExtras={moreExtras}
          moreOpen={moreOpen}
          onMoreOpenChange={setMoreOpen}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 h-16 bg-card border-b border-gray-100 flex items-center justify-between gap-2 px-4 sm:px-6">
          {/* Phones: page title (+ back arrow) instead of the breadcrumb trail. */}
          <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
            {(mobileExit ?? backTo) && (
              <button
                type="button"
                aria-label={t('common:back', { defaultValue: 'Back' })}
                onClick={() => (mobileExit ? mobileExit() : backTo && navigate(backTo))}
                className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-50"
              >
                <ChevronRightIcon className="size-5 rotate-180" />
              </button>
            )}
            <h1 className="truncate text-base font-semibold text-foreground">{mobileTitle}</h1>
          </div>
          <Breadcrumbs items={breadcrumbItems} className="hidden min-w-0 md:flex" />
          <div className="flex shrink-0 items-center gap-2">
            {/* Phones: the page's secondary actions (⋯), portalled in by PageActions (B7). */}
            <MobileHeaderActionsSlot />
            <NotificationCenter />

            {/* Phones: avatar opens the More sheet (profile, log out, other sections). */}
            <button
              type="button"
              aria-label={t('nav:account', { defaultValue: 'Account' })}
              onClick={() => setMoreOpen(true)}
              className="flex size-10 items-center justify-center rounded-full md:hidden"
            >
              <AvatarWithStatus
                name={currentUser?.name ?? ''}
                avatarUrl={avatarUrl}
                workStatus={profile?.workStatus as WorkStatusType}
                size={32}
              />
            </button>

            <div className="relative group hidden md:block">
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
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={logoutMutation.isPending}
                  >
                    {t('auth:logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            'flex-1 overflow-auto md:pb-0',
            !navHidden && 'pb-[calc(56px+env(safe-area-inset-bottom))]',
          )}
        >
          <Outlet />
          {/* Phones: the page's main action bar (B7) mounts here, after the content. */}
          <MobileActionBarSlot className="md:hidden" />
        </main>
      </div>

      {showLogoutConfirm && (
        <ConfirmDialog
          title={t('auth:logoutConfirmTitle', { defaultValue: 'Log out' })}
          message={t('auth:logoutConfirmMessage', {
            defaultValue:
              'Are you sure you want to log out? You will need to sign in again to access your account.',
          })}
          confirmLabel={t('auth:logout')}
          cancelLabel={t('common:cancel', { defaultValue: 'Cancel' })}
          confirmVariant="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onConfirm={() => {
            setShowLogoutConfirm(false);
            logoutMutation.mutate();
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}
