import { PageLoader } from '@forethread/ui-components';
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

import { ErrorPage } from '@/shared/components/ErrorPage';
import { GuestRoute } from '@/shared/components/GuestRoute';
import { PrivateRoute } from '@/shared/components/PrivateRoute';
import { AppLayout } from '@/shared/layout/AppLayout';

import { ROUTES } from './route-config';

// ── Auth pages (public) ──────────────────────────────────────────────────────
const LoginPage = lazy(() => import('@/features/auth/ui/LoginPage'));
const VendorVerifyOtpPage = lazy(() => import('@/features/auth/ui/VendorVerifyOtpPage'));
const VendorActivateAccountPage = lazy(
  () => import('@/features/auth/ui/VendorActivateAccountPage'),
);
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const VendorResetPasswordPage = lazy(() => import('@/features/auth/ui/VendorResetPasswordPage'));
const GuestInvitationPage = lazy(() => import('@/features/rfqs/pages/GuestInvitationPage'));
const MaterialDetailPage = lazy(() => import('@/features/rfqs/pages/MaterialDetailPage'));

// ── Protected pages ──────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const RfqListPage = lazy(() => import('@/features/rfqs/pages/RfqListPage'));
const RfqDetailPage = lazy(() => import('@/features/rfqs/pages/RfqDetailPage'));
const RfqResponsePage = lazy(() => import('@/features/rfqs/pages/RfqResponsePage'));
const PurchaseOrderListPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderListPage'),
);
const PurchaseOrderDetailPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderDetailPage'),
);
const PurchaseOrderCommsPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderCommsPage'),
);
const ChangeRequestPage = lazy(() => import('@/features/purchase-orders/pages/ChangeRequestPage'));
const BulkOrderListPage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderListPage'));
const BulkOrderDetailPage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderDetailPage'));
const BulkOrderChangePage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderChangePage'));
const BulkOrderReviewChangePage = lazy(
  () => import('@/features/bulk-orders/pages/BulkOrderReviewChangePage'),
);
const InvoiceDetailPage = lazy(() => import('@/features/invoices/pages/InvoiceDetailPage'));
const VendorUserListPage = lazy(() => import('@/features/users/ui/VendorUserListPage'));
const VendorUserDetailPage = lazy(() => import('@/features/users/ui/VendorUserDetailPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const UserProfilePage = lazy(() => import('@/features/profile/pages/UserProfilePage'));
const CompanyProfilePage = lazy(() => import('@/features/company/pages/CompanyProfilePage'));

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      // ── Guest-only routes (redirect to home if authenticated) ─────────
      {
        element: <GuestRoute />,
        children: [
          { path: ROUTES.login, element: withSuspense(<LoginPage />) },
          { path: ROUTES.verifyOtp, element: withSuspense(<VendorVerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Public routes (always accessible) ──────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<VendorActivateAccountPage />) },
      { path: ROUTES.resetPassword, element: withSuspense(<VendorResetPasswordPage />) },
      { path: ROUTES.guestInvitation, element: withSuspense(<GuestInvitationPage />) },

      // ── Protected routes ─────────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: withSuspense(<DashboardPage />) },
              { path: ROUTES.rfqs, element: withSuspense(<RfqListPage />) },
              { path: ROUTES.rfqDetail, element: withSuspense(<RfqDetailPage />) },
              { path: ROUTES.rfqResponse, element: withSuspense(<RfqResponsePage />) },
              { path: ROUTES.purchaseOrders, element: withSuspense(<PurchaseOrderListPage />) },
              {
                path: ROUTES.purchaseOrderComms,
                element: withSuspense(<PurchaseOrderCommsPage />),
              },
              {
                path: ROUTES.purchaseOrderChangeRequest,
                element: withSuspense(<ChangeRequestPage />),
              },
              {
                path: ROUTES.purchaseOrderDetail,
                element: withSuspense(<PurchaseOrderDetailPage />),
              },
              { path: ROUTES.bulkOrders, element: withSuspense(<BulkOrderListPage />) },
              { path: ROUTES.bulkOrderChange, element: withSuspense(<BulkOrderChangePage />) },
              {
                path: ROUTES.bulkOrderReviewChange,
                element: withSuspense(<BulkOrderReviewChangePage />),
              },
              { path: ROUTES.bulkOrderDetail, element: withSuspense(<BulkOrderDetailPage />) },
              {
                path: ROUTES.invoiceDetail,
                element: withSuspense(<InvoiceDetailPage />),
              },

              { path: ROUTES.users, element: withSuspense(<VendorUserListPage />) },
              { path: ROUTES.userDetail, element: withSuspense(<VendorUserDetailPage />) },
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
              { path: ROUTES.me, element: withSuspense(<UserProfilePage />) },
              { path: ROUTES.companyProfile, element: withSuspense(<CompanyProfilePage />) },
              { path: ROUTES.materialDetail, element: withSuspense(<MaterialDetailPage />) },
            ],
          },
        ],
      },
    ],
  },
];
