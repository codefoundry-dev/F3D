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
const CompanyAdminVerifyOtpPage = lazy(
  () => import('@/features/auth/ui/CompanyAdminVerifyOtpPage'),
);
const CompanyAdminActivateAccountPage = lazy(
  () => import('@/features/auth/ui/CompanyAdminActivateAccountPage'),
);
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const CompanyAdminResetPasswordPage = lazy(
  () => import('@/features/auth/ui/CompanyAdminResetPasswordPage'),
);

// ── Protected pages ──────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const RfqListPage = lazy(() => import('@/features/rfqs/pages/RfqListPage'));
const RfqDetailPage = lazy(() => import('@/features/rfqs/pages/RfqDetailPage'));
const PurchaseOrderListPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderListPage'),
);
const ProjectListPage = lazy(() => import('@/features/projects/ui/ProjectListPage'));
const CreateProjectPage = lazy(() => import('@/features/projects/ui/CreateProjectPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/ui/ProjectDetailPage'));
const EditProjectPage = lazy(() => import('@/features/projects/ui/EditProjectPage'));
const PurchaseOrderDetailPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderDetailPage'),
);
const PurchaseOrderCommsPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderCommsPage'),
);
const BulkOrderListPage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderListPage'));
const BulkOrderDetailPage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderDetailPage'));
const BulkOrderDrawdownPage = lazy(
  () => import('@/features/bulk-orders/pages/BulkOrderDrawdownPage'),
);
const BulkOrderEditPage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderEditPage'));
const BulkOrderChangePage = lazy(() => import('@/features/bulk-orders/pages/BulkOrderChangePage'));
const BulkOrderReviewChangePage = lazy(
  () => import('@/features/bulk-orders/pages/BulkOrderReviewChangePage'),
);
const InvoiceListPage = lazy(() => import('@/features/invoices/ui/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('@/features/invoices/ui/InvoiceDetailPage'));
const UploadInvoicePage = lazy(() => import('@/features/invoices/pages/UploadInvoicePage'));
const CreateRfqPage = lazy(() => import('@/features/rfqs/pages/CreateRfqPage'));
const QuoteResponseDetailPage = lazy(() => import('@/features/rfqs/pages/QuoteResponseDetailPage'));
const CreatePurchaseOrderPage = lazy(
  () => import('@/features/purchase-orders/pages/CreatePurchaseOrderPage'),
);
const VendorListPage = lazy(() => import('@/features/vendors/pages/VendorListPage'));
const CreateVendorPage = lazy(() => import('@/features/vendors/pages/CreateVendorPage'));
const VendorProfilePage = lazy(() => import('@/features/vendors/pages/VendorProfilePage'));
const MaterialCataloguePage = lazy(
  () => import('@/features/material-catalogue/pages/MaterialCataloguePage'),
);
const UserListPage = lazy(() => import('@/features/users/ui/UserListPage'));
const UserDetailPage = lazy(() => import('@/features/users/ui/UserDetailPage'));
const UserProfilePage = lazy(() => import('@/features/profile/pages/UserProfilePage'));
const CompanyProfilePage = lazy(() => import('@/features/settings/pages/CompanyProfilePage'));
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
          { path: ROUTES.verifyOtp, element: withSuspense(<CompanyAdminVerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Public routes (always accessible) ──────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<CompanyAdminActivateAccountPage />) },
      { path: ROUTES.resetPassword, element: withSuspense(<CompanyAdminResetPasswordPage />) },

      // ── Protected routes ─────────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: withSuspense(<DashboardPage />) },
              { path: ROUTES.rfqs, element: withSuspense(<RfqListPage />) },
              { path: ROUTES.rfqNew, element: withSuspense(<CreateRfqPage />) },
              { path: ROUTES.rfqDetail, element: withSuspense(<RfqDetailPage />) },
              {
                path: ROUTES.quoteResponseDetail,
                element: withSuspense(<QuoteResponseDetailPage />),
              },
              { path: ROUTES.purchaseOrders, element: withSuspense(<PurchaseOrderListPage />) },
              {
                path: ROUTES.purchaseOrderNew,
                element: withSuspense(<CreatePurchaseOrderPage />),
              },
              {
                path: ROUTES.purchaseOrderComms,
                element: withSuspense(<PurchaseOrderCommsPage />),
              },
              {
                path: ROUTES.purchaseOrderDetail,
                element: withSuspense(<PurchaseOrderDetailPage />),
              },
              { path: ROUTES.projects, element: withSuspense(<ProjectListPage />) },
              { path: ROUTES.projectsNew, element: withSuspense(<CreateProjectPage />) },
              { path: ROUTES.projectDetail, element: withSuspense(<ProjectDetailPage />) },
              { path: ROUTES.projectEdit, element: withSuspense(<EditProjectPage />) },
              { path: ROUTES.bulkOrders, element: withSuspense(<BulkOrderListPage />) },
              { path: ROUTES.bulkOrderDrawdown, element: withSuspense(<BulkOrderDrawdownPage />) },
              { path: ROUTES.bulkOrderEdit, element: withSuspense(<BulkOrderEditPage />) },
              { path: ROUTES.bulkOrderChange, element: withSuspense(<BulkOrderChangePage />) },
              {
                path: ROUTES.bulkOrderReviewChange,
                element: withSuspense(<BulkOrderReviewChangePage />),
              },
              { path: ROUTES.bulkOrderDetail, element: withSuspense(<BulkOrderDetailPage />) },
              { path: ROUTES.invoices, element: withSuspense(<InvoiceListPage />) },
              { path: ROUTES.invoiceDetail, element: withSuspense(<InvoiceDetailPage />) },
              { path: ROUTES.invoiceUpload, element: withSuspense(<UploadInvoicePage />) },
              { path: ROUTES.vendors, element: withSuspense(<VendorListPage />) },
              { path: ROUTES.vendorNew, element: withSuspense(<CreateVendorPage />) },
              { path: ROUTES.vendorDetail, element: withSuspense(<VendorProfilePage />) },
              { path: ROUTES.materialCatalogue, element: withSuspense(<MaterialCataloguePage />) },
              { path: ROUTES.users, element: withSuspense(<UserListPage />) },
              { path: ROUTES.userDetail, element: withSuspense(<UserDetailPage />) },
              { path: ROUTES.profile, element: withSuspense(<UserProfilePage />) },
              { path: ROUTES.companyProfile, element: withSuspense(<CompanyProfilePage />) },
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
            ],
          },
        ],
      },
    ],
  },
];
