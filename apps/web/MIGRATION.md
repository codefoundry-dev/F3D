# `apps/web` — unified frontend migration

This document is the contract between sessions. Each follow-up turn picks one
feature row, ports it, ticks the box, and stops. Delete this file once the
six per-role apps are removed.

## Strategy

- One Vite/React SPA at `apps/web` replacing the six per-role apps:
  `super-admin-app`, `company-admin-app`, `procurement-officer-app`,
  `financial-officer-app`, `warehouse-officer-app`, `vendor-app`.
- Role is read from `useAuthStore().currentUser.role` (`UserRole` enum in
  `@forethread/shared-types`). The unified app uses a single auth store
  (`forethread-web-auth` persistence key) — old per-app stores are left
  alone so the legacy apps keep working during migration.
- Routing:
  - `PrivateRoute` (auth-only) wraps every internal route.
  - `RoleRoute allow={[…]}` wraps each feature subtree.
  - When two roles need different pages at the *same* URL (e.g.
    `/rfqs/:id` for VENDOR vs COMPANY_ADMIN), wrap the element in
    `<RoleSwitch byRole={{ VENDOR: …, COMPANY_ADMIN: … }} />`.
- Feature folder convention: `src/features/<feature>/pages/<role>/<Page>.tsx`
  for role-specific pages, `src/features/<feature>/pages/<Page>.tsx` for
  shared pages.

## Resolved URL conflicts

The original apps disagreed on a few paths. The unified map picks one:

| Concept         | super-admin / company-admin | vendor / proc-officer | **Unified** |
| --------------- | --------------------------- | --------------------- | ----------- |
| Users           | `/settings/users`           | `/users`              | `/users`    |
| Self profile    | `/settings/profile`         | `/me`                 | `/me`       |
| Company profile | `/settings/company`         | `/company`            | `/company`  |

Legacy links into `/settings/users`, `/settings/profile`, `/settings/company`
need redirects added in `routes.tsx` if any are still circulating.

## Per-role landing pages

`shared/role/roleHome.ts` — `ROLE_HOME_PATH`:

| Role                  | Landing            |
| --------------------- | ------------------ |
| SUPER_ADMIN           | `/admin-panel`     |
| COMPANY_ADMIN         | `/`                |
| PROCUREMENT_OFFICER   | `/`                |
| FINANCIAL_OFFICER     | `/invoices`        |
| WAREHOUSE_OFFICER     | `/`                |
| FOREMAN               | `/`                |
| VENDOR                | `/`                |

## Feature migration matrix

Roles that need each feature (source: existing per-app `features/` folders).
Use this to set the `allow=` for each `RoleRoute` in `app/routes.tsx`.

| Feature             | SA | CA | PO | FO | WO | FM | VN | Source paths to merge |
| ------------------- | -- | -- | -- | -- | -- | -- | -- | --------------------- |
| auth                | x  | x  | x  | x  | x  |    | x  | every app's `features/auth/` — role-specific OTP/activate/reset pages keep different copy in role-namespaced subfolders |
| dashboard           | x  | x  | x  | x  | x  |    | x  | every app's `features/dashboard/pages/DashboardPage.tsx` — different per role, use `RoleSwitch` at `/` |
| profile (me)        | x  | x  | x  | x  | x  |    | x  | every app's `features/profile/pages/UserProfilePage.tsx` |
| settings            | x  | x  | x  | x  | x  |    | x  | every app's `features/settings/pages/SettingsPage.tsx` |
| projects            |    | x  | x  |    |    |    |    | `company-admin-app`, `procurement-officer-app` `features/projects/` |
| rfqs (list/detail)  |    | x  | x  |    |    |    | x  | buyer-side: `company-admin-app`, `procurement-officer-app`. vendor-side different page — use `RoleSwitch` |
| rfq create          |    | x  | x  |    |    |    |    | buyer-side only |
| rfq response        |    |    |    |    |    |    | x  | `vendor-app/features/rfqs/pages/RfqResponsePage.tsx` |
| quote response detail|   | x  | x  |    |    |    |    | buyer-side only |
| material detail     |    | x  | x  |    |    |    | x  | buyer-side from `material-catalogue`; vendor-side `vendor-app/features/rfqs/pages/MaterialDetailPage.tsx` |
| purchase-orders     |    | x  | x  |    |    |    | x  | role-specific list/detail pages — `RoleSwitch` |
| po create           |    | x  | x  |    |    |    |    |   |
| po comms            |    | x  | x  |    |    |    | x  | `RoleSwitch` at `/purchase-orders/:id/comms` |
| po change request   |    |    |    |    |    |    | x  | vendor-only |
| bulk-orders         |    | x  | x  |    |    |    | x  | `RoleSwitch` for the list/detail; drawdown + edit are buyer-only |
| invoices            |    | x  | x  | x  |    |    | x  | finance has its own list page — `RoleSwitch` |
| invoice upload      |    | x  | x  |    |    |    |    |   |
| vendors             |    | x  | x  |    |    |    |    | `company-admin-app/features/vendors/` |
| material catalogue  |    | x  | x  |    |    |    |    |   |
| users               | x  | x  |    |    |    |    | x  | super-admin and company-admin manage internal users; vendor manages its own users — `RoleSwitch` |
| companies           | x  |    |    |    |    |    |    | `super-admin-app/features/companies/` |
| admin panel         | x  |    |    |    |    |    |    | `super-admin-app/features/admin-panel/` |
| company profile     |    | x  | x  |    |    |    | x  | `RoleSwitch` between buyer-side `settings/CompanyProfilePage` and vendor `company/CompanyProfilePage` |

Legend: SA = SUPER_ADMIN, CA = COMPANY_ADMIN, PO = PROCUREMENT_OFFICER,
FO = FINANCIAL_OFFICER, WO = WAREHOUSE_OFFICER, FM = FOREMAN, VN = VENDOR.

FOREMAN currently has no source app — leave it out of every `allow=` list
until that role ships.

## Per-feature migration checklist

Each row is one PR-sized task. Pre-migration the route renders a
`<ComingSoon />` stub.

- [x] **auth** — done. Discovery: all six apps' auth pages were
      byte-identical except for the exported component name. Migrated as
      five plain shared pages (`LoginPage`, `ForgotPasswordPage`,
      `VerifyOtpPage`, `ActivateAccountPage`, `ResetPasswordPage`) in
      `apps/web/src/features/auth/ui/` — no role-namespaced subfolders, no
      `RoleSwitch` needed. `LoginStub.tsx` deleted. Post-OTP navigation
      issue solved with `apps/web/src/app/HomeRedirect.tsx`: the
      `@forethread/auth` package hardcodes `navigate('/')` after a
      successful OTP, so `/` renders `HomeRedirect`, which bounces any role
      whose `homePathForRole(role)` isn't `/` (today: SUPER_ADMIN →
      `/admin-panel`) and otherwise renders the dashboard placeholder.
      Login flow has **not** yet been smoke-tested against the live
      backend end-to-end — that requires `docker-compose.dev.yml up` plus
      a test user, and is the first thing to do at the start of the
      next dashboard session.
- [ ] **dashboard** — port six `DashboardPage.tsx` into
      `features/dashboard/pages/<role>/DashboardPage.tsx`, wire
      `RoleSwitch` at `/`.
- [ ] **profile (me)** — port `UserProfilePage.tsx`; mostly identical
      across apps, candidate for a single shared page.
- [ ] **settings** — port `SettingsPage.tsx`; likely a single shared page
      with role-aware menu items inside.
- [ ] **projects** — port `ProjectListPage`, `CreateProjectPage`,
      `ProjectDetailPage`, `EditProjectPage` from `company-admin-app` and
      `procurement-officer-app` (diff them first — they may already
      be identical).
- [ ] **rfqs** — buyer-side `RfqListPage`, `RfqDetailPage`, `CreateRfqPage`,
      `QuoteResponseDetailPage` from company-admin/proc-officer; vendor-side
      `RfqListPage`, `RfqDetailPage`, `RfqResponsePage`, `MaterialDetailPage`,
      `GuestInvitationPage` from vendor-app. Wire `RoleSwitch` for shared URLs.
- [ ] **purchase-orders** — buyer-side `PurchaseOrderListPage`,
      `PurchaseOrderDetailPage`, `PurchaseOrderCommsPage`,
      `CreatePurchaseOrderPage`; vendor-side counterparts plus
      `ChangeRequestPage`.
- [ ] **bulk-orders** — `BulkOrderListPage`, `BulkOrderDetailPage`,
      `BulkOrderDrawdownPage`, `BulkOrderEditPage`, `BulkOrderChangePage`,
      `BulkOrderReviewChangePage`. Drawdown + edit are buyer-only.
- [ ] **invoices** — buyer-side `InvoiceListPage`, `InvoiceDetailPage`,
      `UploadInvoicePage`; finance-side list/detail (likely identical to
      buyer-side — diff first); vendor-side `InvoiceDetailPage`. Upload is
      buyer-only.
- [ ] **vendors** — `VendorListPage`, `CreateVendorPage`, `VendorProfilePage`
      from `company-admin-app`/`procurement-officer-app`.
- [ ] **material catalogue** — `MaterialCataloguePage` from
      `company-admin-app`/`procurement-officer-app`.
- [ ] **users** — `UserListPage`, `UserDetailPage` from super-admin /
      company-admin; `VendorUserListPage`, `VendorUserDetailPage` from
      vendor-app. Wire `RoleSwitch`.
- [ ] **companies** — `CompanyDetailPage` from super-admin-app.
- [ ] **admin panel** — `AdminPanelPage` from super-admin-app.
- [ ] **company profile** — buyer-side `CompanyProfilePage` from
      `company-admin-app/features/settings/pages/`; vendor-side from
      `vendor-app/features/company/pages/`. Wire `RoleSwitch`.

## Layout work that is NOT yet ported

`AppLayout.tsx` in the scaffold is intentionally minimal:

- The per-page title / subtitle / back-button logic lives in `usePageInfo()`
  in each per-app layout. Restore it incrementally as features migrate — the
  buyer-side title map in `company-admin-app/src/shared/layout/AppLayout.tsx`
  is the most complete starting point.
- `useAvatarUrl()` / `useProfile()` calls are skipped until the **profile**
  feature is migrated. The avatar currently renders without an image.
- Sidebar submenu rendering for `/settings/*` works through `hasSubmenu`,
  but the actual submenu items list lives in each app's settings page — port
  with the **settings** feature.

## Cleanup (only after all rows above are ticked)

1. Diff each old app's `package.json` against `apps/web/package.json` and
   confirm no unique deps are left behind.
2. Delete `apps/company-admin-app`, `apps/super-admin-app`,
   `apps/procurement-officer-app`, `apps/financial-officer-app`,
   `apps/warehouse-officer-app`, `apps/vendor-app`.
3. Remove the per-role `*_APP_URL` env vars and `5173-5178` ports from
   `docker-compose.dev.yml` / `docker-compose.staging.yml` /
   `docker-compose.production.yml`. Keep `WEB_APP_URL` and `5179`.
4. Update `CORS_ORIGINS` to a single origin.
5. Strip the per-app auth storage keys (`forethread-company-auth`,
   `forethread-vendor-auth`, etc.) from any docs.
6. Delete `apps/web/MIGRATION.md`.
