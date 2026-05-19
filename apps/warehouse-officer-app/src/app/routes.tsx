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
const WarehouseOfficerVerifyOtpPage = lazy(
  () => import('@/features/auth/ui/WarehouseOfficerVerifyOtpPage'),
);
const WarehouseOfficerActivateAccountPage = lazy(
  () => import('@/features/auth/ui/WarehouseOfficerActivateAccountPage'),
);
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const WarehouseOfficerResetPasswordPage = lazy(
  () => import('@/features/auth/ui/WarehouseOfficerResetPasswordPage'),
);

// ── Protected pages ──────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
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
          { path: ROUTES.verifyOtp, element: withSuspense(<WarehouseOfficerVerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Public routes (always accessible) ──────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<WarehouseOfficerActivateAccountPage />) },
      { path: ROUTES.resetPassword, element: withSuspense(<WarehouseOfficerResetPasswordPage />) },

      // ── Protected routes ─────────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: withSuspense(<DashboardPage />) },
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
              { path: ROUTES.me, element: withSuspense(<UserProfilePage />) },
            ],
          },
        ],
      },
    ],
  },
];
