import { UserRole } from '@forethread/shared-types/client';
import { PageLoader } from '@forethread/ui-components';
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

import { ComingSoon } from '@/shared/components/ComingSoon';
import { ErrorPage } from '@/shared/components/ErrorPage';
import { GuestRoute } from '@/shared/components/GuestRoute';
import { PrivateRoute } from '@/shared/components/PrivateRoute';
import { AppLayout } from '@/shared/layout/AppLayout';
import { Forbidden, PermissionRoute, RoleRoute } from '@/shared/role';

import { HomeRedirect } from './HomeRedirect';
import { ROUTES } from './route-config';

const LoginPage = lazy(() => import('@/features/auth/ui/LoginPage'));
const VerifyOtpPage = lazy(() => import('@/features/auth/ui/VerifyOtpPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ui/ForgotPasswordPage'));
const ActivateAccountPage = lazy(() => import('@/features/auth/ui/ActivateAccountPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ui/ResetPasswordPage'));
const UserProfilePage = lazy(() => import('@/features/profile/pages/UserProfilePage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const RoleListPage = lazy(() => import('@/features/roles/pages/RoleListPage'));
const RoleEditPage = lazy(() => import('@/features/roles/pages/RoleEditPage'));
const ProjectListPage = lazy(() => import('@/features/projects/pages/ProjectListPage'));
const CreateProjectPage = lazy(() => import('@/features/projects/pages/CreateProjectPage'));
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'));
const EditProjectPage = lazy(() => import('@/features/projects/pages/EditProjectPage'));
const CreateBomPage = lazy(() => import('@/features/boms/pages/CreateBomPage'));
const RfqListRoleSwitch = lazy(() => import('@/features/rfqs/RfqListRoleSwitch'));
const RfqDetailRoleSwitch = lazy(() => import('@/features/rfqs/RfqDetailRoleSwitch'));
const MaterialDetailRoleSwitch = lazy(() => import('@/features/rfqs/MaterialDetailRoleSwitch'));
const CreateRfqPage = lazy(() => import('@/features/rfqs/buyer/pages/CreateRfqPage'));
const BomConversionPage = lazy(() => import('@/features/rfqs/buyer/pages/BomConversionPage'));
const QuoteResponseDetailPage = lazy(
  () => import('@/features/rfqs/buyer/pages/QuoteResponseDetailPage'),
);
const RfqResponsePage = lazy(() => import('@/features/rfqs/vendor/pages/RfqResponsePage'));
const GuestInvitationPage = lazy(() => import('@/features/rfqs/vendor/pages/GuestInvitationPage'));
const PurchaseOrderListRoleSwitch = lazy(
  () => import('@/features/purchase-orders/PurchaseOrderListRoleSwitch'),
);
const PurchaseOrderDetailRoleSwitch = lazy(
  () => import('@/features/purchase-orders/PurchaseOrderDetailRoleSwitch'),
);
const PurchaseOrderCommsRoleSwitch = lazy(
  () => import('@/features/purchase-orders/PurchaseOrderCommsRoleSwitch'),
);
const CreatePurchaseOrderPage = lazy(
  () => import('@/features/purchase-orders/buyer/pages/CreatePurchaseOrderPage'),
);
const ChangeRequestPage = lazy(
  () => import('@/features/purchase-orders/vendor/pages/ChangeRequestPage'),
);
const ChangePurchaseOrderPage = lazy(
  () => import('@/features/purchase-orders/buyer/pages/ChangePurchaseOrderPage'),
);
const BulkOrderListRoleSwitch = lazy(
  () => import('@/features/bulk-orders/BulkOrderListRoleSwitch'),
);
const BulkOrderDetailRoleSwitch = lazy(
  () => import('@/features/bulk-orders/BulkOrderDetailRoleSwitch'),
);
const BulkOrderChangeRoleSwitch = lazy(
  () => import('@/features/bulk-orders/BulkOrderChangeRoleSwitch'),
);
const BulkOrderReviewChangeRoleSwitch = lazy(
  () => import('@/features/bulk-orders/BulkOrderReviewChangeRoleSwitch'),
);
const BulkOrderCreatePage = lazy(
  () => import('@/features/bulk-orders/buyer/pages/BulkOrderCreatePage'),
);
const BulkOrderDrawdownPage = lazy(
  () => import('@/features/bulk-orders/buyer/pages/BulkOrderDrawdownPage'),
);
const BulkOrderEditPage = lazy(
  () => import('@/features/bulk-orders/buyer/pages/BulkOrderEditPage'),
);
const InvoiceListRoleSwitch = lazy(() => import('@/features/invoices/InvoiceListRoleSwitch'));
const InvoiceDetailRoleSwitch = lazy(() => import('@/features/invoices/InvoiceDetailRoleSwitch'));
const UploadInvoicePage = lazy(() => import('@/features/invoices/buyer/pages/UploadInvoicePage'));
const VendorListPage = lazy(() => import('@/features/vendors/pages/VendorListPage'));
const CreateVendorPage = lazy(() => import('@/features/vendors/pages/CreateVendorPage'));
const VendorProfilePage = lazy(() => import('@/features/vendors/pages/VendorProfilePage'));
const MaterialCataloguePage = lazy(
  () => import('@/features/material-catalogue/pages/MaterialCataloguePage'),
);
const MaterialDetailPage = lazy(
  () => import('@/features/material-catalogue/pages/MaterialDetailPage'),
);
const CreateMaterialPage = lazy(
  () => import('@/features/material-catalogue/pages/CreateMaterialPage'),
);
const EditMaterialCorePage = lazy(
  () => import('@/features/material-catalogue/pages/EditMaterialCorePage'),
);
const EditMaterialAdditionalPage = lazy(
  () => import('@/features/material-catalogue/pages/EditMaterialAdditionalPage'),
);
const MaterialListDetailPage = lazy(
  () => import('@/features/material-catalogue/pages/MaterialListDetailPage'),
);
const UploadMaterialFilePage = lazy(
  () => import('@/features/material-catalogue/pages/UploadMaterialFilePage'),
);
const UserListRoleSwitch = lazy(() => import('@/features/users/UserListRoleSwitch'));
const UserDetailRoleSwitch = lazy(() => import('@/features/users/UserDetailRoleSwitch'));
const CompanyDetailPage = lazy(() => import('@/features/companies/pages/CompanyDetailPage'));
const AdminPanelPage = lazy(() => import('@/features/admin-panel/pages/AdminPanelPage'));
const CompanyProfileRoleSwitch = lazy(
  () => import('@/features/company-profile/CompanyProfileRoleSwitch'),
);

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
// Material catalogue is visible to the buyer roles AND the super-admin (who
// owns the public catalogue and the approval queue — US 4.01).
const CATALOGUE_VIEWERS = [
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
] as const;
const RFQ_VIEWERS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.VENDOR,
] as const;
const PO_VIEWERS = RFQ_VIEWERS;
const BULK_ORDER_VIEWERS = RFQ_VIEWERS;
const INVOICE_LIST_VIEWERS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
] as const;
const INVOICE_DETAIL_VIEWERS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.FINANCIAL_OFFICER,
  UserRole.VENDOR,
] as const;
const USERS_VIEWERS = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.VENDOR] as const;
const COMPANY_PROFILE_VIEWERS = [
  UserRole.COMPANY_ADMIN,
  UserRole.PROCUREMENT_OFFICER,
  UserRole.VENDOR,
] as const;
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
      { path: ROUTES.guestInvitation, element: withSuspense(<GuestInvitationPage />) },

      // ── Authenticated ─────────────────────────────────────────────
      {
        element: <PrivateRoute />,
        children: [
          { path: ROUTES.forbidden, element: <Forbidden /> },
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.home, element: <HomeRedirect /> },
              { path: ROUTES.me, element: withSuspense(<UserProfilePage />) },
              { path: ROUTES.settings, element: withSuspense(<SettingsPage />) },
              {
                element: <RoleRoute allow={COMPANY_PROFILE_VIEWERS} />,
                children: [
                  {
                    path: ROUTES.companyProfile,
                    element: withSuspense(<CompanyProfileRoleSwitch />),
                  },
                ],
              },

              // RFQs
              {
                element: <RoleRoute allow={RFQ_VIEWERS} />,
                children: [
                  { path: ROUTES.rfqs, element: withSuspense(<RfqListRoleSwitch />) },
                  { path: ROUTES.rfqDetail, element: withSuspense(<RfqDetailRoleSwitch />) },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  {
                    element: <PermissionRoute require={['rfq.create']} />,
                    children: [
                      { path: ROUTES.rfqNew, element: withSuspense(<CreateRfqPage />) },
                      {
                        path: ROUTES.rfqFromBom,
                        element: withSuspense(<BomConversionPage />),
                      },
                    ],
                  },
                  {
                    path: ROUTES.quoteResponseDetail,
                    element: withSuspense(<QuoteResponseDetailPage />),
                  },
                ],
              },
              {
                element: <RoleRoute allow={VENDOR_ONLY} />,
                children: [
                  { path: ROUTES.rfqResponse, element: withSuspense(<RfqResponsePage />) },
                ],
              },

              // Purchase orders
              {
                element: <RoleRoute allow={PO_VIEWERS} />,
                children: [
                  {
                    path: ROUTES.purchaseOrders,
                    element: withSuspense(<PurchaseOrderListRoleSwitch />),
                  },
                  {
                    path: ROUTES.purchaseOrderDetail,
                    element: withSuspense(<PurchaseOrderDetailRoleSwitch />),
                  },
                  {
                    path: ROUTES.purchaseOrderComms,
                    element: withSuspense(<PurchaseOrderCommsRoleSwitch />),
                  },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  {
                    element: <PermissionRoute require={['po.create']} />,
                    children: [
                      {
                        path: ROUTES.purchaseOrderNew,
                        element: withSuspense(<CreatePurchaseOrderPage />),
                      },
                    ],
                  },
                  {
                    element: <PermissionRoute require={['po.proposeChange']} />,
                    children: [
                      {
                        path: ROUTES.purchaseOrderChange,
                        element: withSuspense(<ChangePurchaseOrderPage />),
                      },
                    ],
                  },
                ],
              },
              {
                element: <RoleRoute allow={VENDOR_ONLY} />,
                children: [
                  {
                    path: ROUTES.purchaseOrderChangeRequest,
                    element: withSuspense(<ChangeRequestPage />),
                  },
                ],
              },

              // Bulk orders. The static "/bulk-orders/new" create route is
              // registered before the "/:id" detail route so it is not
              // swallowed by it (US 5.08), and is gated to buyer roles that
              // hold bulkOrder.create.
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  {
                    element: <PermissionRoute require={['bulkOrder.create']} />,
                    children: [
                      {
                        path: ROUTES.bulkOrderNew,
                        element: withSuspense(<BulkOrderCreatePage />),
                      },
                    ],
                  },
                ],
              },
              {
                element: <RoleRoute allow={BULK_ORDER_VIEWERS} />,
                children: [
                  {
                    path: ROUTES.bulkOrders,
                    element: withSuspense(<BulkOrderListRoleSwitch />),
                  },
                  {
                    path: ROUTES.bulkOrderDetail,
                    element: withSuspense(<BulkOrderDetailRoleSwitch />),
                  },
                  {
                    path: ROUTES.bulkOrderChange,
                    element: withSuspense(<BulkOrderChangeRoleSwitch />),
                  },
                  {
                    path: ROUTES.bulkOrderReviewChange,
                    element: withSuspense(<BulkOrderReviewChangeRoleSwitch />),
                  },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  {
                    path: ROUTES.bulkOrderDrawdown,
                    element: withSuspense(<BulkOrderDrawdownPage />),
                  },
                  { path: ROUTES.bulkOrderEdit, element: withSuspense(<BulkOrderEditPage />) },
                ],
              },

              // Projects
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.projects, element: withSuspense(<ProjectListPage />) },
                  { path: ROUTES.projectsNew, element: withSuspense(<CreateProjectPage />) },
                  { path: ROUTES.projectDetail, element: withSuspense(<ProjectDetailPage />) },
                  { path: ROUTES.projectEdit, element: withSuspense(<EditProjectPage />) },
                  { path: ROUTES.projectBomCreate, element: withSuspense(<CreateBomPage />) },
                ],
              },

              // Invoices
              {
                element: <RoleRoute allow={INVOICE_LIST_VIEWERS} />,
                children: [
                  { path: ROUTES.invoices, element: withSuspense(<InvoiceListRoleSwitch />) },
                ],
              },
              {
                element: <RoleRoute allow={INVOICE_DETAIL_VIEWERS} />,
                children: [
                  {
                    path: ROUTES.invoiceDetail,
                    element: withSuspense(<InvoiceDetailRoleSwitch />),
                  },
                ],
              },
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.invoiceUpload, element: withSuspense(<UploadInvoicePage />) },
                ],
              },

              // Vendors
              {
                element: <RoleRoute allow={BUYER_SIDE} />,
                children: [
                  { path: ROUTES.vendors, element: withSuspense(<VendorListPage />) },
                  { path: ROUTES.vendorNew, element: withSuspense(<CreateVendorPage />) },
                  { path: ROUTES.vendorDetail, element: withSuspense(<VendorProfilePage />) },
                ],
              },

              // Material catalogue (US 4.01) — buyer roles + super-admin. Static
              // sub-paths (new, upload) and the edit sub-paths precede the :id
              // detail route so they are not swallowed by it; the deeper
              // /edit/additional is registered before /edit.
              {
                element: <RoleRoute allow={CATALOGUE_VIEWERS} />,
                children: [
                  {
                    path: ROUTES.materialCatalogue,
                    element: withSuspense(<MaterialCataloguePage />),
                  },
                  {
                    path: ROUTES.materialCatalogueNew,
                    element: withSuspense(<CreateMaterialPage />),
                  },
                  {
                    path: ROUTES.materialCatalogueUpload,
                    element: withSuspense(<UploadMaterialFilePage />),
                  },
                  {
                    // Literal "lists/:id" precedes the "/:id" detail route so it
                    // is not swallowed by it (US 4.03).
                    path: ROUTES.materialCatalogueListDetail,
                    element: withSuspense(<MaterialListDetailPage />),
                  },
                  {
                    path: ROUTES.materialCatalogueEditAdditional,
                    element: withSuspense(<EditMaterialAdditionalPage />),
                  },
                  {
                    path: ROUTES.materialCatalogueEdit,
                    element: withSuspense(<EditMaterialCorePage />),
                  },
                  {
                    path: ROUTES.materialCatalogueDetail,
                    element: withSuspense(<MaterialDetailPage />),
                  },
                ],
              },

              // Material (RFQ vendor view — unrelated /materials/:id route)
              {
                element: <RoleRoute allow={[...RFQ_VIEWERS]} />,
                children: [
                  {
                    path: ROUTES.materialDetail,
                    element: withSuspense(<MaterialDetailRoleSwitch />),
                  },
                ],
              },

              // Users (company users for buyer admins; vendor users for vendors;
              // platform users for super-admin — page chosen by RoleSwitch).
              {
                element: <RoleRoute allow={USERS_VIEWERS} />,
                children: [
                  { path: ROUTES.users, element: withSuspense(<UserListRoleSwitch />) },
                  { path: ROUTES.userDetail, element: withSuspense(<UserDetailRoleSwitch />) },
                ],
              },

              // Super-admin only
              {
                element: <RoleRoute allow={SUPER_ONLY} />,
                children: [
                  { path: ROUTES.companies, element: <ComingSoon page="Companies" /> },
                  { path: ROUTES.companyDetail, element: withSuspense(<CompanyDetailPage />) },
                  { path: ROUTES.adminPanel, element: withSuspense(<AdminPanelPage />) },
                ],
              },

              // Roles & permissions — gated by the same backend permission keys
              // (`role.list`, `role.update`) that the API enforces.
              {
                element: <PermissionRoute require={['role.list']} />,
                children: [
                  { path: ROUTES.roles, element: withSuspense(<RoleListPage />) },
                  {
                    element: <PermissionRoute require={['role.update']} />,
                    children: [{ path: ROUTES.roleEdit, element: withSuspense(<RoleEditPage />) }],
                  },
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
