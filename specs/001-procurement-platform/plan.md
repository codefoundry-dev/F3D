# Implementation Plan: Project Creation & Management (Epic 2)

**Branch**: `001-procurement-platform` | **Date**: 2026-02-23 | **Last Updated**: 2026-03-26 |
**Spec**: [spec.md](spec.md) **Input**: User Story 2 — Project Creation & Management (Priority: P2)
**Prerequisites**: Epic 1 (User Registration & Access Management) — mostly complete (see gaps below)

---

## Summary

Epic 2 adds the Project module to the procurement platform. Company Admins and Procurement Officers
can create projects with delivery locations, storage locations, and assigned users. Projects are the
organisational container for all procurement documents — without a project, no RFQ, PO, or invoice
can be created. Access control is enforced at the project level: only users explicitly assigned to a
project can view or act on its documents.

**Technical approach**: New NestJS `projects` module with Prisma models (Project, ProjectLocation,
ProjectMember), shared DTOs in `packages/shared-types`, API client endpoints in
`packages/api-client`, and a fully scaffolded `apps/company-admin-app` with auth + project
management UI. A reusable `ProjectAccessGuard` enforces project-scoped access checks on all project
endpoints.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) — established in Epic 1 **Primary Dependencies**:
NestJS 10.x, React 18, Vite 5, Prisma 5.x, TanStack Query 5, Zustand 4 **Storage**: PostgreSQL 16
(existing), MinIO (file uploads — future project documents) **Testing**: Jest (unit + integration),
React Testing Library (component) **Target Platform**: Web (desktop browsers) **Project Type**: Web
application (monorepo — `apps/backend` + `apps/company-admin-app`) **Performance Goals**: Project
list loads < 3s for 1,000 projects (SC-004) **Constraints**: Role-based + project-scoped access
control on all endpoints **Scale/Scope**: ~50 projects per contractor company initially; 7 API
endpoints; 4 frontend pages

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| #    | Principle                 | Status | Notes                                                                                  |
| ---- | ------------------------- | ------ | -------------------------------------------------------------------------------------- |
| I    | Monorepo-First            | PASS   | New module in `apps/backend/src/modules/projects/`, new app `apps/company-admin-app/`  |
| II   | Clean Architecture        | PASS   | Controller -> Service -> Prisma; business logic in service only                        |
| III  | Strict Type Safety        | PASS   | DTOs in `packages/shared-types/src/dtos/project.dto.ts`, Zod schemas for client        |
| IV   | Security by Design        | PASS   | RBAC via existing guards + new `ProjectAccessGuard` for membership checks              |
| V    | Testing Discipline        | PASS   | >90% coverage achieved (T597, T605, T629, T632–T636, T641). Debt from Epic 1 resolved. |
| VI   | Independent Deployability | PASS   | company-admin-app is a separate Vite app with its own Dockerfile                       |
| VII  | Observability             | PASS   | Winston logging + correlation IDs inherited from global setup                          |
| VIII | Shared-Before-Custom      | PASS   | DTOs shared, API client centralised, auth patterns reused from super-admin-app         |
| IX   | Design Tokens             | PASS   | company-admin-app uses shared Tailwind preset from `packages/config/tailwind`          |
| X    | i18n                      | PASS   | All user-facing text via `react-i18next` with keys in `packages/i18n`                  |

**Gate result**: PASS. No violations. All 10 principles satisfied.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-procurement-platform/
├── plan.md                  # This file (Epic 2 plan)
├── research.md              # Phase 0 output (Epic 2 decisions appended)
├── data-model.md            # Updated — Project, ProjectLocation, ProjectMember reconciled
├── contracts/projects.md    # Updated — reconciled with data model
├── quickstart.md            # No changes (already covers full platform)
└── tasks.md                 # Phase 2 output (/speckit.tasks command — NOT created by plan)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   └── src/
│       ├── modules/
│       │   └── projects/                      # NEW — Epic 2
│       │       ├── projects.controller.ts     # 7 endpoints per contracts/projects.md
│       │       ├── projects.service.ts        # Project CRUD + member management
│       │       ├── projects.module.ts         # NestJS module registration
│       │       └── guards/
│       │           └── project-access.guard.ts # Project membership check
│       └── prisma/
│           └── schema/                        # Multi-file schema (prismaSchemaFolder preview feature)
│               ├── schema.prisma              # Generator + datasource config
│               ├── enums.prisma               # All enums (SCREAMING_SNAKE_CASE)
│               ├── user.prisma                # User model
│               ├── company.prisma             # Company model
│               ├── project.prisma             # Project, ProjectLocation, ProjectMember
│               ├── rfq.prisma                 # Rfq, RfqLineItem, QuoteResponse
│               ├── purchase-order.prisma      # PurchaseOrder
│               ├── bulk-order.prisma          # BulkOrder, BulkOrderLineItem, Drawdown
│               ├── invoice.prisma             # Invoice
│               └── audit.prisma               # AuditLog
│
├── company-admin-app/                         # NEW SCAFFOLD — Epic 2
│   ├── package.json                           # React 18, Vite 5, TailwindCSS 3, TanStack Query 5, Zustand 4
│   ├── vite.config.ts
│   ├── tailwind.config.ts                     # Extends @forethread/config/tailwind preset
│   ├── tsconfig.json                          # Extends packages/config/tsconfig.react.json
│   ├── Dockerfile                             # Multi-stage production build
│   ├── index.html
│   └── src/
│       ├── main.tsx                           # QueryClientProvider, BrowserRouter, i18n init
│       ├── app/
│       │   ├── App.tsx                        # Root component
│       │   └── routes.tsx                     # Public (auth) + protected (projects) routes
│       ├── features/
│       │   ├── auth/                          # Auth flow — same patterns as super-admin-app
│       │   │   ├── state/auth.store.ts        # Zustand: currentUser, accessToken
│       │   │   ├── services/auth.service.ts   # TanStack Query mutations
│       │   │   └── ui/                        # Login, OTP, activate, forgot/reset password
│       │   │       ├── LoginPage.tsx
│       │   │       ├── OtpVerificationPage.tsx
│       │   │       ├── ActivateAccountPage.tsx
│       │   │       ├── ForgotPasswordPage.tsx
│       │   │       └── ResetPasswordPage.tsx
│       │   ├── projects/                      # NEW — Epic 2 core feature
│       │   │   ├── state/projects.store.ts    # Zustand: UI state (modal, selected project)
│       │   │   ├── services/projects.service.ts # TanStack Query hooks
│       │   │   └── ui/
│       │   │       ├── ProjectListPage.tsx     # Paginated table, filters, search
│       │   │       ├── CreateProjectPage.tsx   # Multi-step form (details, locations, members)
│       │   │       ├── ProjectDetailPage.tsx   # Overview + tabs (members, documents placeholder)
│       │   │       └── EditProjectPage.tsx     # Edit form (same structure as create)
│       │   └── dashboard/
│       │       └── pages/
│       │           └── DashboardPage.tsx       # CompanyAdmin dashboard stub
│       └── shared/
│           ├── layout/
│           │   └── AppLayout.tsx               # Side nav: Dashboard, Projects, Users
│           └── components/
│               └── PrivateRoute.tsx            # Auth guard (reuse pattern from super-admin-app)

packages/
├── shared-types/
│   └── src/
│       ├── enums/index.ts                     # MODIFIED — add ProjectStatus, LocationType
│       ├── dtos/project.dto.ts                # NEW — CreateProjectDto, UpdateProjectDto, etc.
│       └── schemas/project.schema.ts          # NEW — Zod schemas for client validation
├── api-client/
│   └── src/
│       ├── endpoints/projects.ts              # NEW — typed API functions
│       └── index.ts                           # MODIFIED — re-export projects
└── i18n/
    └── src/
        └── locales/en/
            └── projects.json                  # NEW — project-related translations
```

**Structure Decision**: Follows established monorepo patterns from Epic 1. The
`apps/company-admin-app` scaffold mirrors `apps/super-admin-app` in tech stack and folder
conventions. Auth feature code is adapted (not shared as a package) since the navigation and
post-login behaviour differ between apps. Shared types, API client, design tokens, and i18n remain
centralised in `/packages/`.

---

## Complexity Tracking

No constitution violations requiring justification.

---

## Key Design Decisions (from research.md)

### 1. Project Status Lifecycle

**Decision**: `ProjectStatus` enum with values `Planned | Ongoing | Completed | Archived`.

| Status      | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| `Planned`   | Project created; procurement activity not yet started         |
| `Ongoing`   | Active project with procurement activity in progress          |
| `Completed` | Project work finished; documents finalised and read-only      |
| `Archived`  | Soft-deleted; hidden from default views; retained for history |

**Rationale**: The original data model's `Active | Archived` was too coarse for business use. Users
need to distinguish planned vs ongoing vs completed states. `Completed` is preferred over `Finished`
as a more standard term.

### 2. Location Model (Delivery + Storage)

**Decision**: Single `ProjectLocation` table with a `type` enum (`Delivery | Storage`). The
`is_default` constraint applies per type per project (one default delivery location, one default
storage location).

**Rationale**: Delivery and storage locations share identical structure (address + label + default
flag). A single table with a type discriminator is simpler than maintaining two separate tables. The
default uniqueness is enforced via a partial index:
`UNIQUE(project_id, type) WHERE is_default = true`.

### 3. Project-Scoped Access Control

**Decision**: A `ProjectAccessGuard` NestJS guard reads `:id` from route params, queries
`ProjectMember`, and grants access if the user is:

- A member of the project, OR
- A CompanyAdmin of the project's owning company, OR
- A SuperAdmin

**Rationale**: A reusable guard avoids duplicating access checks in every service method. Applied
via a `@UseGuards(ProjectAccessGuard)` or custom `@ProjectAccess()` decorator on all project-scoped
endpoints.

### 4. Company-Admin-App Scaffold

**Decision**: Scaffold `apps/company-admin-app` from scratch following the same patterns established
in `apps/super-admin-app`. Auth feature code is adapted (copy + modify), not extracted to a shared
package.

**Rationale**: The navigation structure, post-login routing, and available features differ
significantly between SuperAdmin and CompanyAdmin roles. Premature extraction of shared auth
components would over-engineer the solution. When a third app (procurement-officer-app) is
scaffolded, the pattern will be clear enough to extract a shared auth package if beneficial.

### 5. BOM Scope

**Decision**: Defer BOM implementation to Epic 7 (Material Catalogue Management). The project detail
page includes a "Bill of Materials" tab that shows an empty state with a message indicating BOM will
be available when the material catalogue is set up.

**Rationale**: BOM requires the Material entity which belongs to Epic 7. Including BOM CRUD in Epic
2 would create a dependency on unimplemented features.

### 6. Aggregated Counts on Project Detail

**Decision**: The `GET /v1/projects/:id` response includes `rfqCount`, `poCount`, `invoiceCount`,
and `vendorCount` fields. Until the relevant epics are implemented, these return `0`.

**Rationale**: Defining the response shape now avoids breaking API changes when later epics are
implemented. The counts are computed via SQL `COUNT` queries and are inexpensive.

---

## Scope Boundaries

### In Scope (Epic 2)

- Backend: Project, ProjectLocation, ProjectMember Prisma models + migration
- Backend: Projects NestJS module (CRUD + member management)
- Backend: ProjectAccessGuard for membership-based access control
- Shared types: ProjectStatus enum, LocationType enum, project DTOs, Zod schemas
- API client: Project endpoint functions
- Frontend: company-admin-app scaffold (auth + projects)
- Frontend: Project list, create, detail, edit pages
- Frontend: Project member management (add/remove users)
- i18n: English translations for all project UI text
- Seed data: Test projects for seeded contractor company

### Out of Scope (deferred)

- BOM management (Epic 7 — Material Catalogue)
- Project document upload/management (future enhancement)
- Procurement-officer-app scaffold (future epic)
- Financial-officer-app project views (future epic)
- Project archival workflow with cascading document rules
- Approval scenarios for project creation (FR-009, optional for Release 1)

---

## Verification Criteria

### Independent Test (from spec)

Create a project with a name, location, storage location, and two assigned users. Verify that only
assigned users can access project documents, and that unassigned users see no project data.

### Step-by-Step Verification

1. **Start services**:
   `docker compose -f docker-compose.dev.yml up -d && pnpm dev --filter=backend --filter=company-admin-app`
2. **Seed data**: Ensure seed includes CompanyAdmin with status Active for the contractor company
3. **Log in as CompanyAdmin** at `http://localhost:3002`
4. **Create a project**:
   - Name: "Test Project Alpha"
   - Delivery location: "123 Main St, Sydney" (marked as default)
   - Storage location: "Warehouse B, Parramatta" (marked as default)
   - Assign two users: the CompanyAdmin + one ProcurementOfficer
   - Status: Planned
5. **Verify project list**: The new project appears with correct name, status, and location
6. **Verify project detail**: Overview shows all fields, Members tab shows both assigned users
7. **Verify access control via API**:
   - `GET /v1/projects` as the assigned ProcurementOfficer returns the project
   - `GET /v1/projects` as an unassigned FinancialOfficer returns empty list
   - `GET /v1/projects/:id` as an unassigned user returns 403
8. **Verify duplicate name rejection**: Attempt to create another project with "Test Project Alpha"
   — 409 error
9. **Verify CompanyAdmin member management**: Add a third user, remove one user, verify changes
   persist
10. **Verify ProcurementOfficer cannot manage members**: Log in as PO, verify "Add/Remove Users"
    controls are hidden

### Acceptance Scenarios Coverage

| Scenario                                                     | Verification Step |
| ------------------------------------------------------------ | ----------------- |
| AS-1: PO creates project, auto-assigned, cannot manage users | Steps 4, 10       |
| AS-2: CA sees project detail with overview + section tabs    | Step 6            |
| AS-3: Unassigned user cannot access project                  | Steps 7c          |
| AS-4: Duplicate project name rejected                        | Step 8            |

---

## Generated Artifacts

| Artifact            | Path                                                   | Status                        |
| ------------------- | ------------------------------------------------------ | ----------------------------- |
| Implementation Plan | `specs/001-procurement-platform/plan.md`               | This file                     |
| Research (Epic 2)   | `specs/001-procurement-platform/research.md`           | Appended (section 6)          |
| Data Model          | `specs/001-procurement-platform/data-model.md`         | Updated (entities 4-6)        |
| API Contract        | `specs/001-procurement-platform/contracts/projects.md` | Updated (reconciled)          |
| Tasks               | `specs/001-procurement-platform/tasks.md`              | Active — continuously updated |

---

## Post-Epic 2: Infrastructure & Cross-Cutting Work

_Added during implementation. Documents additional work performed beyond the original Epic 2 scope
to satisfy constitution principles and align with Figma design system._

### Reusable UI Component Library (Parts A–C)

**Rationale**: During Epic 2 implementation, significant UI pattern duplication was identified
across `super-admin-app` and `company-admin-app` (buttons, inputs, modals, pagination, form fields).
To comply with Constitution Principle VIII (Shared-Before-Custom), 13 reusable components were
extracted to `packages/ui-components` and both apps refactored to consume them.

**Components**: Button, Input, Textarea, Select, FormField, Alert, Spinner/PageLoader, Badge, Modal,
ConfirmDialog, Pagination, EmptyState, AuthLayout.

### Design System Alignment (Parts D–H)

**Rationale**: UI components were initially built with placeholder styling. After Figma design
system analysis, components were updated to match Figma specs: border radii, icon props, typography
variants. Theme infrastructure (light/dark mode via CSS class toggle) was added. Figma colour
palette and typography tokens extracted to `packages/config/tailwind/colors.ts` and `typography.ts`.
SVG icon import support (vite-plugin-svgr) enabled for all apps. Font changed from Inter to Urbanist
per Figma.

### Invoice List UI Shell (Parts I–L)

**Rationale**: To validate the design system and demonstrate dashboard patterns ahead of US9
(Invoice Reconciliation), the Invoice List page was scaffolded with mock data in `company-admin-app`
and `financial-officer-app`. No backend, no Prisma models — frontend shell only. Deferred for
`procurement-officer-app` (not yet scaffolded).

### Auth UI Standardisation (Parts M–Z)

**Rationale**: Multiple auth-related improvements were bundled:

- **Role-based frontend URLs (Part M)**: Backend now routes email links (password reset, invitation)
  to the correct app per user role.
- **Reusable auth form components (Parts N–Q)**: `LoginForm`, `ForgotPasswordForm`,
  `CheckEmailCard`, `ResetPasswordForm`, `Text`, `IconBadge` extracted to `packages/ui-components`.
  All 4 apps refactored.
- **App scaffolds (Parts R–S)**: `vendor-app` (port 3003) and `financial-officer-app` (port 3004)
  scaffolded with full auth flows.
- **TwoFactorCard & OTP refactor (Parts T–W)**: Reusable 2FA component extracted. OTP pages in all 4
  apps refactored.
- **Route config centralisation (Part X)**: Hardcoded path strings replaced with `ROUTES` constant
  objects per app.
- **OTP account locking fix (Part Z)**: Fixed off-by-one bug in max OTP attempts; HTTP 423 status;
  e2e tests added.

### Email Template Styling (Part AA)

**Rationale**: Email notifications (invitation, OTP, password reset, deactivation) were sent with
basic inline HTML — no branding, blue buttons, generic sans-serif. Emails now match the Figma design
system: clean monochrome style with Inter font, #131313 buttons, footer with divider and policy
links. Local Handlebars templates replace inline HTML for maintainability (future migration path to
Brevo).

**Changes**:

- Installed `handlebars` dependency in `apps/backend`
- Created `apps/backend/src/modules/notifications/templates/` with layout, partials (button), and 4
  content templates (invitation, OTP, password-reset, deactivation)
- Created `apps/backend/src/modules/notifications/email-templates.const.ts` — template name
  constants
- Refactored `EmailService` to compile Handlebars templates on module init via `OnModuleInit`
- Added `name` parameter to `sendPasswordResetEmail()` signature; updated `auth.service.ts` caller
- Added `assets` config to `nest-cli.json` to copy `.html` templates to `dist/`

### Toast Notification System (Part AB)

**Rationale**: The platform lacked a unified notification system for in-app feedback
(success/error/info messages). A reusable toast component was added to `packages/ui-components`
using `sonner`, with a `notificationService` wrapper for imperative usage from service layers. All 4
apps now mount `<Toaster>` in their root layout. Auth flows updated to show toast on OTP send.

**Changes**:

- Created `packages/ui-components/src/components/CustomToast.tsx` with `notificationService`
  (success/error/info/warning)
- Re-exported `Toaster`, `toast`, `CustomToast`, `notificationService` from `packages/ui-components`
- Added `<Toaster position="bottom-right" duration={5000} />` to all 4 apps' `main.tsx`
- Updated `auth.service.ts` in all 4 apps to show info toast after OTP email sent

### Auth Form Validation UX (Part AC)

**Rationale**: Submit buttons on Login, Forgot Password, and Reset Password forms remained enabled
even when form validation failed, allowing premature submissions. Added `isValid` prop to
`LoginForm`, `ForgotPasswordForm`, and `ResetPasswordForm` in `packages/ui-components`. All 4 apps
updated to pass `isValid` from react-hook-form `formState` with `mode: 'onChange'` for real-time
validation.

**Changes**:

- Added optional `isValid` prop to `LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`
- Submit buttons now `disabled={!isValid}` (ResetPasswordForm also checks `passwordsMismatch`)
- All 4 apps' LoginPage, ForgotPasswordPage, ResetPasswordPage updated with `mode: 'onChange'`

### Activate Account Refactor + Invitation Expired Flow (Part AD — US 1.02)

**Rationale**: The `ActivateAccountPage` used an inline form with basic `Input` fields and no
password requirements checklist. Figma design shows it should match the Reset Password page — using
`ResetPasswordForm` component with `PasswordInput` (eye toggle), real-time password requirements
checklist, and symbol validation. Additionally, Figma shows an "Invitation link has been expired"
screen with the user's email and a "Request new link" button — this required two new backend
endpoints.

**Changes**:

- **Backend**: Added `POST /v1/auth/validate-activation-token` (validates invitation token, returns
  email + validity without expiry filter) and `POST /v1/auth/request-new-invitation` (self-service
  resend invitation, no email enumeration, 3/hr rate limit). New DTOs in
  `apps/backend/src/modules/auth/dto/`.
- **Shared types**: Added `ValidateActivationTokenDto`, `ValidateActivationTokenResponseDto`,
  `RequestNewInvitationDto` to `packages/shared-types/src/dtos/auth.dto.ts`. Added symbol regex to
  `activateAccountSchema` in `packages/shared-types/src/schemas/auth.schema.ts`.
- **API client**: Added `validateActivationToken()` and `requestNewInvitation()` functions to
  `packages/api-client/src/endpoints/auth.ts`.
- **i18n**: Added 8 translation keys to `packages/i18n/src/locales/en/auth.json` for expired screen,
  success screen, and request new link feedback.
- **Frontend (all 4 apps)**: Rewrote `ActivateAccountPage.tsx` to use `ResetPasswordForm` component
  with `PasswordInput`, real-time 6-rule requirements checklist (min 8 chars, lowercase, uppercase,
  number, symbol, non-breached), token validation on mount via `useValidateActivationToken` query,
  invitation expired screen with `ClockIcon` + "Request new link" button, and success screen with
  auto-redirect countdown. Added `useValidateActivationToken` and `useRequestNewInvitation` hooks to
  all 4 apps' `auth.service.ts`.
- **API contract**: Documented both new endpoints in
  `specs/001-procurement-platform/contracts/auth.md`.
- **T170 — Admin-only resend (FRD alignment)**: Changed `requestNewInvitation()` from self-service
  token regeneration to admin notification. When a user clicks "Request new link" on the expired
  invitation page, the system now emails the inviting admin (via `invitedByUserId`) instead of
  sending a new invitation directly. New `sendInvitationExpiredNotification()` method in
  `email.service.ts`, new `invitation-expired-notification` email template, updated i18n keys in
  `auth.json` and `emails.json`. Frontend unchanged — same button/hook, only backend behavior and
  i18n text differ.

### User Management — Company Admin Frontend (US-1.07 / FR-007)

**Rationale**: FR-007 requires Company Admins to invite users, assign roles, and manage (edit,
deactivate, reactivate) users within their company. Backend was 100% complete from Epic 1 (8 user
endpoints). This implements the full frontend: User Management page with tabs, sortable table, CRUD
modals, and activation/deactivation workflow. Matches Figma screens US 1.07 and US 1.08.

**Changes**:

- **Shared UI components**: Created 4 new reusable components in `packages/ui-components`:
  `DotActionsMenu` (three-dot menu with desktop dropdown + mobile bottom sheet), `CustomDropdown`
  (styled dropdown for react-hook-form), `StatusActionModal` (confirm activate/deactivate with
  variant prop), `StatusSuccessModal` (success result with auto-redirect countdown). Added
  `ModalCloseButton` using `cross.svg` to `Modal.tsx`.
- **SVG icons**: Created 5 new icons in `packages/ui-components/src/assets/icons/`: `user-outline`,
  `briefcase`, `id-badge`, `phone`, `department`.
- **API client**: Added `sortBy`/`sortDir` params to `UserListParams` in
  `packages/api-client/src/endpoints/users.ts`.
- **Users feature**: Created full feature in `apps/company-admin-app/src/features/users/`:
  - `services/users.service.ts` — TanStack Query hooks (useUsers, useUser, useCreateUser,
    useUpdateUser, useDeactivateUser, useReactivateUser, useResendInvitation, useCancelInvitation)
  - `state/users.store.ts` — Zustand store for all modal states (create, edit, success, status
    action, status success)
  - `ui/UserListPage.tsx` — Tabs, sortable table, three-dot menu, pagination
  - `ui/CreateUserModal.tsx` — Invite user form with Zod validation
  - `ui/EditUserModal.tsx` — Edit user form with role dropdown, phone, position, department
  - `ui/InvitationSuccessModal.tsx` — Success with auto-redirect countdown
- **Routing**: Added `/users` route to `route-config.ts` and `routes.tsx`, Users sidebar link in
  `AppLayout.tsx`.
- **i18n**: Updated `users.json` with 50+ keys (tabs, columns, modals, actions, statuses).
- **Bugfix (T213)**: Added missing success toast notifications for Resend Invitation and Cancel
  Invitation actions in both super-admin and company-admin UserListPage/UserDetailPage. Fixed
  `DotActionsMenu` focus jumping to next row after action click — added `triggerRef` to return focus
  to trigger button. Added `cancelInvitationSuccess` i18n key.

### Error Boundary & Error UI (Part AN)

**Rationale**: The platform had no error boundaries — any unhandled runtime error (e.g. missing
module export, failed lazy import) showed React Router's default white error screen with a raw stack
trace, providing no recovery path for users. A reusable `ErrorFallback` component was added to
`packages/ui-components` and app-level `ErrorPage` wrappers were created in all 4 apps, wired into
React Router's `errorElement` on the root route.

**Changes**:

- Created `packages/ui-components/src/components/ErrorFallback.tsx` — reusable error UI with title,
  message, retry/back buttons, and optional icon slot
- Exported `ErrorFallback` and `ErrorFallbackProps` from `packages/ui-components/src/index.ts`
- Created `apps/*/src/shared/components/ErrorPage.tsx` in all 4 apps — wraps `ErrorFallback` with
  `useRouteError` logging, i18n translations, retry (reload) and back (navigate -1) actions
- Updated `routes.tsx` in all 4 apps — wrapped all routes in a root route object with
  `errorElement: <ErrorPage />`
- Added i18n keys (`errorTitle`, `errorMessage`, `errorRetry`, `errorBack`) to
  `packages/i18n/src/locales/en/common.json`
- Fixed `UserRole` import in `company-admin-app` — changed from `@forethread/shared-types` (CJS
  dist) to `@forethread/shared-types/client` (source TS, Vite-compatible)

### Ad-hoc: UserDetailPage Redesign & Auth Page Renaming

**Purpose**: Redesign the company-admin-app `UserDetailPage` to match the Figma design — replacing
the inline-actions layout with a profile card, DotActionsMenu, icon-based info grid, assigned
projects section, and collapsible placeholder sections. Also rename `ActivateAccountPage` and
`ResetPasswordPage` across all 4 apps to follow the app-specific naming convention
(`CompanyAdminActivateAccountPage`, `SuperAdminVerifyOtpPage`, etc.).

**Changes**:

- Rewrote `apps/company-admin-app/src/features/users/ui/UserDetailPage.tsx` — profile card with
  56x56 avatar, name/email, DotActionsMenu (Edit User, Activate/Deactivate for Active/Inactive,
  Resend/Cancel Invitation for Invited status), 3x2 icon info grid (phone, status, role, date
  joined, position, department), assigned projects section, 3 collapsible placeholder sections (Role
  & Permissions, Approval responsibilities, Activity log), modals via `useUsersStore`
- Updated `apps/company-admin-app/src/shared/layout/AppLayout.tsx` — added `/users/:id` to
  `usePageInfo()` with "User Profile" title and back navigation to `/users`
- Added i18n keys to `packages/i18n/src/locales/en/nav.json` (`userProfile`, `userProfileSubtitle`)
- Added `detail.*` i18n keys to `packages/i18n/src/locales/en/users.json` (phone, status,
  dateJoined, position, department, editUser, activate, assignedProject, noProjectAssigned,
  rolePermissions, approvalResponsibilities, activityLog, comingSoon)
- Renamed `ActivateAccountPage.tsx` → `{AppPrefix}ActivateAccountPage.tsx` in all 4 apps with
  updated function names and lazy imports in `routes.tsx`
- Renamed `ResetPasswordPage.tsx` → `{AppPrefix}ResetPasswordPage.tsx` in all 4 apps with updated
  function names and lazy imports in `routes.tsx`
- Fixed UserListPage table overflow — changed `overflow-hidden` to `overflow-x-auto` so all rows are
  visible

### User Management UI Polish & AC Compliance (US-1.07)

**Rationale**: After initial implementation of the User Management feature (Parts AH–AM), the UI was
refined iteratively to match Figma designs precisely and pass all US-1.07 acceptance criteria from
the FRD. Changes span table styling, layout, modal design, button sizing, role restrictions, and
field validation.

**Changes**:

- **Table styling**: Added `table-fixed` for even column distribution, wrapped table in bordered
  container (`border border-border rounded-lg`), header font updated to match Figma
  (`text-xs font-bold leading-4 tracking-[0.6px]`), Actions column narrowed (`w-[100px]`) and
  right-aligned.
- **Layout**: Changed `AppLayout` from `h-screen` (viewport-locked) to `min-h-screen` (natural page
  scroll) with sticky sidebar and sticky header (`sticky top-0 z-10`).
- **CreateUserModal**: Removed asterisks from form fields (`required` prop removed from FormField),
  changed title from `text-lg font-semibold` to `text-2xl font-normal leading-[140%]`, increased
  modal width from `max-w-md` to `max-w-lg`, Alert uses InfoIcon (not CrossInCircleIcon).
- **Button component**: Updated `lg` size to `text-lg leading-6` (was `text-sm`) matching Figma
  specs (18px, medium 500, 24px line-height).
- **Invited user actions**: Users with "Invited" status only show "Reset Invitation" in the
  three-dot menu (not Edit/Deactivate/Reset Password).
- **Reset Password**: Wired `StatusActionModal` for reset password action, using `forgotPassword`
  API endpoint via new `useResetUserPassword` hook.
- **Table overflow fix**: Removed `overflow-hidden` from table wrapper to prevent DotActionsMenu
  dropdown clipping on last row.
- **AC #4 fix (revised)**: `CompanyAdmin` is included in `COMPANY_ROLE_OPTIONS` — Company Admin CAN
  assign CompanyAdmin role to users within their own company. Backend restriction removed (was
  `ForbiddenException` for `dto.role === UserRole.CompanyAdmin`). Only SuperAdmin role remains
  blocked for CompanyAdmin creators.
- **AC #5 fix**: Made `position` a mandatory field in `createUserFormSchema` (was optional). Updated
  `CreateUserDto` in `shared-types` to mark position as required with `@IsNotEmpty()`.
- **Constants extraction**: Moved `STATUS_BADGE_COLORS` and `STATUS_TEXT_COLORS` to
  `constants/roles.ts` for reuse across UserListPage and UserDetailPage.

### Super-Admin User Management Page Redesign (US-1)

**Backend**:

- Added multi-value filter support to `GET /users` — comma-separated `companyId`, `status` (string
  split), and `role` (Transform + `@IsEnum(UserRole, { each: true })`).
- Added `POST /users/:id/initiate-reset-password` endpoint (SuperAdmin only) — generates 15-minute
  password reset token, sends reset email via existing `sendPasswordResetEmail`.
- Updated API contract (`contracts/users.md`) with new endpoint and multi-value query params.

**API Client**:

- Added `initiateResetPassword` path and function to `packages/api-client`.

**Shared UI Components** (new in `packages/ui-components`):

- `Checkbox` — custom styled (w-5, rounded-md, Figma-matched), with focus ring and disabled state.
- `FilterPopover` — trigger button with active count badge, checkbox dropdown (desktop) / bottom
  sheet (mobile), click-outside and Escape to close.
- `SortIcon` — extracted from company-admin inline definition; company-admin updated to import from
  shared.

**Super-Admin App**:

- Expanded `users.store.ts` with full modal state: create, invitation success, edit, status action,
  status success, reset password, reset password success, plus company expand/collapse.
- Added `useUpdateUser`, `useInitiateResetPassword` service hooks.
- Created `constants/roles.ts` with `ALL_ROLE_OPTIONS`, `ROLE_BADGE_COLORS`, `STATUS_BADGE_COLORS`,
  `STATUS_TEXT_COLORS`.
- Created hooks: `useGroupedUsers` (groups users by company), `useEditUserForm`, `useRoleOptions`.
- Created `EditUserModal` (same pattern as company-admin, adds read-only company field).
- Created `InvitationSuccessModal` (3s auto-close countdown).
- **Full `UserListPage` rewrite**: tabs (Platform users + Action Log placeholder), search with 300ms
  debounce, 3 `FilterPopover` instances (Company/Status/Role), grouped-by-company table with
  expand/collapse chevrons, sortable columns with `SortIcon`, company-level `DotActionsMenu` (Edit
  company / Deactivate all — TODO), user-level `DotActionsMenu` (Edit / Reset Password / Activate /
  Deactivate / Reset Invitation), all modals driven by Zustand store, pagination.
- Updated `CreateUserModal` to trigger success modal on create instead of just closing.
- Added i18n keys: tabs, filters, grouped table, reset password success, action labels.

### Super-Admin Invite Users — Multi-Step Page (US-1.01 / US-1.05)

**Rationale**: The FRD US 1.01 specifies a multi-step user creation flow: choose company type →
select/create company → fill user details → success. The existing `CreateUserModal` was a simple
single-step modal. This replaces it with a dedicated `/users/create` page matching the Figma design.

**Changes**:

- **Shared UI (CustomDropdown)**: Extended
  `packages/ui-components/src/components/CustomDropdown.tsx` with `actionItem` prop (renders a
  clickable action below options with separator), `searchable` prop (adds text input at top for
  filtering options), and `searchPlaceholder` prop. Exported new `DropdownActionItem` type from
  `packages/ui-components/src/index.ts`.
- **Backend DTO flexibility**: Made `abn` and `legalAddress` optional in
  `packages/shared-types/src/dtos/company.dto.ts` (`@IsOptional()` + `@ApiPropertyOptional()`) —
  they are already `String?` in Prisma schema. Made `contactEmail` optional in
  `packages/api-client/src/endpoints/companies.ts` `CreateCompanyDto` interface.
- **Routing**: Added `createUser: '/users/create'` to
  `apps/super-admin-app/src/app/route-config.ts`. Registered lazy-loaded `CreateUserPage` in
  `apps/super-admin-app/src/app/routes.tsx` (before `userDetail` to avoid path conflicts).
- **CreateUserPage orchestrator** (`apps/super-admin-app/src/features/users/ui/CreateUserPage.tsx`):
  Multi-step page using `useState<'companySelection' | 'userDetails' | 'success'>`. Manages shared
  state (companyType, companyId, companyName, createdUserEmail) and conditionally shows add-company
  modals. Centered card layout with `max-w-md`.
- **Step 1 — CompanySelectionStep**
  (`apps/super-admin-app/src/features/users/ui/steps/CompanySelectionStep.tsx`): Radio group
  (Contractor/Vendor), company `CustomDropdown` filtered by `useCompanies({ type, limit: 100 })`
  with `searchable`, `actionItem` for "Add contractor/vendor company". DepartmentIcon on dropdown.
- **Step 2 — UserDetailsStep**
  (`apps/super-admin-app/src/features/users/ui/steps/UserDetailsStep.tsx`): React Hook Form + Zod
  validation. Fields: representative name (UserOutlineIcon), email (EnvelopeIcon), role dropdown for
  contractors only (IdBadgeIcon, options from `CONTRACTOR_ROLE_OPTIONS`), position (BriefcaseIcon).
  Vendor auto-sets role to `'Vendor'`. Company info box shown. Uses `useCreateUser()` mutation.
- **Step 3 — InvitationSuccessStep**
  (`apps/super-admin-app/src/features/users/ui/steps/InvitationSuccessStep.tsx`): CheckCircle
  IconBadge, success title/subtitle, green email info box, expiry note, "Back to User Management"
  button, 3-second countdown auto-redirect to `/users`.
- **AddContractorCompanyModal**
  (`apps/super-admin-app/src/features/users/ui/modals/AddContractorCompanyModal.tsx`): Modal with
  DepartmentIcon IconBadge. Single field: Company name. Uses
  `useCreateCompany({ type: 'Contractor', legalName })`. Returns created company to parent.
- **AddVendorCompanyModal**
  (`apps/super-admin-app/src/features/users/ui/modals/AddVendorCompanyModal.tsx`): Modal with
  BriefcaseIcon IconBadge. Fields: Company name, Company email, Specialisation dropdown (Civil,
  Infrastructure, Materials, Equipment). Uses
  `useCreateCompany({ type: 'Vendor', legalName, contactEmail, specialisations })`.
- **UserListPage update**: Changed "Invite user" button from opening `CreateUserModal` to
  `navigate(ROUTES.createUser)`. Removed old modal rendering and related store state.
- **Role constants**: Added `CONTRACTOR_ROLE_OPTIONS` array
  (`[CompanyAdmin, ProcurementOfficer, FinancialOfficer, WarehouseOfficer, Foreman]`) to
  `apps/super-admin-app/src/features/users/constants/roles.ts`. `CompanyAdmin` is included in
  `COMPANY_ROLE_OPTIONS` in `apps/company-admin-app/src/features/users/constants/roles.ts` — Company
  Admin can assign CompanyAdmin role (backend restriction removed).
- **Store cleanup**: Removed `isCreateModalOpen`, `openCreateModal`, `closeCreateModal`,
  `isSuccessModalOpen`, `createdUserEmail`, `openSuccessModal`, `closeSuccessModal` from
  `apps/super-admin-app/src/features/users/state/users.store.ts`.
- **Deleted files**: `CreateUserModal.tsx`, `InvitationSuccessModal.tsx` (replaced by page/steps).
- **i18n**: Added `createUserPage.*` (16 keys), `addCompanyModal.*` (13 keys),
  `createModal.representativeName`, `createModal.representativeEmail` to
  `packages/i18n/src/locales/en/users.json`.

**FRD US 1.01 — Remaining Gaps** (not implemented in this iteration):

- **AC 5.1/5.2**: Company names should be in alphabetical order with first-letter quick navigation.
  Currently uses default backend ordering.
- **AC 7.1**: When creating a new contractor company, the first user's role should auto-default to
  Company Admin. Currently the role dropdown is shown without a default.
- **AC 7.3**: For a new vendor company, the admin must assign it to at least one contractor company.
  The vendor-to-contractor assignment UI is not yet implemented.

**FRD US 1.05 — Remaining Gaps**:

- **AC 6**: "All actions are logged and visible as a history of activities" — the Action Log tab is
  a placeholder only. Requires backend audit trail implementation.

### Shared Layout Components (US-1)

**Rationale**: During US-1 sidebar/navigation work and US-1.07 password-reset enhancements, three
reusable layout components were extracted to `packages/ui-components` from app-specific code.

**Changes**:

- Created `packages/ui-components/src/components/Sidebar.tsx` — collapsible desktop sidebar
  (expanded 240px / collapsed 64px) with hover tooltips (portal-based, dark `#2D3139` bg with left
  arrow, bold text), localStorage persistence (`sidebar-collapsed` key), active state
  (`bg-[#E8EAED]`), `hasSubmenu` arrow-right chevron, `companyName` header slot. Mobile bottom tab
  bar unchanged. All 6 apps' `AppLayout` refactored to use shared `Sidebar`.
- Created `packages/ui-components/src/components/PageHeader.tsx` — title, subtitle, optional
  `onBack` callback rendering a back-arrow button. Used by all apps' top header bar.
- Created `packages/ui-components/src/components/ResetPasswordSuccessModal.tsx` — modal with Alert
  success box, countdown redirect, and confirm button. Used by super-admin and company-admin user
  management pages for admin-initiated password reset success feedback.
- All three exported from `packages/ui-components/src/index.ts` barrel.
- New sidebar icons added: `arrow-right.svg`, `open-sidebar.svg`, `request.svg`,
  `purchase-orders.svg`, `projects.svg`, `bulk-orders.svg`, `invoice.svg`, `vendors.svg`,
  `material-catalogue.svg`.

### TablePagination Component & Pagination Standardisation

**Rationale**: The Figma design shows a consistent pagination bar across all table pages:
rows-per-page dropdown, "Showing X to Y of Z items" text, numbered page buttons with ellipsis, and
Back/Next navigation. The existing `Pagination` component was a simple prev/next pair. A new
`TablePagination` component was created in `packages/ui-components` and adopted across all table
pages.

**Changes**:

- Created `packages/ui-components/src/components/TablePagination.tsx` — reusable pagination bar with
  three sections: left (rows-per-page `<select>`), centre ("Showing X to Y of Z" label), right
  (numbered page buttons with smart ellipsis via `buildPageNumbers()`, Back/Next). Fully i18n-ready
  via callback props (`rowsPerPageLabel`, `showingLabel`, `backLabel`, `nextLabel`).
- Exported `TablePagination` and `TablePaginationProps` from `packages/ui-components/src/index.ts`.
- Updated `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx` — replaced inline
  pagination with `<TablePagination>`.
- Updated `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx` — same change.
- Updated `apps/company-admin-app/src/features/users/ui/UserListPage.tsx` — replaced `Pagination`
  with `TablePagination`, added `pageSize` state (default 25), changed `limit` from hardcoded to
  `pageSize`.
- Updated `apps/super-admin-app/src/features/users/ui/UserListPage.tsx` — same change, `limit`
  changed from 100 to 25 (per FRD documentation requirement).
- Added i18n keys to `packages/i18n/src/locales/en/common.json`: `back`, `rowsPerPage`,
  `showingItems`.

### Settings Hub Navigation

**Rationale**: Settings acts as a hub page for accessing sub-features (User Management) via
card-based links. Features with dedicated sidebar items (Invoices, Projects, etc.) are no longer
duplicated in Settings.

**Changes**:

- **Sidebar — company-admin-app**: 8 items — RFQs (`/rfqs`), Purchase Orders (`/purchase-orders`),
  Projects (`/projects`), Bulk Orders (`/bulk-orders`), Invoices (`/invoices`), Vendors
  (`/vendors`), Material Catalogue (`/material-catalogue`), Company Settings (`/settings`,
  `hasSubmenu: true`). All hrefs use `ROUTES` constants from `route-config.ts`.
- **Sidebar — super-admin-app**: 3 items — Dashboard, Companies, Settings (unchanged).
- **Sidebar — financial-officer-app**: 3 items — Dashboard, Invoices (`/invoices`), Settings.
  Invoices moved from `/settings/invoices` to top-level `/invoices`.
- **Settings pages** rewritten as card-based navigation hubs:
  - `company-admin-app`: Link to User Management (`/settings/users`) only (Invoices removed — now
    top-level sidebar item).
  - `super-admin-app`: Link to User Management (`/settings/users`).
  - `financial-officer-app`: Empty hub (Invoices removed — now top-level sidebar item).
- **Placeholder pages** created for future features: `RfqListPage`, `PurchaseOrderListPage`,
  `BulkOrderListPage`, `VendorListPage`, `MaterialCataloguePage` (all show "Coming soon").
- **User avatar dropdown** fix across all 6 apps: `mt-1` → `pt-1` wrapper to prevent hover gap.
- **Back buttons**: `usePageInfo()` in each app's `AppLayout` returns `onBack` callbacks for
  sub-pages: `/settings/users` → `/settings`, `/settings/users/:id` → `/settings/users`.
- **i18n**: Added nav keys: `rfqs`, `purchaseOrders`, `bulkOrders`, `vendors`, `materialCatalogue`,
  `companySettings` to `packages/i18n/src/locales/en/nav.json`.

### Global API Error Handling via Toast (Part BE)

**Rationale**: Backend errors from API calls were not consistently shown to users. Some mutations
(e.g. `useInitiateResetPassword` in the super-admin user list) had no `onError` callback, causing
errors to be silently swallowed. A global error handler was added at the Axios interceptor level
(matching the pattern used in `project-public-archive`), so every failed API call automatically
shows a toast notification with the backend error message. Calls that already display errors inline
(auth forms, create/edit modals) opt out via `skipErrorHandler: true` in the Axios config.

**Changes**:

- **API Client** (`packages/api-client/src/interceptors/error.interceptor.ts`):
  - Added Axios `AxiosRequestConfig` module augmentation with `skipErrorHandler?: boolean`.
  - `applyErrorInterceptor` now accepts an optional `onError: (message: string) => void` callback.
  - Before rejecting with `ApiRequestError`, checks `error.config?.skipErrorHandler` — if `false` or
    absent and `onError` is provided, calls `onError(message)` for HTTP errors, network errors, and
    config errors.
- **API Client endpoints** (`packages/api-client/src/endpoints/auth.ts`, `users.ts`, `projects.ts`):
  - Added optional `config?: AxiosRequestConfig` parameter to functions that need
    `skipErrorHandler`: `login`, `verifyOtp`, `resetPassword`, `activateAccount`,
    `validateActivationToken`, `createUser`, `updateUser`, `deactivateUser`, `reactivateUser`,
    `resendInvitation`, `cancelInvitation`, `getProjects`, `createProject`, `updateProject`.
- **All 4 apps' `main.tsx`**: Updated `applyErrorInterceptor` call to pass
  `(msg) => notificationService.error(msg)` as the `onError` callback.
- **Auth services** (all 4 apps' `auth.service.ts`): Added `{ skipErrorHandler: true }` to
  `useLogin`, `useVerifyOtp`, `useResetPassword`, `useActivateAccount`, `useValidateActivationToken`
  — auth errors stay in inline Alert components.
- **User services** (super-admin + company-admin `users.service.ts`): Added
  `{ skipErrorHandler: true }` to `useCreateUser`, `useUpdateUser`, `useDeactivateUser`,
  `useReactivateUser`, `useResendInvitation`, `useCancelInvitation` — errors displayed in inline
  Alerts in modals and detail pages. `useInitiateResetPassword` (super-admin) /
  `useResetUserPassword` (company-admin) intentionally left WITHOUT `skipErrorHandler` — errors now
  correctly show via toast.
- **Project services** (company-admin `projects.service.ts`): Added `{ skipErrorHandler: true }` to
  `useProjects`, `useCreateProject`, `useUpdateProject` — errors handled inline.

### Invited User Actions — Resend & Cancel Invitation (US-1.08 AC 10 / US-1.01 AC 10)

**Rationale**: The FRD requires that for users with "Invited" status, admins can **resend** or
**cancel** the invitation (US 1.08 AC 10, US 1.01 AC 10). The existing implementation showed a
single "Reset Invitation" action that only called the resend API. This was replaced with two
separate actions matching the FRD.

**Changes**:

- **i18n**: Replaced `actions.resetInvitation` with `actions.resendInvitation` and
  `actions.cancelInvitation`. Added `cancelInvitationModal.*` keys (title, subtitle, info, confirm)
  for the destructive confirmation modal. Added `resendInvitationSuccess` key for feedback. Removed
  unused `detail.resetInvitation` key (already had `detail.resendInvitation` and
  `detail.cancelInvitation`).
- **Stores**: Added `cancelInvitation` modal state (userId, email, name, open/close actions) to both
  `company-admin-app` and `super-admin-app` users stores.
- **Company-admin UserListPage**: Replaced single "Reset Invitation" action with "Resend Invitation"
  (direct mutation) + "Cancel Invitation" (opens confirmation modal with `StatusActionModal`
  variant="danger"). Imported `useCancelInvitation` hook.
- **Company-admin UserDetailPage**: Same change — "Resend Invitation" + "Cancel Invitation" actions
  for invited users. Cancel navigates back to `/users` on success.
- **Super-admin UserListPage**: Same change — "Resend Invitation" + "Cancel Invitation" for invited
  users in the three-dot menu.

### CompanyAdmin Role Assignment — Backend Fix

**Change**: Removed the backend restriction that prevented CompanyAdmin from creating users with the
CompanyAdmin role. Previously, `users.service.ts:createUser` threw `ForbiddenException` for both
`SuperAdmin` and `CompanyAdmin` role assignments. Now only `SuperAdmin` role remains blocked.

**Affected files**:

- `apps/backend/src/modules/users/users.service.ts` — removed `dto.role === UserRole.CompanyAdmin`
  from the forbidden roles check in `createUser()`
- `apps/company-admin-app/src/features/users/constants/roles.ts` — `CompanyAdmin` already included
  in `COMPANY_ROLE_OPTIONS` (no frontend change needed)
- `specs/001-procurement-platform/spec.md` — updated edge case (CompanyAdmin CAN assign
  CompanyAdmin)
- `specs/001-procurement-platform/contracts/users.md` — updated business rule

**Rationale**: Per FRD, Company Admins should be able to invite other Company Admins within their
own company. The original restriction was overly conservative. Only SuperAdmin role remains blocked
for CompanyAdmin creators.

### Project-User Assignment (already implemented)

Company Admin can assign users to specific projects or remove users from projects by selecting a
project and adding or removing users. This capability is already fully implemented:

- **Backend**: `POST /v1/projects/:id/members` (add), `DELETE /v1/projects/:id/members/:userId`
  (remove) — CompanyAdmin only, protected by `ProjectAccessGuard`
- **Frontend**: `ProjectDetailPage.tsx` Members section — "Add Members" button + "Remove" action per
  row, with modal for user multi-select and confirmation dialog for removal
- **Access control**: ProcurementOfficer cannot manage project members (they are auto-assigned to
  projects they create)

### Known Debt

- **Testing (Constitution Principle V)**: No unit/integration/component tests for Epic 2. Carried
  from Epic 1 per team decision. Must be addressed before production release.
- **SVG icon duplication (Constitution Principle VIII)**: RESOLVED — 8 duplicated SVG icon files
  removed from all 4 apps; imports now point to `@forethread/ui-components/assets/icons/`.
- **Inline SVG elimination (T325)**: RESOLVED — All remaining inline `<svg>` code in 12 source files
  replaced with SVG asset imports from `packages/ui-components/src/assets/icons/`. Created 6 new
  icon files (chevron-down, chevron-right, checkmark, check-stroke, filter, users-group). Eliminated
  duplicate icon definitions between company-admin-app and financial-officer-app InvoiceListPage.
- **EditUserModal reuse**: Both `company-admin-app` and `super-admin-app` have their own
  EditUserModal with similar patterns. Could be extracted to shared package if needed.
- **Company-level actions**: "Edit company details" modal is implemented (T162–T167) — updates
  company `legalName` via `PATCH /companies/:id`. "Deactivate all users" remains a placeholder TODO.

---

### App Scaffold: procurement-officer-app & warehouse-officer-app

**Rationale**: Both apps were empty directories with no scaffolding. The apps follow the same
pattern established by `vendor-app` and `financial-officer-app`: Vite + React 18 + TailwindCSS +
shared packages (`@forethread/api-client`, `@forethread/i18n`, `@forethread/shared-types`,
`@forethread/ui-components`). Full auth flows (login, OTP, activate, forgot/reset password) copied
from `vendor-app` with role-specific naming prefixes.

**Port assignments**: `procurement-officer-app` → 3005, `warehouse-officer-app` → 3006.

**Backend**: `ROLE_APP_URL_MAP` updated — `ProcurementOfficer` → `PROCUREMENT_OFFICER_APP_URL`,
`WarehouseOfficer` → `WAREHOUSE_OFFICER_APP_URL`. New env vars added to `.env` and `.env.example`.

**Foreman app**: Skipped — per spec §Assumptions, "the Foreman app is a native mobile application
(separate app, not part of this specification scope)". The `apps/foreman-app/` directory remains
empty. `Foreman` role still falls back to `COMPANY_ADMIN_APP_URL` in `ROLE_APP_URL_MAP`.

### Super-Admin Invite Users — Revert from Page to Modal

**Rationale**: The multi-step `CreateUserPage` (navigated via `/settings/users/create`) was reverted
to a `CreateUserModal` opened from the UserListPage. This matches the company-admin pattern — the
invite flow opens as a modal overlay rather than a separate page. The 3-step content
(CompanySelectionStep → UserDetailsStep → InvitationSuccessStep) and add-company sub-modals remain
unchanged; only the container changed from a routed page to a modal.

**Changes**:

- **New file**: `apps/super-admin-app/src/features/users/ui/CreateUserModal.tsx` — wraps step
  components inside `<Modal maxWidth="max-w-md">` with `<div className="p-8">` content area. Manages
  the same local state (step, companyType, companyId, companyName, createdUserEmail,
  showAddCompanyModal). Renders add-company modals outside the main modal.
- **Updated**: `apps/super-admin-app/src/features/users/ui/steps/InvitationSuccessStep.tsx` —
  accepts `onClose` callback prop instead of using `useNavigate`. Countdown auto-close calls
  `onClose()` instead of navigating to `/settings/users`.
- **Updated**: `apps/super-admin-app/src/features/users/state/users.store.ts` — re-added
  `isCreateModalOpen` / `openCreateModal()` / `closeCreateModal()` state.
- **Updated**: `apps/super-admin-app/src/features/users/ui/UserListPage.tsx` — "Invite user" button
  calls `openCreateModal()` instead of `navigate(ROUTES.createUser)`. Renders `<CreateUserModal>`
  when `isCreateModalOpen` is true. Removed `useNavigate` and `ROUTES` imports.
- **Updated**: `apps/super-admin-app/src/app/route-config.ts` — removed `createUser` route.
- **Updated**: `apps/super-admin-app/src/app/routes.tsx` — removed `CreateUserPage` lazy import and
  route registration.
- **Deleted**: `apps/super-admin-app/src/features/users/ui/CreateUserPage.tsx` — replaced by
  `CreateUserModal.tsx`.

### Create User Modal — Bug Fixes (US-1.01)

- **T172 — contactEmail optional for Contractor**: `contactEmail` was required in both Prisma schema
  (`String`) and service DTO (`@IsEmail()` without `@IsOptional()`), causing `400 Bad Request` when
  creating Contractor companies (frontend only sends `type` + `legalName`). Per API contract,
  `contactEmail` is required for Vendor only. Fix: Prisma `String?`, DTO `@IsOptional() @IsEmail()`,
  runtime check in `createCompany()` throws `BadRequestException` for Vendor without email.
- **T173 — RadioButton style**: Selected state was `bg-foreground border-foreground` (solid black
  circle) with `bg-background` inner dot (white). Figma shows `bg-background border-foreground`
  (white circle, black border) with `bg-foreground` inner dot (black). Fixed in `RadioButton.tsx`.
- **T174 — CustomDropdown actionItem color**: Action button used `text-primary` (blue). Changed to
  `text-foreground` (#131313) to match Figma.
- **T175 — i18n "+" prefix removal**: `addContractorCompany`/`addVendorCompany` had "+" in text, but
  `PlusInCircleIcon` is already rendered as `actionItem.icon`. Removed redundant "+" from i18n.
- **T176 — Unified focus ring style**: Replaced `focus:border-foreground/50` with
  `focus:ring-2 focus:ring-ring focus:border-transparent` in `Input.tsx`, `CustomDropdown.tsx`
  (button + search input + open state), and `TwoFactorCard.tsx` OTP inputs. Consistent focus
  indicator across all form controls.

### Backdrop Blur on All Modals

**Rationale**: Per design requirement, all modal overlays should have a blur effect behind them for
better visual separation from the page content.

**Changes**:

- `packages/ui-components/src/components/Modal.tsx` — added `backdrop-blur-sm` to the overlay div
  (`fixed inset-0 bg-black/50 backdrop-blur-sm`). Affects all modals that use the base Modal
  component (StatusActionModal, ResetPasswordSuccessModal, StatusSuccessModal, ConfirmDialog,
  CreateUserModal, EditUserModal, AddContractor/VendorCompanyModal, etc.).
- `packages/ui-components/src/components/FilterPopover.tsx` — added `backdrop-blur-sm` to the mobile
  bottom sheet overlay (`fixed inset-0 bg-black/40 backdrop-blur-sm`).
- `packages/ui-components/src/components/DotActionsMenu.tsx` — added `backdrop-blur-sm` to the
  mobile bottom sheet overlay (`fixed inset-0 bg-black/40 backdrop-blur-sm`).

### Invoice Sort & Search Fixes (T204)

Replaced inline triangle SortIcon SVGs with shared `SortIcon` component from
`@forethread/ui-components`. Added clickable sort logic (sortField/sortDir state + handleSort
callback) to both company-admin and financial-officer invoice pages. Removed `bg-muted` from
SearchInput. Extracted Invoice interface, MOCK_INVOICES, PAGE_SIZE_OPTIONS to separate constants
files.

### User Table — DotActionsMenu Overflow Fix

**Rationale**: The three-dot menu dropdown for the last rows in the super-admin user table was
clipped and invisible because the table wrapper had `overflow-hidden`. Additionally, the last table
row's `border-bottom` doubled with the wrapper's border.

**Changes**:

- `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`:
  - Changed table wrapper from `overflow-hidden` to `overflow-visible` so absolutely-positioned
    dropdown menus can overflow.
  - Added `border-t-0` to `TablePagination` className to remove the top border that doubled with the
    table wrapper's bottom border.
  - Added `last:border-b-0` to both `CompanySection` header row and `UserRow` row to prevent the
    last row's bottom border from doubling with the table wrapper's border.

---

### Super-Admin User Table Redesign + Vendor Assignment (US-1.05)

**Rationale**: The super-admin UserListPage needed alignment with the Figma design: Date Joined
column, eye/edit/three-dot action icons per row, plain-text status (not badges), company row
eye/edit icons. Vendor-to-contractor assignment support added to backend and create-user flow.
Action Log tab added as stub (backend data exists via AuditModule).

**Changes**:

- **UserListPage.tsx** (super-admin): Added "Date Joined" sortable column, eye + edit icon buttons
  per user row (navigate to detail / open edit modal), eye + edit for company group rows, status as
  plain text with `STATUS_TEXT_COLORS`, "Actions" column header, colSpan 5→6.
- **ActionLogTab.tsx** (new): Stub tab component for Action Log, ready to wire to `getAuditLogs`.
- **CreateUserModal.tsx**: Vendor-to-contractor assignment dropdown added in AddVendorCompanyModal.
- **CompanySelectionStep/UserDetailsStep**: Updated for grouped dropdown and vendor assignment.
- **Backend companies module**: Added vendor assignment CRUD endpoints
  (`POST/DELETE /companies/:id/vendors`), logo upload (`POST /companies/:id/logo`), document CRUD
  (`POST/GET/DELETE /companies/:id/documents`). CompaniesModule now imports StorageModule.
- **API client**: Added vendor, logo, document endpoint functions to `companies.ts`. Added avatar
  paths to `users.ts`.
- **CustomDropdown**: Added grouped options support for vendor-contractor dropdown.
- **i18n**: Added `columns.dateJoined`, vendor assignment keys, validation keys. New icons: date,
  user-plus, hammer SVGs.

---

### Infrastructure: Storage Module, Audit Module, DB Migration (US-1.05 AC 6 / US-1.09)

**Rationale**: Multiple upcoming features (company logo upload, compliance documents, user avatars)
require a generic file storage service. The audit log (US-1.05 AC 6) needs a backend module to
record all user management actions. A single Prisma migration adds all new models.

**Changes**:

- **Prisma schema**: Added `File` model (bucket, key, filename, mimeType, size, uploadedBy),
  `CompanyDocument` model (companyId, type: DocumentType enum, fileId, expiresAt),
  `CompanyVendorAssignment` model (vendorId, contractorId), `AuditLog` model (action: AuditAction
  enum, performedById, targetType, targetId, metadata JSON, ipAddress). Added `avatarUrl` field to
  User. Added `DocumentType` and `AuditAction` enums.
- **Migration**: `20260304153721_add_vendor_assignment_files_audit` — creates all new tables and
  indexes.
- **StorageModule** (`apps/backend/src/modules/storage/`): `StorageService` wraps
  `@aws-sdk/client-s3` for MinIO/S3 uploads, signed URL generation, and file deletion.
  `StorageController` exposes `POST /storage/upload`, `GET /storage/:id/url`, `DELETE /storage/:id`.
  Registered in `AppModule`.
- **AuditModule** (`apps/backend/src/modules/audit/`): `AuditService` provides
  `log(action, performedById, target, metadata)` method writing to `AuditLog` table.
  `AuditController` exposes `GET /audit-logs` with pagination and filters (action, targetType,
  targetId, performedById, dateRange). Registered in `AppModule`.
- **Shared types**: Added `AuditAction` enum to `packages/shared-types/src/enums/index.ts`.
- **API client**: Added `packages/api-client/src/endpoints/audit.ts` with `getAuditLogs()` function.
  Added `AUDIT_PATHS`, `STORAGE_PATHS` to `paths.ts`. Exported from barrel `index.ts`.
- **Dependencies**: Added `@aws-sdk/client-s3` to `apps/backend/package.json`.

---

## Epic 1 — Remaining Gaps (Not Implemented)

**Audit date**: 2026-03-03 | **Source**: FRD cross-check against codebase

The following acceptance criteria from Epic 1 User Stories are **not yet implemented**. Tasks should
be generated for these items.

---

### GAP-1: US-1.05 AC 2 — Backend dynamic sort support

**Status**: COMPLETE **Implementation**: Added `sortBy` and `sortDir` fields to `UserListQueryDto`,
dynamic `orderBy` in `listUsers()` with whitelist validation (`SORTABLE_USER_FIELDS`). Defaults to
`createdAt desc`. Frontend already sent these params.

---

### GAP-2: US-1.05 AC 4 — Bulk deactivate all company users

**Status**: COMPLETE **Implementation**: Frontend bulk deactivate/activate implemented using
existing individual endpoints via `Promise.allSettled`. Dynamic label toggles based on company user
statuses. Confirmation modal + success/error toasts. (T153 — done in previous commit)

---

### GAP-3: US-1.05 AC 6 — Activity/audit log for user management

**Status**: COMPLETE **Story**: US-1.05 (RBA Management) **Criterion**: All actions are logged and
visible as a history of activities (edits) for each user **Backend**: DONE — `AuditLog` Prisma
model, `AuditModule` with `AuditService` (log method) and `AuditController` (GET /audit-logs with
filters), registered in AppModule. **Frontend**: DONE — `ActionLogTab.tsx` wired to `getAuditLogs`
API, timeline UI with check circle icons, action names, dates, descriptions, pagination. Matches
Figma.

---

### GAP-4: US-1.08 AC 8 — Reactivation email notification

**Status**: COMPLETE **Story**: US-1.08 (Manage users within a company) **Criterion**: When a user
is reactivated, the user receives an email notification **Implementation**: Added
`sendReactivationEmail(to, name)` to `email.service.ts`, created `reactivation.html` Handlebars
template, added `REACTIVATION` constant to `email-templates.const.ts`, added i18n keys to
`emails.json`. `reactivateUser()` in `users.service.ts` now calls `sendReactivationEmail()`. Also
added audit logging for user create/deactivate/reactivate actions and dynamic sort support
(sortBy/sortDir in UserListQueryDto). Avatar upload endpoints added to users controller.

---

### GAP-5: US-1.09 — Contractor profile management (frontend)

**Status**: COMPLETE **Story**: US-1.09 (Contractor profile management) **Implementation**: Created
`CompanyProfilePage.tsx` as single-page layout matching Figma: company card header (initials
avatar + edit pencil overlay + "Edit Profile" button), Legal Information (4-col grid: legal name,
trade name, ABN, tax code + full-width legal address), Contact Information (3-col grid: email,
phone, website), Compliance Documents (document cards with uploader email, date, view/download
actions). `EditCompanyModal.tsx` for editing with Zod validation. Added route, i18n keys, icons
(location, tax, web, download, paperclip, upload, delete). ProjectAccessModal added for user-project
assignment. UserDetailPage updated with project access action.

**Super-Admin Company Detail Page** (T192, T202): Created `CompanyDetailPage.tsx` in super-admin-app
with tabbed layout (Overview, Company Users, Documents). Eye icon on company row in UserListPage
navigates to `/companies/:id`. Edit icon removed from company row (three-dot menu covers edit).
OverviewTab (legal info + contacts), CompanyUsersTab (user table with sort/pagination/modals),
DocumentsTab (upload/view/delete). EditCompanyModal with Zod validation. AppLayout updated with page
header. **UI polish (T202)**: tabs moved outside card, company header inside card, EditCompanyModal
reduced to name-only field, "User Profile" header for `/settings/users/:id`, removed My Profile
page/route. **Tab URL persistence (T225)**: All tabbed pages now persist active tab in URL
`?tab=...` via `useSearchParams` instead of `useState`, enabling direct-link and browser back/fwd.
**Preselect company in invite (T227)**: CreateUserModal accepts optional `preselectedCompany` prop;
CompanyUsersTab passes company info so invite modal skips company selection step.

**Logo upload** (T156): Backend stores S3 key instead of path, new `GET /companies/:id/logo-url`
endpoint returns signed URL. Frontend CompanyProfilePage wired: file picker on avatar edit click,
displays logo image when available, shows spinner during upload. Specialisations section added.
`contactEmail` made nullable in `CompanyResponse`.

**UI polish (T203)**: Company-admin EditCompanyModal redesigned — removed input icons, added ABN/Tax
Code fields with section headers. Settings sidebar label changed "Companies" → "Company". Tab
borders updated to 2px black underline. **Popup blocker fix (T226)**: Document view/download/export
now opens blank tab synchronously before async API call, preventing browser popup blocker.

**Sub-gaps resolved (T207)**:

- ABN/tax format validation: Backend `@Matches` regex on CreateCompanyDto + UpdateCompanyDto (ABN:
  11 digits, taxCode: 1-11 digits). Frontend Zod schema extracted to `company-form.schema.ts`. i18n
  validation keys added. ABN/taxCode now updatable via PATCH /companies/:id.

**Sub-gaps resolved (T210–T212)**:

- T210: ABN masked with `#` characters in super-admin OverviewTab (InfoItem `masked` prop).
- T211: Empty-string validation fix — `emptyToUndefined()` helper prevents `""` from reaching
  backend `@Matches`/`@IsEmail`/`@IsUrl` validators on PATCH /companies/:id.
- T212: Google Places address autocomplete — new backend `GoogleModule`
  (`POST /google/places/addresses`) using Google Places API (New) with native `fetch`. Reusable
  `AddressInput` component in `@forethread/ui-components` (debounce 300ms, keyboard nav, listbox
  ARIA). Replaced plain `<Input>` for all location fields: EditCompanyModal (legalAddress),
  CreateProjectPage + EditProjectPage (delivery/storage locations). Env: `GOOGLE_PLACES_API_KEY`.

---

### GAP-6: US-1.10 — Manage user profile (frontend)

**Status**: COMPLETE **Story**: US-1.10 (Manage user profile) **Implementation**: Created
`UserProfilePage.tsx` in company-admin-app with: profile card (avatar with upload, name, email),
editable fields (name, position, phone), read-only fields (email, role, company, date joined),
change password form (current + new + confirm). `EditProfileModal` for editing. `AvatarUpload`
component in ui-components for image upload with preview. Added `profile.json` i18n namespace. Route
added to company-admin-app. Migration `add_user_avatar_url` for User.avatarUrl field.

**Deployed to all apps**: Route `/me`, AppLayout "My Profile" menu item now deployed across
super-admin-app, company-admin-app, financial-officer-app, procurement-officer-app, vendor-app,
warehouse-officer-app (T193).

**UI polish (T205, T206)**: User detail pages wrapped in single card (profile header + info grid +
sections). Profile sections use `bg-muted` without border across all 6 apps. Centered not-found
message. Removed "Back to users" link. Mock data extracted to constants files.

**Final gaps resolved (T208, T209)**: Approval Responsibilities section → empty state with "No
approval responsibilities assigned yet" (no backend API exists). Activity Log section → real
`getAuditLogs` API with `performedById` filter. Removed all mock data from constants.ts. Removed
role restriction on audit controller so all authenticated users can query their own logs. Added
`userId` prop to `ActivityLogSection`. i18n keys: `noApprovalResponsibilities`, `noActivityLog`.

**workStatus/department backend (T223)**: Added `workStatus` (VARCHAR 50) and `department`
(VARCHAR 255) nullable fields to User model. Updated `UpdateMeDto` and `USER_SELECT`. Cancel
invitation now uses `$transaction` with explicit `emailVerification.deleteMany` + relation
disconnect before `user.delete` to prevent FK constraint errors.

**workStatus/department frontend (T224)**: EditProfileModal in all 5 apps now populates
workStatus/department from profile data and sends them via updateMe API. Previously UI-only fields.

### GAP-7: US-2.07 — PO Schema Expansion & Dashboard List Pages

**Status**: COMPLETE **Story**: US-2.07 (PO Dashboard) **Implementation**: Expanded PurchaseOrder
Prisma schema to match the PO data fields template documentation. Added 6 new enums (ApprovalStatus,
PoSourceOfCreation, PoChangeType, PaymentTerm, PoPriority, PoQuickFilter), 3 new models (PoLineItem,
PoDocument, PoChangeRequest), self-referencing parent/child PO relation, financial fields (currency,
subtotal, discount, tax), vendor delivery fields (plannedDeliveryDate, deliveryNotes), and unique
poNumber. PurchaseOrdersService enriched with quick filters (11), ApprovalStatus enum,
lastModifiedBy tracking, and enhanced detail response. Frontend: @forethread/po-shared package, 5
new ui-components (ExportDropdownButton, GroupByButton, ToolbarSearchToggle, ViewSelectorDropdown,
useDropdown), full PO list page rewrite for CA/PO/Vendor apps with column management, saved views,
drag-drop, grouping, search, and export. (T680–T688)

### Project Forms — Custom Component Adoption (T214)

**Rationale**: Project pages (Create, Edit, List, Detail) in `company-admin-app` used native HTML
`<select>`, `<input type="checkbox">`, `<input type="radio">` instead of the project's custom
`CustomDropdown`, `Checkbox`, and `RadioButton` components from `@forethread/ui-components`.
Constitution Principle VIII (Shared-Before-Custom) requires custom components to be used everywhere.

**Changes**:

- **CreateProjectPage**: Replaced native `<select>` with `CustomDropdown` (via `Controller`) for
  type, status, currency, pointOfContact. Replaced `<input type="checkbox">` with `Checkbox` for
  team members (vertical stacking). Replaced `<input type="radio">` with `RadioButton` for default
  location. "Remove" text → `DeleteIcon`. "Add Location" link → muted color (not blue). Removed
  "Back to projects" link.
- **EditProjectPage**: Same replacements as CreateProjectPage.
- **ProjectListPage**: Replaced `<select>` filters with `CustomDropdown`, `<input type="checkbox">`
  with `Checkbox` for show-archived toggle.
- **ProjectDetailPage**: Replaced `<input type="checkbox">` in AddMembersModal with `Checkbox`.
  Removed "Back to projects" link.

### Super-Admin Navigation & Pagination Cleanup (US-1.05)

**Rationale**: FRD does not require a standalone Companies list page — companies are managed through
the User Management page grouped by company. The sidebar had a redundant "User Management" link;
users should navigate to User Management via Settings only. Pagination should be hidden when data
fits on one page (≤ 10 items).

**Changes**:

- **CompaniesPage removed (T229)**: Deleted `/companies` route, page component, and test. Sidebar
  "User Management" item replaced with "Settings" only. Company detail back button navigates to
  `/settings/users` instead of `/companies`.
- **Empty companies visible (T230)**: `useGroupedUsers` hook accepts optional `allCompanies` param
  to seed the company group map, so companies with 0 users still appear in the User Management
  table. Tab-switching tests refactored to contract-based approach (verify `setSearchParams` calls +
  URL-driven rendering separately).
- **Sidebar restructured (T231)**: Removed "User Management" sidebar item — users page is accessed
  only through Settings. `/settings/users` now shows a back button → `/settings`. Settings sidebar
  item highlights for all `/settings/*` and `/companies/*` paths.
- **Pagination hidden (T231)**: `TablePagination` hidden when `total ≤ 10` on both `UserListPage`
  and `CompanyUsersTab`.

---

## Epic 3+ Roadmap (from Designer Wireframe Review — 2026-03-04)

_Based on cross-referencing designer wireframe documentation (sections 0–8 + US22) with existing
spec and implementation. This section maps remaining work to epics and identifies the components,
routes, and backend modules needed._

### Epic 3 — RFQ Creation & Vendor Quote Collection (US-3, US-4)

**Scope**: Full RFQ workflow — creation, vendor dispatch (tokenized), quote collection, side-by-side
comparison, winner selection.

**Backend modules needed**:

- `apps/backend/src/modules/rfqs/` — RFQ CRUD, line items, vendor dispatch
- `apps/backend/src/modules/quotes/` — Vendor quote submission, comparison
- `apps/backend/src/modules/vendors/` — Vendor management (extends companies module)

**Frontend routes needed**:

- `procurement-officer-app`: `/rfqs`, `/rfqs/new`, `/rfqs/:id`, `/rfqs/:id/compare`
- `company-admin-app`: `/rfqs`, `/rfqs/:id` (read-only or same as PO)
- `vendor-app`: `/rfqs/:token` (tokenized public page — no auth)

**Shared types**: `RfqStatus` enum (Draft, Sent, Responded, Closed), RFQ DTOs, Quote DTOs, Zod
schemas **API client**: RFQ endpoints, Quote endpoints **i18n**: `rfqs.json`, `quotes.json`

**Key screens from designer**:

- RFQ list with status/vendor/project/date filters
- Create RFQ form (items from catalog, quantities, project selector, delivery deadline, notes, BOM
  attach)
- Vendor Response Viewer (compare side-by-side, highlight best price, accept winning)
- Vendor tokenized RFQ page (company logo, RFQ number, items table, price inputs, upload quote,
  submit)

---

### Epic 4 — Purchase Order Management (US-5, US-15) — IN PROGRESS

**Scope**: PO creation (from RFQ/manual/bulk drawdown/material request/copy), PO lifecycle
(Draft→Sent→Acknowledged→ Pending Delivery→Delivered→Closed), vendor tokenized PO page, change
orders (US-15), multi-vendor PO splitting.

**Implementation Status** (2026-03-20):

- ✅ Prisma schema fully aligned to FRD (deliveryLocationId FK, paymentTermsDays, pickup fields,
  materialId FK, message, deliveryResponsible)
- ✅ Backend: POST create, PATCH update, POST issue endpoints implemented (T725-T728)
- ✅ Backend: GET list/detail updated with all new fields
- ✅ Backend: POST copy updated with all new fields
- ✅ Backend: Document upload/delete (T701-T703)
- ✅ Contracts: purchase-orders.md aligned to FRD
- ✅ Shared types: DTOs, Zod schemas, API client updated
- ✅ Frontend: Create PO wizard DONE — 3-step wizard (BasicInfo → LineItems → Review+Send) in
  po-shared package, wired in CA, PO, Vendor apps (T770-T807). Features: mandatory field validation,
  save as draft, attachments (drag-and-drop + format/size validation), material search panel,
  ApprovedQuotesModal (RFQ→PO conversion UI), BulkOrdersModal (drawdown UI), BulkOrderCoverageModal,
  RfqCoverageModal, BulkPriceWarningModal, vendor details auto-populate in review step, line-level
  notes/dates/locations, pick-up + hold-for-release checkboxes.
- ✅ Frontend: PO list "Create new" dropdown menus (T770), Dashboard QuickActions (T772)
- ✅ Frontend: PO detail page, PO comms page (messages tab), PO preview panel (T776, T802)
- ✅ Tests: Comprehensive test coverage across PO list/detail/create/comms (T782, T787, T801)
- ✅ Backend: POST confirm (vendor) — T755 — SENT→ACKNOWLEDGED, vendor role only
- ✅ Backend: POST validate-items (auto-check RFQ coverage) — T756 — approved RFQ matching done,
  bulk order matching stubbed (BulkOrderLineItem lacks materialId FK)
- ✅ Schema: PoLineItem.pickUp boolean (T749) — RFQ→PO pick-up preservation
- ✅ Hold-for-release validation — backend enforces deadlineStart on holdForRelease, frontend maps
  plannedDeliveryDate→deadlineStart (already working)
- ❌ Backend: Change requests CRUD — T754
- ❌ Vendor tokenized PO page

**FRD Alignment** (2026-03-17): Updated to include all PO creation requirements from FRD:

- 5 creation sources (RFQ, bulk order, material request, manual, copy)
- Single vendor, single project per PO in Release 1 (multi-vendor/multi-project grouping and
  auto-split deferred to post-Release 1, see US 5.11)
- Mandatory fields: project, vendor, delivery location, expected delivery date, line items
  (material, qty, UoM, price)
- Optional fields: hold-for-release, cost codes, material codes, line-level notes, line-level
  delivery dates, line-level delivery location, material code, payment terms, pick up, warehouse
  location, PO message, attachments
- Line item validation against warehouse inventory, bulk orders, approved RFQs
- System suggestions: warehouse release, bulk order drawdown, RFQ conversion
- Vendor auto-populate on selection

**Backend modules needed**:

- `apps/backend/src/modules/purchase-orders/` — PO CRUD, status transitions, versioning, line-item
  validation
- `apps/backend/src/modules/change-orders/` — Change Order creation, classification (Minor/Major),
  approval workflow, audit trail

**Frontend routes needed**:

- `procurement-officer-app`: `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/:id`,
  `/purchase-orders/:id/change-order`
- `company-admin-app`: `/purchase-orders`, `/purchase-orders/:id`
- `financial-officer-app`: `/purchase-orders`, `/purchase-orders/:id` (read-only)
- `vendor-app`: `/purchase-orders/:token` (tokenized — acknowledge/reject, upload receipt)

**Shared types**: `PoStatus` enum (Draft, Sent, Acknowledged, PendingDelivery, Delivered, Closed),
`ChangeOrderStatus` (Draft, PendingApproval, Approved, Rejected), `ChangeClassification` (Minor,
Major), PO DTOs, ChangeOrder DTOs **Key entities**: PurchaseOrder, PurchaseOrderLineItem,
ChangeOrder, ChangeOrderItem

**Architecture decisions**:

- Release 1: Single vendor per PO (multi-vendor auto-split deferred to post-Release 1, US 5.11)
- Line-item validation: On line item add, backend checks warehouse inventory + bulk orders +
  approved RFQs
- Vendor auto-populate: Frontend fetches vendor details on selection via existing vendor endpoint
- Material request conversion: Reuses material request data (project, items) to pre-fill PO form

---

### Epic 4b — RFQ Enhancements (US-5.05, US-5.06, US-5.18, US-5.19, US-5.24) — IN PROGRESS

**Scope**: Detailed RFQ creation (from BOM, manual, copy, saved list), bulk order check during RFQ,
quote review (comparison table + list view), line-level approval with multi-vendor allocation,
pick-up RFQ items, edit RFQ before vendor response.

**FRD Alignment** (2026-03-17): Expanded from high-level US-3/US-4 to detailed acceptance criteria.

**Implementation Status** (2026-03-18):

- ✅ Prisma schema: rfqNumber, currency, deliveryLocationId FK, needByDate, holdForRelease,
  earliestDeliveryDate, message, ApprovalStatus enum
- ✅ Prisma schema: RfqVendor M2M for invited vendors
- ✅ Prisma schema: RfqLineItem — materialId FK, costCode, pickUp
- ✅ Contracts: rfq.md aligned to FRD
- ✅ Backend: RFQ list/detail/copy updated with all new fields
- ✅ QuoteLineItem model (needed for US 3.06 per-line vendor quotes)
- ✅ QuoteResponse enrichment (message, attachments, shipmentPrice, taxesIncluded, validityPeriod) —
  T897 added QuoteAttachment model for file persistence
- ❌ Quote line-level approval tracking (US 5.19)
- ❌ Frontend: Create RFQ page (design available, not started)
- ❌ Frontend: Review quotes page (design available, needs QuoteLineItem first)
- ✅ Frontend: Vendor RFQ response form (T362) — RfqResponsePage with bulk defaults, per-line-item
  editable table, back-order details, substitute material search, file attachments, success/error
  modals, split layout with info panel, 60+ i18n keys

**Key additions vs existing spec**:

- RFQ creation: 4 sources (BOM, manual, copy, saved list) + bulk order check on line item
  confirmation
- Quote review: comparison table with horizontal scroll, fixed item column, per-vendor columns
- Line-level approval: approve per-item per-vendor with quantity allocation
- Pick-up RFQ items: mark line items as pick-up, preserved through PO conversion
- Edit RFQ: allowed before vendor response, vendors notified of updates

**Backend additions**:

- Line-level approval endpoint with quantity allocation per vendor
- Pick-up flag on RFQ line items
- Bulk order check during RFQ creation (reuse existing bulk order service)

---

### Epic 4c — Change Requests & Pick-up (US-5.12, US-5.15, US-5.23) — PARTIALLY DONE

**Scope**: Commercial and internal change requests for POs, pick-up PO with time/contact details,
auto-apply bulk pricing during PO creation.

**FRD Alignment** (2026-03-17): Expanded from FR-031/032 to detailed commercial vs internal
workflow.

**Implementation Status** (2026-03-18):

- ✅ Pick-up fields in PO schema: pickUpTimeExpectation (ASAP/TOMORROW/CUSTOM_DATE),
  pickUpPersonName, pickUpPersonPhone
- ✅ PoChangeRequest model exists with changeType (COMMERCIAL/INTERNAL), changedFields (JSON)
- ❌ PoChangeRequest needs: explicit `status` enum (Pending/Approved/Rejected) + `message` field
- ❌ PoLineItem needs: `pickUp` boolean (for RFQ→PO pick-up preservation, US 5.18 AC 4)
- ❌ Change request CRUD endpoints not implemented
- ❌ PO & Bulk auto-apply not implemented

**Key additions vs existing spec**:

- Commercial changes: quantities, prices, dates, line items, location, discounts, taxes, shipment
- Internal changes: cost codes, material codes, project references (applied immediately)
- Pick-up PO: time expectation (ASAP/tomorrow/date), contact details, pick-up reports
- PO & Bulk: auto-apply bulk pricing when vendor has active agreement, partial coverage support

---

### Epic 5 — Vendor & Supplier Management (US-6)

**Scope**: Vendor invitation, vendor profiles, sales representatives, vendor-contractor
relationships, in-app messaging threads scoped to documents.

**Backend modules needed**:

- `apps/backend/src/modules/vendors/` — Vendor CRUD, sales reps, specialisations
- `apps/backend/src/modules/messages/` — Document-scoped messaging threads

**Frontend routes needed**:

- `procurement-officer-app`: `/vendors`, `/vendors/:id`
- `company-admin-app`: `/vendors`, `/vendors/:id`
- `vendor-app`: `/profile`, `/settings` (manage own profile, warehouse locations, reps)

**Sidebar update**: Add "Vendors" to company-admin-app and procurement-officer-app sidebars

---

### Epic 6 — Material Catalogue Management (US-7) — SCHEMA ONLY

**Scope**: Material CRUD, bulk import (CSV/XLS) with column mapping, BOM creation from document
upload (XLS/XLSX/CSV/PDF) with catalogue matching, duplicate detection, archive/unarchive, material
suggestions, smart search, lists and favourites, BOM editing.

**Implementation Status** (2026-03-18):

- ✅ Prisma models: Material (name, categoryId FK, uom, upc, manufacturer, description, status enum,
  createdById FK) + MaterialCategory (name unique)
- ✅ Material is referenced by PoLineItem.materialId FK and RfqLineItem.materialId FK
- ❌ Backend module not created (no CRUD service/controller)
- ❌ API contract exists (`contracts/materials.md`) but no implementation
- ❌ Frontend: no UI implementation
- ❌ Bulk import, BOM, lists/favourites — not started

**FRD Alignment** (2026-03-17): Updated to include detailed requirements from FRD:

- US-4.01: SA manages public catalogue (approve/reject suggestions, prevent duplicates)
- US-4.02: File upload with column mapping step, structured table with duplicate detection
- US-4.03: Material lists and favourites (company-scoped visibility)
- US-4.04: Smart search with real-time suggestions, recommendations (frequent/recent/BOM items)
- US-5.01: BOM creation from document upload with OCR/matching, confidence scores, manual matching
- US-5.02: BOM editing without impacting existing procurement documents

**Backend modules needed**:

- `apps/backend/src/modules/materials/` — Material CRUD, import with column mapping, duplicate
  detection, suggestions
- `apps/backend/src/modules/bom/` — Bill of Materials per project, document upload/OCR, catalogue
  matching
- `apps/backend/src/modules/material-lists/` — User lists, favourites, company-scoped sharing

**Frontend routes needed**:

- `procurement-officer-app`: `/materials`, `/materials/:id`, `/materials/import`, `/materials/lists`
- `company-admin-app`: `/materials`, `/materials/:id`, `/materials/import`
- `super-admin-app`: `/materials` (admin management, approve suggestions)

**Key screens from designer (3.2)**:

- Material list with filters (category, UOM, manufacturer, type, country, colour)
- Material detail (Name, Manufacturer, SKU, UOM, Price, Description, Photos, Deprecated flag)
- File import wizard (upload → column mapping → review table → save)
- BOM upload wizard (upload → extract → match to catalogue → review → save)
- Duplicate detection UI (flag + resolve)
- Smart search with autocomplete and recommendations
- Archive / Unarchive actions

---

### Epic 7 — Warehouse Operations (US-13 — NEW)

**Scope**: Warehouse request handling, inventory management, barcode scanning, stock levels, task
queue.

**Backend modules needed**:

- `apps/backend/src/modules/warehouse-requests/` — Request CRUD, status management
- `apps/backend/src/modules/inventory/` — Stock levels, incoming/outgoing logs, barcode lookup

**Frontend routes needed** (warehouse-officer-app, currently shell only):

- `/` (Home — task queue: new requests, items to pick, pending deliveries, confirm deliveries)
- `/warehouse-requests`, `/warehouse-requests/:id` (list, detail, confirm stock, mark ready)
- `/inventory`, `/inventory/scanner`, `/inventory/stock-levels` (barcode scan, manual search, logs)

**Shared types**: `WarehouseRequestStatus` enum (New, Confirmed, PickingInProgress, ReadyForPickup,
Dispatched, Completed), `InventoryTransactionType` (Incoming, Outgoing, Adjustment) **i18n**:
`warehouse.json`, `inventory.json`

---

### Epic 8 — Field Worker Mobile Features (US-14 — NEW)

**Scope**: Material requests from field (with photos, offline mode), delivery confirmation (with
photos, defect reporting), multi-project switcher.

**Note**: The Foreman app is described as a native mobile app in Assumptions. If building as a
responsive web app instead, the warehouse-officer-app and a new `foreman-app` would need these
features. Currently no `foreman-app` exists in the monorepo.

**Backend modules needed**:

- `apps/backend/src/modules/material-requests/` — Field material request CRUD, photo upload (MinIO)
- `apps/backend/src/modules/delivery-confirmations/` — Delivery confirmation with photo, defect
  tracking, integration with PO comment thread

**Frontend routes needed** (foreman-app or responsive mobile):

- `/` (Home — assigned projects switcher, pending deliveries, draft requests)
- `/material-requests`, `/material-requests/new` (create with items, photos, offline draft)
- `/deliveries/:id/confirm` (take photo, mark received, report defects, chat)

**Key technical challenges**: Offline mode (service worker, IndexedDB), photo upload (camera API,
MinIO), background sync

---

### Epic 9 — Invoice Reconciliation & Documents (US-9)

**Scope**: Invoice upload (from dashboard/PO detail), OCR data extraction with review, PO matching
with line-item alignment, reconciliation table (ordered vs delivered vs invoiced), line-item and
document-level approval/rejection, dispute management with communication thread and controlled
change proposals, invoice history (immutable), payment due date notifications (configurable),
multi-PO invoice linking, optional financial reports.

**FRD Alignment** (2026-03-17): Updated to include detailed requirements from FRD:

- US-8.01: Upload from dashboard quick actions or PO detail, drag-drop, file preview
- US-8.04: OCR extraction with editable review form alongside original document
- US-8.05: Reconciliation with optional delivery report aggregation, line/document approval
- US-8.06: Dispute thread with per-field change proposals requiring explicit approval
- US-8.08: Immutable history with action type, user, timestamp, comment
- US-8.09: Configurable notification lead time, in-app + dashboard + email delivery
- US-8.10: Multi-PO invoice linking with aggregated reconciliation
- US-8.11: Financial reports (optional) — price per item, spend, committed vs actual

**Backend modules needed**:

- `apps/backend/src/modules/invoices/` — Invoice CRUD, OCR processing, PO matching, reconciliation
- `apps/backend/src/modules/disputes/` — Dispute creation, communication thread, change proposals
- `apps/backend/src/modules/reports/` — Financial reports aggregation (optional)

**Frontend routes needed**:

- `financial-officer-app`: `/invoices`, `/invoices/:id`, `/invoices/:id/reconcile`, `/reports`
- `company-admin-app`: `/invoices`, `/invoices/:id`
- `procurement-officer-app`: `/invoices`, `/invoices/:id`
- `vendor-app`: `/invoices`, `/invoices/:id` (dispute response)

**Key entities**: Invoice, InvoiceLineItem, Dispute, DisputeMessage, InvoiceHistory

**System requirements** (if delivery is implemented):

- Delivery reports can be submitted under a Closed PO
- Invoices can be submitted under a Closed PO
- Reconciliation operates on all linked POs + all delivery reports + aggregated quantities

---

### Epic 10 — Dashboards & KPI Cards (US-10)

**Scope**: Role-specific dashboards with KPI cards, filters, document views. Replaces current
dashboard stubs in all apps.

**Frontend changes per app**:

- `company-admin-app`: KPI cards (Total spend, Cost-to-complete, Inventory value, Pending RFQs,
  Pending POs, Change Orders), filters (period, project, vendor, status)
- `procurement-officer-app`: KPI cards (RFQs sent, Awaiting vendor quote, Winning quote value,
  Approved POs, Delayed deliveries), filters (date range, vendor, project)
- `financial-officer-app`: Invoice-focused KPIs
- `vendor-app`: Summary cards (open RFQs, active POs, pending invoices)
- `super-admin-app`: "Open Analytics Dashboard" button (Google Analytics)

**Backend needed**: Aggregation endpoints per role (counts, sums, trends)

---

### Epic 11 — Bulk Orders (US-8)

**Scope**: Bulk order creation from RFQ, drawdown management, vendor negotiation, expiry handling.

---

### Epic 12 — Notifications, Logs, Currency & Admin Panel (Cross-Cutting)

**Scope**: System-wide notification engine (in-app + email), user notification preferences,
immutable system logs on business documents, multi-currency support (AUD default), admin panel for
monitoring integrations, background jobs, and notification delivery.

**FRD Alignment** (2026-03-17): Expanded to include all cross-cutting system requirements.

**Backend modules needed**:

- `apps/backend/src/modules/notifications/` — Notification engine, email delivery, user preferences
- `apps/backend/src/modules/audit/` — Immutable system logs (already partial — extend for all
  documents)
- `apps/backend/src/modules/admin/` — Admin panel endpoints for integration status, job retry

**Frontend routes needed**:

- All apps: Notification centre (bell icon dropdown), notification preferences in settings
- `super-admin-app`: `/admin` — integration status, background jobs, error logs, retry actions

---

### Epic 13 — Sidebar Navigation Update (Global)

**Scope**: Update all app sidebars to match designer navigation structure. Currently most apps have
only Dashboard + Settings. Target structure per app:

| App                     | Target Sidebar Items                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| company-admin-app       | Dashboard, Projects, RFQs, Purchase Orders, Vendors, Documents, Settings                   |
| procurement-officer-app | Dashboard, Material Catalog, RFQs, Purchase Orders, Vendors, Projects, Documents, Settings |
| financial-officer-app   | Dashboard, Purchase Orders, Documents (Invoices), Settings                                 |
| warehouse-officer-app   | Home (task queue), Warehouse Requests, Inventory, Settings                                 |
| vendor-app              | Dashboard, RFQs, Purchase Orders, Documents, Settings                                      |
| super-admin-app         | Dashboard, Companies, Settings (unchanged)                                                 |

**Note**: Sidebar items should only be added when the corresponding feature module is implemented.
Add nav items incrementally per epic completion.

---

### Suggested Epic Execution Order

```
Epic 3 (RFQ)
  └→ Epic 4 (PO + Change Orders)      ← depends on RFQ (PO from approved quotes)
       └→ Epic 5 (Vendors)             ← can be parallel with Epic 4
       └→ Epic 9 (Invoices/Dockets)    ← depends on PO
       └→ Epic 11 (Bulk Orders)        ← depends on RFQ + PO

Epic 6 (Material Catalog)              ← can start parallel with Epic 3
  └→ Epic 7 (Warehouse)                ← depends on Materials + Inventory
  └→ Epic 8 (Field Worker)             ← depends on Materials + Delivery

Epic 10 (Dashboards)                   ← depends on data from Epics 3–9
Epic 12 (Notifications)                ← cross-cutting, can be incremental
Epic 13 (Sidebar Nav)                  ← incremental per epic completion
```

---

## Post-Epic 2: Header Redesign — Search Input & Notification Bell (2026-03-04)

**Status**: Complete (UI components done). Notification dot hidden until backend notification logic
is implemented (Epic 12).

### What Was Done

- Created `SearchInput` shared component (`packages/ui-components`) with `search.svg` icon import
- Created `NotificationBell` shared component using `notification.svg` icon, 34x34px with `#E8EAED`
  border, optional blue notification dot (`#175CD3`, 8x8px)
- Updated all 6 app headers (`AppLayout.tsx`) to use `SearchInput` + `NotificationBell`
- Removed username text next to avatar (design alignment)
- Added `search` i18n key to `common.json`

### What Is NOT Done (deferred to Epic 12 — Notifications)

- `hasNotifications` prop is not wired — currently always `false` (no backend notification logic)
- In-app notification centre (bell click → notification list)
- Notification count / unread badge
- Push notification integration

---

## US-1.05 Gap Fix: Bulk Deactivate/Activate All Company Users (2026-03-04)

**Status**: Complete (frontend-only, no new backend endpoint).

### What Was Done

- Implemented "Deactivate all users" / "Activate all users" toggle in Super Admin user management
  company-level dot menu (`getCompanyActions`)
- Dynamic label: if all toggleable users (non-Invited) in a company are Inactive → shows "Activate
  all users"; otherwise → "Deactivate all users"
- Uses existing individual `PATCH /users/:id/deactivate` and `PATCH /users/:id/reactivate` endpoints
  via `Promise.allSettled` (no bulk backend endpoint)
- Confirmation modal (`StatusActionModal`) with danger/default variant matching action type
- Success/error toasts via `notificationService`; partial failure handling
- Added bulk action modal state to `users.store.ts`
- Added i18n keys: `actions.activateAll`, `bulkDeactivateModal.*`, `bulkActivateModal.*`,
  `bulkDeactivateSuccess`, `bulkActivateSuccess`, `bulkActionPartialError`

### What Is NOT Done

- No dedicated bulk backend endpoint (`PATCH /companies/:id/deactivate-users`) — uses individual
  calls. If performance is an issue with many users, a bulk endpoint can be added later
- "Sole CompanyAdmin" guard is enforced per-user by the backend — if the last active admin is in the
  batch, that individual call will fail but others will succeed (partial failure toast shown)

## Avatar/Logo Display: Public MinIO URLs (T222)

**Problem**: Avatars and company logos stored in MinIO were inaccessible via `<img src>` because
presigned URLs had wrong host and backend proxy endpoints required JWT auth that `<img>` tags don't
send.

**Solution**: MinIO bucket is already public (`mc anonymous set public` in docker-compose). Added
`StorageService.getPublicUrl(key)` that builds `{S3_ENDPOINT}/{bucket}/{key}`. Backend controllers
now resolve S3 keys to public URLs before returning them. Frontend uses direct `<img src={url}>`.

### Changes

- `StorageService.getPublicUrl(key)` — builds direct public URL from S3 endpoint + bucket + key
- `UsersController` — `resolveAvatarUrl()` helper converts S3 key → public URL in `getMe()`,
  `getUser()`, `listUsers()`, `uploadAvatar()`, `getAvatarUrl()`; removed streaming proxy endpoints
  (`avatar-image`)
- `CompaniesController` — `resolveLogoUrl()` helper converts S3 key → public URL in `getCompany()`,
  `listCompanies()`, `uploadLogo()`, `getLogoUrl()`; removed streaming proxy endpoint (`logo-image`)
- Removed from api-client: `getMyAvatarBlob`, `getUserAvatarBlob`, `getCompanyLogoBlob`,
  `ME_AVATAR_IMAGE`, `avatarImage()`, `logoImage()` paths
- All 6 apps' `useAvatarUrl()` → uses `getMyAvatarUrl` with `select: (d) => d.url`
- `UserDetailPage` (super-admin, company-admin) — uses `user.avatarUrl` directly
- `CompanyDetailPage` (super-admin) — uses `company.logoUrl` directly
- `useCompanyLogo` — uses `getCompanyLogoUrl` with `select: (d) => d.url`

## Document Export + Confirm Dialog + UI Polish (T217)

**Status**: Complete.

### Changes

- `CompanyExportService` — new service for exporting company documents as PDF (using pdfkit) or CSV
- `GET /companies/:id/documents/export/:format` — new backend endpoint (PDF or CSV)
- `exportCompanyDocuments()` — new API client function
- `DocumentsTab` (both super-admin & company-admin) — replaced `window.confirm` with `ConfirmDialog`
  component for delete confirmation; added export PDF button with `DownloadIcon`
- Delete icon hover: changed from `text-destructive` to `text-foreground` in DocumentsTab and
  project location remove buttons (CreateProjectPage, EditProjectPage)
- Updated `DocumentsTab.test.tsx` to test ConfirmDialog flow

---

## Super Admin Dashboard (Epic 2 — US-2)

**Figma Reference**:
https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110088&m=dev **Status**: In
Progress

### Overview

Super Admin Dashboard with KPI cards, platform state monitoring, quick actions, recent activity
feed, and analytics placeholder. Uses existing UI components, i18n translations, and design tokens
(CSS variables).

### User Stories

- **US-2.01** — KPI Overview Cards (P1): 4 cards — Overall Platform Status, Active Users, Total
  Companies, Database Performance. Real data for users/companies, mock for status/DB.
- **US-2.02** — Quick Action Buttons (P1): 4 buttons — User Management, Company Management, Material
  Catalogue (disabled), Admin Panel. Navigate to respective routes.
- **US-2.03** — Platform State Table (P2): Table with Component, Status, Last Successful Run, Last
  Error, Error Info, Actions. Mock data. Status badges: Healthy (green/success), Error
  (red/destructive), Warning (amber/warning).
- **US-2.04** — Recent Changes Feed (P2): Timeline of 5 most recent audit log entries with action
  label, performer avatar+name, timestamp, target. Uses existing `getAuditLogs` API.
- **US-2.05** — Google Analytics Placeholder (P3): Placeholder card for future analytics
  integration.

### Functional Requirements

- FR-001–015: See spec (all KPI, quick actions, platform state, recent changes, analytics,
  responsive layout, i18n, design tokens, shared components).

### Architecture

- `DashboardPage.tsx` — main page component (thin orchestrator)
- `KpiCard.tsx` — reusable KPI card component
- `PlatformStateTable.tsx` — platform state monitoring table
- `RecentChangesTimeline.tsx` — audit log timeline feed
- `useDashboardData.ts` — hook for fetching users, companies, audit logs
- `dashboard.constants.ts` — mock data, action labels, status color mappings
- `formatDateTime` — shared utility in `@forethread/ui-components` (deduplicated from 7 files)
- `dashboard.json` — i18n namespace with all dashboard translations

### Implementation Notes

- All hardcoded Tailwind colors replaced with CSS variable classes: `text-[hsl(var(--success))]`,
  `bg-[hsl(var(--destructive))]/10`, etc.
- `formatDateTime` extracted to `packages/ui-components/src/utils/formatDateTime.ts` and exported
  from `@forethread/ui-components`. Removed duplicates from all 6 apps' ProfileSections +
  ActionLogTab.
- Platform Status and DB Performance use mock/static values until backend health-check API exists.

### Success Criteria

- SC-001–008: All 4 KPI cards load <3s, real data for users/companies, quick actions navigate
  correctly, platform state renders with badges, recent changes shows 5 entries, responsive
  320–2560px, zero hardcoded colors, zero hardcoded strings.

---

## Epic 2 Dashboards: Procurement Dashboard & Management Views (US-10.01–10.07)

**Branch**: `001-procurement-platform` | **Date**: 2026-03-09 | **Spec**: [spec.md](spec.md)
US-10.01–10.07 — Epic 2 Dashboards & Management Views | **Prerequisites**: Epic 1 COMPLETE, Epic 2
Projects COMPLETE, Super Admin Dashboard COMPLETE (T232–T240)

---

### Summary

Epic 2 Dashboards delivers role-specific home dashboards and procurement management table views for
all remaining user roles (PO/CA, Vendor, Finance Officer). Each role lands on a dashboard tailored
to their daily actions, with dedicated management pages for RFQs, Purchase Orders, Bulk Orders, and
Invoices.

**Technical approach**: New backend modules for RFQ, PO, BulkOrder, and Invoice entities with Prisma
models, REST endpoints, and shared DTOs. Frontend dashboard pages in each role-specific app
(`company-admin-app`, `vendor-app`, `financial-officer-app`, `procurement-officer-app`). Reusable
data table component with pagination, sorting, filtering, and quick filter tabs. All text via i18n,
all colors via CSS variables.

**Note**: This plan covers the **dashboard and management view** UI. Full CRUD workflows (create
RFQ, create PO, etc.) are separate epics (US-3 through US-9). Dashboard views initially use backend
list/filter endpoints; creation flows link to placeholder pages until those epics are implemented.

---

### Technical Context

**Existing Infrastructure**: All 7 apps scaffolded (super-admin, company-admin, vendor,
financial-officer, procurement-officer, warehouse-officer, backend). Auth flows, layout shells,
sidebar navigation, i18n, design tokens, and shared UI components are in place.

**New Backend Entities Required**: RFQ, QuoteResponse, PurchaseOrder, BulkOrder, Drawdown, Invoice.
These models, migrations, and CRUD endpoints must be created before the dashboards can show real
data. **Phase 1 (Shared Types) and Phase 2 (Backend Models)** establish the data layer.

**Frontend Pattern**: Each dashboard follows the established pattern:

- Zustand store for UI state (filters, selected items)
- TanStack Query hooks for data fetching
- Page component orchestrating sections
- Reusable `DataTable` component for management views
- i18n namespace per feature area

---

### Key Design Decisions

#### 1. Reusable DataTable Component

**Decision**: Create a generic `DataTable` component in `packages/ui-components` supporting:
pagination (configurable rows/page, default 25), column sorting (asc/desc toggle), search bar,
advanced filter panel, quick filter tabs, column visibility toggle, grouping, row actions, checkbox
selection, bulk actions bar, CSV/Excel export.

**Rationale**: All 4 management views (RFQ, PO, Bulk Order, Invoice) share identical table
behaviour. A single reusable component avoids massive duplication and ensures consistent UX.

#### 2. Dashboard Section Components

**Decision**: Each dashboard section (Quote Responses, Recent Orders, Purchase Orders, etc.) is an
independent component with its own data-fetching hook. Sections load asynchronously with individual
loading skeletons.

**Rationale**: Independent loading prevents a slow section from blocking the entire dashboard.
Matches the Figma design showing distinct card-based sections.

#### 3. Backend Dashboard Aggregation Endpoints

**Decision**: Create dedicated dashboard aggregation endpoints per role:

- `GET /v1/dashboard/po-ca` — returns quote responses, recent orders, pending POs, pending invoices
- `GET /v1/dashboard/vendor` — returns RFQs awaiting quote, invoices, active POs
- `GET /v1/dashboard/finance` — returns KPI metrics, pending invoices, disputed invoices

**Rationale**: Single dashboard endpoint per role reduces frontend round-trips from 4-5 calls to 1.
Each endpoint returns pre-shaped data matching the Figma layout.

#### 4. Quick Filter Tabs as Query Parameters

**Decision**: Quick filters (My RFQs, Open RFQs, etc.) map to query parameters on the list endpoint:
`GET /v1/rfqs?quickFilter=myRfqs`. The backend translates these into the appropriate WHERE clauses.

**Rationale**: Keeps filter logic server-side, supports deep-linking to filtered views, and
maintains consistent pagination counts.

#### 5. Role-Specific Column Sets

**Decision**: Management table endpoints return a `columns` metadata array alongside data,
specifying which columns are visible for the requesting user's role. Vendor PO view shows different
columns than PO/CA view.

**Rationale**: A single endpoint serves both roles, with the backend determining column visibility
based on role. The frontend `DataTable` consumes the column metadata.

---

### Scope Boundaries

#### In Scope

- Backend: RFQ, PurchaseOrder, BulkOrder, Invoice, QuoteResponse, Drawdown Prisma models +
  migrations
- Backend: Dashboard aggregation endpoints (per role)
- Backend: List/filter endpoints for RFQ, PO, BulkOrder, Invoice with pagination, sorting,
  filtering, quick filters
- Shared types: Enums, DTOs, Zod schemas for all new entities
- API client: Endpoint functions for dashboards and management views
- Frontend: PO/CA home dashboard (company-admin-app + procurement-officer-app)
- Frontend: Vendor home dashboard (vendor-app)
- Frontend: Finance Officer home dashboard (financial-officer-app)
- Frontend: RFQ Management page (company-admin-app, procurement-officer-app, vendor-app)
- Frontend: PO Management page (all apps)
- Frontend: Bulk Order Management page + detail view (company-admin-app, procurement-officer-app,
  vendor-app)
- Frontend: Invoice Management page (company-admin-app, procurement-officer-app,
  financial-officer-app)
- Frontend: Reusable DataTable component in packages/ui-components
- i18n: English translations for all dashboard and management view text
- Sidebar navigation: Add RFQ Management, Purchase Orders, Bulk Orders, Invoices menu items

#### Out of Scope (deferred to respective epics)

- RFQ creation flow (US-3)
- Quote review & approval (US-4)
- PO creation flow (US-5)
- Vendor invitation flow (US-6)
- Material catalogue (US-7)
- Bulk order creation flow (US-8)
- Invoice upload & reconciliation (US-9)
- Dashboard inline actions (Approve/Decline/Reject) — initially navigates to detail page; inline
  mutation added when corresponding CRUD epic is implemented
- Delivery report page (US-11)
- Export to CSV/Excel — deferred to Phase 2 of this epic

---

### Project Structure (new files)

```text
apps/
├── backend/src/
│   ├── modules/
│   │   ├── rfqs/                          # NEW — RFQ module
│   │   │   ├── rfqs.controller.ts         # List + filter endpoints
│   │   │   ├── rfqs.service.ts            # Query logic with quick filters
│   │   │   └── rfqs.module.ts
│   │   ├── purchase-orders/               # NEW — PO module
│   │   │   ├── purchase-orders.controller.ts
│   │   │   ├── purchase-orders.service.ts
│   │   │   └── purchase-orders.module.ts
│   │   ├── bulk-orders/                   # NEW — Bulk Order module
│   │   │   ├── bulk-orders.controller.ts
│   │   │   ├── bulk-orders.service.ts
│   │   │   └── bulk-orders.module.ts
│   │   ├── invoices/                      # NEW — Invoice module
│   │   │   ├── invoices.controller.ts
│   │   │   ├── invoices.service.ts
│   │   │   └── invoices.module.ts
│   │   └── dashboard/                     # NEW — Dashboard aggregation
│   │       ├── dashboard.controller.ts    # Per-role dashboard endpoints
│   │       ├── dashboard.service.ts       # Aggregation logic
│   │       └── dashboard.module.ts
│   └── prisma/
│       └── schema.prisma                  # MODIFIED — add RFQ, PO, BulkOrder, Invoice models
│
├── company-admin-app/src/features/
│   ├── dashboard/                         # MODIFIED — replace stub with full PO/CA dashboard
│   │   ├── pages/DashboardPage.tsx
│   │   ├── ui/
│   │   │   ├── KpiSummaryCards.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── QuoteResponsesSection.tsx
│   │   │   ├── RecentOrdersSection.tsx
│   │   │   ├── PendingPurchaseOrders.tsx
│   │   │   └── InvoicesPendingApproval.tsx
│   │   └── hooks/useDashboardData.ts
│   ├── rfqs/                              # NEW — RFQ management
│   │   ├── pages/RfqListPage.tsx
│   │   └── services/rfqs.service.ts
│   ├── purchase-orders/                   # NEW — PO management
│   │   ├── pages/PurchaseOrderListPage.tsx
│   │   └── services/purchase-orders.service.ts
│   ├── bulk-orders/                       # NEW — Bulk order management
│   │   ├── pages/BulkOrderListPage.tsx
│   │   ├── pages/BulkOrderDetailPage.tsx
│   │   └── services/bulk-orders.service.ts
│   └── invoices/                          # NEW — Invoice management
│       ├── pages/InvoiceListPage.tsx
│       └── services/invoices.service.ts
│
├── vendor-app/src/features/
│   ├── dashboard/                         # MODIFIED — Vendor home dashboard
│   │   ├── pages/DashboardPage.tsx
│   │   ├── ui/
│   │   │   ├── RfqsWaitingSection.tsx
│   │   │   ├── InvoicesSection.tsx
│   │   │   └── ActivePosTable.tsx
│   │   └── hooks/useDashboardData.ts
│   ├── rfqs/                              # NEW
│   ├── purchase-orders/                   # NEW
│   ├── bulk-orders/                       # NEW
│   └── invoices/                          # NEW
│
├── financial-officer-app/src/features/
│   ├── dashboard/                         # MODIFIED — Finance Officer home dashboard
│   │   ├── pages/DashboardPage.tsx
│   │   ├── ui/
│   │   │   ├── InvoiceKpiCards.tsx
│   │   │   ├── InvoicesPendingSection.tsx
│   │   │   └── DisputedInvoicesSection.tsx
│   │   └── hooks/useDashboardData.ts
│   └── invoices/                          # NEW
│
├── procurement-officer-app/src/features/  # Same structure as company-admin-app
│   ├── dashboard/
│   ├── rfqs/
│   ├── purchase-orders/
│   ├── bulk-orders/
│   └── invoices/

packages/
├── shared-types/src/
│   ├── enums/index.ts                     # MODIFIED — add RfqStatus, PoStatus, BulkOrderStatus,
│   │                                      #   InvoiceStatus, PoType
│   ├── dtos/
│   │   ├── rfq.dto.ts                    # NEW — RFQ DTOs
│   │   ├── purchase-order.dto.ts         # NEW — PO DTOs
│   │   ├── bulk-order.dto.ts             # NEW — Bulk Order DTOs
│   │   ├── invoice.dto.ts               # NEW — Invoice DTOs
│   │   └── dashboard.dto.ts             # NEW — Dashboard response DTOs
│   └── schemas/
│       ├── rfq.schema.ts                # NEW — Zod schemas
│       ├── purchase-order.schema.ts     # NEW
│       ├── bulk-order.schema.ts         # NEW
│       └── invoice.schema.ts            # NEW
├── api-client/src/
│   └── endpoints/
│       ├── rfqs.ts                       # NEW
│       ├── purchase-orders.ts            # NEW
│       ├── bulk-orders.ts               # NEW
│       ├── invoices.ts                  # NEW
│       └── dashboard.ts                 # NEW
├── ui-components/src/components/
│   └── DataTable/                         # NEW — reusable table component
│       ├── DataTable.tsx                  # Main component
│       ├── DataTablePagination.tsx        # Pagination controls
│       ├── DataTableFilters.tsx           # Filter panel
│       ├── DataTableQuickFilters.tsx      # Quick filter tabs
│       ├── DataTableSearch.tsx            # Search bar
│       ├── DataTableActions.tsx           # Row action buttons
│       ├── DataTableBulkActions.tsx       # Bulk action bar
│       └── index.ts                       # Barrel export
└── i18n/src/locales/en/
    ├── dashboard.json                     # MODIFIED — add PO/CA, Vendor, FO dashboard keys
    ├── rfqs.json                          # NEW
    ├── purchaseOrders.json               # NEW
    ├── bulkOrders.json                   # NEW
    └── invoices.json                     # MODIFIED — add management view keys
```

---

### Verification Criteria

#### Independent Test (from spec)

Log in as each role (PO/CA, Vendor, Finance Officer), verify the home dashboard renders all sections
with correct data, navigate to each management page (RFQ, PO, Bulk Order, Invoice), and verify
tables, filters, and actions work.

#### Step-by-Step Verification

1. **Start services**: `docker compose -f docker-compose.dev.yml up -d && pnpm dev`
2. **Seed data**: Ensure seed includes RFQs, POs, Bulk Orders, and Invoices in various statuses
3. **PO/CA Dashboard** (login as CompanyAdmin at `http://localhost:3002`):
   - Verify 4 KPI summary cards (RFQs, POs, Quotes, Invoices with pending/overdue counts)
   - Verify 4 quick action buttons in single row (Create PO, Create RFQ, Add vendor, Upload invoice)
   - Verify Quote Responses section with All/Pending/Acknowledged tabs, Decline/Approve only on
     Pending
   - Verify Recent Orders shows RFQ, PO, and Bulk Order cards
   - Verify Purchase Orders section shows pending POs with Decline/Approve
   - Verify Invoices Pending Approval shows invoice cards with Reject/Approve
4. **Vendor Dashboard** (login as Vendor at `http://localhost:3004`):
   - Verify RFQs Waiting section shows RFQ cards with Response button
   - Verify Invoices section shows invoice cards with status badges
   - Verify Active POs table shows PO rows with columns per Figma
5. **Finance Officer Dashboard** (login as FinancialOfficer at `http://localhost:3003`):
   - Verify Upload Invoice button renders
   - Verify 3 KPI cards (Total Pending, Due This Week, Disputed)
   - Verify Invoices Pending Approval section with Reject/Approve
   - Verify Disputed Invoices section
6. **RFQ Management** (navigate to /rfqs in company-admin-app):
   - Verify table with all columns per Figma
   - Verify quick filter tabs (My RFQs, Open, Awaiting, No Quotes, Awarded, Closed)
   - Verify search, sort, pagination (25/page)
7. **PO Management** (navigate to /purchase-orders):
   - Verify table with role-specific columns
   - Verify pagination and sorting
8. **Bulk Order Management** (navigate to /bulk-orders):
   - Verify list with project/vendor filters
   - Open detail view, verify Bulk Details + Line Items table
   - Verify Create Drawdown button
9. **Invoice Management** (navigate to /invoices):
   - Verify table with checkbox selection
   - Select multiple, verify bulk actions bar (Approve all, Export as)
   - Verify individual row actions (Approve, Export)

#### Acceptance Scenarios Coverage

| Scenario                                   | US    | Verification Step |
| ------------------------------------------ | ----- | ----------------- |
| PO/CA sees 4 quick actions                 | 10.01 | Step 3            |
| PO/CA sees quote responses with actions    | 10.01 | Step 3            |
| PO/CA sees recent orders (RFQ, PO, Bulk)   | 10.01 | Step 3            |
| PO/CA sees pending POs with actions        | 10.01 | Step 3            |
| PO/CA sees invoices pending approval       | 10.01 | Step 3            |
| Vendor sees RFQs waiting for quote         | 10.02 | Step 4            |
| Vendor sees invoices with status           | 10.02 | Step 4            |
| Vendor sees Active POs table               | 10.02 | Step 4            |
| FO sees Upload Invoice + 3 KPIs            | 10.03 | Step 5            |
| FO sees pending + disputed invoices        | 10.03 | Step 5            |
| RFQ table with all columns + quick filters | 10.04 | Step 6            |
| PO table with role-specific columns        | 10.05 | Step 7            |
| Bulk Order list + detail + drawdown        | 10.06 | Step 8            |
| Invoice table with checkbox + bulk actions | 10.07 | Step 9            |

---

## Cookie-Based Auth Token Storage (T480–T482)

**Status**: Complete.

**Rationale**: Migrated from in-memory token storage (Zustand + module-level variable) to httpOnly
cookie-based storage for improved security. Tokens are no longer accessible via JavaScript (XSS
protection). Refresh tokens are sent automatically via cookies instead of request body.

### Architecture

- **Backend**: `cookie-parser` middleware; `setAuthCookies()`/`clearAuthCookies()` utility sets
  `jwt` (access) and `jwt_refresh` (refresh) cookies with `httpOnly: true`, `sameSite: 'lax'` (dev)
  / `'none'` (prod), `secure` in production. JWT strategies extract from cookies first, fall back to
  `Authorization: Bearer` header for backward compatibility.
- **Frontend**: Removed `setAccessToken()`/`getAccessToken()` from api-client. Auth interceptor no
  longer injects Bearer headers — cookies sent automatically via `withCredentials: true`. Zustand
  auth store simplified: no `accessToken` in state, only `currentUser` + `isAuthenticated`.
- **Refresh flow**: On 401, interceptor calls `POST /auth/refresh` (cookies auto-attached); backend
  validates refresh token from cookie, issues new cookie pair.
- **Cookie options**: `path: '/'`, `httpOnly: true`, environment-aware `sameSite`/`secure`.

---

## Inline SVG Elimination Refactor (T325)

**Status**: Complete.

**Rationale**: All icons must come from `packages/ui-components/src/assets/icons/` per project
convention. Audit found 12 source files with inline `<svg>` code — in ui-components (SearchInput,
PasswordInput, Checkbox, CustomDropdown, FilterPopover, PageHeader, ChangePasswordModal,
CustomToast) and app-level pages (SettingsPage, UserListPage, InvoiceListPage in both company-admin
and financial-officer apps). InvoiceListPage had 5 identical icon components duplicated across 2
apps.

### Changes

- **New SVG icon files** (6): `chevron-down.svg`, `chevron-right.svg`, `checkmark.svg`,
  `check-stroke.svg`, `filter.svg`, `users-group.svg` in `packages/ui-components/src/assets/icons/`
- **ui-components** (8 files): Replaced inline SVG with `?react` imports from assets/icons
- **super-admin-app** (2 files): SettingsPage (ChevronRightIcon, UsersIcon), UserListPage
  (expand/collapse chevron) — now import from `@forethread/ui-components/assets/icons/`
- **company-admin-app + financial-officer-app** (2 files): InvoiceListPage — removed 5 duplicated
  inline icon components (EyeIcon, CheckCircleIcon, MoreDotsIcon, FilterIcon, DownloadIcon),
  replaced with shared asset imports

---

# Full Product Backlog Alignment (2026-03-10)

**Trigger**: Product backlog spreadsheet update — all 6 epics with ~80 user stories fully specified
with acceptance criteria. This section documents the implementation plan for Epics 3–6 and expanded
Dashboard stories, aligning the codebase with the complete product backlog.

**Source**:
[Product Backlog Spreadsheet](https://docs.google.com/spreadsheets/d/1HR_tLdxaJz0U3jf3LcVDKVJe3C7j3LeZ02kRxLR0rhM)

---

## Implementation Roadmap (Epics 3–6)

### Priority Order

| Priority | Epic | Feature                                     | Dependencies                         | Status                                                       |
| -------- | ---- | ------------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| P1       | 4    | Material Catalogue                          | None (foundational data)             | Schema only (model + migration)                              |
| P2       | 3    | Vendor Management                           | Epic 1 (users)                       | Backend COMPLETE, Frontend prep done, Frontend pages pending |
| P3       | 5    | Procurement (RFQ, PO, Bulk, Approval)       | Epic 4 (materials), Epic 3 (vendors) | In Progress — schema + PO CRUD done                          |
| P4       | 2+   | Extended Dashboards (2.03, 2.05, 2.08-2.10) | Epic 5 (procurement data)            | Not Started                                                  |
| P5       | 6    | Field Progressive Web App                   | Epic 5 (material requests, POs)      | Not Started                                                  |
| P6       | 1.06 | Approval Configuration                      | Epic 5 (approval scenarios)          | Not Started                                                  |

### What was done (2026-03-18 — FRD alignment sprint)

**Prisma schema aligned to FRD** (all models match data-model.md):

| Model / Change                         | Status      | Notes                                                                                                                                                                     |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Material` + `MaterialCategory` models | **Created** | material.prisma — `id`, `name`, `categoryId`, `uom`, `upc`, `manufacturer`, `description`, `status` (PUBLIC/PENDING_APPROVAL/ARCHIVED), `createdById`                     |
| `PurchaseOrder` — FRD fields added     | **Done**    | `deliveryLocationId` (FK→ProjectLocation), `paymentTermsDays` (Int), `pickUpTimeExpectation` (enum), `pickUpPersonName/Phone`, `deliveryResponsibleName/Email`, `message` |
| `PoLineItem` — `materialId` FK         | **Done**    | `materialId` FK→Material (replaced `materialName` text), `deliveryLocationId` FK→ProjectLocation                                                                          |
| `Rfq` — FRD fields added               | **Done**    | `rfqNumber` (unique), `currency`, `deliveryLocationId` (FK), `needByDate`, `holdForRelease`, `earliestDeliveryDate`, `message`, `approvalStatus` (ApprovalStatus enum)    |
| `RfqVendor` M2M model                  | **Created** | rfq↔vendor invited vendors tracking                                                                                                                                       |
| `RfqLineItem` — FRD fields added       | **Done**    | `materialId` FK→Material (replaced `materialName`), `costCode`, `pickUp`                                                                                                  |

**API contracts aligned to FRD** (contracts/\*.md updated):

| Contract             | Status      | Notes                                                                                                         |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `purchase-orders.md` | **Updated** | All fields match FRD US 5.07, 5.15, US XX. `materialId` in line items. Pick-up fields added.                  |
| `rfq.md`             | **Updated** | All fields match FRD US 5.05. `materialId`, `costCode`, `pickUp` in line items. `substituteItemId` in quotes. |

**Backend PO endpoints implemented:**

| Endpoint                                       | Status      | Notes                                                                 |
| ---------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| `POST /v1/purchase-orders` (create)            | **Done**    | Validates project, vendor, delivery location. Calculates line totals. |
| `PATCH /v1/purchase-orders/:id` (update draft) | **Done**    | Draft-only check. Replaces line items in transaction.                 |
| `POST /v1/purchase-orders/:id/issue`           | **Done**    | Sets status to SENT, issuedAt timestamp.                              |
| `GET /v1/purchase-orders` (list)               | **Updated** | New field names (deliveryLocationId, paymentTermsDays).               |
| `GET /v1/purchase-orders/:id` (detail)         | **Updated** | Material relation resolved, all new fields returned.                  |
| `POST /v1/purchase-orders/:id/copy`            | **Updated** | Copies all new fields.                                                |

**Shared types / API client updated:**

| Package                      | Status      | Notes                                                                                       |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `shared-types/enums`         | **Updated** | `PickUpTimeExpectation` enum added, `PaymentTerm` enum removed                              |
| `shared-types/dtos`          | **Updated** | `CreatePurchaseOrderDto`, `UpdatePurchaseOrderDto`, `CreatePoLineItemDto` with `materialId` |
| `shared-types/schemas`       | **Updated** | Zod schemas use `z.nativeEnum()` from shared enums                                          |
| `api-client/purchase-orders` | **Updated** | `createPurchaseOrder`, `updatePurchaseOrder`, `issuePurchaseOrder` added                    |

**What is NOT done yet:**

| Item                               | FRD Reference | Notes                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`QuoteLineItem` model~~          | US 3.06       | **DONE** — `QuoteResponseLineItem` model created with all fields (price, qty, availability, delivery, discount, tax, back-order, substitute)                                                                                                                                                                               |
| ~~`QuoteResponse` enrichment~~     | US 3.06       | **DONE** — Added `message`, `bulkShipment`, `bulkTax`, `bulkDiscount`, `bulkDeliveryTime`, `validityPeriod`, `warehouseLocationId`                                                                                                                                                                                         |
| Quote line-level approval tracking | US 5.19       | No model for per-line approval status + `approvedQuantity` per vendor                                                                                                                                                                                                                                                      |
| `PoChangeRequest.status` enum      | US 5.12       | Missing explicit status (Pending/Approved/Rejected) + `message` field                                                                                                                                                                                                                                                      |
| `PoLineItem.pickUp` flag           | US 5.18 AC 4  | Pick-up status not preserved when converting RFQ→PO line items                                                                                                                                                                                                                                                             |
| Material Catalogue backend module  | US 4.01–4.04  | Prisma model exists, but no CRUD service/controller/endpoints yet                                                                                                                                                                                                                                                          |
| Material Catalogue frontend        | US 4.01–4.04  | No UI implementation                                                                                                                                                                                                                                                                                                       |
| ~~Vendor Management module~~       | US 3.01–3.12  | **DONE** — Backend complete: vendor invite (RBAC for CA/PO), profile, warehouses, user invite, messages, quote response, PO accept/decline, bulk order changes, sales reps, email templates. Frontend: vendor list with representatives, edit modal, invite success modal, vendor profile page, vendor-app user management |
| ~~PO frontend (create PO page)~~   | US 5.07       | **DONE** (T770-T807): 3-step wizard in po-shared, wired in 3 apps. Backend confirm (T755) + validate-items (T756) done. Pending: frontend validate-items integration                                                                                                                                                       |
| RFQ frontend (create RFQ page)     | US 5.05       | Backend partially ready, frontend not started (design available)                                                                                                                                                                                                                                                           |
| ~~Review quotes frontend~~         | US 5.06       | Backend QuoteResponseLineItem model + quote-response.service DONE. Frontend page pending                                                                                                                                                                                                                                   |
| Prisma migration                   | —             | Migration SQL drafted but not applied (requires DB connection)                                                                                                                                                                                                                                                             |

---

## Epic 3: Vendor Management (US 3.01–3.12) — BACKEND COMPLETE, FRONTEND IN PROGRESS

### Summary

Vendor management extends the platform with vendor invitation, profile management, RFQ response
workflows, in-app messaging, bulk order change requests, and organizational tools (sales rep
display). This epic touches both the contractor and vendor sides of the platform.

### Prisma Models — Status

| Model                     | Status   | Notes                                                                               |
| ------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `CompanyVendorAssignment` | **DONE** | Existed (Epic 1) — vendor ↔ contractor assignment with categories                   |
| `MessageThread`           | **DONE** | message.prisma — contextType (RFQ/PO/MR/WRR), contextId, participants, messages     |
| `ThreadParticipant`       | **DONE** | message.prisma — userId ↔ threadId (unique)                                         |
| `Message`                 | **DONE** | message.prisma — threadId, senderUserId, content, attachments                       |
| `MessageAttachment`       | **DONE** | message.prisma — messageId, fileId                                                  |
| `QuoteResponseLineItem`   | **DONE** | rfq.prisma — unitPrice, qty, availability, delivery, discount, tax, back-order, sub |
| `WarehouseLocation`       | **DONE** | company.prisma — companyId, name, city, postcode, address                           |
| `BulkOrderChangeRequest`  | **DONE** | bulk-order.prisma — changes (JSON), status, message, reason, versioning             |
| `BulkOrder.version`       | **DONE** | Added version Int @default(1) to BulkOrder                                          |
| `VendorTag`               | Deferred | Not in scope for current release                                                    |
| `VendorRating`            | Deferred | Not in scope for current release                                                    |

### Backend Modules — Status

| Module / Service             | Status   | Endpoints                                                     |
| ---------------------------- | -------- | ------------------------------------------------------------- |
| **vendors/** invite          | **DONE** | POST /vendors/invite, GET /vendors                            |
| **vendors/** profile         | **DONE** | GET/PATCH /vendors/:id/profile                                |
| **vendors/** warehouses      | **DONE** | POST/PATCH/DELETE /vendors/:id/warehouses/:whId               |
| **vendors/** user invite     | **DONE** | POST /vendors/:companyId/users/invite, resend, cancel         |
| **vendors/** representatives | **DONE** | GET /vendors/:id/representatives                              |
| **messages/**                | **DONE** | POST/GET threads, GET/POST messages                           |
| **rfqs/** quote response     | **DONE** | POST/PATCH/GET /rfqs/:rfqId/quotes/:quoteId                   |
| **purchase-orders/** vendor  | **DONE** | PATCH accept, PATCH vendor-decline                            |
| **bulk-orders/** changes     | **DONE** | POST/GET change-requests, approve/reject, cancel              |
| **notifications/** emails    | **DONE** | sendRfqReceivedEmail, sendPoIssuedEmail (templates + service) |

### Frontend Work — Status

| Component                            | Status          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vendor list page + invitation modals | **DONE**        | packages/vendor-shared — VendorListPage, InviteVendor. RBAC: CA/PO can create vendor companies. List returns 1 row/company with representatives[]. Edit User Details modal for reps. Success modal matches user mgmt (560px, countdown). Dot menu: Reset/Cancel for INVITED, Archive for ACTIVE (T860-T861)                                                                                                                                                                                                                                        |
| Vendor profile page                  | **DONE**        | packages/vendor-shared — VendorProfilePage (company info, warehouses, reps). Vendor-app user management: invite users, user list (T363)                                                                                                                                                                                                                                                                                                                                                                                                            |
| Vendor contact popover (sales reps)  | **DONE**        | packages/rfq-shared — VendorContactPopover                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Vendor routes in admin + procurement | **DONE**        | /vendors, /vendors/new, /vendors/:id in CA + PO apps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Shared types (enums, DTOs)           | **DONE**        | MessageContextType, QuoteLineItem\*, BulkOrderCR enums                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| API client endpoints                 | **DONE**        | messages, vendors profile/warehouses/reps/user-invite,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|                                      |                 | rfqs quotes, bulk-orders changes, PO accept/decline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| i18n translations                    | **DONE**        | messages.json, vendors.json, bulkOrders.json extended                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Messaging UI pages                   | **IN PROGRESS** | PO Messages tab DONE in vendor-app (T906): real API integration with createThread/getMessages/sendMessage, date separators, avatar/name/time, read-only for closed POs, auto-scroll, 15s refetch. **REMAINING**: thread list page (centralized view), messaging in CA/PO apps, RFQ/MR/WRR context types, file attachment upload in messages                                                                                                                                                                                                        |
| Vendor RFQ response form             | **DONE**        | vendor-app — bulk fields, per-line items, back-order, discount % / $, material detail page, add warehouse modal, guest invitation page, Figma design alignment, frontend validation, quote-submitted email notification, **quote attachment persistence** (QuoteAttachment model), **edit existing response** (pre-populate form from submitted quote, updateQuote mutation, edit-aware UI) (T362, T889, T890, T894, T895, T896, T897) — all US-3.06 acceptance criteria met                                                                       |
| Vendor profile edit page             | **IN PROGRESS** | vendor-app — company info, warehouses done. RepresentativesSection rewritten with add/remove drafts + validation (T905). **NOT WORKING**: add/remove reps not saved to backend (POST/DELETE endpoints missing per T880), specialisation multi-select not wired                                                                                                                                                                                                                                                                                     |
| PO receiving actions UI              | **DONE**        | vendor-app — acknowledge, approve (with payment terms + warehouse), decline (reason modal), change request (propose + history + standalone page), action log tab, alert banner, status-based visibility, Documents tab (Related + Attached per Figma), PoDetailsTab 2-column Figma layout, PoLineItemsTab readOnly for vendor. Backend: vendor RBAC for document upload/delete, storage exists check. Frontend: T364, T673, T674, T903, T904. Messages tab now DONE (T906 — real API). **NOT WORKING**: vendor tokenized PO page (not implemented) |
| Vendor user invitation UI            | **PENDING**     | vendor-app — invite/resend/cancel users                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Bulk order change request UI         | **PENDING**     | All apps — propose, review, approve/reject, cancel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Tests — 65 suites, 1129 tests (all green)

New test files:

- `messages/__tests__/messages.service.spec.ts` (8 tests)
- `rfqs/__tests__/quote-response.service.spec.ts` (35 tests)
- `vendors/__tests__/vendor-user-invite.service.spec.ts` (10 tests)
- `bulk-orders/__tests__/bulk-order-change.service.spec.ts` (23 tests)
- Updated: email-templates, rfqs.controller, bulk-orders.controller, vendors.controller,
  vendors.service, po-status specs

### Key Technical Decisions

1. **In-app messaging (US 3.03)**: REST API with thread-per-document model; participant-only access;
   read-only after document closed. WebSocket upgrade deferred to post-MVP.
2. **Sales reps (US 3.12)**: Reuses existing User model (VENDOR role users) — no separate
   SalesRepresentative model needed. Endpoint returns company users.
3. **Bulk order changes (US 5.20)**: JSON-based change proposals with version tracking; approve
   applies changes atomically; cancel rejects all pending proposals.

---

## Epic 4: Material Catalogue (US 4.01–4.07)

### Summary

The material catalogue is the data backbone for all procurement documents. It supports public and
private catalogues, bulk import via file upload with column mapping, smart search, favourites/lists,
aggregated products, price history, and inventory availability indicators.

### New Prisma Models Required

- `Material` — id, name, category, unit, manufacturer, UPC, description, type (Standard,
  Aggregated), status (Active, Archived, Pending), createdByCompanyId, isPublic
- `MaterialComponent` — for aggregated products: materialId, componentMaterialId, quantity
- `MaterialList` — user-created lists: name, userId, companyId
- `MaterialListItem` — materialId, listId
- `MaterialFavourite` — userId, materialId
- `MaterialPriceHistory` — materialId, quoteResponseLineItemId, price, date (auto-populated from
  quotes)
- `BOM` — projectId, version, status (Active, Historical), createdByUserId
- `BOMLineItem` — bomId, materialId, originalDescription, quantity, unit, matchConfidence

### New Backend Modules

- `apps/backend/src/modules/materials/` — Material CRUD, bulk import, search, favourites, lists
- `apps/backend/src/modules/bom/` — BOM upload, parsing, material matching
- Expand existing modules to reference Material entity

### Frontend Work

- **company-admin-app + procurement-officer-app**: Material catalogue pages (list, detail, import,
  search), BOM management, aggregated product creation
- **super-admin-app**: Public catalogue management (approve/reject suggestions)
- **All apps**: Material search component (reusable, used in RFQ/PO/material request creation)

### Key Technical Decisions

1. **File upload parsing (US 4.02)**: Backend service processes XLS/XLSX/CSV; returns column
   suggestions; frontend shows column-mapping step
2. **Smart search (US 4.04)**: PostgreSQL full-text search with trigram index; suggestions include
   recently used, frequently used, BOM materials
3. **Aggregated products (US 4.05)**: Stored as a Material with type=Aggregated; components stored
   in MaterialComponent join table; treated as single line item in all documents

---

## Epic 5: Procurement Workflows (US 5.01–5.24)

### Summary

The core procurement workflow: RFQ creation (from BOM, manual, file, material request), vendor quote
review and approval (line-item level, multi-vendor allocation), PO creation (from RFQ, bulk
drawdown, manual, material request), PO splitting (multi-vendor/project/location), change requests
(commercial + internal), bulk order management, warehouse release requests, and approval scenarios.

### New Prisma Models Required

- `RfqVendor` — invited vendors per RFQ
- `POLineItem` — PO line items with material, quantity, price, delivery location, cost code
- `POChangeRequest` — commercial/internal changes with status, before/after values
- `POVersion` — versioned PO snapshots
- `ParentPO` — parent-child relationship for split POs
- `WarehouseReleaseRequest` — request from office/field to warehouse
- `WarehouseReleaseLineItem` — line items with quantity, material, availability status
- `WarehouseReleaseChangeRequest` — change requests for warehouse releases
- `ApprovalScenario` — configurable approval workflows per company
- `ApprovalRequest` — individual approval instances linked to documents
- `BulkOrderVersion` — versioned bulk agreement snapshots
- Expand `QuoteResponseLineItem` with: substitute material, back-order qty, back-order date

### New/Expanded Backend Modules

- Expand `apps/backend/src/modules/rfqs/` — full RFQ CRUD, send to vendors, warehouse/bulk check
- Expand `apps/backend/src/modules/purchase-orders/` — full PO CRUD, splitting, change requests
- Expand `apps/backend/src/modules/bulk-orders/` — change proposals, versioning, cancellation
- `apps/backend/src/modules/warehouse-releases/` — warehouse release request CRUD
- `apps/backend/src/modules/approvals/` — approval engine (scenarios, requests, routing)

### Frontend Work

- **company-admin-app + procurement-officer-app**: RFQ creation wizard, quote comparison view, PO
  creation wizard, bulk order management, warehouse release request management
- **vendor-app**: Quote response form, PO receiving/acknowledge/approve/decline + change requests
  (DONE), bulk order change review
- **warehouse-officer-app**: Warehouse release acceptance, stock reservation

### Key Technical Decisions

1. **PO Splitting (US 5.11)**: When a multi-vendor/project/location PO is submitted, the backend
   creates a parent PO (informational) and child POs (operational); each child follows standard
   lifecycle independently
2. **Approval engine (US 5.10)**: Generic approval service that accepts document type + ID; routes
   to configured approvers; supports approve/reject/request-changes
3. **Warehouse availability check (US 5.05, 5.07)**: Real-time stock check against warehouse
   inventory + bulk order remaining quantities; suggestions shown in RFQ and PO creation flows

---

## Epic 6: Field Progressive Web App (US 6.01–6.15)

### Summary

Mobile-first progressive web app for field workers (Foremen, Warehouse Officers). Covers material
request creation (with file/photo/handwriting upload), in-app notepad, delivery report submission
(with GPS, photos, offline support), damaged item flagging, invoice upload during delivery, internal
material transfer confirmation, and warehouse release acceptance.

### New Prisma Models Required

- `MaterialRequest` — projectId, status, priority, requestedByUserId, needByDate
- `MaterialRequestLineItem` — materialId (optional), freeFormName, quantity, unit
- `DeliveryReport` — purchaseOrderId, submittedByUserId, gpsLatitude, gpsLongitude, submittedAt,
  editableUntil
- `DeliveryReportLineItem` — poLineItemId, deliveredQty, outcome (Delivered, Partial, NotDelivered,
  Rejected), disposition (Returned, Accepted), comments
- `DeliveryReportPhoto` — deliveryReportLineItemId, fileId
- `Note` — userId, title, content, status (Active, Archived), lastUpdatedAt
- `MaterialTransfer` — sourceWarehouseId, destinationLocationId, warehouseReleaseRequestId, status
- `InventoryEntry` — locationId, materialId, quantity, lastUpdatedAt

### New Backend Modules

- `apps/backend/src/modules/material-requests/` — material request CRUD, bulk/warehouse suggestions
- `apps/backend/src/modules/delivery-reports/` — delivery report submission, GPS capture, edit
  window
- `apps/backend/src/modules/notes/` — in-app notepad CRUD, note-to-request conversion
- `apps/backend/src/modules/inventory/` — inventory tracking, stock updates from deliveries
- `apps/backend/src/modules/material-transfers/` — internal transfer confirmation

### Frontend Work

- **warehouse-officer-app**: Warehouse dashboard, release request acceptance, inventory view,
  delivery report, material transfer confirmation
- **All mobile apps (foreman-app — NEW)**: Material request creation, notepad, delivery reports, GPS
  capture, offline support
- **company-admin-app**: Material request dashboard view

### Key Technical Decisions

1. **Offline support (US 6.01, 6.08, 6.12)**: Service worker + IndexedDB for local storage;
   background sync when connectivity restored; conflict resolution via server timestamps
2. **OCR for handwriting (US 6.03)**: Separate OCR engine (external service) for handwritten text;
   results reviewed by user before submission
3. **GPS capture (US 6.11)**: Browser Geolocation API; captured on delivery report submission;
   stored as lat/lng in DeliveryReport model
4. **Edit window (US 6.12)**: 15-minute default; `editableUntil` timestamp stored on delivery
   report; backend rejects edits after window expires

---

## Extended Dashboard Stories

### New Dashboard Views Required

| Story   | Dashboard                            | Role                | Status                             |
| ------- | ------------------------------------ | ------------------- | ---------------------------------- |
| US 2.03 | Foreman Dashboard                    | Foreman             | Not Started — requires foreman-app |
| US 2.05 | Warehouse Dashboard                  | Warehouse Officer   | Not Started                        |
| US 2.08 | Material Request & Warehouse Release | WO, Foreman, PO, CA | Not Started                        |
| US 2.09 | Deliveries Management                | All roles           | Not Started                        |
| US 2.10 | Financial Dashboard (expanded)       | Finance Officer     | Not Started                        |

These dashboards depend on the procurement entities from Epics 3–5 being fully implemented.

### Backend Changes

- Add `GET /v1/dashboard/warehouse` endpoint for Warehouse Officer dashboard
- Add `GET /v1/dashboard/foreman` endpoint for Foreman mobile dashboard
- Expand `GET /v1/dashboard/finance` with per-project budget tracking, invoice grouping
- Add `GET /v1/material-requests` list endpoint with filtering
- Add `GET /v1/warehouse-releases` list endpoint with filtering
- Add `GET /v1/deliveries` list endpoint with filtering

---

## Cross-Cutting Features

### US 1.11: Work Status Display

- Add `workStatus` field to User model (already exists in Prisma: `work_status VARCHAR(50)`)
- Show work status indicator next to user names in all views across the platform
- Add profile preview popup on user name click (name, position, email, work status)
- Company-scoped visibility (users can only see status of users within their own company)

### US 1.06: Approval Configuration (Post-Release 1 → NOW IN SCOPE)

- `ApprovalScenario` model: company, scenario type, trigger condition, approvers, status
- Company Admin configures which actions require approval
- Default: all scenarios disabled; Company Admin is fallback approver
- RBAC overrides: allow/restrict specific actions per role
- Changes take effect immediately for all new actions

---

## Prisma Schema Evolution Strategy

All new models will be added incrementally per epic. Each epic's Phase 2 (schema) produces one
migration. Cross-references between epics (e.g., Material referenced by RFQ line items) are handled
via nullable foreign keys that become required when both epics are complete.

### Migration Order

1. `add-material-catalogue` — Material, MaterialComponent, MaterialList, BOM, BOMLineItem
2. `add-vendor-management` — VendorTag, Message, WarehouseLocation, QuoteResponseLineItem expansion
3. `add-procurement-workflows` — POLineItem, POChangeRequest, RfqVendor, WarehouseRelease,
   ApprovalScenario, ApprovalRequest
4. `add-field-operations` — MaterialRequest, DeliveryReport, Note, InventoryEntry, MaterialTransfer

---

### Dashboard & List Pages Figma Alignment Round 3 (US-10.01, T508–T519)

**Status**: COMPLETE

**Rationale**: Dashboard and list pages across all 7 apps did not match Figma designs — duplicate
page titles (in both AppLayout header and page content), broken inline three-dot menus (clipped by
overflow), missing back buttons, wrong column structures in BulkOrders/RFQ/PO pages, hardcoded
Tailwind colors instead of CSS variables, and duplicated status color maps + formatters in every
page.

**Architecture decisions**:

- **Shared status color constants**: `RFQ_STATUS_COLORS`, `PO_STATUS_COLORS`,
  `BULK_ORDER_STATUS_COLORS`, `INVOICE_STATUS_COLORS`, `ORDER_STATUS_COLORS` + `getStatusColor()`
  utility in `packages/ui-components/src/utils/status-colors.ts`. All apps import from shared
  package instead of defining local duplicates. Uses CSS custom properties (`--badge-blue`,
  `--badge-teal`, `--badge-orange`, `--success`, `--destructive`) for consistent theming.
- **Shared formatters**: `formatCurrency()`, `formatDate()`, `formatStatus()` in
  `packages/ui-components/src/utils/formatters.ts`. Replaces ~15 local inline function definitions.
- **AppLayout as single source of truth**: `usePageInfo()` hook in each app's `AppLayout.tsx`
  provides title, subtitle, and back button for every route. Pages no longer render their own
  headers.
- **DotActionsMenu everywhere**: All inline three-dot menu implementations replaced with shared
  `DotActionsMenu` component (proper z-index, click-outside, Escape key, mobile bottom sheet).
- **MessageBadgeIcon reuse**: Inline flag+badge-dot patterns replaced with shared component.
- **New shared components**: DashboardItemCard, DashboardSection, CreateViewModal,
  TableManagementModal, DatePicker, FilterPanel, SelectDropdown, MessageBadgeIcon.
- **16 new SVG icons** added to `packages/ui-components/src/assets/icons/`.
- **SortIcon refactored** to use dedicated sort-asc/sort-desc/sort-unsorted SVG icons.
- **InfoHint component** (`packages/ui-components/src/components/InfoHint.tsx`): Shared tooltip-like
  hint with icon + text. Replaces duplicated InfoIcon+noSavedViews pattern in CA/PO RfqListPage.
  Props: `icon` (ReactNode), `children`, `className` for color/width overrides.

### FilterChip Component & Theme Refinements (US-10.04, T523–T525)

**Status**: COMPLETE

**Rationale**: Quick filter pills in DataTableQuickFilters used inline Tailwind classes with
`bg-foreground text-background` for the active state, which didn't match Figma (gray pill, not
inverted). Border color across all apps was `222 12% 84%` (#D2D5DB) instead of Figma's `0 0% 90%`
(#E5E5E5). Extracted FilterChip as a shared component with proper theming.

**Architecture decisions**:

- **FilterChip** (`packages/ui-components/src/components/FilterChip.tsx`): Shared pill button with
  `active` prop. Uses `--filter-chip` / `--filter-chip-foreground` CSS variables for active state.
  Rounded-xl with border, matching Figma quick filter design.
- **CSS variable `--filter-chip`**: Added to all 6 app `globals.css` files (light: gray #6E6E6E,
  dark: gray-500 #717182). Registered in `packages/config/tailwind/preset.ts` as
  `filter-chip.DEFAULT` and `filter-chip.foreground`.
- **Border color fix**: `--border` and `--input` changed from `222 12% 84%` to `0 0% 90%` across all
  apps to match Figma #E5E5E5.
- **Removed unused CSS vars**: `--table-drag-bg` and `--table-drag-overlay` removed (were always
  transparent, never referenced).

### RFQ Table Zustand Store & View Switcher (US-10.04, T526–T530)

**Status**: COMPLETE

**Rationale**: RfqListPage had 17+ `useState` calls making the component hard to maintain. View
dropdown showed a 400px InfoHint instead of a compact list. Archive button was disabled instead of
hidden. Dropdown/DatePicker active states didn't match Figma.

**Architecture decisions**:

- **Zustand store factory** (`createRfqTableStore(defaultColumns)`): Encapsulates all table state
  (page, pageSize, search, sort, filters, groupBy, columnOrder, visibleColumns, savedViews,
  activeViewId, UI panel toggles, copy RFQ modal). Created in
  `apps/*/src/features/rfqs/state/rfq-table.store.ts`. Factory pattern allows reuse across CA and PO
  apps with different default columns.
- **View switcher**: Dropdown shows "Default view" + saved views when savedViews.length > 0.
  InfoHint tooltip shows only when no saved views exist. Active view tracked via `activeViewId`.
  Button text updates to show active view name. No "+ Create new view" in dropdown (separate
  button).
- **Archive action conditional render**: Uses spread with ternary
  `...(rfq.status === 'CLOSED' ? [archiveAction] : [])` instead of `disabled` prop. Hidden when
  status is not CLOSED.
- **Dropdown/DatePicker active state**: Trigger button uses `border-foreground/50 bg-muted` when
  open (theme variables, not hardcoded colors). Applied to CustomDropdown, DatePicker,
  SelectDropdown.

### Visual Grouping & Saved Views Persistence (US-10.04, T532, T537, T538)

**Status**: COMPLETE

**Rationale**: Grouping button existed but had no visual accordion effect. Saved views were only
in-memory (Zustand) with no backend persistence. RFQ detail page needed for AC compliance.

**Architecture decisions**:

- **Grouping accordion** (`useGroupedRfqs` hook in RfqListPage): Client-side grouping by
  project/status/vendor using `GROUP_FIELD_MAP`. Renders accordion headers with `ChevronRightIcon`
  (rotate-90 on expand), item count, click-to-toggle. Auto-expands all groups when groupBy changes.
  Group button uses `bg-filter-chip` instead of `bg-foreground` per Figma.
- **Saved views backend** (`UserTableView` Prisma model): Stores `visibleColumns[]`,
  `columnOrder[]`, `sortBy`, `sortDir`, `quickFilter`, `groupBy` per user+table. CRUD via
  `ViewsModule` (controller + service). API client in `packages/api-client/src/endpoints/views.ts`.
  Migration: `20260311120000_add_user_table_views`.
- **`applyView(viewId)`**: Restores all table settings from saved view — columns, sort, filter,
  grouping. `null` resets to defaults. Called from view dropdown instead of `setActiveViewId`.
- **RFQ Detail page** (CA): `RfqDetailPanel` (side panel) + `RfqDetailPage` (fullscreen). Tabs:
  Details, Line Items, Responses (placeholder), Documents (placeholder).

### Remaining US-10.04 Work (T531, T533–T536, T539–T547)

**Status**: IN PROGRESS

**Completed**:

- Backend copy/archive endpoints (T535, T536): `POST /rfqs/:id/copy`, `PATCH /rfqs/:id/archive`
- Backend RfqExportService (T548): CSV/XLSX/PDF via PdfExportService with landscape mode, exceljs
  dep
- Backend advanced filters (T549): status[], projectId[], deliveryLocation[], createdByUserId[],
  date ranges, min approved quotes/vendors in rfqs.service
- Shared types (T550): RfqListQueryDto extended with validation decorators
- Views persistence backend (T551): UserTableView Prisma model, migration, CRUD
  service/controller/module
- Views API client (T552): getViews, createView, updateView, deleteView, deleteAllViews

- Default sort by deadline (T539): Zustand store default sortBy='deadlineRange', sortDir='asc'
- Page sizes 25/50/100 (T541): Updated CA, PO, vendor apps
- Advanced filters frontend (T531): FilterPanel wired to Zustand store, connected to backend params
- Export frontend (T533, T534): CSV/XLSX download with blob response, single RFQ PDF via window.open
- Visual grouping (T532): Collapsible group sections with accordion UI in CA, PO, vendor apps
- RFQ Detail page (T553–T556): CA fullscreen page with tabs, RfqDetailPanel preview, PO shared
  components, page-title store

- PO detail preview (T542): RfqDetailPanel wired in PO app
- Vendor quick filter semantics (T544): VENDOR_QUICK_FILTERS = ['myRfqs', 'incoming',
  'approvedForMe', 'closedRfqs']

**Remaining priority order**:

1. **Vendor grouping restrict** (T543): Allow only groupByStatus for vendor app
2. **Detail tabs** (T545, T546): Responses tab (placeholder → real), Documents upload UI
3. **Backend sort expansion** (T547): Support all ~15 column sort fields (currently 6)

### SA + WH Dashboards Real Data (US-10.SA, US-10.WH, T583–T591)

**Status**: COMPLETE (2026-03-12)

**Problem**: Super Admin dashboard used mock/hardcoded KPI values. Warehouse Officer dashboard was a
stub placeholder. Admin Panel PlatformStateTable used hardcoded mock constants.

**Architecture decisions**:

- **Backend**: Two new endpoints in existing `dashboard.controller.ts` + `dashboard.service.ts`:
  - `GET /dashboard/super-admin` (@Roles SUPER_ADMIN): Parallel Prisma queries via `Promise.all` for
    user counts (total/active/new this week/by role), company counts (total/active/contractors/
    vendors/new), project counts by status, procurement totals (RFQs/POs/bulk orders/invoices), DB
    health ping (`SELECT 1` with `Date.now()` timing)
  - `GET /dashboard/warehouse` (@Roles WAREHOUSE_OFFICER): POs with PENDING_DELIVERY status
    (filterable by company), recently delivered POs, active bulk orders with line item fulfillment
    progress (qty delivered / total qty percentage), KPI counts including overdue deliveries
  - `GET /dashboard/admin-panel` (@Roles SUPER_ADMIN): Real platform component monitoring — checks
    DB connectivity, notification service, storage service, email service, audit service health.
    Returns component statuses with lastSuccessfulRun timestamps.

- **API Client**: New interfaces `SuperAdminDashboard`, `WarehouseDashboard`, `AdminPanelState`,
  `WarehousePoItem`, `WarehouseBulkOrderItem`, `RoleCount` in
  `packages/api-client/src/endpoints/ dashboard.ts`. New fetch functions + path entries.

- **SA Frontend**: `useDashboardData` rewritten to call `getSuperAdminDashboard()`. DashboardPage
  shows real KPI cards (active users, companies, DB ping ms, platform health status based on
  response time), StatCards for projects/RFQs/POs/invoices overview, Users by Role breakdown
  replacing Google Analytics placeholder.

- **WH Frontend**: New `useDashboardData` hook + full DashboardPage rewrite with KpiCard component,
  DeliverySection (pending + recent deliveries with PO cards showing vendor, project, deadline,
  overdue highlighting), BulkOrdersSection with per-line-item progress bars.

- **SA PlatformState refactor**: Extracted `PlatformComponent` type to `platform-state.types.ts`
  with `ComponentStatus` and `ComponentCategory` enums. `usePlatformState` hook refactored to use
  real `getAdminPanelState()` API. Removed ~100 lines of mock PLATFORM_STATE constants.
  PlatformStateTable now uses real data with toggle/reload actions.

- **Stub page cleanup**: All stub pages (Create RFQ, Create PO, Upload Invoice, Create Vendor,
  BulkOrderDetail) simplified — removed inline back buttons in favour of AppLayout header nav.
  BulkOrderDetailPage uses `usePageTitleStore` for dynamic header. AppLayout `usePageInfo` expanded
  to cover PO/invoice/RFQ/vendor/bulk-order detail + create routes in CA, PO, vendor apps.

- **PurchaseOrderListPage rewrite**: CA + PO apps — full DataTable with columns, filters, sorting,
  pagination, status badges, dot actions menu. Matching RFQ list page patterns.

- **Test fixes**: 22 test files fixed — import order lint errors (MemoryRouter after vi.mock
  blocks), PrismaService/ConfigService mock providers in backend specs, unused import removal.

**Key files**:

- Backend: `apps/backend/src/modules/dashboard/dashboard.{service,controller}.ts`
- API client: `packages/api-client/src/endpoints/dashboard.ts`, `paths.ts`
- SA: `apps/super-admin-app/src/features/dashboard/` (hooks, pages, types, constants, ui)
- WH: `apps/warehouse-officer-app/src/features/dashboard/` (hooks, pages)
- CA/PO: `apps/{company-admin,procurement-officer}-app/src/` (layout, pages)
- Vendor: `apps/vendor-app/src/` (pages, layout)

### RFQ Line Item CRUD & BulkOrder UI Refresh (US-10.04, T592–T593)

**Status**: COMPLETE (2026-03-12)

**Problem**: RfqLineItemsTab edit/delete buttons showed "coming soon" toasts instead of real
functionality. BulkOrderDetailPage line items table style was inconsistent with RFQ patterns.
Dashboard sections had minor UI inconsistencies.

**Architecture decisions**:

- **Backend**: Two new endpoints in existing `rfqs.controller.ts` + `rfqs.service.ts`:
  - `PATCH /v1/rfqs/:rfqId/line-items/:lineItemId` — updates materialName, quantity, unit,
    description fields with company access check
  - `DELETE /v1/rfqs/:rfqId/line-items/:lineItemId` — deletes line item with company access check
  - Both restricted to COMPANY_ADMIN and PROCUREMENT_OFFICER roles

- **API Client**: `UpdateLineItemPayload` interface, `updateLineItem()` and `deleteLineItem()`
  functions in `packages/api-client/src/endpoints/rfqs.ts`. New `lineItem(rfqId, lineItemId)` path
  helper in `paths.ts`.

- **EditLineItemModal**: New modal component for editing RFQ line items — material name, quantity,
  unit, description fields. Uses TanStack Query mutation with cache invalidation.

- **RfqLineItemsTab**: Wired edit button → EditLineItemModal, delete button → confirmation dialog
  with real API call. Actions column only shown in page layout (not panel preview). Tests updated to
  cover new behaviour.

- **BulkOrderDetailPage** (CA + PO): Line items table restyled to match RFQ pattern — rounded
  borders, edit icon header, coming-soon toasts for future edit/delete. `setTitle(data.projectName)`
  instead of `data.bulkId`.

- **Dashboard sections** (CA + PO): Minor fixes in PendingPurchaseOrders, QuoteResponsesSection,
  RecentOrdersSection, DashboardSection.

**Key files**:

- Backend: `apps/backend/src/modules/rfqs/rfqs.{service,controller}.ts`
- API client: `packages/api-client/src/endpoints/rfqs.ts`, `paths.ts`
- CA: `apps/company-admin-app/src/features/rfqs/components/` (EditLineItemModal, RfqLineItemsTab)
- CA/PO: `apps/{company-admin,procurement-officer}-app/src/features/bulk-orders/pages/`
- CA/PO: `apps/{company-admin,procurement-officer}-app/src/features/dashboard/ui/`
- i18n: `packages/i18n/src/locales/en/rfqs.json`

### RFQ Responses Tab Real Implementation (US-10.04, T594)

**Status**: COMPLETE (2026-03-12)

**Problem**: RfqResponsesTab was a placeholder showing "coming soon". Needed full implementation
with filter tabs, approve/decline actions, and vendor quote details.

**Architecture decisions**:

- **RfqResponsesTab** (rfq-shared): Receives `rfqId` + `quoteResponses` as props (data already in
  RFQ detail response). Filter tabs (All/Approved/Declined) with counts. List view shows vendor
  cards with cost, discount, coverage, delivery info. Table view (placeholder). Approve/decline via
  TanStack Query mutations calling existing `approveQuote`/`declineQuote` API client functions.

- **Backend**: `rfqs.service.ts` extended to return `discountPercent`, `discountAmount`,
  `itemsCovered`, `totalItems` fields from `QuoteResponse` model in getRfq detail.

- **API Client**: `RfqDetail` interface extended with new quote response fields.

- **Dashboard navigation**: QuoteResponsesSection card clicks now navigate with `?tab=responses`
  query param to auto-open the Responses tab on the RFQ detail page.

**Key files**:

- Shared: `packages/rfq-shared/src/components/RfqResponsesTab.tsx`
- Backend: `apps/backend/src/modules/rfqs/rfqs.service.ts`
- API client: `packages/api-client/src/endpoints/rfqs.ts`
- CA/PO:
  `apps/{company-admin,procurement-officer}-app/src/features/rfqs/components/RfqDetailPanel.tsx`
- CA: `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.tsx`
- Dashboard:
  `apps/{company-admin,procurement-officer}-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`
- i18n: `packages/i18n/src/locales/en/rfqs.json`

### Bulk Order Shared Package Extraction (US-10.06, T637)

**Status**: COMPLETE (2026-03-16)

**Problem**: BulkOrderListPage and BulkOrderDetailPage were duplicated across company-admin-app,
procurement-officer-app, and vendor-app (like RFQ and Invoice before shared extraction).

**Architecture decisions**:

- **@forethread/bulk-order-shared**: New workspace package following rfq-shared / invoice-shared
  pattern. Exports shared components (BulkOrderListPage, BulkOrderDetailPage, BulkOrderTable,
  BulkOrderToolbar, BulkOrderLineItemsTable, DetailField), hooks (useBulkOrderSort,
  useBulkOrderListState, useFilterOptions), constants (COLUMNS, PAGE_SIZE_OPTIONS), and services
  (useBulkOrders, useBulkOrder). Role-specific behavior via `useFilterOptions` hook variants
  (useProjectFilterOptions, useVendorFilterOptions, useContractorFilterOptions).

- **FilterDropdownButton**: New UI component in @forethread/ui-components — styled dropdown button
  that triggers FilterPopover with search and clear capabilities. FilterPopover extended with
  `searchable`, `searchPlaceholder`, `popoverTitle`, `clearLabel` props.

- **i18n labels**: Updated to match Figma designs — colons on detail field labels, "Utilization,%"
  instead of "Deliveries %", "Item/Material" instead of "Item Reference".

**Key files**:

- Shared: `packages/bulk-order-shared/src/` (components, hooks, constants, services)
- UI: `packages/ui-components/src/components/FilterDropdownButton.tsx`, `FilterPopover.tsx`
- Apps: `apps/{company-admin,procurement-officer,vendor}-app/src/features/bulk-orders/`
- i18n: `packages/i18n/src/locales/en/bulkOrders.json`

### Bulk Order CRUD + Drawdown Modals (US-10.06, T638)

**Status**: COMPLETE (2026-03-16)

**Problem**: All bulk order action buttons (Create new, Drawdown, Change, Edit, Edit line item)
showed "coming soon" notifications. Backend had only GET endpoints (list + detail).

**Architecture decisions**:

- **Backend CRUD**: 6 new endpoints in bulk-orders controller/service — POST create (with nested
  line items), PATCH update (brands/endDate/status with closed-status guard), DELETE, PATCH
  line-items/:id (recalculates totals), POST drawdowns (validates remaining qty, updates utilization
  %). Error messages via i18n errors.json.

- **Shared types**:
  CreateBulkOrderDto/UpdateBulkOrderDto/UpdateBulkOrderLineItemDto/CreateDrawdownDto with
  class-validator decorators. Zod schemas for client-side validation.

- **Mutation hooks**: useCreateBulkOrder, useUpdateBulkOrder, useDeleteBulkOrder,
  useUpdateBulkOrderLineItem, useCreateDrawdown — all invalidate `['bulk-orders']` query cache.

- **5 modals in bulk-order-shared** following RFQ EditLineItemModal/CopyRfqModal patterns:
  CreateBulkOrderModal (project/vendor dropdowns + dynamic line items), EditBulkOrderModal
  (status/brands/endDate), EditLineItemModal (all fields), CreateDrawdownModal (line item selector
  - qty with remaining validation), DeleteBulkOrderModal (confirmation).

- **Navigation integration**: List DotActionsMenu "Drawdown"/"Change" navigate to detail with
  `?action=drawdown`/`?action=edit` query params → auto-open corresponding modal. Vendor app gets
  `readOnly` prop to hide all mutation buttons. `hideCreate` prop hides "Create new" for vendors.

**Key files**:

- Backend: `apps/backend/src/modules/bulk-orders/bulk-orders.{service,controller}.ts`
- Shared types: `packages/shared-types/src/dtos/bulk-order.dto.ts`, `schemas/bulk-order.schema.ts`
- API client: `packages/api-client/src/endpoints/bulk-orders.ts`, `paths.ts`
- Modals: `packages/bulk-order-shared/src/components/{Create,Edit,Delete}BulkOrderModal.tsx`,
  `EditLineItemModal.tsx`, `CreateDrawdownModal.tsx`
- i18n: `packages/i18n/src/locales/en/bulkOrders.json` (modals namespace), `errors.json`

---

## Phase: US-10.06 Completion + US-10.05 PO Dashboard (Epic 2 Continuation)

**Branch**: `feat/bulk-order_1` | **Date**: 2026-03-16 | **Prerequisites**: US-10.06 Bulk Order CRUD
complete (T638), DatePicker enhanced (T639–T640), test coverage >90% (T641)

### Summary

Complete the remaining US-10.06 bulk order items (DrawdownPage, EditBulkOrderPage, list column
enrichment, status filter, consumption tracking) and implement US-10.05 PO Management Dashboard
enhancements (PO detail page, create PO page, vendor PO view alignment). Both user stories are Epic
2 Dashboard scope — they extend existing list pages and backend endpoints with detail/create flows.

### Constitution Check

| #    | Principle                 | Status | Notes                                                                              |
| ---- | ------------------------- | ------ | ---------------------------------------------------------------------------------- |
| I    | Monorepo-First            | PASS   | Work spans existing packages: bulk-order-shared, shared-types, api-client, backend |
| II   | Clean Architecture        | PASS   | Backend endpoints in service layer; controllers delegate only                      |
| III  | Strict Type Safety        | PASS   | DTOs + Zod schemas for all new request/response shapes                             |
| IV   | Security by Design        | PASS   | Role guards on all endpoints; vendor sees only own POs                             |
| V    | Testing Discipline        | PASS   | >90% coverage maintained; new tests for new endpoints/pages                        |
| VI   | Independent Deployability | PASS   | No new apps; existing builds unaffected                                            |
| VII  | Observability             | PASS   | Inherited from global setup                                                        |
| VIII | Shared-Before-Custom      | PASS   | Shared packages (bulk-order-shared, rfq-shared patterns) reused                    |
| IX   | Design Tokens             | PASS   | CSS variables via shared Tailwind preset                                           |
| X    | i18n                      | PASS   | All text via translation keys                                                      |

**Gate result**: PASS. All 10 principles satisfied.

### Technical Context

**Language/Version**: TypeScript 5.x (strict mode) **Primary Dependencies**: NestJS 10.x, React 18,
Vite 5, Prisma 5.x, TanStack Query 5, Zustand 4 **Storage**: PostgreSQL 16 (existing schema —
PurchaseOrder, BulkOrder, BulkOrderLineItem, Drawdown) **Testing**: Jest (backend), Vitest + React
Testing Library (frontend) **Target Platform**: Web (desktop browsers) **Performance Goals**: List
loads < 3s for 1,000 records (SC-004) **Constraints**: Role-based + project-scoped access control on
all endpoints **Scale/Scope**: ~6 new/enhanced pages across 3 apps, ~4 new backend endpoints

### Scope Boundaries

#### In Scope

**US-10.06 Remaining (Bulk Orders)**:

- ~~DrawdownPage form implementation~~ DONE (T644) — line item checkbox selection + qty validation
- ~~EditBulkOrderPage form implementation~~ DONE (T645) — status/brands/endDate fields
- ~~List page column enrichment~~ DONE (T642, T650) — totalQtyOrdered, totalQtyRemaining,
  consumptionPercent
- Status filter dropdown — backend ready (T648), removed from frontend toolbar pending design
- ~~Consumption progress bars~~ DONE (T647, T649) — on detail page line items table
- MessageBadgeIcon wiring to real data (message count per line item) — blocked on messaging backend

**US-10.05 (PO Management Dashboard)**:

- ~~Shared package `@forethread/po-shared`~~ DONE — constants (columns, filters, groups), hooks
  (usePurchaseOrders, usePoExport), stores (createPoTableStore with backend-persisted views)
- ~~Shared toolbar components in `@forethread/ui-components`~~ DONE — GroupByButton,
  ExportDropdownButton, ViewSelectorDropdown, ToolbarSearchToggle, ToolbarIconButton, useDropdown
- ~~PO list page (CA, PO, Vendor)~~ DONE — full spec columns (24 CA/PO, 19 Vendor), sort, drag-drop
  column reorder, column hide/show, saved views, group by, quick filters, advanced filters, search,
  export CSV/XLSX, pagination
- ~~Vendor PO view alignment~~ DONE — vendor-specific column set (no createdBy, lastModifiedBy,
  approvalStatus, approvedBy per spec)
- ~~PO export (CSV/XLSX)~~ DONE — usePoExport hook + ExportDropdownButton
- ~~PO quick filters wiring~~ DONE — 10 filters CA/PO, 11 Vendor
- ~~PO advanced filters panel~~ DONE — project, vendor, status, type, dates, amount, operational
  state checkboxes
- PO detail page (full implementation replacing "Coming soon" stub) — header, line items table,
  status actions, vendor info, delivery details, tabs (Details, Line Items, Documents, Messages)
- ~~PO create page (full implementation replacing stub)~~ DONE — project selector, vendor selector,
  line items from catalogue/RFQ/bulk order, delivery details, submit as Draft. Duplicate header
  removed (already in AppLayout), full-width layout per Figma.
- ~~PO/RFQ "Create new" dropdown menus~~ DONE — PO list + RFQ list pages show role-specific dropdown
  (PO: Create manually / Converting Approved RFQ / From Bulk order; RFQ: Create manually /
  Converting a project BOM / From material list). Dashboard QuickActions also use dropdowns.
- ~~PO line items tab empty state~~ DONE — hide table when no items, show "No line items yet"
- ~~PO creation shared extraction~~ DONE — Stepper, PoBasicInfoStep, PoCreateLineItemsStep,
  PoReviewStep, formSchema moved from per-app copies into `@forethread/po-shared`. All 3 apps now
  import from shared package.
- ~~PO comms page~~ DONE — PoCommsPage with Messages/LineItems/Attachments tabs in po-shared, routes
  added for all 3 apps at /purchase-orders/:id/comms.
- ~~StatusErrorModal/StatusSuccessModal~~ DONE — extracted to `@forethrough/ui-components`.
- ~~PO creation wizard refactor~~ DONE — extracted `usePoWizardForm`, `useMaterialSearch`,
  `usePoDropdownOptions` hooks, `LineItemRow` / `LineItemsTableHeader` components, `line-items.ts`
  constants, `format.ts` utils from monolithic CreatePoWizard and PoCreateLineItemsStep. Added
  `borderless` DatePicker prop, `editable` CustomDropdown prop. PO list page responsive layout.
- ~~Coverage modals~~ DONE — BulkOrderCoverageModal and RfqCoverageModal show per-material coverage
  (bulk order remaining qty/pricing, approved RFQ quotes/prices). Info icons in line item table
  cells open coverage modals. Dismissible "Approved RFQ alert" banner links to ApprovedQuotesModal.

#### Out of Scope (deferred)

- PO change request/change order workflow (US-15 — separate epic)
- PO approval engine integration (FR-009 deferred)
- Vendor tokenized PO access (public route, no auth — Epic 4)
- PO versioning (v2, v3 on change order approval — US-15)
- Internal comment/messaging thread on PO (Epic 4)
- Hold-for-release PO flow (Epic 4)

### Key Design Decisions

#### 1. PO Detail Page Structure

**Decision**: Created `@forethread/po-shared` package (mirroring `rfq-shared`). Extracted shared
toolbar components (GroupByButton, ExportDropdownButton, ViewSelectorDropdown, ToolbarSearchToggle)
into `@forethread/ui-components` for reuse across both RFQ and PO dashboards.

**Recommendation**: Start with per-app implementation in CA and PO apps. Extract to `po-shared` only
if vendor app needs the same detail page structure. The RFQ shared package was justified by 3+ apps
needing identical views — POs may not reach that threshold yet.

**PO Detail Tabs**:

- **Details**: PO metadata (project, vendor, status, dates, delivery info, created by)
- **Line Items**: Table with material name, qty, UOM, unit price, total, cost code
- **Documents**: Attached files (follow RfqDocumentsTab pattern)
- **Messages**: Placeholder for future comment thread (Epic 4)

#### 2. PO Create Page Form

**Decision**: React Hook Form + Zod validation (same as CreateProjectPage pattern).

**Form sections**:

1. Project selector (CustomDropdown with company projects)
2. Vendor selector (CustomDropdown filtered by project's vendor assignments)
3. Delivery details (location from project locations, expected delivery date via DatePicker, pick-up
   toggle)
4. Line items table (add from catalogue search, manual entry, or pre-populate from RFQ/bulk order)
5. Summary (total amount auto-calculated)

**Source data**: If `?sourceQuoteId=` or `?sourceBulkOrderId=` query params present, pre-populate
line items from the source. Otherwise start blank.

#### 3. Drawdown Page Form

**Decision**: Full-page form (not modal — consistent with EditBulkOrderPage navigation).

**Form fields**:

- Read-only bulk order metadata header
- Line items table with checkboxes (select which items to draw down)
- Quantity input per selected item (validated against remaining quantity)
- Delivery details (location, expected date)
- Creates a PO with `type: BULK_DRAWDOWN` and `sourceBulkOrderId`

#### 4. Backend Endpoints Needed

**New endpoints**:

- `POST /v1/purchase-orders` — create PO (contract exists, implementation needed)
- `PATCH /v1/purchase-orders/:id` — update draft PO
- `POST /v1/purchase-orders/:id/issue` — send PO to vendor
- `GET /v1/purchase-orders/export` — CSV/XLSX export (follow invoice pattern)

**Enhanced endpoints**:

- `GET /v1/purchase-orders/:id` — already exists, needs full detail response with line items
- `GET /v1/bulk-orders` — add `status` filter param (Active/Expired/FullyDrawn)
- `GET /v1/bulk-orders/:id` — add computed `remainingQuantity` and `consumptionPercent` per item

### Project Structure (New/Modified Files)

```text
apps/backend/src/modules/purchase-orders/
├── purchase-orders.controller.ts   # MODIFIED — add POST, PATCH, issue, export
├── purchase-orders.service.ts      # MODIFIED — add create, update, issue, export
├── dto/                            # NEW — CreatePoDto, UpdatePoDto if not in shared-types
└── __tests__/
    ├── purchase-orders.controller.spec.ts  # MODIFIED — new endpoint tests
    └── purchase-orders.service.spec.ts     # MODIFIED — new method tests

apps/backend/src/modules/bulk-orders/
├── bulk-orders.controller.ts       # MODIFIED — add status filter
└── bulk-orders.service.ts          # MODIFIED — add status filter, consumption calc

packages/shared-types/src/
├── dtos/purchase-order.dto.ts      # MODIFIED — add CreatePurchaseOrderDto, UpdatePurchaseOrderDto
└── schemas/purchase-order.schema.ts # NEW — Zod schemas for PO forms

packages/api-client/src/endpoints/
├── purchase-orders.ts              # MODIFIED — add createPurchaseOrder, updatePurchaseOrder, issuePo, exportPos
└── bulk-orders.ts                  # MODIFIED — add status filter param

packages/bulk-order-shared/src/components/
├── DrawdownPage.tsx                # MODIFIED — full form implementation
├── EditBulkOrderPage.tsx           # MODIFIED — full form implementation
├── BulkOrderListPage.tsx           # MODIFIED — column enrichment, consumption bars
└── BulkOrderDetailPage.tsx         # MODIFIED — consumption bars, messaging

apps/company-admin-app/src/features/purchase-orders/
├── pages/PurchaseOrderDetailPage.tsx   # MODIFIED — full implementation
├── pages/CreatePurchaseOrderPage.tsx   # MODIFIED — full form
├── pages/PurchaseOrderListPage.tsx     # MODIFIED — quick filter wiring, export
├── services/purchase-orders.service.ts # MODIFIED — new hooks
└── constants/                          # MODIFIED — add detail tabs, filter options

apps/procurement-officer-app/src/features/purchase-orders/
├── pages/PurchaseOrderDetailPage.tsx   # MODIFIED — full implementation (same as CA)
├── pages/CreatePurchaseOrderPage.tsx   # MODIFIED — full form (same as CA)
└── pages/PurchaseOrderListPage.tsx     # MODIFIED — quick filter wiring, export

apps/vendor-app/src/features/purchase-orders/
├── pages/PurchaseOrderDetailPage.tsx   # MODIFIED — vendor view (acknowledge/reject)
└── pages/PurchaseOrderListPage.tsx     # MODIFIED — vendor column set

packages/i18n/src/locales/en/
├── purchaseOrders.json                 # MODIFIED — detail, create, export keys
└── bulkOrders.json                     # MODIFIED — drawdown form, consumption keys
```

### Verification Criteria

1. **Bulk Order Drawdown**: Navigate to bulk order detail, click "+ Create drawdown", select 2 items
   with partial quantities, submit. Verify a new PO is created with type BULK_DRAWDOWN and the bulk
   order's remaining quantities are reduced.

2. **PO Create**: Navigate to PO list, click "Create new", select project and vendor, add 2 line
   items manually, set delivery details, submit. Verify PO appears in list with status Draft.

3. **PO Detail**: Click a PO row, verify detail page shows all metadata, line items table, and tabs.
   Verify vendor view shows acknowledge/reject buttons.

4. **PO Export**: Click export button on PO list, select CSV. Verify download contains correct
   columns matching the table.

5. **Consumption Tracking**: On bulk order list and detail, verify progress bars show correct
   percentage of quantity drawn down vs total ordered.

### PO Creation 3 Modes (US-5.07, T814–T826)

**Architecture**: Pre-selection modals (`SelectRfqModal`, `SelectBulkOrderModal`) live in
`po-shared` package. Source data is passed via React Router route state
(`useNavigate`/`useLocation`). The wizard remains mode-agnostic — it receives `initialValues` +
`lockedFields` props without knowing about modes. Two pure functions (`rfqToFormDefaults`,
`bulkOrderToFormDefaults`) convert API data into form defaults.

**Field locking**: Locked fields are disabled in `PoBasicInfoStep` via a `Set<string>` prop. RFQ
mode locks projectId, deliveryLocationId, plannedDeliveryDate. Bulk order mode locks vendorId only.

### RFQ Backend CRUD (US-5.05, T808–T811)

**Endpoints added**: POST `/v1/rfqs` (create), PATCH `/v1/rfqs/:id` (update draft), POST
`/v1/rfqs/:id/send` (send to vendors), DELETE `/v1/rfqs/:id` (cancel). Service generates rfqNumber
using same pattern as PO (RFQ-XXXX). Line items and vendor invitations created in transaction.

### Materials Module (US-4.01, T812–T813)

**Module**: `apps/backend/src/modules/materials/`. CRUD service with search
(name/code/manufacturer). Registered in AppModule. Shared types: `CreateMaterialDto`,
`UpdateMaterialDto`, `MaterialListQueryDto`.

### Drawdown History Tab (US-2.11, T887) — PARTIAL, NOT FINAL

**Status**: PARTIAL (2026-03-26) — implemented per Figma (node 5433-162052), marked as not final.

**What was done**: Replaced "coming soon" placeholder with proper DataTable-based component. Schema
extended: added `lineItemId` and `qtyBeforeDrawdown` to Drawdown model (nullable for backward
compat). Backend `createDrawdown` now stores line item reference and pre-drawdown quantity.
`getBulkOrder` returns enriched drawdowns (material name, PO number, quantities). Frontend
`DrawdownHistoryTab` uses the shared `DataTable` component with SortIcon arrows, client-side
sorting/pagination, and horizontal scroll — matching the table pattern used across the project
(BulkOrderTable, RFQ tables, PO tables).

**Columns** (per Figma): Date/Timestamp, Related PO number, Material, Qty before drawdown, Drawn
quantity, Remaining qty.

**Needs**: `prisma migrate dev` to apply schema changes.

**What may change**: This is not a final decision — visual adjustments possible after further
review.
