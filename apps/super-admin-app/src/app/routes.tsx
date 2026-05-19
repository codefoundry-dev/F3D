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
const SuperAdminVerifyOtpPage = lazy(() => import('@/features/auth/ui/SuperAdminVerifyOtpPage'));
const SuperAdminActivateAccountPage = lazy(
  () => import('@/features/auth/ui/SuperAdminActivateAccountPage'),
);
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const SuperAdminResetPasswordPage = lazy(
  () => import('@/features/auth/ui/SuperAdminResetPasswordPage'),
);

// ── Protected pages ──────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const UserListPage = lazy(() => import('@/features/users/ui/UserListPage'));
const UserDetailPage = lazy(() => import('@/features/users/ui/UserDetailPage'));
const CompanyDetailPage = lazy(() => import('@/features/companies/pages/CompanyDetailPage'));
const AdminPanelPage = lazy(() => import('@/features/admin-panel/pages/AdminPanelPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));

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
          { path: ROUTES.verifyOtp, element: withSuspense(<SuperAdminVerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Public routes (always accessible) ──────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<SuperAdminActivateAccountPage />) },
      { path: ROUTES.resetPassword, element: withSuspense(<SuperAdminResetPasswordPage />) },

      // ── Protected routes ─────────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: withSuspense(<DashboardPage />) },
              { path: ROUTES.users, element: withSuspense(<UserListPage />) },
              { path: ROUTES.userDetail, element: withSuspense(<UserDetailPage />) },
              { path: ROUTES.companyDetail, element: withSuspense(<CompanyDetailPage />) },
              { path: ROUTES.adminPanel, element: withSuspense(<AdminPanelPage />) },
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
            ],
          },
        ],
      },
    ],
  },
];
