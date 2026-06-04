# Frontend consolidation & migration map

**Status:** Active · **Owner:** web · **Tracks:** FOR-212 (continues FOR-198 / "A12" foundation)

This is the parity audit for the frontend consolidation. The six legacy per-role apps were replaced
by a single unified shell, `apps/web` (see [ADR-0013](../../docs/adr/0013-consolidation-shell.md)).
This document is the source of truth for **where each legacy feature now lives**, **how roles are
routed**, and **what is explicitly deferred to Phase 2**.

It is referenced from `apps/web/src/app/routes.tsx`, `apps/web/src/app/route-config.ts`, and
`apps/web/src/shared/components/ComingSoon.tsx`.

---

## 1. The six legacy apps → one unified app

The per-role apps were **deleted** in commit `545972f` ("remove legacy per-role apps and unify
backend URLs"). The migration itself landed in `7dc3004` (scaffold + auth) and `52388ba` (complete
feature migration); RBAC moved to permission-based in `d600967`. Anything historical lives in git
history.

| Legacy app (deleted)      | Served role(s)      | Now served by `apps/web` via                                     |
| ------------------------- | ------------------- | ---------------------------------------------------------------- |
| `company-admin-app`       | COMPANY_ADMIN       | buyer surfaces under `features/<domain>/buyer/`                  |
| `procurement-officer-app` | PROCUREMENT_OFFICER | buyer surfaces (same as Company Admin, permission-gated)         |
| `financial-officer-app`   | FINANCIAL_OFFICER   | `features/invoices/finance/`, `features/dashboard/pages/finance` |
| `warehouse-officer-app`   | WAREHOUSE_OFFICER   | `features/dashboard/pages/warehouse` (field-ops → Phase 2)       |
| `super-admin-app`         | SUPER_ADMIN         | `features/admin-panel`, `features/users/super-admin`, companies  |
| `vendor-app`              | VENDOR              | vendor surfaces under `features/<domain>/vendor/`                |

**Structure policy** (ADR-0013): folders are organised **domain-first, role-second** (the opposite
of the old role-first split that produced six apps). A vendor PO page lives at
`features/purchase-orders/vendor/`, never in a separate app. Shared buyer/vendor logic lives in
`packages/{po,rfq,bulk-order,invoice,profile,vendor}-shared`, `packages/ui-components`,
`packages/api-client`, `packages/auth`, `packages/i18n`.

**Backend URL unification:** the per-app origin env vars (`SUPER_ADMIN_APP_URL`,
`COMPANY_ADMIN_APP_URL`, `VENDOR_APP_URL`, `PROCUREMENT_OFFICER_APP_URL`,
`FINANCIAL_OFFICER_APP_URL`, `WAREHOUSE_OFFICER_APP_URL`) collapsed to a single `WEB_APP_URL`
(`apps/backend/.env.example`).

---

## 2. Roles, homes & navigation

Roles come from `UserRole` (`packages/shared-types`). Post-login everyone lands at `/`;
`HomeRedirect` (`apps/web/src/app/HomeRedirect.tsx`) bounces roles whose canonical home isn't `/`,
per `apps/web/src/shared/role/roleHome.ts`.

| Role                | Home           | Sidebar nav (`sidebarConfig.tsx`)                                                |
| ------------------- | -------------- | -------------------------------------------------------------------------------- |
| SUPER_ADMIN         | `/admin-panel` | Settings → (Users, Roles)                                                        |
| COMPANY_ADMIN       | `/`            | Projects, RFQ Mgmt, PO Mgmt, Bulk Orders, Invoices, Vendors, Materials, Settings |
| PROCUREMENT_OFFICER | `/`            | same as Company Admin (create actions permission-gated)                          |
| FINANCIAL_OFFICER   | `/invoices`    | Invoices, Settings                                                               |
| WAREHOUSE_OFFICER   | `/`            | Settings (dashboard is the home; field-ops → Phase 2)                            |
| FOREMAN             | `/`            | Settings (home = "Field App" placeholder; Field PWA → Phase 2)                   |
| VENDOR              | `/`            | RFQ Mgmt, PO Mgmt, Bulk Orders, Invoices, Settings                               |

**Settings is a hub** (`features/settings/pages/SettingsPage.tsx`), not a single page. It exposes
role-gated links so roles with a thin sidebar still reach their admin flows:

- **Users** — SUPER_ADMIN, COMPANY_ADMIN, VENDOR → `/users`
- **Company** — COMPANY_ADMIN, PROCUREMENT_OFFICER, VENDOR → `/company`
- **Roles & permissions** — COMPANY_ADMIN, SUPER_ADMIN → `/settings/roles`

Two enforcement layers (ADR-0013, ADR-0015): the JWT role + backend `PermissionsGuard` is
authoritative; `RoleRoute` / `RoleSwitch` / `PermissionRoute` in `apps/web/src/shared/role/` only
shape the UX.

---

## 3. URL-conflict resolution

The six apps each owned their own URL space; collisions were resolved when merging into one router
(canonical map in `apps/web/src/app/route-config.ts`):

| Feature     | Legacy URL          | Unified URL |
| ----------- | ------------------- | ----------- |
| Users       | `/settings/users`   | `/users`    |
| Own profile | `/settings/profile` | `/me`       |
| Company     | `/settings/company` | `/company`  |

Paths that render a different page per role share one canonical URL and are dispatched by a
`RoleSwitch` (e.g. `/rfqs/:id` → vendor response page vs. internal detail page).

---

## 4. Feature parity matrix

✅ shipped in `apps/web` · 🟡 partial · ⏳ Phase 2 · — n/a for role

| Domain                          | Buyer (CA/PO)  | Finance (FO) |       Vendor       | Warehouse |       Super Admin       |
| ------------------------------- | :------------: | :----------: | :----------------: | :-------: | :---------------------: |
| Auth (login/OTP/activate/reset) |       ✅       |      ✅      |         ✅         |    ✅     |           ✅            |
| Dashboard                       |       ✅       |      ✅      |         ✅         |    ✅     |           ✅            |
| RFQs                            |  ✅ (+create)  |      —       |    ✅ (respond)    |     —     |            —            |
| Purchase Orders                 |  ✅ (+create)  |      —       | ✅ (accept/change) |     —     |            —            |
| Bulk Orders                     | ✅ (+drawdown) |      —       |         ✅         |     —     |            —            |
| Invoices                        |  ✅ (upload)   | ✅ (review)  |     ✅ (view)      |     —     |            —            |
| Projects                        |   ✅ (CRUD)    |      —       |         —          |     —     |            —            |
| Vendors + Materials             |   ✅ (CRUD)    |      —       |         —          |     —     |            —            |
| Users                           |  ✅ (company)  |      —       |     ✅ (team)      |     —     |      ✅ (platform)      |
| Company profile                 |       ✅       |      —       |         ✅         |     —     |            —            |
| Roles & permissions             |   ✅ (gated)   |      —       |         —          |     —     |           ✅            |
| Admin panel                     |       —        |      —       |         —          |     —     |           ✅            |
| Companies                       |       —        |      —       |         —          |     —     | 🟡 (detail ✅, list ⏳) |
| Warehouse field-ops             |       —        |      —       |         —          |    ⏳     |            —            |

---

## 5. Explicitly deferred to Phase 2

Per FOR-212 AC#1, the following are **intentionally not** at parity and are deferred. Each has a
non-broken placeholder so no role hits a dead end.

1. **Foreman Field PWA** ([ADR-0008](../../docs/adr/0008-field-pwa-offline-and-sync.md)). Offline
   field-worker app. `FOREMAN` lands on a `ComingSoon page="Field App"` placeholder at `/`
   (`DashboardRoleSwitch.tsx`) instead of `/forbidden`.
2. **Warehouse field-ops.** The warehouse **dashboard** (deliveries / bulk-order overview) is
   shipped; request queue, stock confirmation, and barcode/inventory are Phase 2
   (`tests/e2e/procurement/us13-warehouse-ops.spec.ts` is `test.fixme`).
3. **Companies management (super-admin).** `/companies` is a `ComingSoon` stub; the per-company
   detail page (`/companies/:id`) is already built.
4. **RFQ alternate create entry points.** The buyer Quick-Action dropdown items "Converting a
   project BOM" and "From material list" are `TODO` in
   `features/dashboard/ui/buyer/QuickActions.tsx`. The BOM-conversion page exists at
   `/rfqs/from-bom`; only the shortcut wiring is pending.

---

## 6. Removed legacy code stays removed (AC#4)

- No `apps/*` per-role directories remain — `apps/` contains only `backend` and `web`.
- `pnpm-workspace.yaml` globs `apps/*` generically; there are no per-app build, compose, or deploy
  targets.
- Backend origin env vars are unified to `WEB_APP_URL` (see §1).

If a legacy per-role app is ever reintroduced, it should be challenged against ADR-0013 first.

---

## 7. E2E coverage

The consolidation-era specs run against the unified dev server (`:5179`, `playwright.config.ts`):

- **FOR-198** — `tests/e2e/foundation/for-198-per-role-login-home.spec.ts`: every role logs in and
  lands on its role-appropriate home.
- **FOR-212** — `tests/e2e/foundation/for-212-per-role-primary-action.spec.ts`: every role logs in →
  home → exercises one primary action (e.g. Company Admin starts an RFQ, Procurement opens PO
  management, Vendor opens RFQ management, Super Admin reaches platform user management).

> **Test debt:** the older `tests/e2e/procurement/us-*.spec.ts` specs predate the consolidation and
> still override `baseURL` to dead per-app ports (`3002`–`3004`). They should be repointed at the
> unified `:5179` when next touched; the `foundation/` specs are the current pattern to copy.
