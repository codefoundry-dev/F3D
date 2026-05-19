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
const ProcurementOfficerVerifyOtpPage = lazy(
  () => import('@/features/auth/ui/ProcurementOfficerVerifyOtpPage'),
);
const ProcurementOfficerActivateAccountPage = lazy(
  () => import('@/features/auth/ui/ProcurementOfficerActivateAccountPage'),
);
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const ProcurementOfficerResetPasswordPage = lazy(
  () => import('@/features/auth/ui/ProcurementOfficerResetPasswordPage'),
);

// ── Protected pages ──────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const RfqListPage = lazy(() => import('@/features/rfqs/pages/RfqListPage'));
const PurchaseOrderListPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderListPage'),
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
const VendorListPage = lazy(() => import('@/features/vendors/pages/VendorListPage'));
const RfqDetailPage = lazy(() => import('@/features/rfqs/pages/RfqDetailPage'));
const PurchaseOrderDetailPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderDetailPage'),
);
const PurchaseOrderCommsPage = lazy(
  () => import('@/features/purchase-orders/pages/PurchaseOrderCommsPage'),
);
const InvoiceDetailPage = lazy(() => import('@/features/invoices/pages/InvoiceDetailPage'));
const UploadInvoicePage = lazy(() => import('@/features/invoices/pages/UploadInvoicePage'));
const CreateRfqPage = lazy(() => import('@/features/rfqs/pages/CreateRfqPage'));
const QuoteResponseDetailPage = lazy(() => import('@/features/rfqs/pages/QuoteResponseDetailPage'));
const CreatePurchaseOrderPage = lazy(
  () => import('@/features/purchase-orders/pages/CreatePurchaseOrderPage'),
);
const CreateVendorPage = lazy(() => import('@/features/vendors/pages/CreateVendorPage'));
const VendorProfilePage = lazy(() => import('@/features/vendors/pages/VendorProfilePage'));
const ProjectListPage = lazy(() => import('@/features/projects/pages/ProjectListPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'));
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
          { path: ROUTES.verifyOtp, element: withSuspense(<ProcurementOfficerVerifyOtpPage />) },
          { path: ROUTES.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },

      // ── Public routes (always accessible) ──────────────────────────────
      { path: ROUTES.activate, element: withSuspense(<ProcurementOfficerActivateAccountPage />) },
      {
        path: ROUTES.resetPassword,
        element: withSuspense(<ProcurementOfficerResetPasswordPage />),
      },

      // ── Protected routes ─────────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: withSuspense(<DashboardPage />) },
              { path: ROUTES.projects, element: withSuspense(<ProjectListPage />) },
              { path: ROUTES.projectDetail, element: withSuspense(<ProjectDetailPage />) },
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
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
              { path: ROUTES.me, element: withSuspense(<UserProfilePage />) },
            ],
          },
        ],
      },
    ],
  },
];
