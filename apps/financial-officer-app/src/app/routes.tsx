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
const FinancialOfficerVerifyOtpPage = lazy(
  () => import('@/features/auth/ui/FinancialOfficerVerifyOtpPage'),
);
const FinancialOfficerActivateAccountPage = lazy(
  () => import('@/features/auth/ui/FinancialOfficerActivateAccountPage'),
);
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const FinancialOfficerResetPasswordPage = lazy(
  () => import('@/features/auth/ui/FinancialOfficerResetPasswordPage'),
);

// ── Protected pages ──────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const InvoiceListPage = lazy(() => import('@/features/invoices/ui/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('@/features/invoices/ui/InvoiceDetailPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const UserProfilePage = lazy(() => import('@/features/profile/pages/UserProfilePage'));

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
          { path: ROUTES.verifyOtp, element: withSuspense(<FinancialOfficerVerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Public routes (always accessible) ──────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<FinancialOfficerActivateAccountPage />) },
      { path: ROUTES.resetPassword, element: withSuspense(<FinancialOfficerResetPasswordPage />) },

      // ── Protected routes ─────────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: withSuspense(<DashboardPage />) },
              { path: ROUTES.invoices, element: withSuspense(<InvoiceListPage />) },
              { path: ROUTES.invoiceDetail, element: withSuspense(<InvoiceDetailPage />) },
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
              { path: ROUTES.me, element: withSuspense(<UserProfilePage />) },
            ],
          },
        ],
      },
    ],
  },
];
