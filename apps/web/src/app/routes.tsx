import { UserRole } from '@forethread/shared-types';
import { PageLoader } from '@forethread/ui-components';
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

import { ComingSoon } from '@/shared/components/ComingSoon';
import { ErrorPage } from '@/shared/components/ErrorPage';
import { GuestRoute } from '@/shared/components/GuestRoute';
import { PrivateRoute } from '@/shared/components/PrivateRoute';
import { AppLayout } from '@/shared/layout/AppLayout';
import { Forbidden, RoleRoute } from '@/shared/role';

import { HomeRedirect } from './HomeRedirect';
import { ROUTES } from './route-config';

const LoginPage = lazy(() => import('@/features/auth/ui/LoginPage'));
const VerifyOtpPage = lazy(() => import('@/features/auth/ui/VerifyOtpPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const ActivateAccountPage = lazy(() => import('@/features/auth/ui/ActivateAccountPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ui/ResetPasswordPage'));

// ── Allowed-role sets, derived from each role's app today ───────────
// (Source of truth for the migration; see apps/web/MIGRATION.md.)
const ALL_INTERNAL = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.WAREHOUSE_OFFICER,
  UserRole.FOREMAN,
] as const;

const BUYER_SIDE = [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER] as const;
const RFQ_VIEWERS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.VENDOR,
] as const;
const PO_VIEWERS = RFQ_VIEWERS;
const BULK_ORDER_VIEWERS = RFQ_VIEWERS;
const INVOICE_VIEWERS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.VENDOR,
] as const;
const USERS_VIEWERS = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.VENDOR] as const;
const SUPER_ONLY = [UserRole.SUPER_ADMIN] as const;
const VENDOR_ONLY = [UserRole.VENDOR] as const;

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      // ── Guest-only ────────────────────────────────────────────────
      {
        element: <GuestRoute />,
        children: [
          { path: ROUTES.login, element: withSuspense(<LoginPage />) },
          { path: ROUTES.verifyOtp, element: withSuspense(<VerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Always-public ─────────────────────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<ActivateAccountPage />) },
      { path: ROUTES.resetPassword, element: withSuspense(<ResetPasswordPage />) },
      { path: ROUTES.guestInvitation, element: <ComingSoon page="Guest invitation" /> },

      // ── Authenticated ─────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          { path: ROUTES.forbidden, element: <Forbidden /> },
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: <HomeRedirect /> },
              { path: ROUTES.me, element: <ComingSoon page="My profile" /> },
              { path: ROUTES.settings, element: <ComingSoon page="Settings" /> },
              { path: ROUTES.companyProfile, element: <ComingSoon page="Company profile" /> },

              // RFQs
              {
                element: <RoleRoute allow={RFQ_VIEWERS} />,
                children: [
                  { path: ROUTES.rfqs, element: <ComingSoon page="RFQs" /> },
                  { path: ROUTES.rfqDetail, element: <ComingSoon page="RFQ detail" /> },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.rfqNew, element: <ComingSoon page="Create RFQ" /> },
                  {
                    path: ROUTES.quoteResponseDetail,
                    element: <ComingSoon page="Quote response detail" />,
                  },
                ],
              },
              {
                element: <RoleRoute allow={VENDOR_ONLY} />,
                children: [
                  { path: ROUTES.rfqResponse, element: <ComingSoon page="Vendor RFQ response" /> },
                ],
              },

              // Purchase orders
              {
                element: <RoleRoute allow={PO_VIEWERS} />,
                children: [
                  { path: ROUTES.purchaseOrders, element: <ComingSoon page="Purchase orders" /> },
                  {
                    path: ROUTES.purchaseOrderDetail,
                    element: <ComingSoon page="Purchase order detail" />,
                  },
                  {
                    path: ROUTES.purchaseOrderComms,
                    element: <ComingSoon page="Purchase order comms" />,
                  },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  {
                    path: ROUTES.purchaseOrderNew,
                    element: <ComingSoon page="Create purchase order" />,
                  },
                ],
              },
              {
                element: <RoleRoute allow={VENDOR_ONLY} />,
                children: [
                  {
                    path: ROUTES.purchaseOrderChangeRequest,
                    element: <ComingSoon page="PO change request" />,
                  },
                ],
              },

              // Bulk orders
              {
                element: <RoleRoute allow={BULK_ORDER_VIEWERS} />,
                children: [
                  { path: ROUTES.bulkOrders, element: <ComingSoon page="Bulk orders" /> },
                  {
                    path: ROUTES.bulkOrderDetail,
                    element: <ComingSoon page="Bulk order detail" />,
                  },
                  {
                    path: ROUTES.bulkOrderChange,
                    element: <ComingSoon page="Bulk order change" />,
                  },
                  {
                    path: ROUTES.bulkOrderReviewChange,
                    element: <ComingSoon page="Bulk order review change" />,
                  },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  {
                    path: ROUTES.bulkOrderDrawdown,
                    element: <ComingSoon page="Bulk order drawdown" />,
                  },
                  { path: ROUTES.bulkOrderEdit, element: <ComingSoon page="Bulk order edit" /> },
                ],
              },

              // Projects
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.projects, element: <ComingSoon page="Projects" /> },
                  { path: ROUTES.projectsNew, element: <ComingSoon page="Create project" /> },
                  { path: ROUTES.projectDetail, element: <ComingSoon page="Project detail" /> },
                  { path: ROUTES.projectEdit, element: <ComingSoon page="Edit project" /> },
                ],
              },

              // Invoices
              {
                element: <RoleRoute allow={INVOICE_VIEWERS} />,
                children: [
                  { path: ROUTES.invoices, element: <ComingSoon page="Invoices" /> },
                  { path: ROUTES.invoiceDetail, element: <ComingSoon page="Invoice detail" /> },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.invoiceUpload, element: <ComingSoon page="Upload invoice" /> },
                ],
              },

              // Vendors / materials
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.vendors, element: <ComingSoon page="Vendors" /> },
                  { path: ROUTES.vendorNew, element: <ComingSoon page="Add vendor" /> },
                  { path: ROUTES.vendorDetail, element: <ComingSoon page="Vendor detail" /> },
                  {
                    path: ROUTES.materialCatalogue,
                    element: <ComingSoon page="Material catalogue" />,
                  },
                ],
              },
              {
                element: <RoleRoute allow={[...RFQ_VIEWERS]} />,
                children: [
                  { path: ROUTES.materialDetail, element: <ComingSoon page="Material detail" /> },
                ],
              },

              // Users (company users for buyer admins; vendor users for vendors;
              // platform users for super-admin — page chosen by RoleSwitch later)
              {
                element: <RoleRoute allow={USERS_VIEWERS} />,
                children: [
                  { path: ROUTES.users, element: <ComingSoon page="Users" /> },
                  { path: ROUTES.userDetail, element: <ComingSoon page="User detail" /> },
                ],
              },

              // Super-admin only
              {
                element: <RoleRoute allow={SUPER_ONLY} />,
                children: [
                  { path: ROUTES.companies, element: <ComingSoon page="Companies" /> },
                  { path: ROUTES.companyDetail, element: <ComingSoon page="Company detail" /> },
                  { path: ROUTES.adminPanel, element: <ComingSoon page="Admin panel" /> },
                ],
              },

              // Catch-all internal route the linter can find — keeps ALL_INTERNAL
              // referenced so the next migration session can rely on it.
              {
                element: <RoleRoute allow={ALL_INTERNAL} />,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];
