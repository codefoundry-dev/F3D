# Tasks: Procurement Platform — Epic 1, Epic 2, Epic 2 Dashboards & FRD Alignment Sprint

**Input**: Design documents from `/specs/001-procurement-platform/`, FRD from
`docs/FRD-release-1.md` **Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/\*.md
✅, research.md ✅ **Last Updated**: 2026-03-18

**Epic 1 Status**: COMPLETE (verified 2026-03-05). All US-1.01–1.10 done. Code audit gaps fixed:
T194–T200. UI polish: T201–T206. Final gaps: T207 (ABN/tax validation + schema extraction), T208
(approval responsibilities → empty state), T209 (activity log → real API). Post-audit: T210 (ABN
masking in super-admin), T211 (empty-string validation fix), T212 (Google Places address
autocomplete). TODO: replace placeholder `mailto:support@forethread.com` with real URL. TODO:
replace temporary Google Places API key with production key. **Epic 2 Status**: Complete (all
T093–T130 done; projects backend, shared types, API client, company-admin-app). **Post-Epic 2
Status**: Complete — all post-epic tasks done (app scaffolds, email templates, toast system, error
boundary, global API error handling, user management for both Company Admin and Super Admin, UI
polish, shared layout components, TablePagination, RadioButton/RadioGroup, backdrop blur). **Epic 2
Dashboards Status**: Complete — all T241–T315 done (shared types, Prisma schema, backend services,
DataTable component, role-specific dashboards, management table pages, sidebar navigation, Swagger
decorators). **Enum Standardisation Status**: Complete — T483–T494 done (Prisma multi-file schema,
SCREAMING_SNAKE_CASE migration across all apps, procurement models, FilterPopover fix, lint fixes).
**PO/CA Dashboard Figma Alignment Round 2**: COMPLETE — T500–T507 done (structure, buttons, icons
aligned per Figma nodes 3345-110136, 3347-115416, 3345-110090). **Dashboard & List Pages Figma
Alignment Round 3**: COMPLETE — T508–T519 done (shared UI components, new icons, AppLayout headers,
duplicate title removal, DotActionsMenu reuse, BulkOrders/RFQ/PO page rewrites, status color
extraction, shared formatters). **Dashboard Navigation & Detail Pages**: COMPLETE — T577–T582 done
(Spinner SVG refactor, SA PlatformStateTable interactive enhancements, FO InvoiceDetailPage full
impl, CA/PO/Vendor dashboard card navigation to detail/create pages, stub pages for all entity
types). **SA + WH Real Data & Test Fixes**: COMPLETE — T583–T591 done (SA/WH backend endpoints with
real Prisma queries, SA/WH frontend dashboards with real API data, 22 test file lint/mock fixes, SA
PlatformState refactor with real admin-panel API, CA/PO stub page cleanup with AppLayout
breadcrumbs, PO list page rewrite, vendor/SA stub enhancements, BulkOrderDetailPage dynamic header).
**RFQ Line Item CRUD & BulkOrder UI Refresh**: COMPLETE — T592–T593 done (backend PATCH/DELETE line
item endpoints, EditLineItemModal, RfqLineItemsTab real edit/delete wiring, BulkOrderDetailPage line
items table restyled, dashboard section fixes, i18n keys, tests updated).

**Scope**: Epic 1 (User Registration & Access Management) + Epic 2 (Project Creation & Management) +
Epic 2 Dashboards (US-10.01–10.07: Procurement Dashboards & Management Views) + Future Epic Outlines
(3–13). All core infrastructure is fully operational. Four additional apps scaffolded (vendor,
financial-officer, procurement-officer, warehouse-officer). **Future Epics 3–13**: Outlined from
designer wireframe review (2026-03-04) — RFQ, PO, Change Orders, Vendors, Materials, Warehouse,
Field Worker, Invoices, Dashboards, Bulk Orders, Notifications, Sidebar Navigation.

**Tests**: Coverage >90% achieved across all apps (T597, T605, T629, T632–T636, T641).

---

## Format: `[ID] [P?] [Story] Description — file path`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[US2]**: Belongs to User Story 2 — Project Creation & Management
- Exact file paths match `/specs/001-procurement-platform/plan.md` project structure

---

## Phase 1: Shared Types & API Client (Project Extensions)

**Purpose**: Extend shared packages with project-related types, DTOs, schemas, and API client
endpoints. These must be complete before both backend and frontend can consume them.

- [x] T093 [P] Add `ProjectStatus` enum (`Planned`, `Ongoing`, `Completed`, `Archived`) and
      `LocationType` enum (`Delivery`, `Storage`) to `packages/shared-types/src/enums/index.ts`;
      re-export from `packages/shared-types/src/index.ts` barrel —
      `packages/shared-types/src/enums/index.ts`
- [x] T094 [P] Create `packages/shared-types/src/dtos/project.dto.ts`: `CreateProjectDto` (name
      required, description optional, type optional, status required with default Planned, locations
      array with type/address/label/isDefault, assignedUserIds array min 1, plannedBudget
      optional >=0, currency optional default AUD, pointOfContactId optional, startDate optional,
      expectedEndDate optional), `UpdateProjectDto` (partial of CreateProjectDto, all optional),
      `AddProjectMembersDto` (userIds array), `ProjectListQueryDto` (page, limit, status, search,
      sortBy, sortDir), `ProjectResponseDto` (full project shape per GET /v1/projects/:id contract),
      `ProjectListItemDto` (summary shape per GET /v1/projects contract),
      `PaginatedProjectsResponseDto` (data + meta); all with class-validator decorators —
      `packages/shared-types/src/dtos/project.dto.ts`
- [x] T095 [P] Create `packages/shared-types/src/schemas/project.schema.ts`: Zod schemas mirroring
      project DTOs for client-side form validation — `createProjectSchema` (validates name min 1 max
      255, locations array must contain at least one Delivery default and one Storage default,
      assignedUserIds min 1, expectedEndDate after startDate), `updateProjectSchema` (partial),
      `addProjectMembersSchema` — `packages/shared-types/src/schemas/project.schema.ts`
- [x] T096 Create `packages/api-client/src/endpoints/projects.ts`: typed async functions —
      `getProjects(params: ProjectListQueryDto)`, `createProject(dto: CreateProjectDto)`,
      `getProject(id: string)`, `updateProject(id: string, dto: UpdateProjectDto)`,
      `addProjectMembers(id: string, dto: AddProjectMembersDto)`,
      `removeProjectMember(id: string, userId: string)` — each returns typed response matching
      projects contract; export from `packages/api-client/src/index.ts` barrel —
      `packages/api-client/src/endpoints/projects.ts`, `packages/api-client/src/index.ts`
- [x] T097 [P] Create `packages/i18n/src/locales/en/projects.json`: English translation keys for all
      project UI text — page titles (`projects.list.title`, `projects.create.title`,
      `projects.detail.title`, `projects.edit.title`), form labels (name, description, type, status,
      locations, budget, currency, dates, members), validation messages, status labels, empty
      states, confirmation dialogs, error messages, table headers, filter labels, BOM placeholder
      text — `packages/i18n/src/locales/en/projects.json`

**Checkpoint**: Shared types compile. API client has project endpoints. i18n has project
translations.

---

## Phase 2: Backend — Prisma Schema & Migration

**Purpose**: Add Project, ProjectLocation, and ProjectMember models to the Prisma schema and run the
migration. This MUST be complete before the projects service can be implemented.

**⚠️ CRITICAL**: Schema changes are sequential (shared file). Complete before Phase 3.

- [x] T098 Add `ProjectStatus` enum (`Planned`, `Ongoing`, `Completed`, `Archived`) and
      `LocationType` enum (`Delivery`, `Storage`) to `apps/backend/src/prisma/schema.prisma` —
      `apps/backend/src/prisma/schema.prisma`
- [x] T099 Add `Project` model to `apps/backend/src/prisma/schema.prisma`: all fields from updated
      data-model.md entity 4 — `id` (uuid PK), `companyId` (FK Company), `name` (varchar 255),
      `description` (text optional), `type` (varchar 100 optional), `status` (ProjectStatus default
      Planned), `plannedBudget` (decimal 18,4 optional), `currency` (varchar 3 default AUD),
      `startDate` (date optional), `expectedEndDate` (date optional), `pointOfContactId` (FK User
      optional), `createdByUserId` (FK User), `createdAt`, `updatedAt`; relations to Company, User
      (pointOfContact), User (createdBy), ProjectLocation[], ProjectMember[]; indexes:
      `idx_projects_company`, `idx_projects_company_name` (unique), `idx_projects_company_status`,
      `idx_projects_created_by`; map to `projects` table — `apps/backend/src/prisma/schema.prisma`
- [x] T100 Add `ProjectLocation` model to `apps/backend/src/prisma/schema.prisma`: `id` (uuid PK),
      `projectId` (FK Project), `type` (LocationType), `address` (text), `label` (varchar 255
      optional), `isDefault` (boolean default false); relation to Project; indexes:
      `idx_projectlocation_project`, `idx_projectlocation_project_type`; map to `project_locations`
      table — `apps/backend/src/prisma/schema.prisma`
- [x] T101 Add `ProjectMember` model to `apps/backend/src/prisma/schema.prisma`: `id` (uuid PK),
      `projectId` (FK Project), `userId` (FK User), `assignedAt` (datetime default now),
      `assignedByUserId` (FK User optional); unique constraint on `(projectId, userId)`; relations
      to Project, User (member), User (assignedBy); indexes: `idx_projectmember_project`,
      `idx_projectmember_user`; map to `project_members` table —
      `apps/backend/src/prisma/schema.prisma`
- [x] T102 Add reverse relations on existing models in `apps/backend/src/prisma/schema.prisma`: add
      `projects Project[]` and `projectMemberships ProjectMember[]` to `User` model; add
      `projects Project[]` to `Company` model — `apps/backend/src/prisma/schema.prisma`
- [x] T103 Run Prisma migration: `pnpm prisma migrate dev --name add-project-models` from
      `apps/backend`; verify migration creates `projects`, `project_locations`, `project_members`
      tables with correct indexes and constraints — `apps/backend/src/prisma/migrations/`

**Checkpoint**: Database has project tables. `pnpm prisma studio` shows Project, ProjectLocation,
ProjectMember models.

---

## Phase 3: Backend — Projects Module (User Story 2) 🎯

**Goal**: Company Admins and Procurement Officers can create projects, manage project details, and
control project membership via API. Project-scoped access control is enforced on all endpoints. The
full projects API contract is implemented.

**Independent Test**: `POST /v1/projects` with valid body creates a project; `GET /v1/projects`
returns it for assigned users only; `GET /v1/projects/:id` returns 403 for unassigned users.

### Backend: ProjectAccessGuard

- [x] T104 [US2] Implement `apps/backend/src/modules/projects/guards/project-access.guard.ts`:
      NestJS `CanActivate` guard that reads `params.id` from request, allows SuperAdmin
      unconditionally, allows CompanyAdmin if project belongs to their company, allows other roles
      only if ProjectMember record exists; throws `NotFoundException` if project doesn't exist,
      `ForbiddenException` if not a member; follows pattern from research.md §6.3 —
      `apps/backend/src/modules/projects/guards/project-access.guard.ts`

### Backend: Projects Service

- [x] T105 [US2] Implement `apps/backend/src/modules/projects/projects.service.ts` with the
      following methods:
  - `listProjects(query, requestingUser)`: SuperAdmin sees all, CompanyAdmin sees own company,
    others see only projects where they are a ProjectMember; paginated with search (name,
    description), filter by status, sort by name/createdAt/status/startDate; exclude Archived by
    default unless explicitly requested; return `defaultDeliveryLocation` and
    `defaultStorageLocation` strings and `memberCount` per project
  - `createProject(dto, requestingUser)`: validate company is Contractor type, validate name
    uniqueness within company `(companyId, name)`, validate locations array has at least one
    Delivery default and one Storage default, validate assignedUserIds are active users in same
    company, validate pointOfContactId is active user in same company, validate expectedEndDate >
    startDate; if requestingUser is ProcurementOfficer: ignore assignedUserIds and only assign the
    creator; auto-add creator to members; create Project + ProjectLocations + ProjectMembers in a
    Prisma transaction
  - `getProject(id)`: return full project with locations, members (with user details),
    pointOfContact, createdBy; include computed fields: `usedBudget` (0 for now), `activeBom`
    (null), `rfqCount`/`poCount`/`invoiceCount`/`vendorCount` (all 0)
  - `updateProject(id, dto, requestingUser)`: validate name uniqueness on change, validate status
    transitions per state machine (Planned→Ongoing, Ongoing→Completed, any→Archived; no reverse), if
    locations provided do full replacement (delete old, insert new) with same validation,
    ProcurementOfficer cannot change assignedUserIds or set status to Archived
  - `addMembers(projectId, userIds, requestingUser)`: validate all userIds are active users in same
    company as project, skip already-assigned users (idempotent), create ProjectMember records with
    assignedByUserId
  - `removeMember(projectId, userId, requestingUser)`: validate not removing last member (400),
    validate not removing auto-assigned ProcurementOfficer creator (400), delete ProjectMember
    record — `apps/backend/src/modules/projects/projects.service.ts`

### Backend: Projects Controller

- [x] T106 [US2] Implement `apps/backend/src/modules/projects/projects.controller.ts` with all 7
      endpoints per `contracts/projects.md`:
  - `GET /v1/projects` —
    `@Roles(CompanyAdmin, ProcurementOfficer, FinancialOfficer, WarehouseOfficer, Foreman)` — calls
    `listProjects`
  - `POST /v1/projects` — `@Roles(CompanyAdmin, ProcurementOfficer)` — calls `createProject`,
    returns 201
  - `GET /v1/projects/:id` — `@UseGuards(ProjectAccessGuard)` — calls `getProject`
  - `PATCH /v1/projects/:id` — `@Roles(CompanyAdmin, ProcurementOfficer)` +
    `@UseGuards(ProjectAccessGuard)` — calls `updateProject`
  - `POST /v1/projects/:id/members` — `@Roles(CompanyAdmin)` + `@UseGuards(ProjectAccessGuard)` —
    calls `addMembers`
  - `DELETE /v1/projects/:id/members/:userId` — `@Roles(CompanyAdmin)` +
    `@UseGuards(ProjectAccessGuard)` — calls `removeMember`
  - `GET /v1/projects/:id/bom` and `POST /v1/projects/:id/bom` — stub endpoints returning 501
    `{ success: false, error: "BOM management is not yet available" }` All endpoints use DTOs from
    `@forethread/shared-types`, return `ApiResponseDto` or `PaginatedResponseDto`, and include
    `@ApiTags('projects')`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth()` Swagger decorators —
    `apps/backend/src/modules/projects/projects.controller.ts`

### Backend: Module Registration & Seed

- [x] T107 [US2] Create `apps/backend/src/modules/projects/projects.module.ts`: imports
      `PrismaModule`; provides `ProjectsService`, `ProjectAccessGuard`; exports `ProjectsService`;
      register `ProjectsModule` in `apps/backend/src/app.module.ts` —
      `apps/backend/src/modules/projects/projects.module.ts`, `apps/backend/src/app.module.ts`
- [x] T108 [US2] Update `apps/backend/prisma/seed.ts`: add 2 test projects for the seeded contractor
      company ("Alpha Construction" with status Planned, "Beta Fitout" with status Ongoing); each
      project gets 3 ProjectLocation records (2 Delivery with first as default, 1 Storage as
      default); add ProjectMember records assigning the seeded CompanyAdmin and ProcurementOfficer
      to both projects; the seeded FinancialOfficer is NOT assigned (for access control testing);
      run `pnpm prisma db seed` to verify — `apps/backend/prisma/seed.ts`

**Checkpoint**: Backend projects API is functional. All 7 endpoints respond correctly.
`curl -H "Authorization: Bearer <token>" http://localhost:3000/v1/projects` returns seeded projects.

---

## Phase 4: Frontend — company-admin-app Scaffold

**Purpose**: Scaffold the company-admin-app with the same tech stack and patterns as
super-admin-app. Includes build config, auth flow, application shell, and routing. This MUST be
complete before project UI pages can be built.

### App Configuration

- [x] T109 [P] [US2] Create `apps/company-admin-app/package.json` with dependencies matching
      super-admin-app: React 18, Vite 5, TailwindCSS 3, TanStack Query 5, Zustand 4, React Router 6,
      React Hook Form, @hookform/resolvers, Zod, `@forethread/shared-types`,
      `@forethread/api-client`, `@forethread/i18n`; set `"name": "@forethread/company-admin-app"`;
      add scripts: `dev` (vite --port 3002), `build`, `preview`, `lint`, `typecheck` —
      `apps/company-admin-app/package.json`
- [x] T110 [P] [US2] Create `apps/company-admin-app/vite.config.ts` (same as super-admin-app
      pattern, server port 3002), `apps/company-admin-app/tsconfig.json` (extends
      `@forethread/config/tsconfig.react.json`), `apps/company-admin-app/index.html` (root HTML with
      div#root) — `apps/company-admin-app/vite.config.ts`, `apps/company-admin-app/tsconfig.json`,
      `apps/company-admin-app/index.html`
- [x] T111 [P] [US2] Create `apps/company-admin-app/tailwind.config.ts`: extends
      `@forethread/config/tailwind` preset (same pattern as super-admin-app/tailwind.config.ts);
      create `apps/company-admin-app/src/styles/globals.css` with CSS custom property definitions
      (copy from super-admin-app pattern, design tokens via shared preset) —
      `apps/company-admin-app/tailwind.config.ts`, `apps/company-admin-app/src/styles/globals.css`
- [x] T112 [P] [US2] Create `apps/company-admin-app/Dockerfile`: multi-stage build (same pattern as
      super-admin-app if it exists, otherwise: node:20-alpine build stage + nginx:alpine serve
      stage) — `apps/company-admin-app/Dockerfile`
- [x] T113 [P] [US2] Create `apps/company-admin-app/.env.example` with
      `VITE_API_URL=http://localhost:3000/v1` and `VITE_SENTRY_DSN=` —
      `apps/company-admin-app/.env.example`

### App Bootstrap & Shell

- [x] T114 [US2] Create `apps/company-admin-app/src/main.tsx`: wrap `<App />` in
      `<QueryClientProvider>` (QueryClient with same defaults as super-admin-app: staleTime 60s,
      gcTime 5min, retry 1, refetchOnWindowFocus true), `<BrowserRouter>`, import i18n
      initialisation from `@forethread/i18n`, import globals.css —
      `apps/company-admin-app/src/main.tsx`
- [x] T115 [US2] Implement `apps/company-admin-app/src/shared/layout/AppLayout.tsx`: top navigation
      bar (app logo "Forethread", notification bell placeholder, user avatar dropdown with "My
      Profile" and "Logout" using `t()` translation keys), side navigation (links: Dashboard `/`,
      Projects `/projects`), main content area via `<Outlet />`; use design tokens from shared
      Tailwind preset (no hardcoded colours); all text via i18n keys from `nav` namespace —
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`
- [x] T116 [US2] Implement `apps/company-admin-app/src/shared/components/PrivateRoute.tsx`: reads
      `isAuthenticated` from auth Zustand store; if false redirects to `/login` preserving intended
      path in `state.from`; renders `<Outlet />` if authenticated (same pattern as super-admin-app)
      — `apps/company-admin-app/src/shared/components/PrivateRoute.tsx`

### Auth Feature (adapted from super-admin-app)

- [x] T117 [US2] Implement `apps/company-admin-app/src/features/auth/state/auth.store.ts`: Zustand
      store with `currentUser` (id, name, email, role, companyId), `accessToken`, `isAuthenticated`;
      actions: `setAuth(user, token)`, `clearAuth()` (same pattern as super-admin-app auth store) —
      `apps/company-admin-app/src/features/auth/state/auth.store.ts`
- [x] T118 [US2] Implement `apps/company-admin-app/src/features/auth/services/auth.service.ts`:
      TanStack Query mutations — `useLogin`, `useVerifyOtp` (on success calls `setAuth`),
      `useLogout` (calls `clearAuth`, navigates to /login), all using `@forethread/api-client` auth
      endpoints (same pattern as super-admin-app) —
      `apps/company-admin-app/src/features/auth/services/auth.service.ts`
- [x] T119 [P] [US2] Implement auth pages adapted from super-admin-app (same functionality, using
      design tokens and i18n):
  - `apps/company-admin-app/src/features/auth/ui/LoginPage.tsx`: email + password form with Zod
    validation, calls `useLogin`, navigates to `/verify-otp`
  - `apps/company-admin-app/src/features/auth/ui/OtpVerificationPage.tsx`: 6-digit OTP input, expiry
    countdown, calls `useVerifyOtp`
  - `apps/company-admin-app/src/features/auth/ui/ActivateAccountPage.tsx`: token from URL,
    password + confirm form, calls `activateAccount`
  - `apps/company-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`: email form, calls
    `forgotPassword`
  - `apps/company-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`: token from URL, new
    password form, calls `resetPassword` — `apps/company-admin-app/src/features/auth/ui/`

### Routing

- [x] T120 [US2] Configure `apps/company-admin-app/src/app/routes.tsx` with React Router: public
      routes (`/login`, `/verify-otp`, `/activate`, `/forgot-password`, `/reset-password`);
      protected routes under `<PrivateRoute>` + `<AppLayout>`: `/` (DashboardPage), `/projects`
      (ProjectListPage), `/projects/new` (CreateProjectPage), `/projects/:id` (ProjectDetailPage),
      `/projects/:id/edit` (EditProjectPage); create `apps/company-admin-app/src/app/App.tsx` as
      root component rendering `<RouterProvider>` or `<Routes>` —
      `apps/company-admin-app/src/app/routes.tsx`, `apps/company-admin-app/src/app/App.tsx`
- [x] T121 [P] [US2] Create `apps/company-admin-app/src/features/dashboard/pages/DashboardPage.tsx`:
      stub dashboard for CompanyAdmin showing welcome message with user name, placeholder cards for
      "Active Projects", "Pending RFQs", "Open POs" (all showing 0 or placeholder); all text via
      i18n keys — `apps/company-admin-app/src/features/dashboard/pages/DashboardPage.tsx`

**Checkpoint**: company-admin-app boots at `http://localhost:3002`. Login flow works with seeded
CompanyAdmin credentials. Dashboard loads after auth. Navigation shows Dashboard and Projects links.

---

## Phase 5: Frontend — Projects Feature (User Story 2) 🎯

**Goal**: CompanyAdmin can create projects, view project list, view project details, edit projects,
and manage project members — all within the company-admin-app UI.

**Independent Test**: Log in as CompanyAdmin at `http://localhost:3002`, navigate to Projects,
create a project with name/locations/members, verify it appears in the list, open detail page, edit
the project, add/remove a member.

### Projects State & Service

- [x] T122 [US2] Implement `apps/company-admin-app/src/features/projects/state/projects.store.ts`:
      Zustand store — `selectedProjectId`, `isDeleteDialogOpen`, `memberToRemoveId`; actions:
      `selectProject(id)`, `clearSelection()`, `openDeleteDialog()`, `closeDeleteDialog()`,
      `setMemberToRemove(id)`, `clearMemberToRemove()` —
      `apps/company-admin-app/src/features/projects/state/projects.store.ts`
- [x] T123 [US2] Implement
      `apps/company-admin-app/src/features/projects/services/projects.service.ts`: TanStack Query
      hooks — `useProjects(params)` (GET /v1/projects with pagination + filters, queryKey
      `['projects', params]`), `useProject(id)` (GET /v1/projects/:id, queryKey `['projects', id]`),
      `useCreateProject()` mutation (invalidates `['projects']` on success, navigates to project
      detail), `useUpdateProject()` mutation (invalidates `['projects']` and `['projects', id]`),
      `useAddProjectMembers()` mutation (invalidates `['projects', id]`), `useRemoveProjectMember()`
      mutation (invalidates `['projects', id]`); also `useCompanyUsers()` hook (GET /v1/users with
      companyId filter, for member selection dropdowns) —
      `apps/company-admin-app/src/features/projects/services/projects.service.ts`

### Projects UI Pages

- [x] T124 [US2] Implement `apps/company-admin-app/src/features/projects/ui/ProjectListPage.tsx`:
      paginated table with columns (name, status badge with colour per status, type, default
      delivery location, member count, start date, created date, actions); server-side pagination
      (25/page) with TanStack Query; filter bar with search input (debounced 300ms), status dropdown
      (Planned/Ongoing/Completed/Archived), sort dropdown; "Create Project" button linking to
      `/projects/new`; row click navigates to `/projects/:id`; empty state when no projects;
      Archived projects hidden by default with toggle to show; all text via `t()` keys from
      `projects` namespace — `apps/company-admin-app/src/features/projects/ui/ProjectListPage.tsx`
- [x] T125 [US2] Implement `apps/company-admin-app/src/features/projects/ui/CreateProjectPage.tsx`:
      full-page form using React Hook Form + Zod (`createProjectSchema`); sections: Project Details
      (name required, description, type dropdown, status dropdown defaulting to Planned, planned
      budget, currency dropdown defaulting to AUD, start date, expected end date), Delivery
      Locations (dynamic list with add/remove, each row: address required + label optional +
      isDefault radio, at least one required with one default), Storage Locations (same pattern, at
      least one with one default), Team Members (multi-select from company users via
      `useCompanyUsers()`, at least one required, point of contact dropdown from selected members);
      submit calls `useCreateProject()`; show API errors (409 duplicate name); cancel navigates back
      to list; all text via i18n —
      `apps/company-admin-app/src/features/projects/ui/CreateProjectPage.tsx`
- [x] T126 [US2] Implement `apps/company-admin-app/src/features/projects/ui/ProjectDetailPage.tsx`:
      loads project via `useProject(id)` from URL params; overview section showing all project
      fields (name, description, status badge, type, budget with currency, dates, point of contact,
      created by); Locations section listing all delivery and storage locations with default badges;
      Members section showing assigned users table (name, email, role, assigned date) with "Add
      Members" button and "Remove" action per row (CompanyAdmin only); placeholder tabs for "Bill of
      Materials" (empty state message per research.md §6.5), "Procurement Documents" (placeholder),
      "Financial Summary" (placeholder); "Edit Project" button linking to `/projects/:id/edit`;
      member add triggers modal with user multi-select, member remove triggers confirmation dialog;
      all text via i18n — `apps/company-admin-app/src/features/projects/ui/ProjectDetailPage.tsx`
- [x] T127 [US2] Implement `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`:
      same form structure as CreateProjectPage but pre-populated with existing project data via
      `useProject(id)`; submit calls `useUpdateProject()`; validates status transitions (disable
      invalid options in dropdown based on current status); show 409 error on duplicate name; cancel
      navigates back to detail page; all text via i18n —
      `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`

**Checkpoint**: Full project management UI is functional in company-admin-app. CompanyAdmin can
create, view, edit projects and manage members. All acceptance scenarios are testable.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Harden Epic 2 with production-grade details and verify end-to-end.

- [x] T128 [P] Add Swagger decorators to all project endpoints: `@ApiTags('projects')`,
      `@ApiOperation({ summary })`, `@ApiResponse(200/201/400/403/404/409/501)`, `@ApiBearerAuth()`
      on `apps/backend/src/modules/projects/projects.controller.ts`; verify Swagger UI at
      `http://localhost:3000/api` shows all project endpoints correctly —
      `apps/backend/src/modules/projects/projects.controller.ts`
- [x] T129 [P] Add `@Throttle({ default: { limit: 20, ttl: 60000 } })` on `POST /v1/projects`
      (project creation rate limit) in `apps/backend/src/modules/projects/projects.controller.ts` —
      `apps/backend/src/modules/projects/projects.controller.ts`
- [x] T130 [P] Ensure `pnpm install` from root resolves all new workspace dependencies for
      company-admin-app; run `pnpm turbo build --filter=company-admin-app` to verify production
      build succeeds; run `pnpm turbo typecheck --filter=company-admin-app` to verify zero type
      errors — `(build validation)`
- [x] T131 Run complete Epic 2 verification per plan.md verification criteria: start services
      (`docker compose up -d`, `pnpm dev --filter=backend --filter=company-admin-app`), seed data,
      log in as CompanyAdmin at localhost:3002, create project "Test Project Alpha" with delivery +
      storage locations + 2 assigned users, verify project list, verify detail page, verify access
      control (assigned PO sees project, unassigned FO gets empty list / 403 on direct ID access),
      verify duplicate name rejection (409), verify member add/remove, verify PO cannot manage
      members; fix any issues found — `(runtime validation)`

---

## Post-Epic 2: Super-Admin Invite Users Multi-Step Page (US-1.01 / US-1.05)

**Purpose**: Replace the single-step `CreateUserModal` in `super-admin-app` with a multi-step
`/users/create` page matching the Figma design and FRD US 1.01 acceptance criteria. Also fix US-1.07
AC 4 (Company Admin role in company-admin role dropdown).

**Prerequisites**: Epic 2 complete, super-admin User Management page functional.

### Shared UI & Backend Adjustments

- [x] T132 [P] [US1] Extend `CustomDropdown` in
      `packages/ui-components/src/components/CustomDropdown.tsx` with `actionItem` prop (clickable
      action below options with separator), `searchable` prop (text filter at top),
      `searchPlaceholder` prop. Export `DropdownActionItem` type from
      `packages/ui-components/src/index.ts` —
      `packages/ui-components/src/components/CustomDropdown.tsx`,
      `packages/ui-components/src/index.ts`
- [x] T133 [P] [US1] Make `abn` and `legalAddress` optional in
      `packages/shared-types/src/dtos/company.dto.ts` (`@IsOptional()`, `@ApiPropertyOptional()`).
      Make `contactEmail` optional in `packages/api-client/src/endpoints/companies.ts`
      `CreateCompanyDto` interface — `packages/shared-types/src/dtos/company.dto.ts`,
      `packages/api-client/src/endpoints/companies.ts`

### Routing & i18n

- [x] T134 [P] [US1] Add `createUser: '/users/create'` to
      `apps/super-admin-app/src/app/route-config.ts`. Register lazy-loaded `CreateUserPage` in
      `apps/super-admin-app/src/app/routes.tsx` (before `userDetail` route) —
      `apps/super-admin-app/src/app/route-config.ts`, `apps/super-admin-app/src/app/routes.tsx`
- [x] T135 [P] [US1] Add i18n keys to `packages/i18n/src/locales/en/users.json`: `createUserPage.*`
      (title, subtitle, companyTypeLabel, contractor, vendor, selectCompany, company, continue,
      cancel, back, userDetailsTitle, userDetailsSubtitle, sendInvitation, sending,
      addContractorCompany, addVendorCompany, searchCompany), `addCompanyModal.*`
      (createContractorTitle/Subtitle, createVendorTitle/Subtitle, companyName,
      companyNamePlaceholder, companyEmail, companyEmailPlaceholder, specialisation,
      selectSpecialisation, create, creating, createError), `createModal.representativeName`,
      `createModal.representativeEmail` — `packages/i18n/src/locales/en/users.json`

### Role Constants

- [x] T136 [P] [US1] Add `CONTRACTOR_ROLE_OPTIONS` array
      (`[CompanyAdmin, ProcurementOfficer,     FinancialOfficer, WarehouseOfficer, Foreman]`) to
      `apps/super-admin-app/src/features/users/constants/roles.ts` —
      `apps/super-admin-app/src/features/users/constants/roles.ts`
- [x] T137 [P] [US1] Add `UserRole.CompanyAdmin` to `COMPANY_ROLE_OPTIONS` in
      `apps/company-admin-app/src/features/users/constants/roles.ts` (US-1.07 AC 4 fix) —
      `apps/company-admin-app/src/features/users/constants/roles.ts`

### New Page & Step Components

- [x] T138 [US1] Create `apps/super-admin-app/src/features/users/ui/steps/CompanySelectionStep.tsx`:
      Step 1 — IconBadge with NewUserIcon, title/subtitle, radio group (Contractor/Vendor), company
      `CustomDropdown` with `searchable`, `actionItem` for "Add company", DepartmentIcon leftIcon.
      Uses `useCompanies({ type, limit: 100 })`. Continue/Cancel buttons —
      `apps/super-admin-app/src/features/users/ui/steps/CompanySelectionStep.tsx`
- [x] T139 [US1] Create `apps/super-admin-app/src/features/users/ui/steps/UserDetailsStep.tsx`: Step
      2 — React Hook Form + Zod validation. Fields: name (UserOutlineIcon), email (EnvelopeIcon),
      role dropdown for contractors only (IdBadgeIcon), position (BriefcaseIcon). Vendor auto-sets
      role to 'Vendor'. Company info box. Uses `useCreateUser()` mutation —
      `apps/super-admin-app/src/features/users/ui/steps/UserDetailsStep.tsx`
- [x] T140 [US1] Create
      `apps/super-admin-app/src/features/users/ui/steps/InvitationSuccessStep.tsx`: Step 3 —
      CheckCircle IconBadge, success title/subtitle, green email info box, expiry note, "Back to
      User Management" button, 3-second countdown auto-redirect to `/users` —
      `apps/super-admin-app/src/features/users/ui/steps/InvitationSuccessStep.tsx`
- [x] T141 [US1] Create
      `apps/super-admin-app/src/features/users/ui/modals/AddContractorCompanyModal.tsx`: Modal with
      DepartmentIcon IconBadge. Company name field. Uses
      `useCreateCompany({ type:     'Contractor', legalName })`. Returns created company to parent —
      `apps/super-admin-app/src/features/users/ui/modals/AddContractorCompanyModal.tsx`
- [x] T142 [US1] Create
      `apps/super-admin-app/src/features/users/ui/modals/AddVendorCompanyModal.tsx`: Modal with
      BriefcaseIcon IconBadge. Fields: company name, email, specialisation dropdown. Uses
      `useCreateCompany({ type: 'Vendor', legalName, contactEmail, specialisations })` —
      `apps/super-admin-app/src/features/users/ui/modals/AddVendorCompanyModal.tsx`
- [x] T143 [US1] Create `apps/super-admin-app/src/features/users/ui/CreateUserPage.tsx`: Multi-step
      orchestrator page with `useState<'companySelection' | 'userDetails' | 'success'>`. Manages
      companyType, companyId, companyName, createdUserEmail. Conditionally shows add-company modals.
      Centered card layout with `max-w-md` —
      `apps/super-admin-app/src/features/users/ui/CreateUserPage.tsx`

### Cleanup

- [x] T144 [US1] Update `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`: change
      "Invite user" button to `navigate(ROUTES.createUser)`, remove `CreateUserModal` and
      `InvitationSuccessModal` imports/renders. Remove unused store state (`isCreateModalOpen`,
      `closeCreateModal`, `isSuccessModalOpen`, `closeSuccessModal`) from
      `apps/super-admin-app/src/features/users/state/users.store.ts` —
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/super-admin-app/src/features/users/state/users.store.ts`
- [x] T145 [US1] Delete `apps/super-admin-app/src/features/users/ui/CreateUserModal.tsx` and
      `apps/super-admin-app/src/features/users/ui/InvitationSuccessModal.tsx` (replaced by
      CreateUserPage and InvitationSuccessStep) — `(file deletion)`
- [x] T146 [US1] Build verification: run `pnpm build` from root, verify zero TypeScript errors
      across all apps — `(build validation)`

**Checkpoint**: "Invite user" button navigates to `/users/create`. Full 3-step flow works for both
Contractor and Vendor company types. Add-company modals work inline. Success page auto-redirects.
Build passes.

### Invited User Actions Fix (Resend + Cancel)

- [x] T147 [US1] Replace single "Reset Invitation" action with "Resend Invitation" + "Cancel
      Invitation" for invited users in company-admin `UserListPage`, `UserDetailPage`, and
      super-admin `UserListPage`. Add `cancelInvitation` modal state to both stores. Add
      `cancelInvitationModal.*` i18n keys. Cancel uses `StatusActionModal` with destructive variant.
      Import and wire `useCancelInvitation` hook —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/company-admin-app/src/features/users/ui/UserDetailPage.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/company-admin-app/src/features/users/state/users.store.ts`,
      `apps/super-admin-app/src/features/users/state/users.store.ts`,
      `packages/i18n/src/locales/en/users.json`

### Invite Users — Revert Page to Modal

- [x] T152 [US1] Create `apps/super-admin-app/src/features/users/ui/CreateUserModal.tsx`: wraps
      CompanySelectionStep → UserDetailsStep → InvitationSuccessStep inside `<Modal>`. Same 3-step
      flow as deleted `CreateUserPage`, but opened from UserListPage instead of navigated to —
      `apps/super-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] T153 [US1] Update `InvitationSuccessStep.tsx`: accept `onClose` callback instead of
      `useNavigate`. Countdown calls `onClose()` instead of navigating —
      `apps/super-admin-app/src/features/users/ui/steps/InvitationSuccessStep.tsx`
- [x] T154 [US1] Re-add `isCreateModalOpen` / `openCreateModal` / `closeCreateModal` to super-admin
      users store. Update `UserListPage`: "Invite user" button calls `openCreateModal()`, renders
      `<CreateUserModal>`. Remove `useNavigate` and `ROUTES` imports —
      `apps/super-admin-app/src/features/users/state/users.store.ts`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] T155 [US1] Remove `createUser` route from `route-config.ts` and `routes.tsx`. Delete
      `CreateUserPage.tsx` — `apps/super-admin-app/src/app/route-config.ts`,
      `apps/super-admin-app/src/app/routes.tsx`,
      `apps/super-admin-app/src/features/users/ui/CreateUserPage.tsx`

### Backdrop Blur on All Modals

- [x] T156 [US1] Add `backdrop-blur-sm` to base Modal overlay in
      `packages/ui-components/src/components/Modal.tsx`. Also add to mobile bottom sheet overlays in
      `FilterPopover.tsx` and `DotActionsMenu.tsx` —
      `packages/ui-components/src/components/Modal.tsx`,
      `packages/ui-components/src/components/FilterPopover.tsx`,
      `packages/ui-components/src/components/DotActionsMenu.tsx`

### User Table Overflow & Border Fixes

- [x] T157 [US1] Fix DotActionsMenu clipping: change table wrapper from `overflow-hidden` to
      `overflow-visible` in super-admin `UserListPage.tsx`. Remove `border-t` from TablePagination
      via `className="border-t-0"`. Add `last:border-b-0` to CompanySection header and UserRow to
      prevent border doubling — `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`

### Shared UI: RadioButton Component

- [x] T158 [P] [US1] Create `packages/ui-components/src/components/RadioButton.tsx`: hidden native
      `<input type="radio">` + custom circular visual span. Props: `checked`, `onChange`, `label`,
      `disabled`, `value`, `name`, `className`. States: default, hover, focused (blue ring),
      disabled (muted). Follow Checkbox.tsx pattern —
      `packages/ui-components/src/components/RadioButton.tsx`
- [x] T159 [P] [US1] Create `packages/ui-components/src/components/RadioGroup.tsx`: manages selected
      value via `value`/`onChange` props, renders children RadioButton options. Props: `options`,
      `value`, `onChange`, `disabled`, `orientation` (horizontal/vertical, default horizontal),
      `name`, `className` — `packages/ui-components/src/components/RadioGroup.tsx`
- [x] T160 [US1] Export `RadioButton`, `RadioGroup`, and their prop types from
      `packages/ui-components/src/index.ts` — `packages/ui-components/src/index.ts`
- [x] T161 [US1] Refactor `CompanySelectionStep.tsx`: replace inline `<input type="radio">` with
      `RadioGroup` / `RadioButton` from `@forethread/ui-components` —
      `apps/super-admin-app/src/features/users/ui/steps/CompanySelectionStep.tsx`

### Edit Company Details Modal (US-1.05 AC 3)

- [x] T162 [US1.05] Add `legalName` to `UpdateCompanyDto` (backend + api-client) —
      `apps/backend/src/modules/companies/companies.service.ts`,
      `packages/api-client/src/endpoints/companies.ts`
- [x] T163 [US1.05] Add `useUpdateCompany()` mutation hook —
      `apps/super-admin-app/src/features/companies/services/companies.service.ts`
- [x] T164 [US1.05] Add edit company modal state to users store (`isEditCompanyModalOpen`,
      `editCompanyId`, `editCompanyName`, `openEditCompanyModal`, `closeEditCompanyModal`) —
      `apps/super-admin-app/src/features/users/state/users.store.ts`
- [x] T165 [US1.05] Create `EditCompanyModal.tsx` (edit icon badge, company name input pre-filled,
      vertically stacked Submit/Cancel buttons, uses `useUpdateCompany` mutation) —
      `apps/super-admin-app/src/features/users/ui/modals/EditCompanyModal.tsx`
- [x] T166 [US1.05] Add `editCompanyModal` i18n keys (title, subtitle, companyName, submitChanges,
      submitting, updateError) — `packages/i18n/src/locales/en/users.json`
- [x] T167 [US1.05] Wire up EditCompanyModal in UserListPage: replace TODO stub in
      `getCompanyActions` with `openEditCompanyModal(companyId, companyName)`, render modal
      conditionally — `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`

### i18n Fix: Invitation Expiry Text

- [x] T168 [US1.02] Fix `invitationExpiredBody` i18n: "4 hours" → "30 days" per FRD (FR-002:
      invitation link valid 30 days) — `packages/i18n/src/locales/en/auth.json`

### Design/FRD Conflicts (unresolved)

- [x] T170 [US1.02] Expired invitation link — resolved: admin-only resend per FRD. "Request new
      link" button now sends notification email to the inviting admin instead of self-service
      resend. Backend `requestNewInvitation()` changed, new email template
      `invitation-expired-notification`, i18n updated — `auth.service.ts`, `email.service.ts`,
      `emails.json`, `auth.json`
- [x] T171 [US1.02] "Contact support" link on expired invitation page — implemented as
      `ContactSupportLink` component in `@forethread/ui-components` with placeholder
      `mailto:support@forethread.com`. TODO: replace with real support URL when decided — all 6
      `*ActivateAccountPage.tsx`, `packages/ui-components/src/components/ContactSupportLink.tsx`
- [x] T172 [US1.01] Make `contactEmail` optional for Contractor companies per API contract — Prisma
      schema `String?`, migration `make_contact_email_optional`, service DTO
      `@IsOptional()     @IsEmail()`, runtime validation: Vendor requires `contactEmail`, Contractor
      does not — `schema.prisma`, `companies.service.ts`
- [x] T173 [US1.01] Fix RadioButton selected style — was solid black circle with white dot, now
      white circle with black border + black inner dot per Figma —
      `packages/ui-components/src/components/RadioButton.tsx`
- [x] T174 [US1.01] Fix CustomDropdown actionItem color — `text-primary` (blue) → `text-foreground`
      (#131313) per Figma — `packages/ui-components/src/components/CustomDropdown.tsx`
- [x] T175 [US1.01] Remove "+" prefix from `addContractorCompany`/`addVendorCompany` i18n keys —
      icon already provided via `PlusInCircleIcon` — `packages/i18n/src/locales/en/users.json`
- [x] T176 [US1.03] Unify focus ring style across input components — replace
      `focus:border-foreground/50` with `focus:ring-2 focus:ring-ring focus:border-transparent` in
      `Input.tsx`, `CustomDropdown.tsx`, `TwoFactorCard.tsx`

### Infrastructure: Storage, Audit, Migration

- [x] T177 [US1.05] Prisma schema: `File`, `CompanyDocument`, `CompanyVendorAssignment`, `AuditLog`
      models + `DocumentType`, `AuditAction` enums + `avatarUrl` on User —
      `apps/backend/src/prisma/schema.prisma`
- [x] T178 [US1.05] Migration `20260304153721_add_vendor_assignment_files_audit` — creates all new
      tables and indexes — `apps/backend/src/prisma/migrations/`
- [x] T179 [US1.05] StorageModule: `StorageService` (S3/MinIO upload, signed URLs, delete),
      `StorageController` (POST /storage/upload, GET /storage/:id/url, DELETE /storage/:id) —
      `apps/backend/src/modules/storage/`
- [x] T180 [US1.05] AuditModule: `AuditService` (log method), `AuditController` (GET /audit-logs
      with filters) — `apps/backend/src/modules/audit/`
- [x] T181 [US1.05] Register StorageModule + AuditModule in AppModule —
      `apps/backend/src/app.module.ts`
- [x] T182 [US1.05] API client: `audit.ts` (getAuditLogs), `AUDIT_PATHS` + `STORAGE_PATHS` in
      paths.ts, barrel export — `packages/api-client/`
- [x] T183 [US1.05] Shared types: `AuditAction` enum — `packages/shared-types/src/enums/index.ts`
- [x] T184 [US1.05] Add `@aws-sdk/client-s3` dependency — `apps/backend/package.json`,
      `pnpm-lock.yaml`

### Super-Admin Table Redesign & Vendor Assignment (US-1.05)

- [x] T185 [US1.05] UserListPage: Date Joined sortable column, eye/edit icons per user row,
      plain-text status with STATUS_TEXT_COLORS, company row eye/edit, Actions column header,
      colSpan 5→6 — `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] T186 [US1.05] ActionLogTab stub component — placeholder for audit log display, ready to wire
      to getAuditLogs API — `apps/super-admin-app/src/features/users/ui/ActionLogTab.tsx`
- [x] T187 [US1.05] Backend: vendor assignment CRUD endpoints (POST/DELETE /companies/:id/vendors),
      company logo upload (POST /companies/:id/logo), document CRUD (POST/GET/DELETE
      /companies/:id/documents), CompaniesModule imports StorageModule —
      `apps/backend/src/modules/companies/`
- [x] T188 [US1.05] API client: vendor, logo, document functions in companies.ts, avatar paths in
      users.ts — `packages/api-client/src/endpoints/`
- [x] T189 [US1.05] AddVendorCompanyModal: contractor assignment dropdown for vendor companies —
      `apps/super-admin-app/src/features/users/ui/modals/AddVendorCompanyModal.tsx`
- [x] T190 [US1.05] CustomDropdown: grouped options support — `packages/ui-components/`
- [x] T191 [US1.05] i18n: dateJoined column, vendor assignment keys, validation keys — various

### Known Gaps (deferred)

- [x] T148 [US1] AC 5.1/5.2: Sort company dropdown alphabetically with first-letter quick navigation
      — implemented via `grouped` prop on CustomDropdown (alphabetical sorting + keyboard letter
      jump)
- [x] T149 [US1] AC 7.1: Auto-default role to Company Admin when creating user for a newly created
      contractor company — implemented via `isNewlyCreatedCompany` prop in UserDetailsStep
- [x] T150 [US1] AC 7.3: Vendor-to-contractor assignment — backend CompanyVendorAssignment model +
      CRUD endpoints done, AddVendorCompanyModal includes contractor assignment dropdown
- [x] T151a [US1.05] Backend: AuditLog Prisma model, AuditModule (AuditService + AuditController),
      API client `getAuditLogs`, `AuditAction` enum in shared-types — DONE
- [x] T151b [US1.05] Frontend: ActionLogTab wired to `getAuditLogs` API with timeline UI (check
      circle icons, action names, dates, descriptions, pagination) — DONE
- [x] T169 [US1.06] Project access modal — created ProjectAccessModal in company-admin-app with
      project checkboxes per user. Wired in UserDetailPage via DotActionsMenu "Project access"
      action — `apps/company-admin-app/src/features/users/ui/ProjectAccessModal.tsx`
- [x] T207 [US1.06] Wire ProjectAccessModal into UserListPage.tsx "Project access" menu action —
      currently empty onClick (line 153, TODO US-1.06). UserDetailPage has it wired (T169) but
      UserListPage does not — `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`

### Gaps identified 2026-03-03 (FRD cross-check)

- [x] T216 [US1.05] Backend dynamic sort — added sortBy/sortDir to UserListQueryDto and listUsers()
      service; replaces hardcoded `orderBy: { name: 'asc' }` with dynamic field selection —
      `apps/backend/src/modules/users/users.service.ts`
- [x] T217 [US1.05] Bulk deactivate/activate all company users — implemented on frontend using
      existing individual `PATCH /users/:id/deactivate` and `PATCH /users/:id/reactivate` endpoints
      via `Promise.allSettled`. Dynamic label toggles between "Deactivate all users" / "Activate all
      users" based on company user statuses. Confirmation modal + success/error toasts. Store state
      for bulk action modal added — `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/super-admin-app/src/features/users/state/users.store.ts`,
      `packages/i18n/src/locales/en/users.json`
- [x] T218 [US1.08] Reactivation email notification — added `sendReactivationEmail()` to
      email.service.ts, created `reactivation.html` Handlebars template, added i18n keys to
      emails.json, called from `reactivateUser()`. Also added audit logging for user CRUD actions
      and avatar upload endpoints to users controller — `apps/backend/src/modules/notifications/`,
      `apps/backend/src/modules/users/`, `packages/i18n/src/locales/en/emails.json`
- [x] T219 [US1.09] Company profile management frontend — created CompanyProfilePage as single-page
      layout: company card header, Legal Info (4-col grid), Contact Info (3-col grid), Compliance
      Documents. EditCompanyModal with Zod validation. Routes, i18n, icons added —
      `apps/company-admin-app/src/features/settings/`
- [x] T220 [US1.09] Company logo upload — backend stores S3 key, GET /companies/:id/logo-url returns
      signed URL. Frontend file picker wired, displays logo image, specialisations section added —
      `apps/backend/src/modules/companies/companies.controller.ts`,
      `apps/company-admin-app/src/features/settings/pages/CompanyProfilePage.tsx`
- [x] T221 [US1.09] Compliance documents view/download — document cards with uploader email, date,
      view/download actions using getFileUrl. Upload UI deferred (backend endpoint exists) —
      `apps/company-admin-app/src/features/settings/pages/CompanyProfilePage.tsx`
- [x] T222 [US1.10] User profile page frontend — created UserProfilePage in company-admin-app with
      profile card (avatar upload, name, email), editable fields (name, position, phone), read-only
      fields (email, role, company), change password form. EditProfileModal, AvatarUpload component,
      profile.json i18n, migration for avatarUrl — `apps/company-admin-app/src/features/profile/`,
      `packages/i18n/src/locales/en/profile.json`,
      `packages/ui-components/src/components/AvatarUpload.tsx`
- [x] T192 [US1.05] Super-admin Company Detail Page — CompanyDetailPage with tabbed layout
      (Overview, Company Users, Documents). Eye icon on company row navigates to `/companies/:id`,
      edit icon removed. OverviewTab, CompanyUsersTab, DocumentsTab, EditCompanyModal. AppLayout
      updated — `apps/super-admin-app/src/features/companies/`
- [x] T193 [US1.10] Deploy UserProfilePage to all apps — route `/me`, AppLayout "My Profile" menu
      added to super-admin-app, financial-officer-app, procurement-officer-app, vendor-app,
      warehouse-officer-app

### Gaps identified 2026-03-05 (code verification audit)

- [x] T194 [US1.10] ChangePasswordModal — created `ChangePasswordModal` in `packages/ui-components`,
      wired into `UserProfilePage` across all 6 apps. Backend `POST /users/me/change-password`
      already existed — `packages/ui-components/src/components/ChangePasswordModal.tsx`
- [x] T195 [US1.10] Show company name on user profile — passed
      `company={profile.company?.legalName}` to `ProfileInfoGrid` in all 6 `UserProfilePage.tsx`,
      added `company` prop to company-admin `ProfileInfoGrid.tsx`
- [x] T196 [US1.08] Sole CompanyAdmin role-change guard — added check in `updateUser()` to prevent
      demoting the sole active CompanyAdmin via role change (mirrors deactivate guard) —
      `apps/backend/src/modules/users/users.service.ts`
- [x] T197 [US1.05] Backend `dateJoined` sort alias — added `dateJoined` to `SORTABLE_USER_FIELDS`
      with `SORT_FIELD_ALIASES` mapping to `createdAt` —
      `apps/backend/src/modules/users/users.service.ts`
- [x] T198 [US1.05] CompanyDetailPage bulk deactivate — replaced `window.alert` placeholder with
      real `StatusActionModal` + `Promise.allSettled` bulk action, dynamic label toggle
      (deactivate/activate) based on company user statuses —
      `apps/super-admin-app/src/features/companies/pages/CompanyDetailPage.tsx`
- [x] T199 [US1.02] ContactSupportLink component — extracted inline `<a>` to shared
      `ContactSupportLink` component, used in all 6 `ActivateAccountPage.tsx` —
      `packages/ui-components/src/components/ContactSupportLink.tsx`
- [x] T200 [INFRA] Shared auth package — created `packages/auth` with `createAuthStore` and
      `createAuthHooks` factory functions. Replaced ~1,000 lines of duplicate auth store + service
      code across 6 apps with 3-line factory calls. Each app retains its unique persistence/session
      key while sharing identical logic.
- [x] T202 [US1.05] Super-admin: CompanyDetailPage redesign — tabs outside card, company header
      inside card. EditCompanyModal reduced to name-only field. Removed My Profile page/route. "User
      Profile" header for `/settings/users/:id`. Borderless DotActionsMenu in table rows —
      `apps/super-admin-app/src/features/companies/`, `apps/super-admin-app/src/shared/layout/`
- [x] T203 [US1.09] Company-admin: company profile redesign — remove input icons from
      EditCompanyModal, add ABN/Tax Code fields, section headers. Settings label "Companies" →
      "Company". Borderless DotActionsMenu in CompanyUsersTab. Added abn/taxCode to UpdateCompanyDto
      — `apps/company-admin-app/src/features/settings/`, `packages/api-client/`
- [x] T204 [US1.05] Invoice sort + search fixes — replace inline triangle SortIcon with shared
      SortIcon component, add clickable sort logic (sortField/sortDir state), remove bg-muted from
      SearchInput. Extract Invoice interface, MOCK_INVOICES, PAGE_SIZE_OPTIONS to constants files —
      `apps/company-admin-app/src/features/invoices/`,
      `apps/financial-officer-app/src/features/invoices/`,
      `apps/company-admin-app/src/features/projects/ui/ProjectListPage.tsx`
- [x] T205 [US1.10] User detail pages: wrap all sections in single card (profile header + info
      grid + role/permissions + approval + activity log). Centered not-found message. Remove "Back
      to users" link. Extract mock data to constants files —
      `apps/*/src/features/users/ui/UserDetailPage.tsx`, `apps/*/src/features/profile/constants.ts`
- [x] T206 [US1.10] Cross-app profile sections: bg-muted without border in all 6 apps
      (ProfileSections.tsx, UserProfilePage.tsx) —
      `apps/*/src/features/profile/ui/ProfileSections.tsx`,
      `apps/*/src/features/profile/pages/UserProfilePage.tsx`
- [x] T207 [US1.09] ABN/tax format validation + schema extraction — backend @Matches regex (ABN: 11
      digits, taxCode: 1-11 digits) on CreateCompanyDto + UpdateCompanyDto. Frontend Zod schema
      extracted to `company-form.schema.ts`. i18n validation keys —
      `apps/backend/src/modules/companies/companies.service.ts`,
      `apps/company-admin-app/src/features/settings/schemas/company-form.schema.ts`,
      `apps/company-admin-app/src/features/settings/ui/EditCompanyModal.tsx`
- [x] T208 [US1.10] Approval Responsibilities → empty state (no backend API yet). Removed
      APPROVAL_PLACEHOLDER_COUNT mock data from constants.ts. Shows "No approval responsibilities
      assigned yet" message — `apps/*/src/features/profile/ui/ProfileSections.tsx`,
      `apps/*/src/features/profile/constants.ts`
- [x] T209 [US1.10] Activity Log → real getAuditLogs API. Removed ACTIVITY_LOG_MOCK_ENTRIES mock
      data. ActivityLogSection accepts userId prop, queries GET /audit-logs?performedById=userId.
      Removed role restriction on audit controller. i18n profile keys added —
      `apps/*/src/features/profile/ui/ProfileSections.tsx`,
      `apps/*/src/features/profile/pages/UserProfilePage.tsx`,
      `apps/*/src/features/users/ui/UserDetailPage.tsx`,
      `apps/backend/src/modules/audit/audit.controller.ts`

- [x] T210 [US1.09] Mask ABN in super-admin company overview — show `#` per character instead of
      real value. Added `masked` prop to InfoItem —
      `apps/super-admin-app/src/features/companies/ui/OverviewTab.tsx`
- [x] T211 [US1.09] Fix empty-string validation errors on company update — `""` was sent for
      optional fields (abn, taxCode, contactEmail, website) which failed backend @Matches/@IsEmail/
      @IsUrl validators. Added `emptyToUndefined()` helper —
      `apps/company-admin-app/src/features/settings/ui/EditCompanyModal.tsx`
- [x] T212 [US1.09+US2] Google Places address autocomplete — backend Google module
      (`POST /google/places/addresses`) using Google Places API (New), reusable `AddressInput` UI
      component with debounce + keyboard navigation, replaced all location `<Input>` fields
      (EditCompanyModal legalAddress, CreateProjectPage + EditProjectPage delivery/storage) —
      `apps/backend/src/modules/google/`, `packages/ui-components/src/components/AddressInput.tsx`,
      `packages/api-client/src/endpoints/google.ts`,
      `apps/company-admin-app/src/features/settings/ui/EditCompanyModal.tsx`,
      `apps/company-admin-app/src/features/projects/ui/CreateProjectPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`
- [x] T213 [US1.07] Add success toast notifications for Resend Invitation and Cancel Invitation
      actions in UserListPage and UserDetailPage (super-admin + company-admin). Fix DotActionsMenu
      focus jumping to next row after action — return focus to trigger button via triggerRef. i18n:
      add `cancelInvitationSuccess` key —
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserDetailPage.tsx`,
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/company-admin-app/src/features/users/ui/UserDetailPage.tsx`,
      `packages/ui-components/src/components/DotActionsMenu.tsx`,
      `packages/i18n/src/locales/en/users.json`
- [x] T214 [US2] Replace native HTML form elements with custom components in all project pages.
      `<select>` → `CustomDropdown` (via Controller), `<input type="checkbox">` → `Checkbox`,
      `<input type="radio">` → `RadioButton`. "Remove" text → DeleteIcon. "Add Location" link color
      muted (not blue). Team members vertical stacking. Removed "Back to projects" link —
      `apps/company-admin-app/src/features/projects/ui/CreateProjectPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/ProjectListPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/ProjectDetailPage.tsx`
- [x] T215 [US1] Fix whitespace rendering: replace JSX `{' '}` with `&nbsp;` across all apps
      (ActivateAccountPage, ResetPasswordPage, EditProfileModal, EditUserModal, ActionLogTab) to
      prevent inconsistent space collapsing — all 6 apps auth + profile + users UI files

---

## Future Epics — Task Outline (from Designer Wireframe Review 2026-03-04)

_These task groups cover all remaining User Stories (US-3 through US-15) identified in the designer
wireframe cross-reference. Tasks are listed at outline level — detailed task IDs and file paths will
be generated via `/speckit.tasks` when each epic begins implementation._

### Epic 3 — RFQ Creation & Vendor Quote Collection (US-3, US-4)

**Prerequisites**: Epic 2 complete, Material Catalog (US-7) at least schema-ready for line items

#### Backend Tasks

- [ ] Prisma schema: RFQ, RFQLineItem, RFQVendor models + migration
- [ ] Prisma schema: Quote, QuoteLineItem models + migration
- [ ] RFQ module: `rfqs.controller.ts`, `rfqs.service.ts`, `rfqs.module.ts`
- [ ] Quote module: `quotes.controller.ts`, `quotes.service.ts`, `quotes.module.ts`
- [ ] RFQ status machine: Draft → Sent → Responded → Closed
- [ ] Vendor tokenized access: generate token, validate, rate limit
- [ ] RFQ dispatch: send tokenized links to selected vendors via email
- [ ] Seed data: sample RFQs and quotes for testing

#### Shared Types & API Client

- [ ] `RfqStatus` enum, `QuoteStatus` enum in `packages/shared-types`
- [ ] RFQ DTOs (Create, Update, List, Response) + Zod schemas
- [ ] Quote DTOs (Submit, Response) + Zod schemas
- [ ] API client: RFQ endpoints, Quote endpoints
- [ ] i18n: `rfqs.json`, `quotes.json`

#### Frontend Tasks (procurement-officer-app)

- [ ] Routes: `/rfqs`, `/rfqs/new`, `/rfqs/:id`, `/rfqs/:id/compare`
- [ ] RFQ list page (status/vendor/project/date filters, pagination)
- [ ] Create RFQ page (items from catalog, quantities, project selector, deadline, notes, BOM
      attach)
- [ ] RFQ detail page (line items, vendor responses, status actions)
- [ ] Vendor Response Viewer (compare side-by-side, highlight best price, accept winning)
- [ ] Sidebar: add "RFQs" nav item

#### Frontend Tasks (vendor-app — tokenized)

- [ ] Public route: `/rfqs/:token` (no auth required)
- [ ] Vendor RFQ page (company logo, RFQ number, items table, price inputs, upload quote, submit)

#### Frontend Tasks (company-admin-app)

- [ ] Routes: `/rfqs`, `/rfqs/:id`
- [ ] RFQ list + detail (read access)
- [ ] Sidebar: add "RFQs" nav item

#### RFQ Enhancements (US-5.05, US-5.06, US-5.18, US-5.19, US-5.24)

- [ ] RFQ line-level pick-up flag: mark individual RFQ line items as pick-up
- [ ] RFQ bulk order check: on line item confirmation, check against active bulk orders and suggest
      drawdowns
- [ ] RFQ creation from saved material list
- [ ] RFQ edit before vendor response + vendor notification
- [ ] Quote comparison table view: horizontal scroll, fixed item column, per-vendor columns
- [ ] Quote list view: vendor response cards with key info
- [ ] Line-level approval with multi-vendor quantity allocation
- [ ] Approved quantity validation (cannot exceed RFQ requested, cannot be zero)

---

### Epic 3b — Material Catalogue (US-4.01, US-4.02, US-4.03, US-4.04, US-5.01, US-5.02)

**Prerequisites**: None (independent of procurement epics)

#### Backend Tasks

- [ ] Prisma schema: Material, MaterialCategory, MaterialSuggestion, MaterialList, MaterialListItem,
      BOM, BOMLineItem models + migration
- [ ] Materials module: CRUD, archive/unarchive, duplicate detection, suggestion approve/reject
- [ ] Material import module: file upload (XLS/XLSX/CSV), column detection, column mapping,
      structured extraction
- [ ] Material search: full-text search with autocomplete, frequency/recency ranking, BOM item
      recommendations
- [ ] BOM module: document upload (XLS/XLSX/CSV/PDF), OCR extraction, catalogue matching with
      confidence scores
- [ ] Material lists module: CRUD for lists, add/remove materials, company-scoped visibility
- [ ] Seed data: sample materials, categories, BOMs

#### Shared Types & API Client

- [ ] Material DTOs, MaterialList DTOs, BOM DTOs + Zod schemas
- [ ] API client: materials, material-lists, bom endpoints
- [ ] i18n: `materials.json`, `bom.json`

#### Frontend Tasks

- [ ] super-admin-app: Material list page with filters + admin actions (approve/reject suggestions)
- [ ] super-admin-app: Material detail page (edit all fields, archive/unarchive)
- [ ] procurement-officer-app / company-admin-app: Material list with smart search + filters
- [ ] procurement-officer-app / company-admin-app: File import wizard (upload → column mapping →
      review → save)
- [ ] procurement-officer-app / company-admin-app: Material lists and favourites management
- [ ] procurement-officer-app / company-admin-app: BOM upload wizard (upload → extract → match →
      review → save)
- [ ] procurement-officer-app / company-admin-app: BOM edit page (add/edit/remove items)
- [ ] Routes: `/materials`, `/materials/:id`, `/materials/import`, `/materials/lists`,
      `/bom/:projectId`

---

### Epic 4 — Purchase Order Management (US-5, US-15)

**Prerequisites**: Epic 3 complete (PO created from approved RFQ quotes)

#### Backend Tasks

- [ ] Prisma schema: PurchaseOrder, POLineItem, POVersion models + migration
- [ ] Prisma schema: ChangeOrder, ChangeOrderItem models + migration
- [ ] PO module: `purchase-orders.controller.ts`, `purchase-orders.service.ts`
- [ ] PO status machine: Draft → Sent → Acknowledged → Pending Delivery → Delivered → Closed
- [ ] PO number generation: unique sequential per company
- [ ] PO version management: create new version on change order approval
- [ ] Change Order module: `change-orders.controller.ts`, `change-orders.service.ts`
- [ ] Change Order classification engine: Minor/Major based on configurable thresholds
- [ ] Approval Engine integration for Major change orders
- [ ] Vendor tokenized PO access: token generation, acknowledge/reject endpoints
- [ ] Internal comment thread: scoped to PO document (Office ↔ Vendor ↔ Field)
- [ ] Seed data: sample POs with different statuses
- [ ] Line-item validation endpoint: POST /v1/purchase-orders/validate-items — checks items against
      warehouse inventory, bulk orders, approved RFQs and returns suggestions
- [ ] DEFERRED (US 5.11, post-R1): PO split endpoint: POST /v1/purchase-orders/:id/split — splits
      multi-vendor PO into per-vendor POs
- [ ] Material request → PO conversion: pre-populate PO from material request data
- [ ] Vendor auto-populate: return vendor details (company, legal info, address) on vendor selection
- [ ] Line-level delivery location + warehouse location fields in PO line items

#### Shared Types & API Client

- [ ] `PoStatus` enum, `ChangeOrderStatus` enum, `ChangeClassification` enum
- [ ] PO DTOs, ChangeOrder DTOs + Zod schemas
- [ ] API client: PO endpoints, ChangeOrder endpoints
- [ ] i18n: `purchaseOrders.json`, `changeOrders.json`

#### Frontend Tasks (procurement-officer-app)

- [x] Routes: `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/:id`,
      `/purchase-orders/:id/change-order`
- [x] PO list page (status/vendor/project/change-order filters) — US-2.07 shared via
      `@forethread/po-shared`
- [ ] Create PO page (from RFQ or manual, items, prices, delivery details)
- [ ] DEFERRED (US 5.11, post-R1): Create PO page: multi-vendor support with line items grouped by
      vendor
- [ ] Create PO page: line-item validation panel (warehouse/bulk/RFQ suggestions)
- [ ] Create PO page: material request source selection + auto-populate
- [ ] Create PO page: vendor auto-populate on selection
- [ ] PO detail page (items, status, vendor acknowledgement, comment thread, change history)
- [ ] Change Order flow (Step 1–5 per designer US22: edit items, justify, classify, submit, approve)
- [x] Sidebar: add "Purchase Orders" nav item

#### Frontend Tasks (vendor-app — tokenized)

- [ ] Public route: `/purchase-orders/:token`
- [x] Vendor PO list page (group by project/status, quick filters, search, pagination) — US-2.07
- [ ] Vendor PO detail page (details, items, acknowledge/reject, upload receipt/docket)

#### Frontend Tasks (company-admin-app + financial-officer-app)

- [x] Routes: `/purchase-orders`, `/purchase-orders/:id` (both apps)
- [x] PO list page (role-appropriate columns, saved views, drag-drop columns, export) — US-2.07
- [x] T690 PO list backend enrichment: linkedRfqAvgPrice (QuoteResponse avg), lineItemsDelivered,
      quantityDelivered, attachmentsCount — US-2.07
- [x] T691 DatePicker sectioned masked input (DD/MM/YYYY) with minDate/maxDate validation — US-2.07
- [ ] PO detail page (role-appropriate actions)
- [x] Sidebar: add "Purchase Orders" nav item

---

### Epic 4c — Change Requests, Pick-up & Bulk Auto-Apply (US-5.12, US-5.15, US-5.23, US-5.24)

**Prerequisites**: Epic 4 PO Management complete

#### Backend Tasks

- [ ] Change request module: commercial vs internal classification
- [ ] Commercial change approval workflow: submit → pending → approve/reject with notification
- [ ] Internal change: apply immediately, notify other party
- [ ] PO version history: log all changes with user, fields, values, type, timestamp
- [ ] Pick-up PO: time expectation field, contact details, pick-up reports
- [ ] Bulk auto-apply: detect active agreements on PO creation, apply bulk pricing, partial coverage
- [ ] Bulk quantity deduction on PO issuance

#### Frontend Tasks

- [ ] PO change request form: commercial vs internal, field-level changes with current/proposed
      values
- [ ] PO change request review page: approve/reject with comment
- [ ] PO version history timeline
- [ ] Pick-up PO: checkbox, time expectation selector, contact fields
- [ ] Pick-up RFQ items: per-line-item pick-up toggle
- [ ] Bulk auto-apply UI: show bulk availability per line item, remaining quantity indicator
- [ ] Bulk partial coverage: split line item into bulk-priced and standard portions

---

### Epic 5 — Vendor & Supplier Management (US-6)

**Prerequisites**: Companies module (existing)

#### Backend Tasks

- [ ] Prisma schema: VendorProfile, SalesRepresentative, VendorContractorRelation + migration
- [ ] Vendor module: `vendors.controller.ts`, `vendors.service.ts`
- [ ] Vendor invitation flow (add existing vendor to contractor list)
- [ ] Vendor profile management (specialisations, warehouse locations, reps)
- [ ] Messages module: document-scoped messaging threads

#### Frontend Tasks

- [ ] procurement-officer-app: `/vendors`, `/vendors/:id`
- [ ] company-admin-app: `/vendors`, `/vendors/:id`
- [ ] vendor-app: `/profile` (manage own profile, reps, specialisations)
- [ ] Sidebar: add "Vendors" to company-admin-app and procurement-officer-app

---

### Epic 6 — Material Catalogue Management (US-7)

**Prerequisites**: None (can start in parallel with Epic 3)

#### Backend Tasks

- [ ] Prisma schema: Material, MaterialCategory, BOM, BOMItem models + migration
- [ ] Materials module: `materials.controller.ts`, `materials.service.ts`
- [ ] Material import: CSV/XLS upload, column mapping, duplicate detection
- [ ] BOM module: `bom.controller.ts`, `bom.service.ts`
- [ ] Material suggestions: user-suggested materials pending SA approval

#### Frontend Tasks

- [ ] procurement-officer-app: `/materials`, `/materials/:id`, `/materials/import`
- [ ] super-admin-app: `/materials` (admin management, approve suggestions)
- [ ] Material list page (filters: category, UOM, price, duplicates)
- [ ] Material detail page (name, manufacturer, SKU, UOM, price, description, photos, deprecated)
- [ ] Duplicate detection UI (flag + resolve)
- [ ] Archive / Unarchive actions
- [ ] Sidebar: add "Material Catalog" to procurement-officer-app

---

### Epic 7 — Warehouse Operations (US-13 — NEW)

**Prerequisites**: Materials module (Epic 6), Inventory schema

#### Backend Tasks

- [ ] Prisma schema: WarehouseRequest, WarehouseRequestItem, InventoryItem, InventoryTransaction +
      migration
- [ ] Warehouse requests module: `warehouse-requests.controller.ts`, `warehouse-requests.service.ts`
- [ ] Inventory module: `inventory.controller.ts`, `inventory.service.ts`
- [ ] Barcode lookup endpoint
- [ ] Stock level aggregation queries

#### Frontend Tasks (warehouse-officer-app — currently shell only)

- [ ] Routes: `/` (home/task queue), `/warehouse-requests`, `/warehouse-requests/:id`, `/inventory`,
      `/inventory/scanner`, `/inventory/stock-levels`
- [ ] Home page: task queue (new requests, items to pick, pending deliveries, confirm deliveries)
- [ ] Warehouse request list + detail (confirm stock, mark ready for pickup / sent to jobsite)
- [ ] Inventory scanner page (live camera barcode scan)
- [ ] Stock levels page (manual search, incoming/outgoing logs)
- [ ] Sidebar: replace Dashboard+Settings with Home, Warehouse Requests, Inventory, Settings

---

### Epic 8 — Field Worker Mobile Features (US-14 — NEW)

**Prerequisites**: Materials module (Epic 6), PO comment thread (Epic 4)

**Note**: Foreman app is specified as native mobile in Assumptions. If implementing as responsive
web, scaffold `foreman-app` or extend `warehouse-officer-app` with field features.

#### Backend Tasks

- [ ] Prisma schema: MaterialRequest, MaterialRequestItem, MaterialRequestPhoto + migration
- [ ] Material requests module: `material-requests.controller.ts`, `material-requests.service.ts`
- [ ] Photo upload to MinIO
- [ ] Delivery confirmation module: extend with photo, defect reporting
- [ ] Offline sync support: conflict resolution strategy for draft requests

#### Frontend Tasks (foreman-app or mobile responsive)

- [ ] Routes: `/` (home), `/material-requests`, `/material-requests/new`, `/deliveries/:id/confirm`
- [ ] Home page: assigned projects switcher, pending deliveries, draft requests
- [ ] Material request form (items, quantities, photos from camera, offline draft)
- [ ] Delivery confirmation (take photo, mark received, report defects, chat in PO thread)
- [ ] Service worker for offline mode + background sync
- [ ] Bottom navigation: Home, Material Request, Delivery Tracking, Notifications, Profile

---

### Epic 9 — Invoice Reconciliation & Documents (US-9)

**Prerequisites**: PO module (Epic 4)

#### Backend Tasks

- [ ] Prisma schema: Invoice, InvoiceLineItem, InvoiceHistory, Dispute, DisputeMessage + migration
- [ ] Invoice upload module: file validation (PDF/PNG/JPG/XLS/DOC/CSV, 10MB), drag-drop support
- [ ] Invoice OCR module: extract header data + line items, confidence scoring
- [ ] Invoice-PO matching: auto-align extracted line items with PO line items by material identity
- [ ] Reconciliation engine: aggregate ordered (PO) + delivered (optional) + invoiced quantities
- [ ] Line-item and document-level approval/rejection with blocking rules
- [ ] Dispute module: create dispute on rejection, communication thread, per-field change proposals
- [ ] Invoice history: immutable event log (upload, edit, reconciliation, approval, dispute, status)
- [ ] Payment notification service: configurable lead time, in-app + email delivery, auto-clear on
      Paid
- [ ] Multi-PO invoice linking: aggregate reconciliation across linked POs
- [ ] Financial reports module (optional): price per item, total spend, spend vs committed, date
      range
- [ ] Seed data: sample invoices with different statuses

#### Shared Types & API Client

- [ ] Invoice DTOs, Dispute DTOs, Report DTOs + Zod schemas
- [ ] API client: invoice endpoints, dispute endpoints, report endpoints
- [ ] i18n: `invoices.json` (expand), `disputes.json`, `reports.json`

#### Frontend Tasks

- [ ] Invoice upload page: drag-drop, file preview, PO selection (multi-select)
- [ ] Invoice OCR review page: original document preview + editable extracted data form
- [ ] Invoice-PO alignment review: change/remove line-item alignment, add missing items
- [ ] Reconciliation table: ordered vs delivered vs invoiced, line-item approve/reject
- [ ] Document-level approval with blocking if any line rejected
- [ ] Dispute management: communication thread, per-field change proposals, approve/reject
- [ ] Invoice history timeline: immutable event log with action type, user, timestamp
- [ ] Payment notification config: lead time setting in user preferences
- [ ] Financial reports page (optional): price per item, spend, committed vs actual, date range,
      export
- [ ] Routes: `/invoices`, `/invoices/:id`, `/invoices/:id/reconcile`, `/reports`

---

### Epic 10 — Dashboards & KPI Cards (US-10)

**Prerequisites**: Data from Epics 3–9 (aggregation endpoints)

#### Backend Tasks

- [ ] Dashboard aggregation endpoints per role (counts, sums, trends)
- [ ] Company Admin: total spend, cost-to-complete, inventory value, pending RFQs/POs, change orders
- [ ] Procurement Officer: RFQs sent, awaiting quote, winning value, approved POs, delayed
      deliveries
- [ ] Vendor: open RFQs, active POs, pending invoices
- [ ] Finance Officer: pending reconciliation, overdue payments, approved this period

#### Frontend Tasks

- [ ] Replace dashboard stubs in all 6 apps with role-specific KPI cards
- [ ] company-admin-app: KPI cards with filters (period, project, vendor, status)
- [ ] procurement-officer-app: KPI cards with filters (date range, vendor, project)
- [ ] financial-officer-app: Invoice-focused KPIs
- [ ] vendor-app: Summary cards
- [ ] super-admin-app: "Open Analytics Dashboard" button (Google Analytics link)

---

### Epic 11 — Bulk Orders (US-8)

**Prerequisites**: RFQ (Epic 3), PO (Epic 4)

#### Tasks (outline)

- [ ] Prisma schema: BulkOrder, BulkOrderLineItem, Drawdown + migration
- [ ] Bulk order module: create from RFQ, drawdown management, expiry handling
- [ ] Frontend: bulk order list, detail, drawdown UI

---

### Epic 12 — Notifications, Logs, Currency & Admin Panel (Cross-Cutting)

**Prerequisites**: None (can be incremental)

#### Backend Tasks

- [ ] Notification engine: event-driven notifications for all business events
- [ ] Email notification service: template-based delivery for all notification types
- [ ] User notification preferences: per-event channel configuration (in-app, email)
- [ ] Notification grouping by type and priority
- [ ] Immutable system logs: extend audit module for all business documents
- [ ] Currency module: AUD default, per-document currency selection from predefined list
- [ ] Admin panel API: integration status, background job monitoring, retry failed jobs, error logs
- [ ] System alerts: integration failures, processing errors, queue backlogs

#### Frontend Tasks

- [ ] Notification centre: bell icon dropdown with notification list, mark as read
- [ ] Notification preferences page in settings: per-event, per-channel toggles
- [ ] System log display in document detail pages (read-only timeline)
- [ ] Currency selector in document creation forms (RFQ, PO, invoice)
- [ ] Admin panel page (super-admin): integration health, job status, retry, error logs

---

### Epic 13 — Sidebar Navigation Update (Global)

**Note**: This should be done incrementally as each epic is completed. When a new feature module is
implemented, add the corresponding sidebar item.

#### Sidebar Redesign (Completed)

- [x] Rewrite `Sidebar` component: collapsible (240px / 64px), portal-based hover tooltips, active
      states, `hasSubmenu` chevron, `companyName` slot, localStorage persistence
- [x] company-admin-app: 8 items — RFQs, Purchase Orders, Projects, Bulk Orders, Invoices, Vendors,
      Material Catalogue, Company Settings (placeholder pages for unimplemented features)
- [x] financial-officer-app: 3 items — Dashboard, Invoices (moved from settings to top-level),
      Settings
- [x] super-admin-app: 3 items — Dashboard, Companies, Settings (unchanged)

#### Remaining Navigation Per App (as features are implemented)

- [ ] company-admin-app: +Documents (when Epic 9 Documents is implemented)
- [ ] procurement-officer-app: +Material Catalog, +RFQs, +Purchase Orders, +Vendors, +Projects,
      +Documents
- [ ] financial-officer-app: +Purchase Orders, +Documents
- [ ] warehouse-officer-app: replace Dashboard with Home, +Warehouse Requests, +Inventory
- [ ] vendor-app: +RFQs, +Purchase Orders, +Documents

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Shared Types)**: No dependencies on other Epic 2 phases — can start immediately.
  Depends on Epic 1 shared-types being complete (they are).
- **Phase 2 (Prisma Schema)**: No dependency on Phase 1 (Prisma models use enums defined in
  schema.prisma, not shared-types). Can start in parallel with Phase 1.
- **Phase 3 (Backend Module)**: Depends on Phase 1 (DTOs from shared-types) AND Phase 2 (Prisma
  models). BLOCKS Phase 5 frontend project pages.
- **Phase 4 (company-admin-app Scaffold)**: Depends on Phase 1 (shared-types, api-client, i18n). Can
  run in parallel with Phase 2 and Phase 3.
- **Phase 5 (Projects UI)**: Depends on Phase 3 (backend API must be running) AND Phase 4 (app
  scaffold must be complete).
- **Phase 6 (Polish)**: Depends on Phase 3 and Phase 5 completion.

### Critical Path

```
Phase 1 (Shared Types)  ──┬──▶  Phase 3 (Backend Module) ──▶  Phase 5 (Projects UI) ──▶  Phase 6
Phase 2 (Prisma Schema)  ─┘                                        ▲
Phase 1 ──▶  Phase 4 (App Scaffold) ──────────────────────────────┘
```

### Within Phase 3 (Backend)

```
T104 (ProjectAccessGuard) ──┐
                             ├──▶  T106 (Controller — uses guard + service)
T105 (ProjectsService)  ────┘         │
                                      ▼
                              T107 (Module registration)
                                      │
                                      ▼
                              T108 (Seed data — needs module registered)
```

### Within Phase 4 (App Scaffold)

```
T109–T113 (Config files — all parallel) ──▶  T114 (main.tsx — needs package.json)
                                                │
T117 (auth.store)  ───────────────────────▶  T118 (auth.service — uses store)
                                                │
T115 (AppLayout)  ────────────────┐         T119 (auth pages — uses service)
T116 (PrivateRoute — uses store)  ├──▶  T120 (routes — assembles layout + pages)
T119 (auth pages)  ───────────────┘         │
T121 (DashboardPage)  ────────────────────▶ T120
```

### Within Phase 5 (Projects UI)

```
T122 (projects.store) ──┐
                         ├──▶  T124 (ProjectListPage)
T123 (projects.service) ─┤
                         ├──▶  T125 (CreateProjectPage)
                         ├──▶  T126 (ProjectDetailPage)
                         └──▶  T127 (EditProjectPage)
```

T124–T127 can run in parallel once T122 and T123 are done.

### Parallel Opportunities

```bash
# Phase 1: All shared type tasks in parallel:
T093 (enums) | T094 (DTOs) | T095 (Zod schemas) | T097 (i18n)
# T096 (api-client) runs after T094 (needs DTO types)

# Phase 2 + Phase 1 run in parallel:
Phase 1 tasks | T098–T103 (schema tasks are sequential)

# Phase 3 Backend: Guard and service in parallel:
T104 (guard) | T105 (service)
# Then T106 (controller), T107 (module), T108 (seed) sequentially

# Phase 4 Scaffold: Config files in parallel:
T109 (package.json) | T110 (vite/tsconfig) | T111 (tailwind) | T112 (Dockerfile) | T113 (.env)

# Phase 4 Auth: Pages in parallel after store + service:
T119 (all 5 auth pages written as one task — different files)

# Phase 5 Project Pages: All in parallel after store + service:
T124 (list) | T125 (create) | T126 (detail) | T127 (edit)

# Phase 6 Polish: All in parallel:
T128 (swagger) | T129 (throttle) | T130 (build check)
```

---

## Parallel Example: Full Epic 2 with 2 Engineers

```bash
# STEP 1 — Both engineers start simultaneously:
Engineer A: Phase 1 (T093–T097) — Shared types, DTOs, schemas, api-client, i18n
Engineer B: Phase 2 (T098–T103) — Prisma schema + migration

# STEP 2 — After Phase 1 + 2 complete:
Engineer A: Phase 3 (T104–T108) — Backend projects module
Engineer B: Phase 4 (T109–T121) — company-admin-app scaffold + auth

# STEP 3 — After Phase 3 + 4 complete:
Engineer A: Phase 5 (T122–T123, then T124–T125) — Store, service, list, create pages
Engineer B: Phase 5 (T126–T127) — Detail page, edit page

# STEP 4 — After Phase 5 complete:
Both: Phase 6 (T128–T131) — Polish, build validation, E2E verification
```

---

## Implementation Strategy

### MVP First (Epic 2)

1. Complete **Phase 1** (Shared Types) + **Phase 2** (Prisma Schema) — in parallel
2. Complete **Phase 3** (Backend Module) — projects API functional
3. **STOP AND VALIDATE**: `curl` project endpoints with seeded data, verify RBAC + project-scoped
   access
4. Complete **Phase 4** (App Scaffold) — company-admin-app boots with auth
5. Complete **Phase 5** (Projects UI) — full project management in browser
6. **STOP AND VALIDATE**: Run all verification criteria from plan.md
7. Complete **Phase 6** (Polish) — Swagger, rate limiting, build check

### Incremental Delivery

- After T103 (migration): Database has project tables — visible in Prisma Studio
- After T107 (module): Backend API is live — testable via Swagger/curl
- After T108 (seed): Seeded projects available — no manual setup needed
- After T120 (routing): company-admin-app boots with auth — deployable shell
- After T127 (edit page): Complete Epic 2 — all 4 acceptance scenarios pass

### Key Metrics

| Phase                   | Tasks          | Parallel              | Description                              |
| ----------------------- | -------------- | --------------------- | ---------------------------------------- |
| Phase 1: Shared Types   | T093–T097 (5)  | 4 of 5                | Enums, DTOs, Zod, API client, i18n       |
| Phase 2: Prisma Schema  | T098–T103 (6)  | 0 of 6                | Sequential (shared schema file)          |
| Phase 3: Backend Module | T104–T108 (5)  | 1 of 5                | Guard, service, controller, module, seed |
| Phase 4: App Scaffold   | T109–T121 (13) | 7 of 13               | Config, bootstrap, auth, routing         |
| Phase 5: Projects UI    | T122–T127 (6)  | 4 of 6                | Store, service, 4 pages                  |
| Phase 6: Polish         | T128–T131 (4)  | 3 of 4                | Swagger, throttle, build, E2E            |
| **Total**               | **39 tasks**   | **19 parallelizable** | **Epic 2 complete**                      |

### Acceptance Scenarios Coverage

| Scenario                                                     | Covered By                                        |
| ------------------------------------------------------------ | ------------------------------------------------- |
| AS-1: PO creates project, auto-assigned, cannot manage users | T105 (service logic), T125 (create page)          |
| AS-2: CA sees project detail with overview + section tabs    | T106 (detail endpoint), T126 (detail page)        |
| AS-3: Unassigned user cannot access project                  | T104 (guard), T105 (list scoping)                 |
| AS-4: Duplicate project name rejected                        | T105 (uniqueness check), T125 (409 error display) |

### Independent Test Criteria for US2

✅ CompanyAdmin can create a project via `POST /v1/projects` with name, locations, members ✅
Project appears in `GET /v1/projects` for assigned users only ✅ Unassigned user gets empty list /
403 on direct project access ✅ Duplicate project name within company returns 409 ✅ CompanyAdmin
can add/remove members; ProcurementOfficer cannot ✅ Project detail shows locations, members, and
placeholder tabs ✅ company-admin-app at localhost:3002 provides full project management UI

---

## Post-Epic 2: Reusable UI Components & Polish

**Purpose**: Fix spec gap in T094 (missing Swagger typing for `GET /v1/projects`), extract 13
reusable UI components from duplicated patterns across both apps, and refactor all pages to use
shared components.

### Part A: Backend Spec Gap Fix

- [x] A1 — Add `PaginationMetaDto` and `PaginatedProjectsResponseDto` classes to
      `packages/shared-types/src/dtos/project.dto.ts` with `@ApiProperty` + class-validator
      decorators; field is `items` (matches `projects.service.ts` return shape)
- [x] A2 — Import `PaginatedProjectsResponseDto` in
      `apps/backend/src/modules/projects/projects.controller.ts` and use it in `@ApiResponse` on
      `GET /v1/projects` so Swagger docs are properly typed

### Part B: Reusable UI Components (`packages/ui-components`)

- [x] B1 — Create `Button.tsx`: variants (primary, outline, ghost, destructive), sizes (sm, md, lg),
      `isLoading` prop, `forwardRef`; plus `buttonVariants()` helper for `<Link>` styling
- [x] B2 — Create `Input.tsx`: `forwardRef`, extends `InputHTMLAttributes`, shared styling with CSS
      variable tokens
- [x] B3 — Create `Textarea.tsx`: `forwardRef`, extends `TextareaHTMLAttributes`
- [x] B4 — Create `Select.tsx`: `forwardRef`, extends `SelectHTMLAttributes`
- [x] B5 — Create `FormField.tsx`: `label`, `error`, `required`, `children` slot wrapper
- [x] B6 — Create `Alert.tsx`: variants (destructive, success, warning, info)
- [x] B7 — Create `Spinner.tsx` + `PageLoader`: size variants (sm, md, lg)
- [x] B8 — Create `Badge.tsx`: generic shell with `className` for color customization
- [x] B9 — Create `Modal.tsx`: compound component (Modal, ModalHeader, ModalBody, ModalFooter),
      Escape key handling, backdrop click close
- [x] B10 — Create `ConfirmDialog.tsx`: uses Modal internally, title/message/confirmVariant props
- [x] B11 — Create `Pagination.tsx`: page/totalPages/onPageChange with i18n label props
- [x] B12 — Create `EmptyState.tsx`: title/description/action slot
- [x] B13 — Create `AuthLayout.tsx`: appName/subtitle/children wrapping shared auth page shell
- [x] B14 — Update `packages/ui-components/src/index.ts` barrel export with all 13 components +
      `buttonVariants` + type exports

### Part C: Refactor Both Apps to Use Shared Components

- [x] C1 — Replace inline `PageLoader` in both `apps/*/src/app/routes.tsx` with shared `PageLoader`
- [x] C2 — Refactor 5 auth pages in `apps/company-admin-app/src/features/auth/ui/` to use
      `AuthLayout`, `Input`, `FormField`, `Button`, `Alert`
- [x] C3 — Refactor 5 auth pages in `apps/super-admin-app/src/features/auth/ui/` to use
      `AuthLayout`, `Input`, `FormField`, `Button`, `Alert`
- [x] C4 — Refactor `ProjectListPage.tsx`: use `Spinner`, `Badge`, `Pagination`, `EmptyState`,
      `Input`, `Select`, `Button`
- [x] C5 — Refactor `CreateProjectPage.tsx`: use `Input`, `Textarea`, `Select`, `FormField`,
      `Button`, `Alert`, `Spinner`, `buttonVariants`
- [x] C6 — Refactor `ProjectDetailPage.tsx`: use `Spinner`, `Badge`, `Button`, `Modal`,
      `ConfirmDialog`, `buttonVariants`
- [x] C7 — Refactor `EditProjectPage.tsx`: use `Input`, `Textarea`, `Select`, `FormField`, `Button`,
      `Alert`, `Spinner`, `buttonVariants`
- [x] C8 — Refactor `UserListPage.tsx`: use `Spinner`, `Badge`, `Pagination`, `EmptyState`, `Input`,
      `Select`, `Button`
- [x] C9 — Refactor `UserDetailPage.tsx`: use `Spinner`, `Badge`, `Button`, `Alert`, `ConfirmDialog`
- [x] C10 — Refactor `CreateUserModal.tsx`: use `Modal`, `ModalHeader`, `ModalBody`, `Input`,
      `Select`, `FormField`, `Button`, `Alert`

### Verification

- [x] `pnpm turbo typecheck` — zero type errors in all packages and both apps
- [x] `pnpm turbo build --filter=company-admin-app --filter=super-admin-app` — both apps build
      successfully

---

## Post-Epic 2: Design System Alignment & Theme Infrastructure

**Purpose**: Align UI components with Figma design system, add light/dark theme switching
infrastructure, extract global color and typography constants from Figma, and enable SVG icon
imports. Font changed from Inter to Urbanist per Figma spec.

### Part D: UI Component Updates (Figma Alignment)

- [x] D1 — Update `Input.tsx`: add `leftIcon` and `rightIcon` props (ReactNode), wrap in relative
      `div` with absolute-positioned icon slots, adjust padding when icons present, change border
      radius to `rounded-xl`; backward-compatible (no icons = works as before) —
      `packages/ui-components/src/components/Input.tsx`
- [x] D2 — Create `PasswordInput.tsx`: wraps `Input` with show/hide toggle, `leftIcon` prop for
      custom lock icon, built-in eye/eye-off SVG icons (inline, no external dependency), `showIcon`
      and `hideIcon` props for custom override; export from barrel —
      `packages/ui-components/src/components/PasswordInput.tsx`
- [x] D3 — Update `Button.tsx`: change `primary` variant to dark (`bg-foreground text-background`),
      add `secondary` (muted), `info` (brand blue, former primary colour) variants, add `leftIcon`,
      `rightIcon`, `iconOnly` props, change border radius to `rounded-xl`; update `buttonVariants()`
      helper with `iconOnly` size map — `packages/ui-components/src/components/Button.tsx`
- [x] D4 — Update `AuthLayout.tsx`: add `icon` (ReactNode), `title`, `description` props for in-card
      header rendering, change card border radius to `rounded-2xl`; maintain backward compatibility
      with legacy `appName`/`subtitle` props (external header fallback) —
      `packages/ui-components/src/components/AuthLayout.tsx`
- [x] D5 — Update `packages/ui-components/src/index.ts`: add `PasswordInput` and
      `PasswordInputProps` exports — `packages/ui-components/src/index.ts`

### Part E: Auth Pages Refresh

- [x] E1 — Refactor `apps/company-admin-app/src/features/auth/ui/LoginPage.tsx`: use `PasswordInput`
      for password field, use new `AuthLayout` with `title`/`description` props, change "Forgot
      password?" link to left-aligned dark text (`text-foreground`)
- [x] E2 — Refactor `apps/company-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`: use new
      `AuthLayout` with `title`/`description`, change "Back to sign in" link to left-aligned dark
      text
- [x] E3 — Refactor `apps/company-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`: use
      `PasswordInput` for both password fields, use new `AuthLayout` with `title`, change error card
      to `rounded-2xl`
- [x] E4 — Refactor `apps/super-admin-app/src/features/auth/ui/LoginPage.tsx`: same changes as E1
- [x] E5 — Refactor `apps/super-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`: same changes
      as E2
- [x] E6 — Refactor `apps/super-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`: same changes
      as E3

### Part F: Theme Infrastructure (Light/Dark)

- [x] F1 — Add `darkMode: 'class'` to shared Tailwind preset — `packages/config/tailwind/preset.ts`
- [x] F2 — Add `.dark` CSS custom property block to both `globals.css` files with inverted colour
      values derived from Figma Gray palette (background: Gray-900, foreground: Gray-25, card:
      Gray-800, muted: Gray-700, border: Gray-700, destructive/success/warning use lighter 400-level
      shades for dark mode readability) — `apps/company-admin-app/src/styles/globals.css`,
      `apps/super-admin-app/src/styles/globals.css`
- [x] F3 — Update `:root` CSS variables in both `globals.css` files to match Figma palette:
      background White, foreground from Gray-900 `#1B1D22`, border from Gray-200 `#D2D5DB`, primary
      from Blue-500 `#2E90FA`, destructive from Destructive-500 `#F04438`, success from Success-500
      `#16B364`, warning from Warning-500 `#F79009`, muted from Gray-50 `#F4F4F6`; change font-sans
      to Urbanist primary with Inter fallback
- [x] F4 — Create `ThemeProvider.tsx`: React context with `theme` state (`'light' | 'dark'`),
      `setTheme()`, `toggleTheme()` actions; persists to `localStorage` under `forethread-theme`
      key; applies/removes `dark` class on `<html>` via `useEffect`; export `ThemeProvider`
      component and `useTheme` hook from barrel —
      `packages/ui-components/src/components/ThemeProvider.tsx`,
      `packages/ui-components/src/index.ts`
- [x] F5 — Wrap both apps with `<ThemeProvider defaultTheme="light">` in `main.tsx` —
      `apps/company-admin-app/src/main.tsx`, `apps/super-admin-app/src/main.tsx`

### Part G: Design Tokens — Colour & Typography Constants

- [x] G1 — Create `packages/config/tailwind/colors.ts`: all Figma colour hex values as typed
      constants — primary palette (`basic`, `gray`, `destructive`, `warning`, `success`) and
      secondary palette (`violet`, `purple`, `indigo`, `blue`, `cyan`, `teal`, `green`, `lime`,
      `gold`, `orange`, `rose`, `pink`); each palette has shades 25–900; aggregated `colors` export
      — `packages/config/tailwind/colors.ts`
- [x] G2 — Create `packages/config/tailwind/typography.ts`: Urbanist font typography tokens —
      `display` (L/M/S + emphasis), `headline` (L/M/S + emphasis), `title` (L/M/S + emphasis),
      `body` (16/14/12 × bold/semibold/medium/regular, 140% line-height), `input` (L/M/S, 140%),
      `label` (L/M/S, 100% line-height); `fontWeight` map (regular/medium/semibold/bold); aggregated
      `typography` export — `packages/config/tailwind/typography.ts`
- [x] G3 — Update `packages/config/tailwind/index.ts` barrel: export `colors`, `Colors`,
      `typography`, `Typography` alongside `foreThreadPreset` — `packages/config/tailwind/index.ts`

### Part H: SVG Icon Import Support & Tooling

- [x] H1 — Install `vite-plugin-svgr` as devDependency in both apps —
      `apps/company-admin-app/package.json`, `apps/super-admin-app/package.json`
- [x] H2 — Add `svgr()` plugin to both Vite configs (after `react()`) —
      `apps/company-admin-app/vite.config.ts`, `apps/super-admin-app/vite.config.ts`
- [x] H3 — Add `/// <reference types="vite-plugin-svgr/client" />` to both `vite-env.d.ts` files for
      TypeScript support of `import Icon from '@/assets/icons/icon.svg?react'` pattern —
      `apps/company-admin-app/src/vite-env.d.ts`, `apps/super-admin-app/src/vite-env.d.ts`
- [x] H4 — Install `tailwindcss` as devDependency in config package to resolve
      `Cannot find module 'tailwindcss'` type error in preset.ts — `packages/config/package.json`
- [x] H5 — Create `.vscode/settings.json` at project root: disable built-in CSS validation,
      associate `*.css` with `tailwindcss` language mode to suppress `@tailwind`/`@apply` warnings —
      `.vscode/settings.json`

### Verification

- [x] `pnpm --filter @forethread/ui-components typecheck` — zero type errors
- [x] `pnpm --filter company-admin-app typecheck` — zero type errors
- [x] `pnpm --filter super-admin-app typecheck` — zero type errors

---

## Post-Epic 2: Invoice List UI Shell (US9 Preview)

**Purpose**: Scaffold the Invoice List page (Manage invoice states) per Figma screen
[US 8.07](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3346-110482) with mock data. No
backend, no Prisma models, no API endpoints — frontend shell only. Roles: CompanyAdmin,
ProcurementOfficer, FinancialOfficer. Backend implementation deferred to Epic 9 (depends on Epics
3–5).

**Prerequisites**: Epic 2 complete, company-admin-app and financial-officer-app scaffolded.

### Part I: i18n & Shared Setup

- [x] I1 [P] Create `packages/i18n/src/locales/en/invoices.json`: translation keys for invoice list
      — page title, subtitle, search placeholder, filters, create new, rows per page, showing count,
      items selected, approve all, export as; column headers (Invoice ID, Project Name, Project ID,
      Vendor name, Status, Related PO, Total amount, Due Date, Actions); action labels (view,
      approve, export as); pagination (back, next) — `packages/i18n/src/locales/en/invoices.json`
- [x] I2 Import `invoicesEn` in `packages/i18n/src/config.ts` and register `invoices` namespace in
      `resources.en` object — `packages/i18n/src/config.ts`
- [x] I3 [P] Add `"invoices": "Invoices"` key to `packages/i18n/src/locales/en/nav.json` —
      `packages/i18n/src/locales/en/nav.json`

### Part J: Invoice List Page — company-admin-app (CA)

- [x] J1 [US9] Create `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`: full
      invoice list page matching Figma US 8.07 with mock data (13 invoices); features: back arrow +
      title/subtitle header, search bar with search icon, Filters button with filter icon, "+ Create
      new" primary button, data table with sortable columns (checkbox, Invoice ID, Project Name,
      Project ID, Vendor name, Status badge, Related PO, Total amount, Due Date, Actions), row
      action icons (EyeIcon from `eye-opened.svg`, CheckCircleIcon from `checkcircle-icon.svg`,
      three-dot menu with Approve/Export as dropdown), checkbox selection with bulk actions bar
      (item count, "Approve all" button, "Export as" button), pagination with rows-per-page selector
      (10/25/50), page count text, numbered page buttons with ellipsis (Back/1/2/.../N/Next); uses
      `Input`, `Badge`, `Button` from `@forethread/ui-components`; all text via i18n `invoices`
      namespace — `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [x] J2 [US9] Add lazy import `InvoiceListPage` and route `{ path: '/invoices' }` under protected
      `<AppLayout>` children in `apps/company-admin-app/src/app/routes.tsx` —
      `apps/company-admin-app/src/app/routes.tsx`
- [x] J3 [US9] Add `{ to: '/invoices', label: t('nav:invoices'), exact: false }` to `navItems` array
      in `apps/company-admin-app/src/shared/layout/AppLayout.tsx` —
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`

### Part K: Invoice List Page — financial-officer-app (FO)

- [x] K1 [US9] Copy `InvoiceListPage.tsx` to
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx` (same component,
      same mock data) — `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [x] K2 [US9] Add lazy import `InvoiceListPage` and route `{ path: '/invoices' }` under protected
      `<AppLayout>` children in `apps/financial-officer-app/src/app/routes.tsx` —
      `apps/financial-officer-app/src/app/routes.tsx`
- [x] K3 [US9] Add `{ to: '/invoices', label: t('nav:invoices'), exact: false }` to `navItems` array
      in `apps/financial-officer-app/src/shared/layout/AppLayout.tsx` —
      `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`

### Part L: Invoice List Page — procurement-officer-app (PO)

- [ ] L1 [US9] Deferred — `apps/procurement-officer-app/` is now scaffolded (Parts BI1–BI4). Add
      `InvoiceListPage` route and nav link when invoice feature is implemented.

### Part M: Invoice List — Non-functional buttons & sorting (depends on Epic 9 backend)

- [ ] M1 [US9] Wire "Filters" button — open filter dropdown/modal (status, date range, vendor) —
      `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [ ] M2 [US9] Wire "+ Create New" button — navigate to invoice creation page or open creation modal
      — `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [ ] M3 [US9] Wire column sorting — currently sortable column headers are non-functional; connect
      to API sort params (Invoice ID, Project Name, Status, Total amount, Due Date) —
      `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [ ] M4 [US9] Wire row "View" icon button (eye) — navigate to invoice detail page `/invoices/:id` —
      `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [ ] M5 [US9] Wire row "Approve" icon button and dropdown "Approve" action — call approve API
      endpoint — `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [ ] M6 [US9] Wire dropdown "Export As" action and bulk "Export As" button — trigger invoice export
      (PDF/CSV) — `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [ ] M7 [US9] Wire bulk "Approve All" button — approve all selected invoices —
      `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`

### Verification

- [x] `npx tsc --noEmit --project apps/company-admin-app/tsconfig.json` — zero type errors
- [x] `npx tsc --noEmit --project apps/financial-officer-app/tsconfig.json` — zero type errors

---

## Post-Epic 2: Role-Based App URLs & Auth UI Refresh

**Purpose**: Backend now routes email links (password reset, invitation) to the correct frontend app
per user role. New reusable auth form components in `packages/ui-components` replace inline form
markup. Auth pages in both apps refactored to use shared form components with SVG icon imports. CSS
design tokens fine-tuned to match Figma. vendor-app and financial-officer-app scaffolded with full
auth flows.

### Part M: Backend — Role-Based Frontend URLs

- [x] M1 Add per-role frontend app URL env vars to `apps/backend/.env.example`:
      `SUPER_ADMIN_APP_URL` (localhost:3001), `COMPANY_ADMIN_APP_URL` (localhost:3002),
      `VENDOR_APP_URL` (localhost:3003), `FINANCIAL_OFFICER_APP_URL` (localhost:3004); change
      `APP_URL` default to `http://localhost:3001` — `apps/backend/.env.example`
- [x] M2 Add `ROLE_APP_URL_MAP` (UserRole → env key) and `getAppUrlForRole(role)` method to
      `apps/backend/src/modules/auth/auth.service.ts`; replace hardcoded `APP_URL` in
      `forgotPassword` reset URL builder with `getAppUrlForRole(user.role)` —
      `apps/backend/src/modules/auth/auth.service.ts`
- [x] M3 Add same `ROLE_APP_URL_MAP` and private `getAppUrlForRole(role)` to
      `apps/backend/src/modules/users/users.service.ts`; replace hardcoded `APP_URL` in `createUser`
      (invitation URL) and `resendInvitation` with `getAppUrlForRole(dto.role)` /
      `getAppUrlForRole(user.role)` — `apps/backend/src/modules/users/users.service.ts`

### Part N: Reusable Auth UI Components (`packages/ui-components`)

- [x] N1 [P] Create `Text.tsx`: polymorphic `as` prop (`h1`–`h6`, `p`, `span`, `label`), `variant`
      prop mapping to Figma typography tokens (display, headline, title, body, label sizes),
      defaults to `body-14` — `packages/ui-components/src/components/Text.tsx`
- [x] N2 [P] Create `IconBadge.tsx`: circular icon container with configurable `size` (sm, md, lg)
      and `variant` (muted, primary, success, destructive); renders `children` (ReactNode icon) —
      `packages/ui-components/src/components/IconBadge.tsx`
- [x] N3 [P] Create `LoginForm.tsx`: self-contained login form accepting `icon`, `title`,
      `description`, `emailIcon`, `passwordIcon`, `eyeOpenIcon`, `eyeClosedIcon`, `errorIcon`
      ReactNode props; uses `AuthLayout`, `FormField`, `Input`, `PasswordInput`, `Button`, `Alert`;
      renders email + password fields, "Forgot password?" link, submit button, error state —
      `packages/ui-components/src/components/LoginForm.tsx`
- [x] N4 [P] Create `ForgotPasswordForm.tsx`: self-contained forgot-password form accepting `icon`,
      `title`, `description`, `emailIcon`, `errorIcon` props; email field + submit + back link —
      `packages/ui-components/src/components/ForgotPasswordForm.tsx`
- [x] N5 [P] Create `CheckEmailCard.tsx`: confirmation card shown after password reset request;
      accepts `icon`, `title`, `subtitle`, `description`, expiry text, tips list, resend action,
      back link — `packages/ui-components/src/components/CheckEmailCard.tsx`
- [x] N6 [P] Create `ResetPasswordForm.tsx`: set-new-password form accepting `icon`, `title`,
      `description`, password requirement rules (`PasswordRule[]`), field icons, success/error
      states; validates both password fields match —
      `packages/ui-components/src/components/ResetPasswordForm.tsx`
- [x] N7 Update `packages/ui-components/src/index.ts` barrel: export `Text`, `TextProps`,
      `TextVariant`, `IconBadge`, `IconBadgeProps`, `LoginForm`, `LoginFormProps`,
      `ForgotPasswordForm`, `ForgotPasswordFormProps`, `CheckEmailCard`, `CheckEmailCardProps`,
      `ResetPasswordForm`, `ResetPasswordFormProps`, `PasswordRule` —
      `packages/ui-components/src/index.ts`

### Part O: UI Component Tweaks (Figma Alignment)

- [x] O1 Update `Button.tsx`: simplify `isLoading` state to show only spinner (remove children text
      while loading) — `packages/ui-components/src/components/Button.tsx`
- [x] O2 Update `Input.tsx`: add `bg-muted` default background, change focus style from
      `ring-2 ring-ring` to `border-foreground/50`, change disabled to
      `opacity-50 cursor-not-allowed` — `packages/ui-components/src/components/Input.tsx`
- [x] O3 Update `Alert.tsx`: add `icon` prop (ReactNode), change border-radius to `rounded-xl`,
      render icon + children in flex row layout — `packages/ui-components/src/components/Alert.tsx`
- [x] O4 Update `AuthLayout.tsx`: replace heading/paragraph elements with `<Text>` component using
      Figma typography variants (`title-l`, `title-m`, `body-14`), remove wrapping `div` from icon
      slot — `packages/ui-components/src/components/AuthLayout.tsx`

### Part P: Auth Pages Refactor — Shared Form Components

- [x] P1 Refactor `apps/company-admin-app/src/features/auth/ui/LoginPage.tsx`: replace inline form
      with `<LoginForm>` component, import SVG icons via `?react` suffix (HandWavingIcon,
      EnvelopeSimpleIcon, LockSimpleIcon, EyeOpenedIcon, EyeClosedIcon, InfoIcon) from
      `@/assets/icons/` — `apps/company-admin-app/src/features/auth/ui/LoginPage.tsx`
- [x] P2 Refactor `apps/company-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`: replace
      inline form with `<ForgotPasswordForm>` + `<CheckEmailCard>` components, import SVG icons —
      `apps/company-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`
- [x] P3 Refactor `apps/company-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`: replace
      inline form with `<ResetPasswordForm>` component, add password rules display, add success
      state with countdown redirect —
      `apps/company-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`
- [x] P4 Refactor `apps/super-admin-app/src/features/auth/ui/LoginPage.tsx`: same changes as P1 —
      `apps/super-admin-app/src/features/auth/ui/LoginPage.tsx`
- [x] P5 Refactor `apps/super-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`: same changes
      as P2 — `apps/super-admin-app/src/features/auth/ui/ForgotPasswordPage.tsx`
- [x] P6 Refactor `apps/super-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`: same changes as
      P3 — `apps/super-admin-app/src/features/auth/ui/ResetPasswordPage.tsx`
- [x] P7 [P] Remove `onSuccess` auto-navigate from `useResetPassword()` in both
      `apps/company-admin-app/src/features/auth/services/auth.service.ts` and
      `apps/super-admin-app/src/features/auth/services/auth.service.ts` (navigation now handled by
      ResetPasswordForm success state with countdown) —
      `apps/company-admin-app/src/features/auth/services/auth.service.ts`,
      `apps/super-admin-app/src/features/auth/services/auth.service.ts`

### Part Q: i18n & Design Token Updates

- [x] Q1 Update `packages/i18n/src/locales/en/auth.json`: add new translation keys —
      `signInDescription`, `emailAddressLabel`, `resetEmailSentSubtitle`, `resetLinkExpiry`,
      `checkSpamFolder`, `verifyEmailCorrect`, `tryRequestingNewLink`, `resendEmail`,
      `newPasswordPlaceholder`, `confirmNewPasswordPlaceholder`, `setNewPasswordDescription`,
      `passwordMustContain`, `reqMinChars`, `reqLowercase`, `reqUppercase`, `reqNumber`,
      `reqSymbol`, `reqNotBreached`, `passwordsDoNotMatch`, `resetSuccessTitle`,
      `resetSuccessSubtitle`, `resetSuccessAlertBody`, `resetSuccessAlertLogin`,
      `resetSuccessBackToLogin`, `resetSuccessRedirect`; update existing labels (Welcome Back, Log
      in, Forgot password?) — `packages/i18n/src/locales/en/auth.json`
- [x] Q2 [P] Fine-tune CSS custom properties in both `globals.css` files: adjust foreground from
      `210 14% 7%` to `0 0% 9%` (#171717), muted-foreground from `224 11% 48%` to `240 7% 48%`
      (#717182), secondary-foreground from `220 10% 12%` to `0 0% 15%` (#252525) per Figma colour
      spec — `apps/company-admin-app/src/styles/globals.css`,
      `apps/super-admin-app/src/styles/globals.css`

### Part R: SVG Icon Assets — Per-App Copies

- [x] R1 [P] Copy 8 SVG icon files (checkcircle-icon, envelope-simple, eye-closed, eye-opened,
      handwaving-icon, info, key-icon, lock-simple) to `apps/company-admin-app/src/assets/icons/` —
      for `?react` import via vite-plugin-svgr
- [x] R2 [P] Copy same 8 SVG icon files to `apps/super-admin-app/src/assets/icons/`
- [x] R3 [P] Copy same 8 SVG icon files to `apps/financial-officer-app/src/assets/icons/`
- [x] R4 [P] Copy same 8 SVG icon files to `apps/vendor-app/src/assets/icons/`

### Part S: App Scaffolds — vendor-app & financial-officer-app

- [x] S1 Scaffold `apps/vendor-app/`: `package.json`, `vite.config.ts` (port 3003), `tsconfig.json`,
      `tailwind.config.ts`, `postcss.config.js`, `Dockerfile`, `index.html`, `src/vite-env.d.ts`,
      `src/main.tsx`, `src/styles/globals.css`, `src/app/App.tsx`, `src/app/routes.tsx` —
      `apps/vendor-app/`
- [x] S2 Scaffold `apps/vendor-app/` auth: `src/features/auth/state/auth.store.ts`,
      `src/features/auth/services/auth.service.ts`, `src/features/auth/ui/LoginPage.tsx`,
      `src/features/auth/ui/OtpVerificationPage.tsx`,
      `src/features/auth/ui/ActivateAccountPage.tsx`, `src/features/auth/ui/ForgotPasswordPage.tsx`,
      `src/features/auth/ui/ResetPasswordPage.tsx` — `apps/vendor-app/src/features/auth/`
- [x] S3 Scaffold `apps/vendor-app/` layout & pages: `src/shared/layout/AppLayout.tsx` (Dashboard
      nav), `src/shared/components/PrivateRoute.tsx`,
      `src/features/dashboard/pages/DashboardPage.tsx` — `apps/vendor-app/src/`
- [x] S4 Scaffold `apps/financial-officer-app/` remaining files: `Dockerfile`, `index.html`,
      `package.json`, `postcss.config.js`, `tailwind.config.ts`, `tsconfig.json`, `vite.config.ts`
      (port 3004), `src/vite-env.d.ts`, `src/main.tsx`, `src/styles/globals.css`, `src/app/App.tsx`
      — `apps/financial-officer-app/`
- [x] S5 Scaffold `apps/financial-officer-app/` auth: `src/features/auth/state/auth.store.ts`,
      `src/features/auth/services/auth.service.ts`, `src/features/auth/ui/LoginPage.tsx`,
      `src/features/auth/ui/OtpVerificationPage.tsx`,
      `src/features/auth/ui/ActivateAccountPage.tsx`, `src/features/auth/ui/ForgotPasswordPage.tsx`,
      `src/features/auth/ui/ResetPasswordPage.tsx` — `apps/financial-officer-app/src/features/auth/`
- [x] S6 Scaffold `apps/financial-officer-app/` layout & pages:
      `src/shared/components/PrivateRoute.tsx`, `src/features/dashboard/pages/DashboardPage.tsx` —
      `apps/financial-officer-app/src/`

---

## Post-Epic 2: OTP / Two-Factor Auth UI & Route Config Cleanup

**Purpose**: Extract reusable `TwoFactorCard` component from duplicated OTP verification page
markup, refactor all 4 apps to use it, centralize route paths into `route-config.ts` per app, and
fine-tune design tokens and typography.

### Part T: TwoFactorCard Component (`packages/ui-components`)

- [x] T1 [P] Create `TwoFactorCard.tsx`: self-contained 2FA/OTP card accepting `title`,
      `description`, `email`, i18n label props, callbacks (`onVerify`, `onResend`, `onBackToLogin`,
      `onContactSupport`), `secondsLeft` countdown, `isPending`/`isError`/`isResending`/`isLocked`
      state props; renders shield icon badge, email badge, 6-digit OTP input with paste support,
      countdown timer with clock icon, verify button, resend text, back button; three render states
      (active, expired, locked); uses `AuthLayout`, `Badge`, `Button`, `Alert`, `Text` from
      ui-components — `packages/ui-components/src/components/TwoFactorCard.tsx`
- [x] T2 [P] Add SVG icon assets to `packages/ui-components/src/assets/icons/`: `shield-icon.svg`,
      `clock-icon.svg`, `clock.svg` — used by TwoFactorCard internally
- [x] T3 [P] Create `packages/ui-components/src/svg.d.ts`: TypeScript declaration for `*.svg?react`
      imports enabling vite-plugin-svgr pattern inside the ui-components package
- [x] T4 Update `packages/ui-components/src/index.ts` barrel: export `TwoFactorCard` and
      `TwoFactorCardProps`

### Part U: Typography & Text Updates

- [x] U1 [P] Add `body.18` size tokens (bold/semibold/medium/regular, fontSize 18, lineHeight 140%)
      to `packages/config/tailwind/typography.ts`
- [x] U2 [P] Update `Text.tsx`: add `body-18` variant, change `title-l`/`title-m`/`title-s` from
      `font-medium` to `font-normal` per Figma spec

### Part V: i18n — Two-Factor Auth Keys

- [x] V1 [P] Add 2FA translation keys to `packages/i18n/src/locales/en/auth.json`: `twoFactorTitle`,
      `twoFactorDescription`, `twoFactorDigitLabel`, `twoFactorExpiresIn`, `twoFactorExpired`,
      `twoFactorInvalid`, `verifyCode`, `didntReceiveCode`, `resendAvailableIn`, `resendCode`,
      `resendToast`, `accountLocked`, `contactSupport`

### Part W: OTP Pages Refactor — All 4 Apps

- [x] W1 Refactor `apps/company-admin-app/src/features/auth/ui/OtpVerificationPage.tsx`: replace
      inline OTP input logic with `<TwoFactorCard>` component, pass i18n labels and auth service
      callbacks
- [x] W2 Refactor `apps/super-admin-app/src/features/auth/ui/OtpVerificationPage.tsx`: same changes
      as W1
- [x] W3 Refactor `apps/financial-officer-app/src/features/auth/ui/OtpVerificationPage.tsx`: same
      changes as W1
- [x] W4 Refactor `apps/vendor-app/src/features/auth/ui/OtpVerificationPage.tsx`: same changes as W1

### Part X: Route Config Centralisation

- [x] X1 [P] Create `apps/company-admin-app/src/app/route-config.ts`: `ROUTES` constant with all
      path strings (`home`, `login`, `verifyOtp`, `activate`, `forgotPassword`, `resetPassword`,
      `projects`, `projectsNew`, `projectDetail`, `projectEdit`, `invoices`)
- [x] X2 [P] Create `apps/super-admin-app/src/app/route-config.ts`: `ROUTES` constant (`home`,
      `login`, `verifyOtp`, `activate`, `forgotPassword`, `resetPassword`, `users`, `userDetail`)
- [x] X3 [P] Create `apps/financial-officer-app/src/app/route-config.ts`: `ROUTES` constant (`home`,
      `login`, `verifyOtp`, `activate`, `forgotPassword`, `resetPassword`, `invoices`)
- [x] X4 [P] Create `apps/vendor-app/src/app/route-config.ts`: `ROUTES` constant (`home`, `login`,
      `verifyOtp`, `activate`, `forgotPassword`, `resetPassword`)
- [x] X5 Refactor all 4 apps' `routes.tsx` to import and use `ROUTES.*` constants from
      `route-config.ts` instead of hardcoded path strings — `apps/*/src/app/routes.tsx`

### Part Y: Design Token & Build Tweaks

- [x] Y1 [P] Update `--badge-blue-text` CSS variable from `213 50% 35%` to `225 94% 38%` in all 4
      apps' `globals.css` — Figma colour alignment
- [x] Y2 [P] Add `"concurrency": "10"` to `turbo.json` — increase parallel task limit

### Part Z: OTP Account Locking (HTTP 423)

- [x] Z1 Fix `apps/backend/src/modules/auth/otp.service.ts`: replace `BadRequestException` (400)
      with `HttpException(HttpStatus.LOCKED)` (423) when max OTP attempts exceeded; keep the
      `emailVerification` record alive so subsequent requests still return 423; check
      `updated.attempts >= MAX_OTP_ATTEMPTS` immediately after increment to fix off-by-one bug (3rd
      wrong attempt now returns 423 instantly, not deferred to 4th request)
- [x] Z2 [P] Add
      `@ApiResponse({ status: 423, description: 'Account locked after too many failed     OTP attempts' })`
      to `verifyOtp` endpoint — `apps/backend/src/modules/auth/auth.controller.ts`
- [x] Z3 Add 3 e2e tests for OTP locking: 3rd wrong OTP → 423; 4th+ request → still 423; new login
      resets lock and correct OTP succeeds — `apps/backend/__tests__/e2e/auth.e2e-spec.ts`
- [x] Z4 Replace all hardcoded HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 423, 501)
      with `HttpStatus.*` constants across all e2e test files; add `HttpStatus` import to each file;
      add `HTTP_LOCKED = 423` constant in `test-helpers.ts` (not in NestJS `HttpStatus` enum) —
      `apps/backend/__tests__/e2e/*.ts`
- [x] Z5 Add `HTTP_STATUS.LOCKED` (423) constant to
      `packages/api-client/src/interceptors/error.interceptor.ts`; export from
      `packages/api-client/src/index.ts`
- [x] Z6 Fix `isLocked` check in all 4 apps' `VerifyOtpPage`: replace broken
      `(error as any)?.response?.status === 423` with
      `error instanceof ApiRequestError && error.statusCode === HTTP_STATUS.LOCKED` (the error
      interceptor converts Axios errors to `ApiRequestError` with `.statusCode`, not
      `.response.status`) — `apps/*/src/features/auth/ui/*VerifyOtpPage.tsx`

---

## Post-Epic 2: Email Template Styling (Figma Design System)

**Purpose**: Style all 4 email notifications (invitation, OTP, password reset, deactivation) to
match Figma design system. Replace inline HTML with local Handlebars templates for maintainability
and future Brevo migration.

- [x] AA1 [P] Install `handlebars` dependency in `apps/backend` — `apps/backend/package.json`
- [x] AA2 [P] Create `apps/backend/src/modules/notifications/email-templates.const.ts`: export
      `EMAIL_TEMPLATES` constant mapping (`INVITATION`, `OTP`, `PASSWORD_RESET`, `DEACTIVATION`) and
      `EmailTemplateName` type — `apps/backend/src/modules/notifications/email-templates.const.ts`
- [x] AA3 [P] Create `apps/backend/src/modules/notifications/templates/layout.html`: email-safe
      table-based HTML wrapper (600px max-width, Inter font via Google Fonts, Outlook VML compat),
      footer with `#efefef` divider, centered "Privacy policy and Terms of service" underlined
      links, `{{{content}}}` Handlebars slot for per-email content —
      `apps/backend/src/modules/notifications/templates/layout.html`
- [x] AA4 [P] Create `apps/backend/src/modules/notifications/templates/partials/button.html`:
      reusable CTA button partial (`#131313` background, 12px border-radius, VML fallback for
      Outlook), accepts `{{url}}` and `{{label}}` params —
      `apps/backend/src/modules/notifications/templates/partials/button.html`
- [x] AA5 [P] Create 4 content templates matching Figma design (20px/500 heading for greeting +
      first sentence, 14px body text, black buttons, #f5f5f5 OTP code block):
      `apps/backend/src/modules/notifications/templates/invitation.html`,
      `apps/backend/src/modules/notifications/templates/otp.html`,
      `apps/backend/src/modules/notifications/templates/password-reset.html`,
      `apps/backend/src/modules/notifications/templates/deactivation.html`
- [x] AA6 Refactor `apps/backend/src/modules/notifications/email.service.ts`: implement
      `OnModuleInit` to compile layout + partials + content templates on startup; add private
      `renderEmail(templateName, params)` method; simplify all 4 send methods to call `renderEmail`
      — `apps/backend/src/modules/notifications/email.service.ts`
- [x] AA7 Update `sendPasswordResetEmail` signature: add `name` parameter; update caller in
      `apps/backend/src/modules/auth/auth.service.ts` `forgotPassword()` to pass `user.name` —
      `apps/backend/src/modules/notifications/email.service.ts`,
      `apps/backend/src/modules/auth/auth.service.ts`
- [x] AA8 Add `assets` config to `apps/backend/nest-cli.json`: copy
      `modules/notifications/templates/**/*.html` to dist with `watchAssets: true` —
      `apps/backend/nest-cli.json`

---

## Post-Epic 2: SVG Icon Consolidation (Constitution Principle VIII)

**Purpose**: Move per-app duplicated SVG icons to `packages/ui-components/src/assets/icons/` and
re-export for all apps. Constitution Principle VIII (Shared-Before-Custom) prohibits duplication of
shared assets across app boundaries.

- [x] IC1 [P] Move shared SVG icon files (checkcircle-icon, envelope-simple, eye-closed, eye-opened,
      handwaving-icon, info, key-icon, lock-simple) from `apps/company-admin-app/src/assets/icons/`
      to `packages/ui-components/src/assets/icons/`; update `packages/ui-components/src/index.ts` to
      re-export icons as React components — `packages/ui-components/src/assets/icons/`,
      `packages/ui-components/src/index.ts`
- [x] IC2 Update all icon imports in `apps/company-admin-app/`, `apps/super-admin-app/`,
      `apps/financial-officer-app/`, `apps/vendor-app/` to import from `@forethread/ui-components`
      instead of local `@/assets/icons/` paths; fix `import/order` lint errors by merging icon
      imports into same group as other `@forethread/*` imports — `apps/*/src/features/auth/ui/*.tsx`
- [x] IC3 Delete per-app icon copies from `apps/*/src/assets/icons/` (8 files × 4 apps) after
      confirming imports resolve — `apps/*/src/assets/icons/`
- [x] IC4 Run `pnpm turbo typecheck` and `pnpm turbo build` for all apps to verify zero breakage

---

## Post-Epic 2: Toast Notification System

**Purpose**: Add a unified in-app toast notification system using `sonner`. Create a reusable
`CustomToast` component and `notificationService` wrapper in `packages/ui-components`. Mount
`<Toaster>` in all 4 apps. Update auth flows to show toast feedback on OTP send.

- [x] AB1 [P] Create `packages/ui-components/src/components/CustomToast.tsx`: `CustomToast`
      component with `notificationService` (success/error/info/warning methods using `sonner`) —
      `packages/ui-components/src/components/CustomToast.tsx`
- [x] AB2 [P] Export `Toaster`, `toast` from `sonner` and `CustomToast`, `notificationService`,
      `CustomToastProps`, `ToastType` from `packages/ui-components/src/index.ts` —
      `packages/ui-components/src/index.ts`
- [x] AB3 [P] Add `<Toaster position="bottom-right" duration={5000} />` to `main.tsx` in all 4 apps:
      `apps/company-admin-app/src/main.tsx`, `apps/super-admin-app/src/main.tsx`,
      `apps/financial-officer-app/src/main.tsx`, `apps/vendor-app/src/main.tsx`
- [x] AB4 Update `auth.service.ts` in all 4 apps: import `notificationService` and `useTranslation`,
      show `notificationService.info(t('auth:resendToast'))` toast after successful OTP send in
      `useLogin` mutation — `apps/*/src/features/auth/services/auth.service.ts`

---

## Post-Epic 2: Auth Form Validation UX

**Purpose**: Disable submit buttons on auth forms when validation fails. Prevents premature
submissions and improves UX by giving immediate visual feedback.

- [x] AC1 [P] Add optional `isValid` prop to `LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`
      in `packages/ui-components`; wire `disabled={!isValid}` on submit `<Button>` —
      `packages/ui-components/src/components/LoginForm.tsx`,
      `packages/ui-components/src/components/ForgotPasswordForm.tsx`,
      `packages/ui-components/src/components/ResetPasswordForm.tsx`
- [x] AC2 Update `LoginPage.tsx` in all 4 apps: destructure `isValid` from `formState`, add
      `mode: 'onChange'` to `useForm`, pass `isValid` prop —
      `apps/*/src/features/auth/ui/LoginPage.tsx`
- [x] AC3 Update `ForgotPasswordPage.tsx` in all 4 apps: destructure `isValid` from `formState`, add
      `mode: 'onChange'` to `useForm`, pass `isValid` prop —
      `apps/*/src/features/auth/ui/ForgotPasswordPage.tsx`
- [x] AC4 Update `ResetPasswordPage.tsx` in all 4 apps: destructure `isValid` from `formState`, add
      `mode: 'onChange'` to `useForm`, pass `isValid={isValid && !passwordsMismatch}` —
      `apps/*/src/features/auth/ui/ResetPasswordPage.tsx`

---

## Post-Epic 2: Activate Account Refactor + Invitation Expired Flow (US 1.02)

**Purpose**: Refactor `ActivateAccountPage` in all 4 apps to use `ResetPasswordForm` component
(matching Reset Password page design). Add token validation on page load, invitation expired screen
with "Request new link" self-service flow, and success screen with auto-redirect. Requires two new
backend endpoints.

### Part AD: Backend — Validate Activation Token & Request New Invitation

- [x] AD1 [P] Create `apps/backend/src/modules/auth/dto/validate-activation-token.dto.ts`:
      `ValidateActivationTokenDto` with `@IsString() @IsNotEmpty() token` field —
      `apps/backend/src/modules/auth/dto/validate-activation-token.dto.ts`
- [x] AD2 [P] Create `apps/backend/src/modules/auth/dto/request-new-invitation.dto.ts`:
      `RequestNewInvitationDto` with `@IsEmail() email` field —
      `apps/backend/src/modules/auth/dto/request-new-invitation.dto.ts`
- [x] AD3 Add `validateActivationToken(token)` method to `auth.service.ts`: query all users with
      `invitationToken: { not: null }` and `status: 'Invited'` (no expiry filter), loop
      `argon2.verify`, return `{ valid: boolean, email: string }` based on expiry check; throw
      `BadRequestException` if no match — `apps/backend/src/modules/auth/auth.service.ts`
- [x] AD4 Add `requestNewInvitation(email)` method to `auth.service.ts`: find user by email with
      `status: 'Invited'`, generate new `crypto.randomBytes(32)` token, argon2 hash, 30-day expiry,
      update user, send invitation email via `emailService.sendInvitationEmail()`; return silently
      if no match (no enumeration) — `apps/backend/src/modules/auth/auth.service.ts`
- [x] AD5 Add `POST validate-activation-token` endpoint to `auth.controller.ts`: `@Public()`,
      `@HttpCode(200)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })`, import and use
      `ValidateActivationTokenDto` — `apps/backend/src/modules/auth/auth.controller.ts`
- [x] AD6 Add `POST request-new-invitation` endpoint to `auth.controller.ts`: `@Public()`,
      `@HttpCode(200)`, `@Throttle({ default: { limit: 3, ttl: 3600000 } })`, import and use
      `RequestNewInvitationDto`, always return generic message —
      `apps/backend/src/modules/auth/auth.controller.ts`

### Part AE: Shared Types, API Client & i18n

- [x] AE1 [P] Add `ValidateActivationTokenDto`, `ValidateActivationTokenResponseDto`,
      `RequestNewInvitationDto` classes to `packages/shared-types/src/dtos/auth.dto.ts` —
      `packages/shared-types/src/dtos/auth.dto.ts`
- [x] AE2 [P] Add symbol regex `.regex(/[^A-Za-z0-9]/)` to `activateAccountSchema` password field in
      `packages/shared-types/src/schemas/auth.schema.ts` —
      `packages/shared-types/src/schemas/auth.schema.ts`
- [x] AE3 [P] Add `validateActivationToken(token)` and `requestNewInvitation(email)` functions with
      `ValidateActivationTokenResponse` interface to `packages/api-client/src/endpoints/auth.ts` —
      `packages/api-client/src/endpoints/auth.ts`
- [x] AE4 [P] Add i18n keys to `packages/i18n/src/locales/en/auth.json`: `activateSuccessTitle`,
      `activateSuccessSubtitle`, `activateSuccessAlertBody`, `activateSuccessRedirect`,
      `invitationExpiredTitle`, `invitationExpiredSubtitle`, `invitationExpiredBody`,
      `requestNewLink`, `newInvitationSent` — `packages/i18n/src/locales/en/auth.json`

### Part AF: Frontend — Refactor ActivateAccountPage (All 4 Apps)

- [x] AF1 [P] Add `useValidateActivationToken(token)` query hook and `useRequestNewInvitation()`
      mutation hook to `auth.service.ts` in all 4 apps; simplify `useActivateAccount` to remove
      navigate-on-success (handled by `ResetPasswordForm` success screen) —
      `apps/super-admin-app/src/features/auth/services/auth.service.ts`,
      `apps/company-admin-app/src/features/auth/services/auth.service.ts`,
      `apps/financial-officer-app/src/features/auth/services/auth.service.ts`,
      `apps/vendor-app/src/features/auth/services/auth.service.ts`
- [x] AF2 Rewrite `apps/super-admin-app/src/features/auth/ui/ActivateAccountPage.tsx`: token
      validation on mount, `PageLoader` while loading, `ResetPasswordForm` with `PasswordInput` and
      6-rule requirements checklist, invitation expired screen with `ClockIcon`/`IconBadge`/"Request
      new link" button, success screen with auto-redirect to `/login` —
      `apps/super-admin-app/src/features/auth/ui/ActivateAccountPage.tsx`
- [x] AF3 Rewrite `apps/company-admin-app/src/features/auth/ui/ActivateAccountPage.tsx`: identical
      to AF2 — `apps/company-admin-app/src/features/auth/ui/ActivateAccountPage.tsx`
- [x] AF4 Rewrite `apps/financial-officer-app/src/features/auth/ui/ActivateAccountPage.tsx`:
      identical to AF2 — `apps/financial-officer-app/src/features/auth/ui/ActivateAccountPage.tsx`
- [x] AF5 Rewrite `apps/vendor-app/src/features/auth/ui/ActivateAccountPage.tsx`: identical to AF2 —
      `apps/vendor-app/src/features/auth/ui/ActivateAccountPage.tsx`

### Part AG: API Contract Documentation

- [x] AG1 Document `POST /v1/auth/validate-activation-token` and
      `POST /v1/auth/request-new-invitation` in `specs/001-procurement-platform/contracts/auth.md`
      with request/response schemas, status codes, business rules, and rate limits —
      `specs/001-procurement-platform/contracts/auth.md`

---

## Post-Epic 2: User Management — Company Admin Frontend (US-1.07 / FR-007)

**Purpose**: Implement the full User Management feature in `company-admin-app` so Company Admins can
view, invite, edit, activate, and deactivate users within their company. Backend is 100% complete
(all 8 user endpoints exist from Epic 1). This covers the entire frontend implementation matching
Figma screens [US 1.07](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3344-59894) and
[US 1.08](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3344-104305).

**FR-007**: Company Admin MUST be able to invite users to their own company, assign roles, and
manage (edit, deactivate, reactivate) users within their company.

### Part AH: SVG Icon Assets

- [x] AH1 [P] Create `packages/ui-components/src/assets/icons/user-outline.svg` — person outline
      icon for Full Name input field
- [x] AH2 [P] Create `packages/ui-components/src/assets/icons/briefcase.svg` — briefcase icon for
      Role dropdown field
- [x] AH3 [P] Create `packages/ui-components/src/assets/icons/id-badge.svg` — ID card icon for
      Position field
- [x] AH4 [P] Create `packages/ui-components/src/assets/icons/phone.svg` — phone icon for Edit modal
      phone field
- [x] AH5 [P] Create `packages/ui-components/src/assets/icons/department.svg` — building icon for
      Department field

### Part AI: Shared UI Components (`packages/ui-components`)

- [x] AI1 Create `DotActionsMenu.tsx`: universal three-dot menu with desktop dropdown and mobile
      bottom sheet; props: `actions: DotAction[]` (key, label, icon?, onClick, disabled?); uses
      `three-dot.svg` icon trigger, click outside / Escape to close, `stopPropagation` on trigger;
      responsive via `matchMedia` — `packages/ui-components/src/components/DotActionsMenu.tsx`
- [x] AI2 Create `CustomDropdown.tsx`: custom styled dropdown (not native `<select>`) matching Input
      component styling; props: options, value, onChange, placeholder, leftIcon, error, disabled;
      click outside to close; works with react-hook-form via `Controller` —
      `packages/ui-components/src/components/CustomDropdown.tsx`
- [x] AI3 Create `StatusActionModal.tsx`: reusable confirm action modal (Activate/Deactivate user);
      props: onClose, onConfirm, isLoading, title, subtitle, infoText (ReactNode), confirmLabel,
      cancelLabel, variant ('default' | 'danger'); green info box for activate, red for deactivate;
      uses InfoIcon + CheckCircleIcon —
      `packages/ui-components/src/components/StatusActionModal.tsx`
- [x] AI4 Create `StatusSuccessModal.tsx`: reusable success result modal with auto-redirect
      countdown; props: onClose, title, description, note?, buttonLabel, redirectLabel (function),
      countdownSeconds (default 3); auto-closes after countdown via useEffect timer —
      `packages/ui-components/src/components/StatusSuccessModal.tsx`
- [x] AI5 Add `ModalCloseButton` component to `Modal.tsx`: uses `cross.svg` icon; update
      `ModalHeader` to use `ModalCloseButton` instead of HTML entity —
      `packages/ui-components/src/components/Modal.tsx`
- [x] AI6 Update `packages/ui-components/src/index.ts` barrel: export `ModalCloseButton`,
      `DotActionsMenu`, `DotActionsMenuProps`, `DotAction`, `CustomDropdown`, `CustomDropdownProps`,
      `DropdownOption`, `StatusActionModal`, `StatusActionModalProps`, `StatusSuccessModal`,
      `StatusSuccessModalProps` — `packages/ui-components/src/index.ts`

### Part AJ: API Client — Sort Parameters

- [x] AJ1 Add `sortBy?: string` and `sortDir?: 'asc' | 'desc'` to `UserListParams` interface in
      `packages/api-client/src/endpoints/users.ts` — enables server-side sorting from frontend

### Part AK: Users Feature — Service & State

- [x] AK1 Create `apps/company-admin-app/src/features/users/services/users.service.ts`: TanStack
      Query hooks — `useUsers` (auto-scopes to companyId from auth store, passes sortBy/sortDir),
      `useUser`, `useCreateUser`, `useUpdateUser`, `useDeactivateUser`, `useReactivateUser`,
      `useResendInvitation`, `useCancelInvitation`; invalidates `['company-users']` on mutations —
      `apps/company-admin-app/src/features/users/services/users.service.ts`
- [x] AK2 Create `apps/company-admin-app/src/features/users/state/users.store.ts`: Zustand store
      with `isCreateModalOpen`, `isSuccessModalOpen`, `createdUserEmail`, `isEditModalOpen`,
      `editUserId`, `isStatusActionModalOpen`, `statusActionType` ('activate'|'deactivate'),
      `statusActionUserId`, `statusActionUserEmail`, `isStatusSuccessModalOpen`,
      `statusSuccessType`, `statusSuccessUserEmail`; open/close actions for each modal —
      `apps/company-admin-app/src/features/users/state/users.store.ts`

### Part AL: Users Feature — UI Pages & Modals

- [x] AL1 Create `UserListPage.tsx`: tabs (Company users / Approval configuration / Role
      permissions), "Invite user" button, data table with columns (Full name, Email, Phone number,
      Role badge, Status, Projects, Actions), sort arrows (SortIcon component) with visual active
      state connected to API sortBy/sortDir, three-dot menu per row (Project access, Reset password,
      Deactivate/Activate), edit/view icons, pagination; renders all modals (Create,
      InvitationSuccess, Edit, StatusAction, StatusSuccess) —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] AL2 Create `CreateUserModal.tsx`: centered icon badge header with ModalCloseButton, form
      fields (Full name + user-outline, Email + envelope, Role as CustomDropdown + briefcase,
      Position + id-badge), Zod validation + react-hook-form, handles `emailInUse` error, on success
      closes + opens InvitationSuccessModal —
      `apps/company-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] AL3 Create `EditUserModal.tsx`: edit icon badge header with ModalCloseButton, form fields
      (Full name, Email + Phone 2-col grid with email disabled, Role as CustomDropdown, Position,
      Department), loads user via useUser(editUserId), pre-fills form with reset(); Department field
      is UI-only — `apps/company-admin-app/src/features/users/ui/EditUserModal.tsx`
- [x] AL4 Create `InvitationSuccessModal.tsx`: success checkmark badge with ModalCloseButton, green
      info box with user email, 3-second auto-redirect countdown, "Back to User Management" button —
      `apps/company-admin-app/src/features/users/ui/InvitationSuccessModal.tsx`

### Part AM: Routing, Navigation & i18n

- [x] AM1 Add `users: '/users'` to `apps/company-admin-app/src/app/route-config.ts`
- [x] AM2 Add lazy import `UserListPage` and route `{ path: ROUTES.users }` under protected
      `<AppLayout>` in `apps/company-admin-app/src/app/routes.tsx`
- [x] AM3 Add Users sidebar item (SuppliersIcon, `/users`, before Projects) and `/users` entry in
      `usePageInfo` pages map in `apps/company-admin-app/src/shared/layout/AppLayout.tsx`
- [x] AM4 Update `packages/i18n/src/locales/en/users.json`: add keys for tabs (companyUsers,
      approvalConfiguration, rolePermissions, placeholders), columns (fullName, phone, projects),
      button (inviteUser), createModal (subtitle, namePlaceholder, emailPlaceholder, sendInvitation,
      emailInUse), editModal (title, subtitle, fullName, namePlaceholder, email, emailPlaceholder,
      phone, phonePlaceholder, role, position, positionPlaceholder, department,
      departmentPlaceholder, submitChanges, submitting, updateError), activateModal (title,
      subtitle, info, confirm), deactivateModal (title, subtitle, info, confirm), activationSuccess
      (title, description, note, backButton, redirecting), deactivationSuccess (title, description,
      note, backButton, redirecting), actions (activate), invitationSuccess (title, subtitle,
      emailSent, linkExpiry, backToUsers, redirecting) — `packages/i18n/src/locales/en/users.json`
- [x] AM5 Update `packages/i18n/src/locales/en/nav.json`: update `usersSubtitle` —
      `packages/i18n/src/locales/en/nav.json`
- [x] AM6 Add `roleRequired` key to `packages/i18n/src/locales/en/validation.json`

### Verification

- [x] `pnpm turbo build --filter=company-admin-app` — builds successfully (pre-existing projects
      feature TS errors are unrelated to US-1.07)
- [x] `pnpm run lint --filter=company-admin-app` — no lint errors in users feature files

---

## Post-Epic 2: Error Boundary & Error UI

**Purpose**: Add route-level error boundaries to all 4 frontend apps so that unhandled runtime
errors (missing exports, failed lazy imports, etc.) show a branded error UI with retry/back actions
instead of React Router's default white error screen.

### Part AN: Error Fallback Component & Route Error Boundaries

- [x] AN1 [P] Create `packages/ui-components/src/components/ErrorFallback.tsx`: reusable error UI
      with `title`, `message`, `retryLabel`, `backLabel`, `icon` (ReactNode), `onRetry`, `onBack`
      props; uses `Button` and `Text` components —
      `packages/ui-components/src/components/ErrorFallback.tsx`
- [x] AN2 [P] Export `ErrorFallback` and `ErrorFallbackProps` from
      `packages/ui-components/src/index.ts` — `packages/ui-components/src/index.ts`
- [x] AN3 [P] Add i18n keys `errorTitle`, `errorMessage`, `errorRetry`, `errorBack` to
      `packages/i18n/src/locales/en/common.json` — `packages/i18n/src/locales/en/common.json`
- [x] AN4 [P] Create `ErrorPage.tsx` in all 4 apps: import `ErrorFallback` + `useRouteError` +
      `useNavigate`, log error in DEV, render `ErrorFallback` with i18n translations, `onRetry`
      reloads page, `onBack` navigates back —
      `apps/company-admin-app/src/shared/components/ErrorPage.tsx`,
      `apps/super-admin-app/src/shared/components/ErrorPage.tsx`,
      `apps/vendor-app/src/shared/components/ErrorPage.tsx`,
      `apps/financial-officer-app/src/shared/components/ErrorPage.tsx`
- [x] AN5 Update `routes.tsx` in all 4 apps: wrap all routes in a root route object with
      `errorElement: <ErrorPage />` — `apps/company-admin-app/src/app/routes.tsx`,
      `apps/super-admin-app/src/app/routes.tsx`, `apps/vendor-app/src/app/routes.tsx`,
      `apps/financial-officer-app/src/app/routes.tsx`
- [x] AN6 Fix `UserRole` import in `apps/company-admin-app/src/features/users/constants/roles.ts`:
      change from `@forethread/shared-types` (CJS dist) to `@forethread/shared-types/client` (source
      TS, Vite-compatible) — `apps/company-admin-app/src/features/users/constants/roles.ts`

## Ad-hoc: UserDetailPage Redesign & Auth Page Renaming

- [x] AN7 [P] Add i18n keys `userProfile`, `userProfileSubtitle` to
      `packages/i18n/src/locales/en/nav.json` — `packages/i18n/src/locales/en/nav.json`
- [x] AN8 [P] Add `detail.*` i18n keys (`phone`, `status`, `dateJoined`, `position`, `department`,
      `editUser`, `activate`, `assignedProject`, `noProjectAssigned`, `rolePermissions`,
      `approvalResponsibilities`, `activityLog`, `comingSoon`) to
      `packages/i18n/src/locales/en/users.json` — `packages/i18n/src/locales/en/users.json`
- [x] AN9 Add `/users/:id` page info to `usePageInfo()` in AppLayout with back navigation to
      `/users` — `apps/company-admin-app/src/shared/layout/AppLayout.tsx`
- [x] AN10 Redesign `UserDetailPage.tsx`: profile card with avatar + DotActionsMenu, icon-based info
      grid (phone, status, role, date joined, position, department), assigned projects section,
      collapsible placeholder sections (Role & Permissions, Approval responsibilities, Activity
      log), modals via `useUsersStore` —
      `apps/company-admin-app/src/features/users/ui/UserDetailPage.tsx`
- [x] AN11 [P] Rename `ActivateAccountPage.tsx` → app-specific names across all 4 apps
      (`CompanyAdminActivateAccountPage`, `SuperAdminActivateAccountPage`,
      `VendorActivateAccountPage`, `FinancialOfficerActivateAccountPage`); update export function
      names and lazy imports in `routes.tsx`
- [x] AN12 [P] Rename `ResetPasswordPage.tsx` → app-specific names across all 4 apps
      (`CompanyAdminResetPasswordPage`, `SuperAdminResetPasswordPage`, `VendorResetPasswordPage`,
      `FinancialOfficerResetPasswordPage`); update export function names and lazy imports in
      `routes.tsx`

---

## Post-Epic 2: User Management UI Polish & AC Compliance (US-1.07)

**Purpose**: Refine the User Management UI to match Figma designs precisely and pass all US-1.07
acceptance criteria from the FRD. Covers table styling, layout improvements, modal refinements,
button sizing, role restrictions, field validation, and new actions for Invited users.

**Prerequisites**: Parts AH–AM complete (User Management base implementation).

### Part AO: Table & Layout Styling

- [x] AO1 Remove `required` prop from FormField components (Full Name, Email, Role) in
      `CreateUserModal.tsx` — removes asterisks from labels —
      `apps/company-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] AO2 Change Alert icon in `CreateUserModal.tsx` from `CrossInCircleIcon` to `InfoIcon`
      (consistent with project error icon convention) —
      `apps/company-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] AO3 Increase `CreateUserModal` width from `max-w-md` to `max-w-lg` —
      `apps/company-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] AO4 [P] Extract `STATUS_BADGE_COLORS` and `STATUS_TEXT_COLORS` constants to
      `constants/roles.ts`; update imports in `UserDetailPage.tsx` —
      `apps/company-admin-app/src/features/users/constants/roles.ts`,
      `apps/company-admin-app/src/features/users/ui/UserDetailPage.tsx`
- [x] AO5 Change `AppLayout` from `h-screen` to `min-h-screen` with sticky sidebar
      (`sticky top-0 h-screen`) and sticky header (`sticky top-0 z-10`); remove `flex-col` and
      `overflow-auto` from main content area —
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`
- [x] AO6 Add `table-fixed` to user table for even column distribution; update header `th` styling
      to `text-xs font-bold leading-4 tracking-[0.6px]`; change header row border from `border-b` to
      `border-y`; remove `font-medium` from user name `td` —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] AO7 Change CreateUserModal `h2` title from `text-lg font-semibold` to
      `text-2xl font-normal leading-[140%]` —
      `apps/company-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] AO8 Wrap table in bordered container (`mx-6 mb-6 border border-border rounded-lg`); move
      invite button outside table border area; change header row back to `border-b` (wrapper
      provides top border) — `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] AO9 Narrow Actions column (`w-[100px]`, `text-right`); add `justify-end` to action buttons div
      — `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] AO10 Remove `overflow-hidden` from table wrapper div — fixes DotActionsMenu dropdown clipping
      on last row — `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`

### Part AP: Button Sizing

- [x] AP1 Update `Button.tsx` lg size from `text-sm` to `text-lg leading-6` — matches Figma specs
      (18px, font-weight 500, line-height 24px) — `packages/ui-components/src/components/Button.tsx`

### Part AQ: Invited User Actions & Reset Password

- [x] AQ1 Add conditional logic for Invited status users: only show "Reset Invitation" action in
      DotActionsMenu (not Edit/Deactivate/Reset Password); calls `resendMutation.mutate(user.id)` —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] AQ2 Add `actions.resetInvitation` i18n key to `packages/i18n/src/locales/en/users.json`
- [x] AQ3 Add `useResetUserPassword` hook to `users.service.ts` using `forgotPassword` API —
      `apps/company-admin-app/src/features/users/services/users.service.ts`
- [x] AQ4 Add `isResetPasswordModalOpen`, `resetPasswordUserEmail`, `openResetPasswordModal`,
      `closeResetPasswordModal` state to users store —
      `apps/company-admin-app/src/features/users/state/users.store.ts`
- [x] AQ5 Wire `StatusActionModal` for reset password action in UserListPage; add
      `resetPasswordModal.*` i18n keys (title, subtitle, info, confirm) to users.json —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`,
      `packages/i18n/src/locales/en/users.json`

### Part AR: AC Compliance Fixes

- [x] AR1 ~~Remove `CompanyAdmin` from `COMPANY_ROLE_OPTIONS`~~ **REVERSED**: `CompanyAdmin` remains
      in `COMPANY_ROLE_OPTIONS` — Company Admin CAN assign CompanyAdmin role to users in their own
      company. Backend restriction removed (`dto.role === UserRole.CompanyAdmin` check in
      `users.service.ts:createUser`) —
      `apps/company-admin-app/src/features/users/constants/roles.ts`,
      `apps/backend/src/modules/users/users.service.ts`
- [x] AR2 Make `position` mandatory in `createUserFormSchema`: change from
      `z.string().optional().default('')` to `z.string().min(1, 'Position is required').max(255)` —
      AC #5: position is a required field —
      `apps/company-admin-app/src/features/users/schemas/user-form.schema.ts`
- [x] AR3 Update `CreateUserModal.tsx` position field: replace manual `<label>` with `<FormField>`
      component including error display — ensures consistent validation UI —
      `apps/company-admin-app/src/features/users/ui/CreateUserModal.tsx`
- [x] AR4 Add `position` as required field to `CreateUserDto` in shared-types with `@IsString()` +
      `@IsNotEmpty()` decorators — `packages/shared-types/src/dtos/user.dto.ts`

### Verification

- [x] All 10 US-1.07 acceptance criteria pass (verified via FRD cross-check)
- [x] Table styling matches Figma (bordered, header font, even columns, right-aligned actions)
- [x] CreateUserModal matches Figma (width, title font, no asterisks, InfoIcon for errors)
- [x] Button lg size matches Figma (18px, 500, 24px line-height)
- [x] Invited users only see "Reset Invitation" in dot menu
- [x] Reset password modal works via StatusActionModal pattern

---

## Super-Admin User Management Page Redesign (US-1)

**Purpose**: Rewrite super-admin-app UserListPage with grouped-by-company table, filter popovers,
dot-action menus, admin-initiated password reset, and all modals.

### Part AS: Backend — Multi-Value Filters & Reset Password

- [x] AS1 Update `UserListQueryDto` to support comma-separated role values with
      `@IsEnum(UserRole, { each: true })` and Transform decorator; update `listUsers` where clause
      for comma-separated `companyId` and `status` —
      `apps/backend/src/modules/users/users.service.ts`
- [x] AS2 Add `initiateResetPassword(id)` method to `UsersService`: validates user is Active,
      generates 15-min reset token via argon2, sends `sendPasswordResetEmail` —
      `apps/backend/src/modules/users/users.service.ts`
- [x] AS3 Add `POST :id/initiate-reset-password` endpoint with `@Roles('SuperAdmin')` guard —
      `apps/backend/src/modules/users/users.controller.ts`
- [x] AS4 Document new endpoint and multi-value query params in users contract —
      `specs/001-procurement-platform/contracts/users.md`

### Part AT: API Client — Reset Password

- [x] AT1 Add `initiateResetPassword` path to `USERS_PATHS` —
      `packages/api-client/src/endpoints/paths.ts`
- [x] AT2 Add `initiateResetPassword(id)` function — `packages/api-client/src/endpoints/users.ts`

### Part AU: Shared UI Components

- [x] AU1 Create `Checkbox` component (w-5 h-5, rounded-md, Figma-matched styles) —
      `packages/ui-components/src/components/Checkbox.tsx`
- [x] AU2 Create `FilterPopover` component (desktop dropdown + mobile bottom sheet, checkbox list,
      active count badge) — `packages/ui-components/src/components/FilterPopover.tsx`
- [x] AU3 Extract `SortIcon` to shared ui-components —
      `packages/ui-components/src/components/SortIcon.tsx`
- [x] AU4 Export Checkbox, FilterPopover, SortIcon from barrel —
      `packages/ui-components/src/index.ts`
- [x] AU5 Update company-admin UserListPage to import SortIcon from shared —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`

### Part AV: Super-Admin State, Services & Constants

- [x] AV1 Rewrite `users.store.ts` with full modal state (create, success, edit, status action,
      status success, reset password, reset password success) and company expand/collapse state —
      `apps/super-admin-app/src/features/users/state/users.store.ts`
- [x] AV2 Add `useUpdateUser` and `useInitiateResetPassword` hooks to services —
      `apps/super-admin-app/src/features/users/services/users.service.ts`
- [x] AV3 Create role/status constants with `ALL_ROLE_OPTIONS`, badge colors, text colors —
      `apps/super-admin-app/src/features/users/constants/roles.ts`

### Part AW: Super-Admin UI — Modals & Hooks

- [x] AW1 Create `useGroupedUsers` hook (groups UserResponse[] by company, sorts by name) —
      `apps/super-admin-app/src/features/users/hooks/useGroupedUsers.ts`
- [x] AW2 Create `useEditUserForm` hook (react-hook-form + zod + useUpdateUser) —
      `apps/super-admin-app/src/features/users/hooks/useEditUserForm.ts`
- [x] AW3 Create `useRoleOptions` hook (all roles except SuperAdmin) —
      `apps/super-admin-app/src/features/users/hooks/useRoleOptions.ts`
- [x] AW4 Create `EditUserModal` (same pattern as company-admin, adds read-only company field) —
      `apps/super-admin-app/src/features/users/ui/EditUserModal.tsx`
- [x] AW5 Create `InvitationSuccessModal` (3s countdown, success badge) —
      `apps/super-admin-app/src/features/users/ui/InvitationSuccessModal.tsx`

### Part AX: Super-Admin UserListPage Rewrite

- [x] AX1 Full UserListPage rewrite: tabs (Platform users + Action Log placeholder), search with
      300ms debounce, 3 FilterPopovers (Company/Status/Role), grouped-by-company table with
      expand/collapse, sortable columns, company-level DotActionsMenu, user-level DotActionsMenu
      with Edit/Reset Password/Activate/Deactivate/Reset Invitation, all modals (StatusActionModal,
      StatusSuccessModal, EditUserModal, InvitationSuccessModal, reset password confirm + success) —
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] AX2 Update CreateUserModal to close and open success modal on create —
      `apps/super-admin-app/src/features/users/ui/CreateUserModal.tsx`

### Part AY: i18n

- [x] AY1 Add i18n keys: `tabs.platformUsers`, `tabs.actionLog`, `tabs.actionLogPlaceholder`,
      `filters.*`, `groupedTable.users`, `resetPasswordSuccess.*`, `actions.editUser`,
      `actions.editCompany`, `actions.deactivateAll` — `packages/i18n/src/locales/en/users.json`

### Verification

- [x] `pnpm lint --filter @forethread/super-admin-app` — 0 errors
- [x] `pnpm lint --filter @forethread/ui-components` — 0 errors
- [x] `npx tsc --noEmit -p apps/super-admin-app/tsconfig.json` — 0 errors
- [x] `npx tsc --noEmit -p packages/ui-components/tsconfig.json` — 0 errors

---

## Post-Epic 2: Shared Layout Components (US-1)

**Purpose**: Extract reusable layout components from app-specific code into
`packages/ui-components`: sidebar navigation, page header with back-button support, and
reset-password success modal. Created during US-1 sidebar/navigation work and US-1.07 password-reset
enhancements.

### Part AZ-L: Sidebar & Page Header

- [x] AZL1 [P] Create `Sidebar` component (`packages/ui-components/src/components/Sidebar.tsx`):
      collapsible desktop sidebar (240px expanded / 64px collapsed) with portal-based hover tooltips
      (dark `#2D3139` bg, left arrow, bold text), localStorage persistence, `hasSubmenu` chevron,
      `companyName` header slot, mobile bottom tab bar — rewritten from icon-only to full
      collapsible — `packages/ui-components/src/components/Sidebar.tsx`
- [x] AZL2 [P] Create `PageHeader` component
      (`packages/ui-components/src/components/PageHeader.tsx`): title, subtitle, optional `onBack`
      callback rendering a back-arrow button —
      `packages/ui-components/src/components/PageHeader.tsx`
- [x] AZL3 [P] Create `ResetPasswordSuccessModal` component
      (`packages/ui-components/src/components/ResetPasswordSuccessModal.tsx`): modal with Alert
      success box, countdown redirect, confirm button; used by both super-admin and company-admin
      user management — `packages/ui-components/src/components/ResetPasswordSuccessModal.tsx`
- [x] AZL4 Export `Sidebar`, `SidebarNavItem`, `PageHeader`, `ResetPasswordSuccessModal` from
      `packages/ui-components/src/index.ts` barrel — `packages/ui-components/src/index.ts`

---

## Post-Epic 2: TablePagination Component & Pagination Standardisation

**Purpose**: Create a reusable `TablePagination` component matching the Figma pagination design
(rows-per-page selector, showing count, numbered pages with ellipsis, Back/Next). Replace inline
pagination in Invoice List pages and upgrade User List pages from simple `Pagination` to the new
component. Standardise default page size to 25 per FRD.

**Prerequisites**: Invoice List UI Shell (Parts I–L) complete, User Management (Parts AH–AY)
complete.

### Part AZ: TablePagination Shared Component

- [x] AZ1 [P] Create `packages/ui-components/src/components/TablePagination.tsx`: props `page`,
      `totalItems`, `pageSize`, `pageSizeOptions` (default [10,25,50]), `onPageChange`,
      `onPageSizeChange`, `rowsPerPageLabel`, `showingLabel` (callback
      `({from,to,total}) => string`), `backLabel`, `nextLabel`, `className`; internal
      `buildPageNumbers()` helper with smart ellipsis; three-section layout (left: rows-per-page
      select, centre: showing text, right: page buttons + Back/Next); active page styled
      `bg-foreground text-background rounded` —
      `packages/ui-components/src/components/TablePagination.tsx`
- [x] AZ2 Export `TablePagination` and `TablePaginationProps` from barrel —
      `packages/ui-components/src/index.ts`
- [x] AZ3 [P] Add i18n keys `back`, `rowsPerPage`, `showingItems` to
      `packages/i18n/src/locales/en/common.json`

### Part BA: Invoice List Page — Pagination Upgrade

- [x] BA1 [P] Update `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`: remove
      inline pagination logic, import `TablePagination` from `@forethread/ui-components`, replace
      custom pagination block with `<TablePagination>` using i18n labels from `invoices` namespace —
      `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [x] BA2 [P] Update `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`: same
      change as BA1 (identical file) —
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`

### Part BB: Settings Hub Navigation

- [x] BB1 Update `apps/company-admin-app/src/shared/layout/AppLayout.tsx` sidebar to 8 items (RFQs,
      Purchase Orders, Projects, Bulk Orders, Invoices, Vendors, Material Catalogue, Company
      Settings with `hasSubmenu: true`); all hrefs via `ROUTES` constants; `usePageInfo()` covers
      all new routes — `apps/company-admin-app/src/shared/layout/AppLayout.tsx`
- [x] BB2 Simplify `apps/super-admin-app/src/shared/layout/AppLayout.tsx` sidebar to 3 items
      (Dashboard, Companies, Settings) — unchanged —
      `apps/super-admin-app/src/shared/layout/AppLayout.tsx`
- [x] BB3 Update `apps/financial-officer-app/src/shared/layout/AppLayout.tsx` sidebar to 3 items
      (Dashboard, Invoices at `/invoices`, Settings); Invoices moved from `/settings/invoices` to
      top-level; all hrefs via `ROUTES` constants —
      `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`
- [x] BB4 [P] Rewrite `apps/company-admin-app/src/features/settings/pages/SettingsPage.tsx`:
      card-based hub; link to User Management only (Invoices removed — now top-level sidebar item) —
      `apps/company-admin-app/src/features/settings/pages/SettingsPage.tsx`
- [x] BB5 [P] Rewrite `apps/super-admin-app/src/features/settings/pages/SettingsPage.tsx` as
      card-based navigation hub; link to User Management (`/settings/users`) —
      `apps/super-admin-app/src/features/settings/pages/SettingsPage.tsx`
- [x] BB6 [P] Rewrite `apps/financial-officer-app/src/features/settings/pages/SettingsPage.tsx`:
      empty hub (Invoices removed — now top-level sidebar item) —
      `apps/financial-officer-app/src/features/settings/pages/SettingsPage.tsx`
- [x] BB7 Fix `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`: pass
      `onBack={pageInfo.onBack}` to `<PageHeader>` — back button was generated by `usePageInfo()`
      but not wired to the component — `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`
- [x] BB8 Fix user avatar dropdown hover bug across all 6 apps: `mt-1` → `pt-1` wrapper to prevent
      hover gap between trigger and dropdown menu
- [x] BB9 Add sidebar icons: `arrow-right.svg` (fix `currerColor` typo), `open-sidebar.svg`,
      `request.svg`, `purchase-orders.svg`, `projects.svg`, `bulk-orders.svg`, `invoice.svg`,
      `vendors.svg`, `material-catalogue.svg`
- [x] BB10 Add i18n nav keys: `rfqs`, `purchaseOrders`, `bulkOrders`, `vendors`,
      `materialCatalogue`, `companySettings` — `packages/i18n/src/locales/en/nav.json`
- [x] BB11 Add `ROUTES` constants for new pages in `company-admin-app/route-config.ts`: `rfqs`,
      `purchaseOrders`, `bulkOrders`, `invoices` (top-level), `vendors`, `materialCatalogue`
- [x] BB12 Create placeholder pages (company-admin-app): `RfqListPage`, `PurchaseOrderListPage`,
      `BulkOrderListPage`, `VendorListPage`, `MaterialCataloguePage` — all show heading + "Coming
      soon", lazy-loaded in `routes.tsx`
- [x] BB8 [P] Update `apps/company-admin-app/src/features/settings/pages/SettingsPage.tsx`: import
      `InvoicesIcon` from `@forethread/ui-components/assets/icons/invoices.svg?react` instead of
      inline SVG — `apps/company-admin-app/src/features/settings/pages/SettingsPage.tsx`
- [x] BB9 [P] Update `apps/financial-officer-app/src/features/settings/pages/SettingsPage.tsx`: same
      as BB8 — `apps/financial-officer-app/src/features/settings/pages/SettingsPage.tsx`

### Part BC: User List Pagination Standardisation

- [x] BC1 Update `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`: replace
      `Pagination` import with `TablePagination`; add `pageSize` state (default 25); change `limit`
      from hardcoded 25 to `pageSize`; replace pagination block with `<TablePagination>` using i18n
      labels from `common` namespace —
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] BC2 Update `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`: same change as BC1;
      additionally change `limit` from 100 to `pageSize` (default 25) per FRD documentation —
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`

### Part BD: Invoices SVG Icon

- [x] BD1 [P] Create `packages/ui-components/src/assets/icons/invoices.svg` — document with folded
      corner and horizontal lines (matches `invoices.svg` in Figma icon set) —
      `packages/ui-components/src/assets/icons/invoices.svg`

### Verification

- [x] TablePagination renders correctly with rows-per-page, showing count, page buttons, Back/Next
- [x] Invoice List pages use `<TablePagination>` instead of inline pagination
- [x] User List pages use `<TablePagination>` with default 25 rows per page
- [x] Settings pages act as navigation hubs with links to sub-features
- [x] Back buttons work on all sub-pages (Users → Settings, Invoices → Settings) — BB7 fixed
      financial-officer `onBack` not being passed to `<PageHeader>`

---

## Post-Epic 2: Global API Error Handling via Toast

**Purpose**: Add a global error handler at the Axios interceptor level so every failed API call
automatically shows a toast notification with the backend error message. Calls that handle errors
inline (auth forms, modals) opt out via `skipErrorHandler: true`. Fixes the issue where
`useInitiateResetPassword` (and other mutations without `onError`) silently swallowed backend
errors.

**Prerequisites**: Toast Notification System (Part AB) complete, Error Interceptor
(`packages/api-client/src/interceptors/error.interceptor.ts`) exists.

### Part BE: Error Interceptor — Global Toast Integration

- [x] BE1 [P] Add Axios `AxiosRequestConfig` module augmentation with `skipErrorHandler?: boolean`
      to `packages/api-client/src/interceptors/error.interceptor.ts`
- [x] BE2 [P] Extend `applyErrorInterceptor` signature with optional
      `onError: (message: string) => void` callback; call `onError(message)` before rejecting when
      `skipErrorHandler` is not set — `packages/api-client/src/interceptors/error.interceptor.ts`
- [x] BE3 Add optional `config?: AxiosRequestConfig` parameter to auth endpoint functions: `login`,
      `verifyOtp`, `resetPassword`, `activateAccount`, `validateActivationToken` —
      `packages/api-client/src/endpoints/auth.ts`
- [x] BE4 Add optional `config?: AxiosRequestConfig` parameter to user endpoint functions:
      `createUser`, `updateUser`, `deactivateUser`, `reactivateUser`, `resendInvitation`,
      `cancelInvitation` — `packages/api-client/src/endpoints/users.ts`
- [x] BE5 Add optional `config?: AxiosRequestConfig` parameter to project endpoint functions:
      `getProjects`, `createProject`, `updateProject` —
      `packages/api-client/src/endpoints/projects.ts`

### Part BF: App Wiring — Connect Toast to Interceptor

- [x] BF1 Update `apps/super-admin-app/src/main.tsx`: import `notificationService`, pass
      `(msg) => notificationService.error(msg)` to `applyErrorInterceptor`
- [x] BF2 Update `apps/company-admin-app/src/main.tsx`: same as BF1
- [x] BF3 Update `apps/financial-officer-app/src/main.tsx`: same as BF1
- [x] BF4 Update `apps/vendor-app/src/main.tsx`: same as BF1

### Part BG: Auth Services — skipErrorHandler for Inline Alerts

- [x] BG1 Add `{ skipErrorHandler: true }` to `useLogin`, `useVerifyOtp`, `useResetPassword`,
      `useActivateAccount`, `useValidateActivationToken` in
      `apps/super-admin-app/src/features/auth/services/auth.service.ts`
- [x] BG2 Same as BG1 in `apps/company-admin-app/src/features/auth/services/auth.service.ts`
- [x] BG3 Same as BG1 in `apps/financial-officer-app/src/features/auth/services/auth.service.ts`
- [x] BG4 Same as BG1 in `apps/vendor-app/src/features/auth/services/auth.service.ts`

### Part BH: User & Project Services — skipErrorHandler for Inline Alerts

- [x] BH1 Add `{ skipErrorHandler: true }` to `useCreateUser`, `useUpdateUser`, `useDeactivateUser`,
      `useReactivateUser`, `useResendInvitation`, `useCancelInvitation` in
      `apps/super-admin-app/src/features/users/services/users.service.ts`
      (`useInitiateResetPassword` intentionally NOT skipped — errors show via toast)
- [x] BH2 Same as BH1 in `apps/company-admin-app/src/features/users/services/users.service.ts`
- [x] BH3 Add `{ skipErrorHandler: true }` to `useProjects`, `useCreateProject`, `useUpdateProject`
      in `apps/company-admin-app/src/features/projects/services/projects.service.ts`

### Verification

- [x] `pnpm --filter @forethread/api-client exec tsc --noEmit` — 0 errors
- [x] `pnpm --filter super-admin-app exec tsc --noEmit` — 0 errors (pre-existing TS6133 in
      CompanySelectionStep unrelated)
- [x] `pnpm --filter financial-officer-app exec tsc --noEmit` — 0 errors
- [x] `pnpm --filter vendor-app exec tsc --noEmit` — 0 errors

---

## Post-Epic 2: App Scaffolds — procurement-officer-app & warehouse-officer-app

**Purpose**: Scaffold `apps/procurement-officer-app/` (port 3005) and `apps/warehouse-officer-app/`
(port 3006) following the established `vendor-app` pattern. Full auth flows, dashboard, settings
placeholder, and shared layout. Backend URL mapping updated to route email links to the correct app
per role.

**Note**: `apps/foreman-app/` is NOT scaffolded — per spec §Assumptions, Foreman is a native mobile
app outside this specification scope.

### Part BI: procurement-officer-app Scaffold

- [x] BI1 [P] Create `apps/procurement-officer-app/package.json`
      (`@forethread/procurement-officer-app`), `tsconfig.json`, `vite.config.ts` (port 3005),
      `index.html` (title: Forethread — Procurement Officer), `.eslintrc.cjs`, `.env.example`,
      `.env`, `Dockerfile`, `postcss.config.js`, `tailwind.config.ts` —
      `apps/procurement-officer-app/`
- [x] BI2 [P] Create `src/main.tsx`, `src/app/App.tsx`, `src/app/route-config.ts`,
      `src/app/routes.tsx`, `src/vite-env.d.ts`, `src/styles/globals.css` —
      `apps/procurement-officer-app/src/`
- [x] BI3 [P] Create auth feature: `src/features/auth/state/auth.store.ts` (persist:
      `forethread-procurement-officer-auth`), `src/features/auth/services/auth.service.ts` (OTP key:
      `forethread-procurement-officer-otp-session`), `src/features/auth/ui/LoginPage.tsx`,
      `src/features/auth/ui/ForgotPasswordPage.tsx`,
      `src/features/auth/ui/ProcurementOfficerVerifyOtpPage.tsx`,
      `src/features/auth/ui/ProcurementOfficerActivateAccountPage.tsx`,
      `src/features/auth/ui/ProcurementOfficerResetPasswordPage.tsx` —
      `apps/procurement-officer-app/src/features/auth/`
- [x] BI4 [P] Create `src/features/dashboard/pages/DashboardPage.tsx`,
      `src/features/settings/pages/SettingsPage.tsx`, `src/shared/components/PrivateRoute.tsx`,
      `src/shared/components/ErrorPage.tsx`, `src/shared/layout/AppLayout.tsx` —
      `apps/procurement-officer-app/src/`

### Part BJ: warehouse-officer-app Scaffold

- [x] BJ1 [P] Create `apps/warehouse-officer-app/package.json`
      (`@forethread/warehouse-officer-app`), `tsconfig.json`, `vite.config.ts` (port 3006),
      `index.html` (title: Forethread — Warehouse Officer), `.eslintrc.cjs`, `.env.example`, `.env`,
      `Dockerfile`, `postcss.config.js`, `tailwind.config.ts` — `apps/warehouse-officer-app/`
- [x] BJ2 [P] Create `src/main.tsx`, `src/app/App.tsx`, `src/app/route-config.ts`,
      `src/app/routes.tsx`, `src/vite-env.d.ts`, `src/styles/globals.css` —
      `apps/warehouse-officer-app/src/`
- [x] BJ3 [P] Create auth feature: `src/features/auth/state/auth.store.ts` (persist:
      `forethread-warehouse-officer-auth`), `src/features/auth/services/auth.service.ts` (OTP key:
      `forethread-warehouse-officer-otp-session`), `src/features/auth/ui/LoginPage.tsx`,
      `src/features/auth/ui/ForgotPasswordPage.tsx`,
      `src/features/auth/ui/WarehouseOfficerVerifyOtpPage.tsx`,
      `src/features/auth/ui/WarehouseOfficerActivateAccountPage.tsx`,
      `src/features/auth/ui/WarehouseOfficerResetPasswordPage.tsx` —
      `apps/warehouse-officer-app/src/features/auth/`
- [x] BJ4 [P] Create `src/features/dashboard/pages/DashboardPage.tsx`,
      `src/features/settings/pages/SettingsPage.tsx`, `src/shared/components/PrivateRoute.tsx`,
      `src/shared/components/ErrorPage.tsx`, `src/shared/layout/AppLayout.tsx` —
      `apps/warehouse-officer-app/src/`

### Part BK: Backend — Role-Based App URL Mapping

- [x] BK1 Update `ROLE_APP_URL_MAP` in `apps/backend/src/common/utils/app-url.util.ts`:
      `ProcurementOfficer` → `PROCUREMENT_OFFICER_APP_URL`, `WarehouseOfficer` →
      `WAREHOUSE_OFFICER_APP_URL` (Foreman stays as `COMPANY_ADMIN_APP_URL` fallback — mobile app
      out of scope) — `apps/backend/src/common/utils/app-url.util.ts`
- [x] BK2 Add `PROCUREMENT_OFFICER_APP_URL=http://localhost:3005` and
      `WAREHOUSE_OFFICER_APP_URL=http://localhost:3006` to `apps/backend/.env.example` and
      `apps/backend/.env` — `apps/backend/.env.example`, `apps/backend/.env`

### Verification

- [x] `npx tsc --noEmit --project apps/procurement-officer-app/tsconfig.json` — zero type errors
- [x] `npx tsc --noEmit --project apps/warehouse-officer-app/tsconfig.json` — zero type errors
- [x] `npx tsc --noEmit --project apps/backend/tsconfig.json` — zero type errors

---

## Post-Epic 2: Header Redesign — Search Input & Notification Bell

**Purpose**: Redesign the app header across all 6 apps to match updated Figma design: add search
input with search icon, replace inline notification bell SVG with styled `NotificationBell`
component (34x34px, `#E8EAED` border, blue notification dot), remove username text next to avatar.
Create reusable `SearchInput` and `NotificationBell` shared components.

### Part BL: Shared UI Components

- [x] BL1 [P] Create `SearchInput` component
      (`packages/ui-components/src/components/SearchInput.tsx`): forwardRef input with inlined
      `search.svg` icon, rounded border, `placeholder` prop (default "Search"), `className`
      passthrough — `packages/ui-components/src/components/SearchInput.tsx`
- [x] BL2 [P] Create `NotificationBell` component
      (`packages/ui-components/src/components/NotificationBell.tsx`): 34x34px button with `#E8EAED`
      1px border, bell SVG icon, optional `hasNotifications` prop rendering blue dot (`#175CD3`,
      8x8px, `border-radius: 4px`, `left: 26px`, white border) —
      `packages/ui-components/src/components/NotificationBell.tsx`
- [x] BL3 Export `SearchInput`, `SearchInputProps`, `NotificationBell`, `NotificationBellProps` from
      barrel — `packages/ui-components/src/index.ts`
- [x] BL4 Add `search` key to `packages/i18n/src/locales/en/common.json` —
      `packages/i18n/src/locales/en/common.json`

### Part BM: Header Update — All 6 Apps

- [x] BM1 Update `apps/company-admin-app/src/shared/layout/AppLayout.tsx`: import `SearchInput` +
      `NotificationBell`, replace inline bell SVG with `<NotificationBell hasNotifications>`, add
      `<SearchInput>` before bell, remove username `<span>` next to avatar, change gap from `gap-4`
      to `gap-3`
- [x] BM2 Same changes in `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`
- [x] BM3 Same changes in `apps/procurement-officer-app/src/shared/layout/AppLayout.tsx`
- [x] BM4 Same changes in `apps/super-admin-app/src/shared/layout/AppLayout.tsx`
- [x] BM5 Same changes in `apps/vendor-app/src/shared/layout/AppLayout.tsx`
- [x] BM6 Same changes in `apps/warehouse-officer-app/src/shared/layout/AppLayout.tsx`

### Part BN: Replace Inline Search Inputs with SearchInput

- [x] BN1 Add `iconClassName` and `inputClassName` props to `SearchInput` for color/style
      customization — `packages/ui-components/src/components/SearchInput.tsx`
- [x] BN2 Replace inline SVG search + `<input>` in super-admin `UserListPage.tsx` with
      `<SearchInput iconClassName="text-foreground">` —
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`
- [x] BN3 Replace `<Input>` in company-admin `ProjectListPage.tsx` with `<SearchInput>` —
      `apps/company-admin-app/src/features/projects/ui/ProjectListPage.tsx`
- [x] BN4 Replace inline `SearchIcon()` + `<Input>` in company-admin `InvoiceListPage.tsx` with
      `<SearchInput>`, delete `SearchIcon` function —
      `apps/company-admin-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [x] BN5 Same as BN4 in financial-officer `InvoiceListPage.tsx` —
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceListPage.tsx`
- [x] BN6 Use `notification.svg` icon in `NotificationBell` instead of inline SVG —
      `packages/ui-components/src/components/NotificationBell.tsx`
- [x] BN7 Remove `hasNotifications` from all 6 AppLayouts (notification logic not implemented yet,
      deferred to Epic 12) — `apps/*/src/shared/layout/AppLayout.tsx`

### Verification

- [x] `npx tsc --noEmit --project packages/ui-components/tsconfig.json` — zero type errors
- [x] `npx tsc --noEmit --project apps/company-admin-app/tsconfig.json` — zero type errors
- [x] `npx tsc --noEmit --project apps/super-admin-app/tsconfig.json` — zero type errors
- [x] `npx tsc --noEmit --project apps/financial-officer-app/tsconfig.json` — zero type errors

---

### Part BO: Bugfixes & UI Polish (Post-Epic 2)

- [x] T216 [US-1.08] Fix avatar/logo cross-host access — proxy through backend S3 streaming instead
      of presigned URLs. Added `StorageService.getObject()`, `GET /users/:id/avatar-image`,
      `GET /users/me/avatar-image`, `GET /companies/:id/logo-image` proxy endpoints. Excluded test
      files from super-admin tsconfig build — `apps/backend/src/modules/storage/storage.service.ts`,
      `apps/backend/src/modules/users/users.controller.ts`,
      `apps/backend/src/modules/companies/companies.controller.ts`,
      `apps/super-admin-app/tsconfig.json`
- [x] T217 [US-1.09] Document export (PDF/CSV) + confirm delete dialog + hover color polish. Backend
      `CompanyExportService` with PDF/CSV export, `GET /companies/:id/documents/export/:format`.
      Frontend: `ConfirmDialog` replaces `window.confirm`, export PDF button, delete hover fix —
      `apps/backend/src/modules/companies/company-export.service.ts`,
      `apps/super-admin-app/src/features/companies/ui/DocumentsTab.tsx`,
      `apps/company-admin-app/src/features/settings/ui/DocumentsTab.tsx`,
      `apps/company-admin-app/src/features/projects/ui/CreateProjectPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`
- [x] T218 [US-1.08] Fix avatar/logo proxy — replace web ReadableStream with Buffer for Node.js
      compatibility. `StorageService.getObject()` now returns `Buffer` via `transformToByteArray()`,
      simplified `streamAvatar` to `res.end(body)` —
      `apps/backend/src/modules/storage/storage.service.ts`,
      `apps/backend/src/modules/users/users.controller.ts`,
      `apps/backend/src/modules/companies/companies.controller.ts`
- [x] T219 [US-1.08] Fix avatar display — fetch image blob via authenticated API client instead of
      using `<img src>` (which lacks JWT auth header). Added `getMyAvatarBlob()` in api-client that
      fetches image as blob and returns `URL.createObjectURL()`. Updated all 6 apps'
      `useAvatarUrl()` hooks to use `getMyAvatarBlob` —
      `packages/api-client/src/endpoints/users.ts`, `packages/api-client/src/endpoints/paths.ts`,
      `apps/*/src/features/profile/services/profile.service.ts`
- [x] T220 [US-1.09] Fix lint errors — import order in companies module files, eslint-disable for
      pdfkit unsafe calls in pdf-export.service.ts, Promise reject wrapping. Added
      `tsconfig.build.json` for super-admin to exclude tests from tsc build while keeping them in
      ESLint scope
- [x] T221 [US-1.10] UI polish — modal width `max-w-[494px]` → `max-w-[560px]` in EditProfileModal
      (all 5 apps), EditUserModal (super-admin, company-admin), EditCompanyModal (both apps);
      UserDetailPage spacing `space-y-0` → `space-y-6`; remove dashboard nav from super-admin
      sidebar; replace native checkbox with Checkbox component in AddVendorCompanyModal; a11y fix in
      ProjectAccessModal (role=button + onKeyDown)
- [x] T222 [US-1.09] Simplify avatar/logo to public MinIO URLs — removed backend proxy streaming
      endpoints (avatar-image, logo-image) and frontend blob fetch logic; backend now returns public
      S3 URLs via `StorageService.getPublicUrl(key)`; frontend uses direct `<img src={url}>`.
      Removed `getMyAvatarBlob`, `getUserAvatarBlob`, `getCompanyLogoBlob` from api-client. Updated
      all 6 apps' profile.service.ts, UserDetailPage, CompanyDetailPage, useCompanyLogo —
      `apps/backend/src/modules/storage/storage.service.ts`,
      `apps/backend/src/modules/users/users.controller.ts`,
      `apps/backend/src/modules/companies/companies.controller.ts`,
      `packages/api-client/src/endpoints/users.ts`,
      `packages/api-client/src/endpoints/companies.ts`,
      `packages/api-client/src/endpoints/paths.ts`, all
      `apps/*/features/profile/services/profile.service.ts`,
      `apps/super-admin-app/src/features/users/ui/UserDetailPage.tsx`,
      `apps/company-admin-app/src/features/users/ui/UserDetailPage.tsx`,
      `apps/super-admin-app/src/features/companies/pages/CompanyDetailPage.tsx`,
      `apps/company-admin-app/src/features/settings/hooks/useCompanyLogo.ts`
- [x] T223 [US-1.10] Add workStatus/department fields to User model — Prisma migration
      `add_user_work_status_department`, UpdateMeDto, USER_SELECT. Fix cancel invitation — wrap in
      transaction with explicit cleanup of emailVerification + relation disconnect —
      `apps/backend/src/prisma/schema.prisma`, `apps/backend/src/modules/users/users.service.ts`,
      `apps/backend/src/modules/users/users.service.spec.ts`,
      `apps/backend/src/prisma/migrations/20260306120000_add_user_work_status_department/`
- [x] T224 [US-1.10] Wire workStatus/department in EditProfileModal — populate from profile data,
      send to updateMe API. Removed "UI-only" comments. Applied to all 5 apps (company-admin,
      financial-officer, procurement-officer, vendor, warehouse-officer) —
      `apps/*/src/features/profile/ui/EditProfileModal.tsx`
- [x] T225 [US-1.05] Persist tab state in URL searchParams — replaced useState with useSearchParams
      for tab navigation on CompanyDetailPage, UserListPage (super-admin + company-admin),
      ProjectDetailPage. Updated tests. Fixed lint: removed unnecessary type assertion —
      `apps/super-admin-app/src/features/companies/pages/CompanyDetailPage.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/ProjectDetailPage.tsx`,
      `apps/super-admin-app/src/features/companies/pages/CompanyDetailPage.test.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.test.tsx`
- [x] T226 [US-1.09] Fix popup blocker for document view/download/export — open blank tab
      synchronously before async getFileUrl, then set location.href. Applied to DocumentsTab
      (super-admin + company-admin) and CompanyProfilePage (company-admin) —
      `apps/super-admin-app/src/features/companies/ui/DocumentsTab.tsx`,
      `apps/company-admin-app/src/features/settings/ui/DocumentsTab.tsx`,
      `apps/company-admin-app/src/features/settings/pages/CompanyProfilePage.tsx`
- [x] T227 [US-1.05] Preselect company in CreateUserModal when inviting from company page — skip
      company selection step, pre-fill companyId/name/type. CompanyUsersTab passes company info.
      CompanyDetailPage passes companyType to tab —
      `apps/super-admin-app/src/features/users/ui/CreateUserModal.tsx`,
      `apps/super-admin-app/src/features/companies/ui/CompanyUsersTab.tsx`,
      `apps/super-admin-app/src/features/companies/pages/CompanyDetailPage.tsx`
- [x] T228 [US-1.09, US-1.05] Fix failing unit tests — DocumentsTab.test.tsx handleView assertion
      aligned with popup-blocker-safe implementation (window.open blank tab + location.href).
      UserListPage.test.tsx bulk action test uses async act() for proper promise resolution —
      `apps/super-admin-app/src/features/companies/ui/DocumentsTab.test.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.test.tsx`
- [x] T229 [US-1.05] Remove CompaniesPage (no FRD requirement) — delete placeholder page, remove
      /companies route, replace sidebar "Companies" with "User Management" linking to
      /settings/users, company detail back button navigates to users page —
      `apps/super-admin-app/src/features/companies/pages/CompaniesPage.tsx` (deleted),
      `apps/super-admin-app/src/app/route-config.ts`, `apps/super-admin-app/src/app/routes.tsx`,
      `apps/super-admin-app/src/shared/layout/AppLayout.tsx`
- [x] T230 [US-1.05] Show empty companies in user management — useGroupedUsers accepts allCompanies
      param to seed groups with companies that have 0 users. Fix tab-switching tests to use
      contract-based testing (verify setSearchParams calls + URL-driven rendering) —
      `apps/super-admin-app/src/features/users/hooks/useGroupedUsers.ts`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/super-admin-app/src/features/companies/pages/CompanyDetailPage.test.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.test.tsx`
- [x] T231 [US-1.05] Remove Users sidebar item, add back button on /settings/users → /settings. Hide
      pagination when total ≤ 10 on UserListPage and CompanyUsersTab —
      `apps/super-admin-app/src/shared/layout/AppLayout.tsx`,
      `apps/super-admin-app/src/shared/layout/AppLayout.test.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.test.tsx`,
      `apps/super-admin-app/src/features/companies/ui/CompanyUsersTab.tsx`

## Company-Admin-App Unit Tests (US-1.05)

**Status**: Complete. 60+ unit test files added covering all features in company-admin-app.

- [x] T316 [US-1.05] Add vitest config to company-admin-app: `test` section in `vite.config.ts`
      (globals, jsdom, setup file, coverage thresholds), `"types": ["vitest/globals"]` in
      `tsconfig.json`, vitest dev dependency in `package.json` —
      `apps/company-admin-app/vite.config.ts`, `apps/company-admin-app/tsconfig.json`,
      `apps/company-admin-app/package.json`, `pnpm-lock.yaml`
- [x] T317 [US-1.05] Add unit tests for company-admin-app auth feature: LoginPage, OtpVerification,
      ActivateAccount, ResetPassword, ForgotPassword pages + auth.service + auth.store —
      `apps/company-admin-app/src/features/auth/`
- [x] T318 [US-1.05] Add unit tests for company-admin-app projects feature: ProjectListPage,
      CreateProjectPage, EditProjectPage, ProjectDetailPage, projects.service, projects.store —
      `apps/company-admin-app/src/features/projects/`
- [x] T319 [US-1.05] Add unit tests for company-admin-app users feature: UserListPage,
      UserDetailPage, CreateUserModal, EditUserModal, InvitationSuccessModal, ProjectAccessModal,
      users.service, users.store, useCreateUserForm, useEditUserForm, useRoleOptions,
      user-form.schema, roles constants — `apps/company-admin-app/src/features/users/`
- [x] T320 [US-1.05] Add unit tests for company-admin-app settings feature: SettingsPage,
      CompanyProfilePage, CompanyUsersTab, DocumentsTab, EditCompanyModal, OverviewTab,
      useCompanyLogo, company-form.schema — `apps/company-admin-app/src/features/settings/`
- [x] T321 [US-1.05] Add unit tests for company-admin-app profile feature: UserProfilePage,
      EditProfileModal, ProfileInfoGrid, ProfileSections, profile.service, constants —
      `apps/company-admin-app/src/features/profile/`
- [x] T322 [US-1.05] Add unit tests for company-admin-app remaining features: DashboardPage,
      InvoiceListPage + constants, RfqListPage, PurchaseOrderListPage, BulkOrderListPage,
      MaterialCataloguePage, VendorListPage, App, AppLayout, PrivateRoute, ErrorPage —
      `apps/company-admin-app/src/features/`, `apps/company-admin-app/src/shared/`,
      `apps/company-admin-app/src/app/`
- [x] T323 [US-1.05] Fix lint errors in super-admin-app test files: CompanyUsersTab.test.tsx,
      DashboardPage.test.tsx, ProfileSections.test.tsx, ActionLogTab.test.tsx —
      `apps/super-admin-app/src/features/`
- [x] T325 [US-1.05] Refactor all inline SVG icons to use assets/icons imports: replace inline
      `<svg>` code in 12 source files (SearchInput, PasswordInput, Checkbox, CustomDropdown,
      FilterPopover, PageHeader, ChangePasswordModal, CustomToast, SettingsPage, UserListPage,
      InvoiceListPage x2) with SVG asset imports. Create 6 new SVG icon files (chevron-down,
      chevron-right, checkmark, check-stroke, filter, users-group). Eliminates code duplication
      between company-admin-app and financial-officer-app —
      `packages/ui-components/src/assets/icons/`, `packages/ui-components/src/components/`,
      `apps/super-admin-app/src/features/`, `apps/company-admin-app/src/features/`,
      `apps/financial-officer-app/src/features/`

## E2E Test Specs (US-3–US-15)

**Status**: Complete. E2E test spec files added for all user stories (US-3 through US-15, plus
US-10.01–10.07 dashboard specs).

- [x] T324 [US-10] Add e2e test specs for procurement platform user stories: US-3 (RFQ creation),
      US-4 (quote review), US-5 (purchase orders), US-6 (vendor management), US-7 (material
      catalogue), US-8 (bulk orders), US-9 (invoice reconciliation), US-10.01–10.07 (dashboards),
      US-11 (delivery reports), US-12 (system admin), US-13 (warehouse ops), US-14 (field requests),
      US-15 (change orders), US-1.10 (user profile). Update playwright.config.ts test matching and
      test-data.ts fixtures — `tests/e2e/procurement/`, `playwright.config.ts`,
      `tests/e2e/fixtures/test-data.ts`

- [x] T326 [US-1.09] Merge us0110 (user profile) tests into us0109 to reduce OTP login count, fix
      us0102 Edge test strict mode violation, refactor loginAs() to use timestamp-based OTP
      filtering and route intercept for reliable OTP submission, update qa-e2e-report.md —
      `tests/e2e/helpers/procurement-helpers.ts`,
      `tests/e2e/procurement/us0102-account-activation.spec.ts`,
      `tests/e2e/procurement/us0109-company-profile.spec.ts`,
      `tests/e2e/procurement/us0110-user-profile.spec.ts`, `playwright.config.ts`,
      `specs/001-procurement-platform/qa-e2e-report.md`

## Super Admin Dashboard (US-2)

**Status**: Complete. Dashboard implemented with all 5 user stories, refactored into components,
shared `formatDateTime` utility extracted.

- [x] T232 [US-2.01] KPI Overview Cards — 4 cards (Platform Status, Active Users, Total Companies,
      DB Performance) with real data for users/companies, mock for status/DB. Responsive grid (4→2→1
      cols). `KpiCard.tsx` component extracted —
      `apps/super-admin-app/src/features/dashboard/ui/KpiCard.tsx`,
      `apps/super-admin-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T233 [US-2.02] Quick Action Navigation Buttons — 4 buttons (User Mgmt, Company Mgmt, Material
      Catalogue disabled, Admin Panel). Navigate to correct routes —
      `apps/super-admin-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T234 [US-2.03] Platform State Monitoring Table — mock data table with Component, Status, Last
      Successful Run, Last Error, Error Info, Actions. Status badges use CSS vars
      (success/destructive/warning). `PlatformStateTable.tsx` component extracted —
      `apps/super-admin-app/src/features/dashboard/ui/PlatformStateTable.tsx`,
      `apps/super-admin-app/src/features/dashboard/constants/dashboard.constants.ts`
- [x] T235 [US-2.04] Recent Changes Feed — timeline of 5 most recent audit log entries via
      `getAuditLogs` API. Shows action label, performer avatar+name, timestamp, target. Loading
      spinner, empty state. `RecentChangesTimeline.tsx` component extracted —
      `apps/super-admin-app/src/features/dashboard/ui/RecentChangesTimeline.tsx`,
      `apps/super-admin-app/src/features/dashboard/hooks/useDashboardData.ts`
- [x] T236 [US-2.05] Google Analytics Placeholder — placeholder card with i18n title and "coming
      soon" message — `apps/super-admin-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T237 [US-2] i18n translations — all dashboard text sourced from `dashboard.json` namespace
      (kpi, quickActions, platformState, recentChanges, googleAnalytics) —
      `packages/i18n/src/locales/en/dashboard.json`
- [x] T238 [US-2] Replace hardcoded colors with CSS variables — all Tailwind emerald/red/amber
      replaced with `hsl(var(--success))`, `hsl(var(--destructive))`, `hsl(var(--warning))` —
      `apps/super-admin-app/src/features/dashboard/constants/dashboard.constants.ts`,
      `apps/super-admin-app/src/features/dashboard/ui/KpiCard.tsx`
- [x] T239 [US-2] Extract `formatDateTime` to shared utility — moved from 7 duplicate locations to
      `@forethread/ui-components` package. Updated all 6 apps' ProfileSections + ActionLogTab +
      DashboardPage — `packages/ui-components/src/utils/formatDateTime.ts`,
      `packages/ui-components/src/index.ts`,
      `apps/super-admin-app/src/features/profile/ui/ProfileSections.tsx`,
      `apps/super-admin-app/src/features/users/ui/ActionLogTab.tsx`,
      `apps/vendor-app/src/features/profile/ui/ProfileSections.tsx`,
      `apps/warehouse-officer-app/src/features/profile/ui/ProfileSections.tsx`,
      `apps/procurement-officer-app/src/features/profile/ui/ProfileSections.tsx`,
      `apps/company-admin-app/src/features/profile/ui/ProfileSections.tsx`,
      `apps/financial-officer-app/src/features/profile/ui/ProfileSections.tsx`
- [x] T240 [US-2] Refactor DashboardPage — extract KpiCard, PlatformStateTable,
      RecentChangesTimeline components; extract constants to `dashboard.constants.ts`; create
      `useDashboardData` hook —
      `apps/super-admin-app/src/features/dashboard/pages/DashboardPage.tsx`,
      `apps/super-admin-app/src/features/dashboard/ui/KpiCard.tsx`,
      `apps/super-admin-app/src/features/dashboard/ui/PlatformStateTable.tsx`,
      `apps/super-admin-app/src/features/dashboard/ui/RecentChangesTimeline.tsx`,
      `apps/super-admin-app/src/features/dashboard/constants/dashboard.constants.ts`,
      `apps/super-admin-app/src/features/dashboard/hooks/useDashboardData.ts`

---

## Epic 2 Dashboards: Procurement Dashboards & Management Views (US-10.01–10.07)

**Status**: COMPLETE. **Prerequisites**: Epic 1 COMPLETE, Epic 2 Projects COMPLETE, SA Dashboard
COMPLETE. **Figma**:
[Epic 2: Dashboard](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3344-58649)

**Scope**: Role-specific home dashboards (PO/CA, Vendor, Finance Officer) + management table pages
(RFQ, PO, Bulk Order, Invoice). Full CRUD workflows deferred to US-3 through US-9.

---

### Phase 1: Shared Types & Enums (Epic 2 Dashboards)

**Purpose**: Define all new entity enums, DTOs, Zod schemas, and API client functions needed by both
backend and frontend. Must complete before backend or frontend work begins.

- [x] T241 [P] [US-10] Add enums to `packages/shared-types/src/enums/index.ts`: `RfqStatus` (Draft,
      Open, AwaitingResponse, Quoted, Awarded, Closed, Cancelled), `PoStatus` (Draft, Sent,
      Acknowledged, PendingDelivery, Delivered, Closed, Cancelled), `PoType` (Standard,
      BulkDrawdown, HoldForRelease), `BulkOrderStatus` (Active, Expired, Completed, Cancelled),
      `InvoiceStatus` (Pending, Approved, Disputed, Paid, Rejected), `QuickFilter` (MyRfqs,
      OpenRfqs, AwaitingResponses, NoQuotes, AwardedRfqs, ClosedRfqs); re-export from barrel —
      `packages/shared-types/src/enums/index.ts`

- [x] T242 [P] [US-10] Create `packages/shared-types/src/dtos/rfq.dto.ts`: `RfqListQueryDto` (page,
      limit, search, status, quickFilter, projectId, sortBy, sortDir, groupBy), `RfqListItemDto`
      (all columns from Figma US 2.06: id, projectName, projectId, status, reqQuantities, pickUp,
      deliveryLocation, pickUpLocation, recVendors, recQuotes, applVendors, lineItems,
      deadlineRange, applIssues, totalRequestedQty, arcBlocksDist, createdDate, createdBy,
      approvalStatus, approvedBy, lastModifiedBy), `RfqResponseDto`, `PaginatedRfqsResponseDto`;
      class-validator decorators — `packages/shared-types/src/dtos/rfq.dto.ts`

- [x] T243 [P] [US-10] Create `packages/shared-types/src/dtos/purchase-order.dto.ts`:
      `PoListQueryDto` (page, limit, search, status, quickFilter, projectId, sortBy, sortDir),
      `PoListItemDto` (PO/CA columns: id, projectName, projectId, status, reqQuantities, pickUp,
      deliveryLocation, pickUpLocation, recVendors, lineItems, deadlineRange, totalRequestedQty,
      createdDate, createdBy, approvalStatus, approvedBy, lastModifiedBy; Vendor columns: poNumber,
      projectName, projectId, contractorName, poStatus, revision, poType, pickUp), `PoResponseDto`,
      `PaginatedPosResponseDto` — `packages/shared-types/src/dtos/purchase-order.dto.ts`

- [x] T244 [P] [US-10] Create `packages/shared-types/src/dtos/bulk-order.dto.ts`:
      `BulkOrderListQueryDto` (page, limit, search, projectId, vendorId, sortBy, sortDir),
      `BulkOrderListItemDto` (id, projectName, projectId, vendorName, brands, lineItems,
      deliveriesPercent, amountCount, totalAmount, solidGold, date), `BulkOrderDetailDto` (bulkId,
      rfqReference, contractorName, vendorName, projectName, createdDate, endDate, createdBy,
      lineItems array with: lineItemId, itemReference, description, qty, unit, ordered,
      qtyRemaining, deliveriesPercent, pricePerUnit, totalLineInc), `PaginatedBulkOrdersResponseDto`
      — `packages/shared-types/src/dtos/bulk-order.dto.ts`

- [x] T245 [P] [US-10] Create `packages/shared-types/src/dtos/invoice.dto.ts`: `InvoiceListQueryDto`
      (page, limit, search, status, projectId, sortBy, sortDir), `InvoiceListItemDto` (id,
      projectName, projectId, vendorName, status, relatedPo, totalAmount, dueDate),
      `PaginatedInvoicesResponseDto` — `packages/shared-types/src/dtos/invoice.dto.ts`

- [x] T246 [P] [US-10] Create `packages/shared-types/src/dtos/dashboard.dto.ts`: `PoCaDashboardDto`
      (quoteResponses array, recentOrders array, pendingPurchaseOrders array,
      invoicesPendingApproval array), `VendorDashboardDto` (rfqsWaiting array, invoices array,
      activePOs array), `FinanceDashboardDto` (totalPendingAmount, pendingInvoiceCount,
      invoicesDueThisWeek, invoicesDueAmount, disputedInvoiceCount, disputedTrend,
      invoicesPendingApproval array, disputedInvoices array) —
      `packages/shared-types/src/dtos/dashboard.dto.ts`

- [x] T247 [P] [US-10] Create Zod schemas: `packages/shared-types/src/schemas/rfq.schema.ts`,
      `packages/shared-types/src/schemas/purchase-order.schema.ts`,
      `packages/shared-types/src/schemas/bulk-order.schema.ts`,
      `packages/shared-types/src/schemas/invoice.schema.ts` — mirroring DTOs for client-side
      validation of query params and filter forms — `packages/shared-types/src/schemas/`

- [x] T248 [P] [US-10] Create API client endpoints: `packages/api-client/src/endpoints/rfqs.ts`
      (getRfqs, getRfq), `packages/api-client/src/endpoints/purchase-orders.ts` (getPurchaseOrders,
      getPurchaseOrder), `packages/api-client/src/endpoints/bulk-orders.ts` (getBulkOrders,
      getBulkOrder), `packages/api-client/src/endpoints/invoices.ts` (getInvoices, getInvoice,
      approveInvoice, bulkApproveInvoices), `packages/api-client/src/endpoints/dashboard.ts`
      (getPoCaDashboard, getVendorDashboard, getFinanceDashboard); export all from
      `packages/api-client/src/index.ts` — `packages/api-client/src/endpoints/`,
      `packages/api-client/src/index.ts`

- [x] T249 [P] [US-10] Create i18n translations: `packages/i18n/src/locales/en/rfqs.json` (page
      title, column headers, quick filter labels, empty states, status labels),
      `packages/i18n/src/locales/en/purchaseOrders.json` (same pattern),
      `packages/i18n/src/locales/en/bulkOrders.json` (same pattern + detail view labels), update
      `packages/i18n/src/locales/en/dashboard.json` (add PO/CA sections: quickActions,
      quoteResponses, recentOrders, purchaseOrders, invoicesPendingApproval; Vendor sections:
      rfqsWaiting, invoices, activePOs; Finance Officer sections: kpi, invoicesPending,
      disputedInvoices), update `packages/i18n/src/locales/en/invoices.json` (add management table
      keys) — `packages/i18n/src/locales/en/`

**Checkpoint**: All shared types compile. API client has new endpoint functions. i18n has all
dashboard and management view translations.

---

### Phase 2: Backend — Prisma Schema & Migrations (Epic 2 Dashboards)

**Purpose**: Add RFQ, PurchaseOrder, BulkOrder, Invoice, QuoteResponse, and Drawdown models to
Prisma schema. Sequential — must complete before service layer.

**⚠️ CRITICAL**: Schema changes are sequential (shared file). Complete before Phase 3.

- [x] T250 [US-10] Add `RfqStatus`, `PoStatus`, `PoType`, `BulkOrderStatus`, `InvoiceStatus` enums
      to `apps/backend/src/prisma/schema.prisma` — `apps/backend/src/prisma/schema.prisma`

- [x] T251 [US-10] Add `Rfq` model to schema: id (uuid PK), projectId (FK Project), companyId (FK
      Company), status (RfqStatus default Draft), pickUpDate (date optional), deliveryLocation (text
      optional), pickUpLocation (text optional), deadlineStart (date optional), deadlineEnd (date
      optional), totalRequestedQty (int default 0), approvalStatus (varchar optional), approvedById
      (FK User optional), createdByUserId (FK User), createdAt, updatedAt; relations to Project,
      Company, User (approvedBy, createdBy), RfqLineItem[], QuoteResponse[]; indexes:
      idx_rfqs_company, idx_rfqs_project, idx_rfqs_status — `apps/backend/src/prisma/schema.prisma`

- [x] T252 [US-10] Add `RfqLineItem` model: id (uuid PK), rfqId (FK Rfq), materialName (text),
      quantity (int), unit (varchar 50), description (text optional); relation to Rfq —
      `apps/backend/src/prisma/schema.prisma`

- [x] T253 [US-10] Add `QuoteResponse` model: id (uuid PK), rfqId (FK Rfq), vendorId (FK Company),
      totalCost (decimal 18,4), discountPercent (decimal 5,2 optional), discountAmount (decimal 18,4
      optional), itemsCovered (int default 0), totalItems (int default 0), status (varchar default
      'Pending'), submittedAt (datetime optional), createdAt, updatedAt; relations to Rfq, Company
      (vendor) — `apps/backend/src/prisma/schema.prisma`

- [x] T254 [US-10] Add `PurchaseOrder` model: id (uuid PK), projectId (FK Project), companyId (FK
      Company), vendorId (FK Company), status (PoStatus default Draft), poType (PoType default
      Standard), revision (int default 1), pickUp (boolean default false), deliveryLocation (text
      optional), pickUpLocation (text optional), totalAmount (decimal 18,4 optional), lineItemCount
      (int default 0), deadlineStart (date optional), deadlineEnd (date optional), approvalStatus
      (varchar optional), approvedById (FK User optional), createdByUserId (FK User), createdAt,
      updatedAt; relations to Project, Company (owner), Company (vendor), User; indexes:
      idx_po_company, idx_po_project, idx_po_vendor, idx_po_status —
      `apps/backend/src/prisma/schema.prisma`

- [x] T255 [US-10] Add `BulkOrder` model: id (uuid PK), projectId (FK Project), companyId (FK
      Company), vendorId (FK Company), rfqId (FK Rfq optional), status (BulkOrderStatus default
      Active), brands (text optional), totalAmount (decimal 18,4 optional), endDate (date optional),
      createdByUserId (FK User), createdAt, updatedAt; relations to Project, Company, Rfq;
      BulkOrderLineItem[], Drawdown[] — `apps/backend/src/prisma/schema.prisma`

- [x] T256 [US-10] Add `BulkOrderLineItem` model: id (uuid PK), bulkOrderId (FK BulkOrder),
      itemReference (varchar 100), description (text), qty (int), unit (varchar 50), ordered (int
      default 0), qtyRemaining (int), deliveriesPercent (decimal 5,2 default 0), pricePerUnit
      (decimal 18,4), totalLineInc (decimal 18,4); relation to BulkOrder —
      `apps/backend/src/prisma/schema.prisma`

- [x] T257 [US-10] Add `Drawdown` model: id (uuid PK), bulkOrderId (FK BulkOrder), purchaseOrderId
      (FK PurchaseOrder optional), quantity (int), createdByUserId (FK User), createdAt; relations
      to BulkOrder, PurchaseOrder, User — `apps/backend/src/prisma/schema.prisma`

- [x] T258 [US-10] Add `Invoice` model: id (uuid PK), projectId (FK Project), companyId (FK
      Company), vendorId (FK Company), relatedPoId (FK PurchaseOrder optional), status
      (InvoiceStatus default Pending), totalAmount (decimal 18,4), dueDate (date optional),
      createdByUserId (FK User), createdAt, updatedAt; relations to Project, Company (owner),
      Company (vendor), PurchaseOrder, User; indexes: idx_invoice_company, idx_invoice_project,
      idx_invoice_vendor, idx_invoice_status — `apps/backend/src/prisma/schema.prisma`

- [x] T259 [US-10] Run Prisma migration: `pnpm prisma migrate dev --name add-dashboard-entities`
      from `apps/backend`; verify migration creates all tables with correct indexes and constraints
      — `apps/backend/src/prisma/migrations/`

- [x] T260 [US-10] Update `apps/backend/prisma/seed.ts`: add seed data for RFQs (various statuses),
      QuoteResponses (from vendor companies), PurchaseOrders (various statuses + types), BulkOrders
      (with line items), Invoices (Pending, Approved, Disputed); ensure data matches Figma sample
      data patterns for realistic dashboard testing — `apps/backend/prisma/seed.ts`

**Checkpoint**: Database has all new tables. `pnpm prisma studio` shows all models. Seed data
populates realistic dashboard data.

---

### Phase 3: Backend — Service & Controller Modules (Epic 2 Dashboards)

**Purpose**: Implement list/filter endpoints for each entity and dashboard aggregation endpoints per
role. These endpoints power both the home dashboards and the management table views.

#### RFQ Module

- [x] T261 [US-10.04] Implement `apps/backend/src/modules/rfqs/rfqs.service.ts`:
      `listRfqs(query, user)` — paginated query with: search (rfqId, projectName), filter by status,
      quick filters (MyRfqs = createdByUserId matches, OpenRfqs = status Open, AwaitingResponses =
      status AwaitingResponse, NoQuotes = 0 quote responses, AwardedRfqs = status Awarded,
      ClosedRfqs = status Closed), sortBy any column, groupBy optional; role-based filtering (PO/CA
      see company RFQs, Vendor sees only invited RFQs); returns all columns per Figma US 2.06 plus
      computed fields (recVendors, recQuotes, applVendors, lineItemCount, applIssues, arcBlocksDist)
      — `apps/backend/src/modules/rfqs/rfqs.service.ts`

- [x] T262 [P] [US-10.04] Implement `apps/backend/src/modules/rfqs/rfqs.controller.ts`:
      `GET /v1/rfqs` — `@Roles(CompanyAdmin, ProcurementOfficer, Vendor)` — calls `listRfqs`,
      returns `PaginatedRfqsResponseDto`; `GET /v1/rfqs/:id` — returns `RfqResponseDto`; Swagger
      decorators, rate limiting on list endpoint —
      `apps/backend/src/modules/rfqs/rfqs.controller.ts`

- [x] T263 [P] [US-10.04] Create `apps/backend/src/modules/rfqs/rfqs.module.ts`: imports
      PrismaModule; provides RfqsService; exports RfqsService; register in AppModule —
      `apps/backend/src/modules/rfqs/rfqs.module.ts`, `apps/backend/src/app.module.ts`

#### Purchase Order Module

- [x] T264 [US-10.05] Implement
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`:
      `listPurchaseOrders(query, user)` — paginated query with search, status filter, sortBy;
      role-based column selection (PO/CA see full columns, Vendor sees: poNumber, projectName,
      projectId, contractorName, poStatus, revision, poType, pickUp); role-based data filtering
      (company scope for PO/CA, vendor scope for Vendor) —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`

- [x] T265 [P] [US-10.05] Implement
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`:
      `GET /v1/purchase-orders` — all non-SA roles — calls `listPurchaseOrders`;
      `GET /v1/purchase-orders/:id` — returns `PoResponseDto`; Swagger decorators —
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`

- [x] T266 [P] [US-10.05] Create
      `apps/backend/src/modules/purchase-orders/purchase-orders.module.ts`: module setup + register
      in AppModule — `apps/backend/src/modules/purchase-orders/purchase-orders.module.ts`,
      `apps/backend/src/app.module.ts`

#### Bulk Order Module

- [x] T267 [US-10.06] Implement `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`:
      `listBulkOrders(query, user)` — paginated with project/vendor filters (PO/CA) or
      project/contractor filters (Vendor); `getBulkOrder(id, user)` — returns detail with Bulk
      Details metadata + LineItems array with all columns from Figma —
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`

- [x] T268 [P] [US-10.06] Implement
      `apps/backend/src/modules/bulk-orders/bulk-orders.controller.ts`: `GET /v1/bulk-orders` —
      PO/CA/Vendor roles — calls `listBulkOrders`; `GET /v1/bulk-orders/:id` — calls `getBulkOrder`,
      returns detail with line items; Swagger decorators —
      `apps/backend/src/modules/bulk-orders/bulk-orders.controller.ts`

- [x] T269 [P] [US-10.06] Create `apps/backend/src/modules/bulk-orders/bulk-orders.module.ts`:
      module setup + register in AppModule —
      `apps/backend/src/modules/bulk-orders/bulk-orders.module.ts`, `apps/backend/src/app.module.ts`

#### Invoice Module

- [x] T270 [US-10.07] Implement `apps/backend/src/modules/invoices/invoices.service.ts`:
      `listInvoices(query, user)` — paginated with search, status filter, sortBy; role-based
      filtering; `approveInvoice(id, user)` — set status to Approved;
      `bulkApproveInvoices(ids, user)` — batch approve selected invoices —
      `apps/backend/src/modules/invoices/invoices.service.ts`

- [x] T271 [P] [US-10.07] Implement `apps/backend/src/modules/invoices/invoices.controller.ts`:
      `GET /v1/invoices` — PO/CA/FO/Vendor roles; `GET /v1/invoices/:id`;
      `PATCH /v1/invoices/:id/approve` — PO/CA/FO roles; `POST /v1/invoices/bulk-approve` — PO/CA/FO
      roles; Swagger decorators — `apps/backend/src/modules/invoices/invoices.controller.ts`

- [x] T272 [P] [US-10.07] Create `apps/backend/src/modules/invoices/invoices.module.ts`: module
      setup + register in AppModule — `apps/backend/src/modules/invoices/invoices.module.ts`,
      `apps/backend/src/app.module.ts`

#### Dashboard Aggregation Module

- [x] T273 [US-10.01] Implement `apps/backend/src/modules/dashboard/dashboard.service.ts`:
      `getPoCaDashboard(user)` — aggregates: recent quote responses (limit 5, status
      received/pending), recent orders (last 5 RFQs + POs + Bulk Orders), pending POs (status
      Pending, limit 5), invoices pending approval (status Pending, limit 5);
      `getVendorDashboard(user)` — aggregates: RFQs awaiting vendor quote (limit 5), vendor invoices
      (limit 5), active POs for vendor (status Accepted/Active, paginated);
      `getFinanceDashboard(user)` — aggregates: KPI metrics (sum pending amounts, count due this
      week, count disputed + weekly trend), invoices pending approval (limit 5), disputed invoices
      (limit 5) — `apps/backend/src/modules/dashboard/dashboard.service.ts`

- [x] T274 [P] [US-10] Implement `apps/backend/src/modules/dashboard/dashboard.controller.ts`:
      `GET /v1/dashboard/po-ca` — `@Roles(CompanyAdmin, ProcurementOfficer)`;
      `GET /v1/dashboard/vendor` — `@Roles(Vendor)`; `GET /v1/dashboard/finance` —
      `@Roles(FinancialOfficer)`; each returns role-specific dashboard DTO; Swagger decorators —
      `apps/backend/src/modules/dashboard/dashboard.controller.ts`

- [x] T275 [P] [US-10] Create `apps/backend/src/modules/dashboard/dashboard.module.ts`: imports
      PrismaModule, RfqsModule, PurchaseOrdersModule, BulkOrdersModule, InvoicesModule; register in
      AppModule — `apps/backend/src/modules/dashboard/dashboard.module.ts`,
      `apps/backend/src/app.module.ts`

**Checkpoint**: All backend endpoints respond correctly. `GET /v1/dashboard/po-ca` returns
aggregated data. `GET /v1/rfqs?quickFilter=openRfqs` returns filtered results with pagination.

---

### Phase 4: Frontend — Reusable DataTable Component

**Purpose**: Build a generic DataTable component that all management views (RFQ, PO, Bulk Order,
Invoice) will consume. Must complete before management page tasks.

- [x] T276 [P] [US-10] Create `packages/ui-components/src/components/DataTable/DataTable.tsx`:
      Generic component accepting typed column definitions, data array, pagination config (page,
      pageSize, totalCount, onPageChange, onPageSizeChange), sort config (sortBy, sortDir, onSort),
      optional search config (value, onChange, placeholder), optional quick filter config (tabs
      array with label + value, activeTab, onTabChange), optional row actions (array of action
      configs with icon, label, onClick), optional checkbox selection (selectedIds,
      onSelectionChange), loading state (shows skeleton rows), empty state (configurable message);
      renders table header with sort indicators, table body, and pagination footer showing "Showing
      X to Y of Z" — `packages/ui-components/src/components/DataTable/DataTable.tsx`

- [x] T277 [P] [US-10] Create DataTable sub-components: `DataTablePagination.tsx` — rows per page
      selector (25 default), Back/numbered pages/Next; `DataTableSearch.tsx` — search input with
      debounce (300ms); `DataTableQuickFilters.tsx` — tab-style filter buttons;
      `DataTableBulkActions.tsx` — floating bar when items selected: "[N] Item Selected" + action
      buttons; `DataTableActions.tsx` — row-level action icon buttons (view, edit, download, more);
      export all from `DataTable/index.ts` barrel —
      `packages/ui-components/src/components/DataTable/`

- [x] T278 [P] [US-10] Export DataTable from `packages/ui-components/src/index.ts` barrel; verify
      build succeeds with `pnpm turbo build --filter=@forethread/ui-components` —
      `packages/ui-components/src/index.ts`

**Checkpoint**: DataTable component renders with sample data. Pagination, sort, search, quick
filters, and checkbox selection all work independently.

---

### Phase 5: Frontend — Home Dashboards (US-10.01, 10.02, 10.03)

**Purpose**: Replace dashboard stubs in each role app with the full Figma-based dashboards.

#### PO/CA Home Dashboard (US-10.01)

- [x] T279 [US-10.01] Implement
      `apps/company-admin-app/src/features/dashboard/hooks/useDashboardData.ts`: TanStack Query hook
      calling `getPoCaDashboard()`, returns typed sections (quoteResponses, recentOrders,
      pendingPurchaseOrders, invoicesPendingApproval); queryKey `['dashboard', 'po-ca']`, staleTime
      30s — `apps/company-admin-app/src/features/dashboard/hooks/useDashboardData.ts`

- [x] T280 [P] [US-10.01] Implement
      `apps/company-admin-app/src/features/dashboard/ui/QuickActions.tsx`: 4 action cards in 2x2
      grid: "Upload invoice" (upload icon), "Create PO" (document icon), "Delivery report" (truck
      icon), "Create RFQ" (search icon); each navigates to respective route (placeholder pages if
      not yet implemented); all text via i18n `dashboard.quickActions.*` —
      `apps/company-admin-app/src/features/dashboard/ui/QuickActions.tsx`

- [x] T281 [P] [US-10.01] Implement
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`: "Quote
      responses" header; vendor cards showing: vendor name with flag + attachment icons, RFQ ID,
      project name, date range, total cost, discount (% + amount), item coverage (e.g. "5/5 items"),
      Decline (outline) + Approve (primary) buttons; two states: received and pending; empty state
      when no responses; all text via i18n —
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`

- [x] T282 [P] [US-10.01] Implement
      `apps/company-admin-app/src/features/dashboard/ui/RecentOrdersSection.tsx`: "Recent Orders"
      header; mixed cards for RFQs (ID, status badge, project, location, dates, items, cost,
      flag+attachment icons), POs (ID, status badge, project, vendor, dates, items, cost,
      delivery/pick-up), Bulk Orders (ID, status badge, project, vendor, date, items, cost,
      remaining %); each card links to its detail page —
      `apps/company-admin-app/src/features/dashboard/ui/RecentOrdersSection.tsx`

- [x] T283 [P] [US-10.01] Implement
      `apps/company-admin-app/src/features/dashboard/ui/PendingPurchaseOrders.tsx`: "Purchase
      orders" header with tab filters (All, Pending, Acknowledged); PO cards showing: vendor name
      with flag + attachment icons, "Pending" badge, PO number, project name, date, item count,
      delivery type, cost, Decline + Approve buttons —
      `apps/company-admin-app/src/features/dashboard/ui/PendingPurchaseOrders.tsx`

- [x] T284 [P] [US-10.01] Implement
      `apps/company-admin-app/src/features/dashboard/ui/InvoicesPendingApproval.tsx`: "Invoices
      pending approval" header; invoice cards showing: vendor name with flag + attachment icons,
      invoice ID, project name, PO reference, date, cost, item count, Reject + Approve buttons —
      `apps/company-admin-app/src/features/dashboard/ui/InvoicesPendingApproval.tsx`

- [x] T285 [US-10.01] Rewrite
      `apps/company-admin-app/src/features/dashboard/pages/DashboardPage.tsx`: replace stub with
      full layout — "Dashboard" title + "Monitor and manage your activities" subtitle, then
      sections: QuickActions, QuoteResponsesSection, RecentOrdersSection (right column),
      PendingPurchaseOrders, InvoicesPendingApproval (right column); 2-column layout per Figma; each
      section loads independently with loading skeleton; uses `useDashboardData` —
      `apps/company-admin-app/src/features/dashboard/pages/DashboardPage.tsx`

- [x] T286 [P] [US-10.01] Copy PO/CA dashboard to
      `apps/procurement-officer-app/src/features/dashboard/`: same components and layout (PO and CA
      share identical dashboard per Figma); adapt imports —
      `apps/procurement-officer-app/src/features/dashboard/`

#### Vendor Home Dashboard (US-10.02)

- [x] T287 [US-10.02] Implement `apps/vendor-app/src/features/dashboard/hooks/useDashboardData.ts`:
      TanStack Query hook calling `getVendorDashboard()`, returns rfqsWaiting, invoices, activePOs;
      queryKey `['dashboard', 'vendor']` —
      `apps/vendor-app/src/features/dashboard/hooks/useDashboardData.ts`

- [x] T288 [P] [US-10.02] Implement
      `apps/vendor-app/src/features/dashboard/ui/RfqsWaitingSection.tsx`: "RFQs waiting for quote"
      header; RFQ cards showing: company name with flag + attachment icons, RFQ ID, project name,
      date range, cost, item count, delivery location, "Response" button; each card links to RFQ
      detail/response page — `apps/vendor-app/src/features/dashboard/ui/RfqsWaitingSection.tsx`

- [x] T289 [P] [US-10.02] Implement `apps/vendor-app/src/features/dashboard/ui/InvoicesSection.tsx`:
      "Invoices" header; invoice cards showing: company name, status badge (colored), flag +
      attachment icons, invoice ID, project name, PO reference, date, cost, item count —
      `apps/vendor-app/src/features/dashboard/ui/InvoicesSection.tsx`

- [x] T290 [P] [US-10.02] Implement `apps/vendor-app/src/features/dashboard/ui/ActivePosTable.tsx`:
      "Active POs" header; table with columns: PO number, Project Name, Project ID, Contractor name,
      PO status (Accepted/Active badges), Revision, PO type (Standard), Pick up (Yes/No), Actions
      (view, edit, download, more icons); sortable, paginated —
      `apps/vendor-app/src/features/dashboard/ui/ActivePosTable.tsx`

- [x] T291 [US-10.02] Rewrite `apps/vendor-app/src/features/dashboard/pages/DashboardPage.tsx`:
      "Dashboard" title + subtitle, sections: RfqsWaitingSection, InvoicesSection (right column),
      ActivePosTable (full width below); uses `useDashboardData`; each section with loading skeleton
      — `apps/vendor-app/src/features/dashboard/pages/DashboardPage.tsx`

#### Finance Officer Home Dashboard (US-10.03)

- [x] T292 [US-10.03] Implement
      `apps/financial-officer-app/src/features/dashboard/hooks/useDashboardData.ts`: TanStack Query
      hook calling `getFinanceDashboard()`, returns KPI metrics, invoicesPending, disputedInvoices;
      queryKey `['dashboard', 'finance']` —
      `apps/financial-officer-app/src/features/dashboard/hooks/useDashboardData.ts`

- [x] T293 [P] [US-10.03] Implement
      `apps/financial-officer-app/src/features/dashboard/ui/InvoiceKpiCards.tsx`: 3 KPI cards in
      row: "Total Pending Invoice Amount" (dollar icon, formatted amount + invoice count), "Invoices
      Due This Week" (people icon, count + total amount), "Disputed Invoices" (chart icon, count +
      trend arrow with +/- weekly change); reuse KpiCard pattern from super-admin-app —
      `apps/financial-officer-app/src/features/dashboard/ui/InvoiceKpiCards.tsx`

- [x] T294 [P] [US-10.03] Implement
      `apps/financial-officer-app/src/features/dashboard/ui/InvoicesPendingSection.tsx`: "Invoices
      pending approval" header; invoice cards: vendor name, status badge, flag + attachment icons,
      invoice ID, project name, PO reference, date, cost, item count, Reject + Approve buttons —
      `apps/financial-officer-app/src/features/dashboard/ui/InvoicesPendingSection.tsx`

- [x] T295 [P] [US-10.03] Implement
      `apps/financial-officer-app/src/features/dashboard/ui/DisputedInvoicesSection.tsx`: "Disputed
      Invoices" header; invoice cards: vendor name, status badge (colored), flag + attachment icons,
      invoice ID, project name, PO reference, date, cost, item count —
      `apps/financial-officer-app/src/features/dashboard/ui/DisputedInvoicesSection.tsx`

- [x] T296 [US-10.03] Rewrite
      `apps/financial-officer-app/src/features/dashboard/pages/DashboardPage.tsx`: "Dashboard"
      title + subtitle, "Upload invoice" button at top, InvoiceKpiCards row, then 2-column:
      InvoicesPendingSection (left) + DisputedInvoicesSection (right); uses `useDashboardData`;
      loading skeletons —
      `apps/financial-officer-app/src/features/dashboard/pages/DashboardPage.tsx`

**Checkpoint**: All 3 role dashboards render with data from backend. Each section loads
independently. Quick actions navigate correctly.

---

### Phase 6: Frontend — Management Table Pages (US-10.04, 10.05, 10.06, 10.07)

**Purpose**: Build the RFQ, PO, Bulk Order, and Invoice management table pages using the reusable
DataTable component.

#### RFQ Management (US-10.04)

- [x] T297 [US-10.04] Create `apps/company-admin-app/src/features/rfqs/services/rfqs.service.ts`:
      TanStack Query hooks — `useRfqs(params)` (GET /v1/rfqs with all query params, queryKey
      `['rfqs', params]`), `useRfq(id)` (GET /v1/rfqs/:id) —
      `apps/company-admin-app/src/features/rfqs/services/rfqs.service.ts`

- [x] T298 [US-10.04] Create `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`: page
      title "RFQ Management" + subtitle, "Create new" button; DataTable with: all columns from Figma
      US 2.06 (RFQ ID, Project Name, Project ID, RFQ Status with badge, Req. Quantities, Pick-up,
      Delivery Location, Pick-up Location, Rec. Vendors, Rec. Quotes, Appl. Vendors, Line Items,
      Deadline Range, Appl. Issues, Total Requested Qty, Arc. Blocks Dist., Created Date, Created
      By, Approval Status, Approved By, Last Modified By, Actions); quick filter tabs: My RFQs, Open
      RFQs, Awaiting Responses, No Quotes, Awarded RFQs, Closed RFQs; search bar, Filters button,
      view toggle (Default/List), Group button; pagination (25/page); uses `useRfqs`; all text via
      i18n `rfqs.*` — `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`

- [x] T299 [P] [US-10.04] Add route `/rfqs` to `apps/company-admin-app/src/app/routes.tsx` pointing
      to lazy-loaded `RfqListPage`; add "RFQ Management" to sidebar navigation in AppLayout —
      `apps/company-admin-app/src/app/routes.tsx`,
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`

- [x] T300 [P] [US-10.04] Copy RFQ management to `apps/procurement-officer-app` (same page) and
      `apps/vendor-app` (vendor perspective — different columns per backend response); add routes
      and sidebar items — `apps/procurement-officer-app/src/features/rfqs/`,
      `apps/vendor-app/src/features/rfqs/`

#### PO Management (US-10.05)

- [x] T301 [US-10.05] Create
      `apps/company-admin-app/src/features/purchase-orders/services/purchase-orders.service.ts`:
      TanStack Query hooks — `usePurchaseOrders(params)`, `usePurchaseOrder(id)` —
      `apps/company-admin-app/src/features/purchase-orders/services/purchase-orders.service.ts`

- [x] T302 [US-10.05] Create
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`: page
      title "Purchase Orders", "Create new" button; DataTable with PO/CA columns (per Figma US
      2.07); quick filter tabs, search, sort, pagination; uses `usePurchaseOrders` —
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`

- [x] T303 [P] [US-10.05] Add route `/purchase-orders` to company-admin-app routes; add sidebar
      item; copy to procurement-officer-app and vendor-app (vendor gets different columns: PO
      number, Project Name, Project ID, Contractor name, PO status, Revision, PO type, Pick up) —
      `apps/company-admin-app/src/app/routes.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/`,
      `apps/vendor-app/src/features/purchase-orders/`

#### Bulk Order Management (US-10.06)

- [x] T304 [US-10.06] Create
      `apps/company-admin-app/src/features/bulk-orders/services/bulk-orders.service.ts`: TanStack
      Query hooks — `useBulkOrders(params)`, `useBulkOrder(id)` —
      `apps/company-admin-app/src/features/bulk-orders/services/bulk-orders.service.ts`

- [x] T305 [US-10.06] Create
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`: page title
      "Bulk order" + subtitle, "+ Create new" button; filter dropdowns: "All projects", "All
      vendors" (or "All Contractors" for vendor view); DataTable with columns: Bulk Order ID,
      Project Name, Project ID, Vendor name, Brands, Line Items, Deliveries %, # of amount, Total
      amount, Solid Gold, Date, Actions; row action context menu with "Drawdown" and "Change"
      options; pagination; uses `useBulkOrders` —
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`

- [x] T306 [US-10.06] Create
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderDetailPage.tsx`: back
      navigation ("< Bulk order"), title with Bulk Order ID; "+ Create drawdown" button; "Bulk
      Details" section: Bulk ID, RFQ reference, Contractor name, Vendor name, Project name, Created
      date, End date, Created by; "Line Items" table: Line Item ID, Item Reference, Description,
      Qty, Unit, Ordered, Qty Remaining, Deliveries %, Price/unit, Total line inc., edit/delete
      action icons per row; "Total Items" summary row at bottom; uses `useBulkOrder(id)` —
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderDetailPage.tsx`

- [x] T307 [P] [US-10.06] Add routes `/bulk-orders` and `/bulk-orders/:id` to company-admin-app; add
      sidebar item; copy to procurement-officer-app and vendor-app (vendor uses "All Contractors"
      filter) — `apps/company-admin-app/src/app/routes.tsx`,
      `apps/procurement-officer-app/src/features/bulk-orders/`,
      `apps/vendor-app/src/features/bulk-orders/`

#### Invoice Management (US-10.07)

- [x] T308 [US-10.07] Create
      `apps/company-admin-app/src/features/invoices/services/invoices.service.ts`: TanStack Query
      hooks — `useInvoices(params)`, `useApproveInvoice()` mutation (invalidates `['invoices']`),
      `useBulkApproveInvoices()` mutation —
      `apps/company-admin-app/src/features/invoices/services/invoices.service.ts`

- [x] T309 [US-10.07] Create
      `apps/company-admin-app/src/features/invoices/pages/InvoiceListPage.tsx`: page title
      "Invoices" + subtitle, "Filters" button, "+ Create new" button; DataTable with checkbox
      selection + columns: Invoice ID, Project Name, Project ID, Vendor name, Status (colored
      badge), Related PO, Total amount, Due Date, Actions (context menu: Approve, Export); when
      items selected: bulk action bar with "[N] Item Selected", "Approve all" button, "Export as"
      button; pagination (25/page); uses `useInvoices` —
      `apps/company-admin-app/src/features/invoices/pages/InvoiceListPage.tsx`

- [x] T310 [P] [US-10.07] Add route `/invoices` to company-admin-app routes; add sidebar item; copy
      to procurement-officer-app and financial-officer-app —
      `apps/company-admin-app/src/app/routes.tsx`,
      `apps/procurement-officer-app/src/features/invoices/`,
      `apps/financial-officer-app/src/features/invoices/`

**Checkpoint**: All 4 management table pages render with real data. Quick filters, search, sort, and
pagination work. Invoice page supports checkbox selection and bulk actions.

---

### Phase 7: Polish & Verification (Epic 2 Dashboards)

- [x] T311 [P] [US-10] Update sidebar navigation in ALL apps: add menu items for RFQ Management,
      Purchase Orders, Bulk Orders, Invoices (role-appropriate items per app); highlight active
      route; use i18n keys from `nav` namespace —
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`,
      `apps/vendor-app/src/shared/layout/AppLayout.tsx`,
      `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`,
      `apps/procurement-officer-app/src/shared/layout/AppLayout.tsx`

- [x] T312 [P] [US-10] Add Swagger decorators to all new endpoints: `@ApiTags`, `@ApiOperation`,
      `@ApiResponse`, `@ApiBearerAuth()` on rfqs, purchase-orders, bulk-orders, invoices, dashboard
      controllers; verify at `http://localhost:3000/api` — `apps/backend/src/modules/*/`

- [x] T313 [P] [US-10] Verify zero hardcoded strings: grep all new frontend files for string
      literals outside of i18n calls; fix any violations. Verify zero hardcoded colors: grep for hex
      values and Tailwind color classes; replace with CSS variable classes — `(validation)`

- [x] T314 [P] [US-10] Build verification: run `pnpm turbo build` from root; verify zero TypeScript
      errors across all apps; run `pnpm turbo typecheck` — `(build validation)`

- [x] T315 [US-10] Run complete Epic 2 Dashboards verification per plan.md verification criteria:
      start all services, seed data, verify all 3 role dashboards and all 4 management pages per the
      step-by-step checklist; fix any issues found — `(runtime validation)`

---

## Epic 3: Vendor Management (US-3.01–3.12)

**Status**: Backend COMPLETE, Frontend prep COMPLETE, Frontend pages IN PROGRESS (T362, T363, T365,
T865–T923 done; T361, T880 pending). **Non-functional**: RfqListPage "Create New RFQ" button (no
onClick — vendors don't create RFQs, button should be hidden); ChangeRequestPage is stub/placeholder
("coming soon"); T361 messaging UI not started; T880 representatives CRUD blocked on backend.
**Prerequisites**: Epic 1 COMPLETE, Epic 2 Projects COMPLETE.

---

### Phase 1: Shared Types & DTOs (Epic 3)

- [x] T327 [P] [US-3] Add vendor enums to `packages/shared-types/src/enums/index.ts`:
      `VendorCategory` (15 categories), `VendorListStatus` (INVITED, ACTIVE), `CompanyType`
      (CONTRACTOR, VENDOR) — `packages/shared-types/src/enums/index.ts`
- [x] T328 [P] [US-3.01] Create vendor DTOs: `InviteVendorDto` (companyName, companyEmail, userName,
      userEmail), `VendorListQueryDto`, `VendorListItemDto`, `InviteVendorResponseDto` —
      `apps/backend/src/modules/vendors/vendors.dto.ts`,
      `packages/api-client/src/endpoints/vendors.ts`
- [x] T329 [P] [US-3.03] Message types added to API client: `CreateThreadInput`, `SendMessageInput`,
      `MessageThread`, `MessageItem` — defined in `packages/api-client/src/endpoints/messages.ts`
      (following existing pattern)
- [x] T330 [P] [US-3.06] Quote response types added to API client: `SubmitQuoteInput`,
      `QuoteResponseDetail`, `QuoteResponseLineItem` — defined in
      `packages/api-client/src/endpoints/rfqs.ts`
- [x] T331 [P] [US-3.07] Vendor profile types added to API client: `VendorProfile`,
      `UpdateVendorProfileInput`, `WarehouseLocation`, `VendorRepresentative` — defined in
      `packages/api-client/src/endpoints/vendors.ts`
- [x] T332 [P] [US-5.20] Bulk order change types added to API client: `CreateChangeRequestInput`,
      `BulkOrderChangeRequest` — defined in `packages/api-client/src/endpoints/bulk-orders.ts`
- [x] T333 [P] [US-3] Create API client endpoints: `packages/api-client/src/endpoints/vendors.ts`
      (inviteVendor, getVendors); export from barrel —
      `packages/api-client/src/endpoints/vendors.ts`
- [x] T333b [P] [US-3] Create i18n translations: `packages/i18n/src/locales/en/vendors.json` (list,
      invitation, categories, modals) — `packages/i18n/src/locales/en/vendors.json`
- [x] T333c [P] [US-3.03] Create i18n translations: `packages/i18n/src/locales/en/messages.json`
      (threads, compose, attachments) — `packages/i18n/src/locales/en/messages.json`
- [x] T333d [P] [US-3] Extend API client: add vendor profile, warehouses, representatives, user
      invite, quote submit/edit, bulk order change request, PO vendor accept/decline endpoints —
      `packages/api-client/src/endpoints/`

### Phase 2: Prisma Schema & Migrations (Epic 3)

- [x] T334 [US-3.01] Vendor management via `CompanyVendorAssignment` model (vendorId, contractorId,
      categories, assignedAt) + `Company` model with VENDOR type, specialisations, legal info —
      `apps/backend/src/prisma/schema/company.prisma`
- [x] T335 [US-3.03] Add `MessageThread`, `Message`, `ThreadParticipant`, `MessageAttachment` models
      — `apps/backend/src/prisma/schema/message.prisma`
- [x] T336 [US-3.06] Add `QuoteResponseLineItem` model: unitPrice, quotedQuantity, availability,
      deliveryDate, substituteItemId, discount, tax, backOrder fields, status —
      `apps/backend/src/prisma/schema/rfq.prisma`
- [x] T337 [US-3.07] Add `WarehouseLocation` model: companyId, name, city, postcode, address —
      `apps/backend/src/prisma/schema/company.prisma`
- [x] T338 [US-5.20] Add `BulkOrderChangeRequest` model + `version` field on BulkOrder —
      `apps/backend/src/prisma/schema/bulk-order.prisma`
- [x] T339 [US-3] Prisma migration created: `20260323120000_epic3_vendor_management` —
      `apps/backend/src/prisma/migrations/20260323120000_epic3_vendor_management/migration.sql`

### Phase 3: Backend Services & Controllers (Epic 3)

- [x] T340 [US-3.01] Implement vendor invitation: `vendor-invite.service.ts` (inviteVendor with
      transaction, token generation, email sending, audit logging) —
      `apps/backend/src/modules/vendors/vendor-invite.service.ts`
- [x] T341 [US-3.01] Implement vendor list: `vendors.service.ts` (listVendors with pagination,
      search, status filter, sorting) + controller `POST /vendors/invite`, `GET /vendors` —
      `apps/backend/src/modules/vendors/`
- [x] T341b [US-3.01] VendorsModule registered in AppModule with PrismaModule, NotificationsModule,
      AuditModule — `apps/backend/src/modules/vendors/vendors.module.ts`
- [x] T342 [US-3.03] Implement messages service: `createThread()`, `getThreads()`, `getMessages()`,
      `sendMessage()` — read-only after document closed, 10MB file limit —
      `apps/backend/src/modules/messages/messages.service.ts`
- [x] T343 [US-3.03] Implement messages controller: `POST /v1/messages/threads`,
      `GET /v1/messages/threads`, `GET /v1/messages/threads/:id/messages`,
      `POST /v1/messages/threads/:id/messages` — participant-only access —
      `apps/backend/src/modules/messages/messages.controller.ts`
- [x] T344 [US-3.03] Create MessagesModule and register in AppModule —
      `apps/backend/src/modules/messages/messages.module.ts`, `apps/backend/src/app.module.ts`
- [x] T345 [US-3.06] Implement quote response service: `submitQuote()`, `updateQuote()`,
      `getQuoteDetail()` — auto-populate line items, bulk/line-level fields, total calc —
      `apps/backend/src/modules/rfqs/quote-response.service.ts`
- [x] T346 [US-3.06] Add quote endpoints to RFQ controller: `POST /v1/rfqs/:rfqId/quotes`,
      `PATCH /v1/rfqs/:rfqId/quotes/:quoteId`, `GET /v1/rfqs/:rfqId/quotes/:quoteId` —
      `apps/backend/src/modules/rfqs/rfqs.controller.ts`
- [x] T347 [US-3.07] Extend vendors service: `getVendorProfile()`, `updateVendorProfile()` +
      warehouse CRUD (`addWarehouse`, `updateWarehouse`, `deleteWarehouse`) —
      `apps/backend/src/modules/vendors/vendors.service.ts`
- [x] T348 [US-3.07] Add vendor profile endpoints: `GET /v1/vendors/:id/profile`,
      `PATCH /v1/vendors/:id/profile`, `POST /v1/vendors/:id/warehouses`,
      `PATCH /v1/vendors/:id/warehouses/:whId`, `DELETE /v1/vendors/:id/warehouses/:whId` —
      `apps/backend/src/modules/vendors/vendors.controller.ts`
- [x] T349 [US-3.08] Add vendor PO actions: `acceptPurchaseOrder()` (ACKNOWLEDGED → ACCEPTED),
      vendor decline (ACKNOWLEDGED → DECLINED with reason), edit payment terms + warehouse before
      accept — `apps/backend/src/modules/purchase-orders/po-status.service.ts`
- [x] T350 [US-3.08] Add vendor PO endpoints: `PATCH /v1/purchase-orders/:id/accept` (VENDOR),
      `PATCH /v1/purchase-orders/:id/vendor-decline` (VENDOR) —
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`
- [x] T351 [US-3.10] Implement vendor user invitation: `inviteVendorUser()`, `resendInvitation()`,
      `cancelInvitation()` — token generation, 30-day expiry, duplicate email check —
      `apps/backend/src/modules/vendors/vendor-user-invite.service.ts`
- [x] T352 [US-3.10] Add vendor user invite endpoints: `POST /v1/vendors/:companyId/users/invite`,
      `POST /v1/vendors/:companyId/users/:userId/resend-invitation`,
      `DELETE /v1/vendors/:companyId/users/:userId/invitation` —
      `apps/backend/src/modules/vendors/vendors.controller.ts`
- [x] T353 [US-5.20] Implement bulk order change request service: `proposeChange()`,
      `listChangeRequests()`, `approveChange()`, `rejectChange()`, `cancelBulkOrder()` — versioning
      on approve, history tracking —
      `apps/backend/src/modules/bulk-orders/bulk-order-change.service.ts`
- [x] T354 [US-5.20] Add bulk order change endpoints: `POST /v1/bulk-orders/:id/change-requests`,
      `GET /v1/bulk-orders/:id/change-requests`,
      `PATCH /v1/bulk-orders/:id/change-requests/:crId/approve`,
      `PATCH /v1/bulk-orders/:id/change-requests/:crId/reject`, `POST /v1/bulk-orders/:id/cancel` —
      `apps/backend/src/modules/bulk-orders/bulk-orders.controller.ts`
- [x] T355 [US-3.12] Add sales representatives endpoint: `GET /v1/vendors/:id/representatives` —
      returns vendor company users with name, email, phone, position —
      `apps/backend/src/modules/vendors/vendors.controller.ts`
- [x] T356 [US-3.06, 3.08] Add email templates and service methods: `sendRfqReceivedEmail()`,
      `sendPoIssuedEmail()`, `sendPoDeclinedByVendorEmail()` —
      `apps/backend/src/modules/notifications/`

### Phase 4: Frontend Pages & Components (Epic 3)

- [x] T357 [US-3.01] Implement vendor list page: `VendorListPage.tsx` with search, status filter,
      company grouping, pagination — `packages/vendor-shared/src/components/VendorListPage.tsx`
- [x] T358 [US-3.01] Implement vendor invitation modals: `InviteVendorModal.tsx`,
      `CreateVendorCompanyModal.tsx`, `VendorInviteSuccessModal.tsx` —
      `packages/vendor-shared/src/components/`
- [x] T359 [US-3.12] Implement vendor contact popover: `VendorContactPopover.tsx` with sales
      contacts display — `packages/rfq-shared/src/components/VendorContactPopover.tsx`
- [x] T360 [US-3] Add vendor routes and sidebar in company-admin-app, procurement-officer-app —
      `/vendors`, `/vendors/new` — `apps/*/src/app/route-config.ts`
- [ ] T361 [US-3.03] Implement messaging UI: thread list, message view, compose — frontend pages for
      company-admin-app, procurement-officer-app, vendor-app
- [x] T362 [US-3.06] Implement vendor RFQ response form in vendor-app: RfqResponsePage with
      split/full layout, BulkLevelDefaults (collapsible, 6 fields: availability, discount, GST,
      shipment, warehouse select, delivery date), ResponseLineItemsTable (editable per-line fields:
      include toggle, avail qty, unit price, discount, GST, tax incl, delivery date, line total;
      actions: view/add note, make back-order, suggest substitute; footer with totals),
      LineItemExpandedRow (contractor notes, line notes, back-order qty + expected date),
      MaterialSearchPopup (catalogue search for substitutes), AdditionalQuoteDetails (validity
      period, notes, file attachments with 10MB/PDF/XLSX/DOCX/JPG/CSV validation),
      RfqResponseInfoPanel (left panel with RFQ details + documents, Issue Date field),
      useRfqResponse hook (form state, totals calc with line-level-overrides-bulk, warehouse fetch,
      submitQuote mutation), useFileUpload hook (storage API upload with validation),
      StatusSuccessModal + StatusErrorModal on submit, route /rfqs/:id/response, 60+ i18n keys —
      `apps/vendor-app/src/features/rfqs/`
- [x] T363 [US-3.07] Implement vendor profile page in vendor-app: editable company info,
      specialisations, warehouse locations, representatives —
      `packages/vendor-shared/src/components/VendorProfilePage.tsx`
- [x] T364 [US-3.08] Implement PO receiving actions in vendor-app: acknowledge, accept/decline (with
      decline reason modal), edit payment terms + warehouse selection before accept, alert banner
      with status-based visibility, change request modal (propose + history), Action Log tab,
      "Change request" + "Export as" buttons in tab bar —
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/PoVendorActions.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/DeclinePoModal.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/ChangeRequestModal.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/PoVendorAcceptFields.tsx`,
      `packages/po-shared/src/components/PoActionLogTab.tsx`,
      `packages/po-shared/src/components/PoDetailTabs.tsx`
- [x] T365 [US-3.10] Implement vendor user invitation UI in vendor-app: InviteVendorUserModal,
      useInviteVendorUserForm hook, vendor-users.service invite/resend/cancel mutations, 409
      conflict handling, skipErrorHandler — `apps/vendor-app/src/features/users/`
- [x] T865 [US-3.07] Shared UI: Modal fullscreen on mobile, CustomDropdown portal rendering,
      FilterDropdownButton hideSearch, DateRangeFilterDropdown component —
      `packages/ui-components/src/components/`
- [x] T866 [US-3.07] Vendor user detail page with profile info, role permissions, activity log —
      `apps/vendor-app/src/features/users/ui/VendorUserDetailPage.tsx`
- [x] T867 [US-3.07] Vendor user edit modal with name, email, phone, position fields —
      `apps/vendor-app/src/features/users/ui/EditVendorUserModal.tsx`
- [x] T868 [US-3.07] Vendor user list: eye icon → detail page, edit icon → edit modal, status filter
      hideSearch, date range filter — `apps/vendor-app/src/features/users/ui/VendorUserListPage.tsx`
- [x] T869 [US-3.07] Fix vendor profile edit mode: populate form data on initial load when opened
      with ?edit=true — `packages/vendor-shared/src/components/VendorProfilePage.tsx`
- [x] T870 [US-3.01] Vendor list toolbar refactoring, edit modal improvements, backend DTO updates —
      `packages/vendor-shared/src/`, `apps/backend/src/modules/vendors/`
- [x] T871 [US-3.07] Company profile and detail page improvements, lint fixes —
      `apps/company-admin-app/`, `apps/super-admin-app/`
- [x] T872 [US-3.07] Responsive layout for RFQ and PO list pages (mobile padding, flex-wrap) —
      `apps/*/src/features/rfqs/`, `apps/*/src/features/purchase-orders/`
- [x] T873 [US-3.01] Enforce 560px modal min-width default, refactor success modals to
      StatusSuccessModal (ResetPasswordSuccessModal, InvitationSuccessModal,
      VendorInviteSuccessModal), standardize maxWidth across all modals —
      `packages/ui-components/src/components/Modal.tsx`, `packages/vendor-shared/`,
      `apps/company-admin-app/`
- [x] T874 [US-3.01] UserAlreadyExistsModal shared component, 409 conflict handling for vendor
      invite and user creation across all apps (company-admin, super-admin, vendor-app) —
      `packages/ui-components/`, `packages/vendor-shared/`, `apps/*/`
- [x] T875 [US-3.01] Vendor list date range filter (DateRangeFilterDropdown), vendor profile edit
      improvements, backend createdAt field for representatives, backend unit tests —
      `packages/vendor-shared/`, `apps/backend/`
- [x] T876 [US-3.07] Vendor profile: editable representatives (name/phone/position inline edit),
      AddressInput autocomplete for legal address and warehouse fields, warehouse card layout
      redesign, backend Google Places country param, api-client searchAddresses update, AddressInput
      shared component — `packages/vendor-shared/src/components/VendorProfilePage.tsx`,
      `packages/ui-components/src/components/AddressInput.tsx`,
      `packages/api-client/src/endpoints/google.ts`, `apps/backend/src/modules/google/`
- [x] T876b [US-3.07] VendorProfilePage refactor: extract InfoItem, RepresentativeRow,
      RepresentativesSection, WarehouseCard, WarehouseLocationFields subcomponents, useAddressSearch
      hook, PLACE_TYPES constants, AddressInput types fix, Google Places types param —
      `packages/vendor-shared/src/components/`, `packages/vendor-shared/src/hooks/`,
      `packages/vendor-shared/src/constants/`, `packages/ui-components/`,
      `packages/api-client/src/endpoints/google.ts`, `apps/backend/src/modules/google/`
- [x] T877 [US-3.07] Vendor-app company profile page + user detail refactor: `/company` route,
      sidebar nav, CompanyProfilePage, VendorUserDetailPage simplified (vendor-only invitation
      actions) — `apps/vendor-app/src/features/company/`, `apps/vendor-app/src/app/`,
      `apps/vendor-app/src/shared/layout/AppLayout.tsx`,
      `apps/vendor-app/src/features/users/ui/VendorUserDetailPage.tsx`
- [x] T878 [US-3.10] Test fixes: useInviteVendorUserForm (409 error shape), vendor-users.service
      (skipErrorHandler), useCreateUserForm (renderHook, error shape), ProjectAccessModal
      (formatEnum mock) — `apps/vendor-app/src/features/users/`, `apps/company-admin-app/`
- [x] T881 [US-3.07] VendorProfilePage continued refactor: simplify RepresentativesSection, improve
      WarehouseCard edit/view toggle, vendor logo upload/display hooks (useVendorLogoUrl,
      useUploadVendorLogo) — `packages/vendor-shared/src/components/`,
      `packages/vendor-shared/src/services/`
- [x] T882 [US-3.07] Test updates: VendorUserListPage test (useNavigate mock,
      DateRangeFilterDropdown, remove userExists modal), new VendorProfilePage integration tests for
      company-admin and procurement-officer apps —
      `apps/vendor-app/src/features/users/ui/VendorUserListPage.test.tsx`,
      `apps/company-admin-app/src/features/vendors/pages/VendorProfilePage.test.tsx`,
      `apps/procurement-officer-app/src/features/vendors/pages/VendorProfilePage.test.tsx`
- [x] T883 [US-3.07] Extract useVendorProfileForm hook: form state, validation, save logic,
      warehouse CRUD, representative editing, logo upload — extracted from VendorProfilePage —
      `packages/vendor-shared/src/hooks/useVendorProfileForm.ts`
- [x] T884 [US-3.07] Google Places backend: add types param to addressAutocomplete for
      country/city/address filtering, update DTO, controller, service, and unit tests —
      `apps/backend/src/modules/google/`
- [ ] T880 [US-3.07] **BLOCKED — backend needed**: Representatives management on vendor profile.
      Backend API for representatives CRUD is not yet implemented. Frontend read-only display of
      existing representatives has been replaced with a placeholder message. Only draft input rows
      (for future creation) are shown in edit mode. Required backend endpoints:
      `POST /v1/vendors/:companyId/representatives`,
      `DELETE /v1/vendors/:companyId/representatives/:id`,
      `PATCH /v1/vendors/:companyId/representatives/:id`. — `apps/backend/src/modules/vendors/`,
      `packages/vendor-shared/src/components/RepresentativesSection.tsx`
- [x] T366 [US-5.20] Implement bulk order change request UI: propose, review, approve/reject, cancel
      — `packages/bulk-order-shared/src/components/` (ProposeChangeModal, ReviewChangesModal,
      CancelBulkOrderModal, ChangeHistoryTab, ChangeHistoryCard, BulkOrderDetailTabs), refactored
      BulkOrderDetailPage with tabs (Line Items, Drawdown History, Change History), pending change
      info alert, action buttons, change request service hooks (useChangeRequests, useProposeChange,
      useApproveChange, useRejectChange, useCancelBulkOrder), CHANGE_PENDING status color, i18n
      translations
- [x] T885 [US-3.06, US-5.20] Fix TS 5.9.3 compiler crash: narrow i18n `t()` overloaded type in new
      bulk-order-shared components (ProposeChangeModal, ReviewChangesModal, CancelBulkOrderModal,
      ChangeHistoryTab, ChangeHistoryCard, ProposeChangePage, ReviewChangesPage,
      BulkOrderDetailTabs). Fix import order in RFQ components. Fix `onUpdateItem` type signature.
      Fix lint in bulk-orders.service.test — `packages/bulk-order-shared/src/components/`,
      `apps/vendor-app/src/features/rfqs/`, `apps/company-admin-app/`
- [x] T886 [US-5.20] Figma alignment: ProposeChangePage — Project Name uses SelectDropdown, Actions
      column uses Delete + MessageBadgeIcon with EditIcon (badge shows when edited, click focuses
      New Qty input), fix reviewPage i18n typo —
      `packages/bulk-order-shared/src/components/ProposeChangePage.tsx`,
      `packages/i18n/src/locales/en/bulkOrders.json`
- [x] T903 [US-3.08] PO Documents tab Figma alignment: split into "Related Documents" (RFQ/Invoice
      eye-only cards, open in new tab) and "Attached Documents" (view/download/delete with uploader
      info). Backend: vendor RBAC for PO document upload/delete (`VENDOR` role added to controller
      `@Roles`, `po-document.service` checks `vendorId`). Storage: `exists()` check before signed
      URL. PoDetailsTab 2-column page layout with `vendorAcceptSlot` prop. PoVendorAcceptFields:
      payment terms pattern validation, layout refinements. PoVendorActions: responsive layout,
      query key fix (`purchase-orders` → correct key), button sizing per Figma. PoLineItemsTab:
      `readOnly` prop for vendor, removed delete mutation, edit-in-square icon.
      PurchaseOrderListPage minor fixes. i18n: relatedDocuments, attachedDocuments,
      noRelatedDocuments keys — `packages/po-shared/src/components/`,
      `apps/vendor-app/src/features/purchase-orders/`, `apps/backend/src/modules/purchase-orders/`,
      `apps/backend/src/modules/storage/`, `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T904 [US-3.08] Change Request page: standalone `/purchase-orders/:id/change-request` route,
      ChangeRequestModal redesigned with `ModalIconHeader` (EditWithoutLineIcon, subtitle). Route
      config + lazy route registration —
      `apps/vendor-app/src/features/purchase-orders/pages/ChangeRequestPage.tsx`,
      `apps/vendor-app/src/app/route-config.ts`, `apps/vendor-app/src/app/routes.tsx`
- [x] T905 [US-3.07] RepresentativesSection rewrite: draft-based add/remove flow (parent-managed
      `RepDraft[]` state), per-field blur validation (`validateRepField` exported), `InfoItem`
      read-only view for existing reps, delete button per draft row, "Add representative" button.
      VendorProfilePage: wire drafts to RepresentativesSection. useVendorProfileForm: manage draft
      state, validation, add/remove handlers — `packages/vendor-shared/src/components/`,
      `packages/vendor-shared/src/hooks/useVendorProfileForm.ts`
- [x] T906 [US-3.03] PoMessagesTab real API integration: replace stub with live Messages API
      (createThread, getThreads, getMessages, sendMessage). Thread auto-creation on first message
      with contextType=PURCHASE_ORDER. Date separators, avatar/name/time per Figma. Read-only mode
      for CLOSED/CANCELLED POs. Auto-scroll, 15s refetch. Props: poId, poStatus, currentUserId,
      creatorUserId. Graceful fallback for apps without props. i18n: noMessages, readOnly keys —
      `packages/po-shared/src/components/PoMessagesTab.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T907 [US-5.20] AllChangeHistorySection: fetch bulk order detail for endDate + lineItems
      display in change history cards. BulkOrderListPage: companyId + contractorName fields.
      Backend: include company.legalName in bulk order list response —
      `packages/bulk-order-shared/src/components/AllChangeHistorySection.tsx`,
      `packages/bulk-order-shared/src/components/BulkOrderListPage.tsx`,
      `packages/bulk-order-shared/src/hooks/useBulkOrderListState.ts`,
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`,
      `packages/api-client/src/endpoints/bulk-orders.ts`
- [x] T908 [US-3.08] PO detail Figma alignment: PoVendorActions alert+buttons in one row on desktop
      (flex-col → flex-row md:), PoDetailsTab vendor layout — vendorAcceptSlot inside Basic Info
      card, Metadata in right column. PoDocumentsTab: Related Documents item layout + 220px scroll
      container + consistent border tokens —
      `apps/vendor-app/src/features/purchase-orders/components/PoVendorActions.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `packages/po-shared/src/components/PoDetailsTab.tsx`,
      `packages/po-shared/src/components/PoDocumentsTab.tsx`
- [x] T909 [US-3.08] PO document RBAC: add VENDOR role to upload/delete document endpoints. Fix
      vendor access check (companyId → vendorId). Storage controller: verify file exists in MinIO
      via HeadObject before returning presigned URL —
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`,
      `apps/backend/src/modules/purchase-orders/po-document.service.ts`,
      `apps/backend/src/modules/storage/storage.controller.ts`,
      `apps/backend/src/modules/storage/storage.service.ts`
- [x] T910 [cross-cutting] DatePicker/DateRangeFilterDropdown: fix portal click-outside closing
      dropdown prematurely (data-datepicker-portal attribute). DatePicker className on root element.
      Users API: add dateFrom/dateTo query params to UserListQueryDto + filtering. TablePagination:
      hide when totalItems <= pageSize — `packages/ui-components/src/components/DatePicker.tsx`,
      `packages/ui-components/src/components/DateRangeFilterDropdown.tsx`,
      `packages/ui-components/src/components/TablePagination.tsx`,
      `apps/backend/src/modules/users/users.service.ts`,
      `packages/api-client/src/endpoints/users.ts`,
      `apps/vendor-app/src/features/users/ui/VendorUserListPage.tsx`
- [x] T911 [cross-cutting] Vendor specialisation filter: fix filter querying empty
      assignment.categories instead of vendor.specialisations —
      `apps/backend/src/modules/vendors/vendors.service.ts`
- [x] T912 PO list deliveryLocationName: include deliveryLocation relation in list query, map to
      deliveryLocationName. Update column definitions —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `packages/api-client/src/endpoints/purchase-orders.ts`,
      `packages/po-shared/src/constants/columns.ts`
- [x] T913 [US-3.08] PoDetailPanel: add Messages + Action Log tabs to slide-over panel (all 5 tabs).
      PoDetailTabs compact prop for panel padding. PoMessagesTab configurable height —
      `apps/vendor-app/src/features/purchase-orders/components/PoDetailPanel.tsx`,
      `packages/po-shared/src/components/PoDetailTabs.tsx`,
      `packages/po-shared/src/components/PoMessagesTab.tsx`
- [x] T914 Vendor user update RBAC: add VENDOR role to PATCH /users/:id. Email/info text truncation
      with tooltip in VendorUserDetailPage and InfoItem —
      `apps/backend/src/modules/users/users.controller.ts`,
      `apps/vendor-app/src/features/users/ui/VendorUserDetailPage.tsx`,
      `packages/vendor-shared/src/components/InfoItem.tsx`
- [x] T915 BulkOrdersModal: replace handleSelectAll with handleAddAll that maps and adds all items
      directly then closes modal — `packages/po-shared/src/components/BulkOrdersModal.tsx`
- [x] T916 [US-3.01] Vendor list phone column: backend returns `phone` and `position` in
      representatives, `contactPhone` in list response. API client types updated. VendorRow shows
      `contactPhone` instead of hardcoded dash —
      `apps/backend/src/modules/vendors/vendors.service.ts`,
      `packages/api-client/src/endpoints/vendors.ts`,
      `packages/vendor-shared/src/components/VendorRow.tsx`,
      `packages/vendor-shared/src/components/VendorListPage.tsx`
- [x] T917 [US-3.07] Fix vendor profile edit mode re-activation after submit: `initialEdit`
      useEffect now uses `useRef` to fire only once, preventing profile refetch from re-enabling
      edit mode — `packages/vendor-shared/src/hooks/useVendorProfileForm.ts`
- [x] T918 [US-3.10] Vendor user list: resendInvitation via confirmation modal instead of inline
      mutation. Store: add `resendInvitation` status action type. i18n: resendInvitationModal keys —
      `apps/vendor-app/src/features/users/ui/VendorUserListPage.tsx`,
      `apps/vendor-app/src/features/users/state/vendor-users.store.ts`,
      `packages/i18n/src/locales/en/vendorUsers.json`
- [x] T919 [cross-cutting] preventScroll on focus: CustomDropdown, FilterDropdownButton,
      FilterPopover — prevent page jump when dropdown opens —
      `packages/ui-components/src/components/`
- [x] T900 [US-3.08] UI polish: rename PaperPlaneIcon → LetterIcon across vendor-app
      (RfqsWaitingSection, GuestInvitationPage), po-shared (PoCommsPage, PoMessagesTab), rfq-shared
      (QuoteResponseDetailPage). ActivePosRow: replace stub edit/download actions with real PDF
      export via `exportPurchaseOrders` API. Fix import order lint —
      `apps/vendor-app/src/features/dashboard/ui/`, `packages/po-shared/src/components/`,
      `packages/rfq-shared/src/components/`
- [x] T902 [US-3.08] PoDetailPanel: add PoVendorActions to slide-over panel for vendor PO actions.
      RepresentativeRow: add per-field validation errors (`RepErrors` interface), `onPhoneOnly`
      keydown handler for phone input —
      `apps/vendor-app/src/features/purchase-orders/components/PoDetailPanel.tsx`,
      `packages/vendor-shared/src/components/RepresentativeRow.tsx`
- [x] T901 [US-3.08] Epic 3 E2E test suite: 6 new Playwright test files (30 real tests) covering
      US-3.01 vendor invite, US-3.06 RFQ response, US-3.07 vendor profile, US-3.08 PO receiving
      actions (11 tests), US-3.10 vendor user invite, US-3.12 sales representatives. New
      `vendor-app` project in playwright.config.ts (port 3003). QA report updated —
      `tests/e2e/procurement/us030*.spec.ts`, `playwright.config.ts`,
      `reports/qa/001-procurement-platform-e2e-2026-03-27T101750.md`

- [x] T920 [US-3.06] RFQ response edit mode fixes: backend converts Prisma Decimal fields to plain
      numbers and flattens quote attachments in `getQuoteForVendor`. `useFileUpload` accepts
      `initialAttachments` param for edit mode pre-population. `useRfqResponse` removes unused
      queryClient. `RfqResponsePage` passes existing quote attachments to file upload hook and
      invalidates RFQ queries on success modal close. `AdditionalQuoteDetails` styling fixes —
      `apps/backend/src/modules/rfqs/quote-response.service.ts`,
      `apps/vendor-app/src/features/rfqs/hooks/useFileUpload.ts`,
      `apps/vendor-app/src/features/rfqs/hooks/useRfqResponse.ts`,
      `apps/vendor-app/src/features/rfqs/pages/RfqResponsePage.tsx`,
      `apps/vendor-app/src/features/rfqs/components/AdditionalQuoteDetails.tsx`
- [x] T921 [US-3.08] PO vendor action fixes: DeclinePoModal invalidates `purchase-orders` list query
      instead of single PO detail query. PoVendorActions accept button requires `isAcknowledged`
      checkbox before enabling —
      `apps/vendor-app/src/features/purchase-orders/components/DeclinePoModal.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/PoVendorActions.tsx`
- [x] T923 [US-3.08] PO component unit tests: 5 new test files (48 tests) covering PoVendorActions
      (7 tests — acknowledge, approve disabled until acknowledged, decline modal), DeclinePoModal (6
      tests — reason input, submit, cancel, empty submit), ChangeRequestModal (16 tests — tabs,
      submit, history, empty history, spinner, count badge), PoVendorAcceptFields (12 tests —
      payment terms input, warehouse dropdown, validation), ChangeRequestPage (7 tests — loading,
      error, placeholder rendering) —
      `apps/vendor-app/src/features/purchase-orders/components/PoVendorActions.test.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/DeclinePoModal.test.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/ChangeRequestModal.test.tsx`,
      `apps/vendor-app/src/features/purchase-orders/components/PoVendorAcceptFields.test.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/ChangeRequestPage.test.tsx`
- [x] T922 [US-3.10] Unify cancel invitation into StatusActionModal: remove dedicated
      `isCancelInvitationModalOpen` store state, route cancelInvitation through
      `openStatusActionModal('cancelInvitation', ...)`. VendorUserDetailPage updated. Resend
      invitation modal i18n text wrapped in green span. Tests updated —
      `apps/vendor-app/src/features/users/state/vendor-users.store.ts`,
      `apps/vendor-app/src/features/users/ui/VendorUserListPage.tsx`,
      `apps/vendor-app/src/features/users/ui/VendorUserDetailPage.tsx`,
      `packages/i18n/src/locales/en/vendorUsers.json`,
      `apps/vendor-app/src/features/users/state/vendor-users.store.test.ts`,
      `apps/vendor-app/src/features/users/ui/VendorUserListPage.test.tsx`,
      `apps/vendor-app/src/features/users/ui/VendorUserDetailPage.test.tsx`

---

## Epic 4: Material Catalogue (US-4.01–4.07)

**Status**: Not Started. **Prerequisites**: None (can start in parallel with Epic 3).

---

### Phase 1: Shared Types & DTOs (Epic 4)

- [ ] T361 [P] [US-4] Add enums to `packages/shared-types/src/enums/index.ts`: `MaterialStatus`
      (Active, Deprecated, Archived), `UnitOfMeasure` (Each, Kg, Metre, Litre, Box, Pallet, etc.) —
      `packages/shared-types/src/enums/index.ts`
- [ ] T362 [P] [US-4.01] Create `packages/shared-types/src/dtos/material.dto.ts`:
      `CreateMaterialDto` (name, manufacturer, sku, uom, description, category, price?),
      `UpdateMaterialDto`, `MaterialListQueryDto` (page, limit, search, category, uom, status,
      sortBy, sortDir), `MaterialListItemDto`, `MaterialDetailDto`, `MaterialImportDto` —
      `packages/shared-types/src/dtos/material.dto.ts`
- [ ] T363 [P] [US-4.06] Create `packages/shared-types/src/dtos/price-history.dto.ts`:
      `PriceHistoryQueryDto`, `PriceHistoryItemDto` (date, price, vendorName, poReference) —
      `packages/shared-types/src/dtos/price-history.dto.ts`
- [ ] T364 [P] [US-4] Create Zod schemas: `packages/shared-types/src/schemas/material.schema.ts` —
      `packages/shared-types/src/schemas/`
- [ ] T365 [P] [US-4] Create API client endpoints: `packages/api-client/src/endpoints/materials.ts`
      (getMaterials, getMaterial, createMaterial, updateMaterial, importMaterials, getPriceHistory,
      addToFavourites, removeFromFavourites, searchMaterials); export from barrel —
      `packages/api-client/src/endpoints/`, `packages/api-client/src/index.ts`
- [ ] T366 [P] [US-4] Create i18n translations: `packages/i18n/src/locales/en/materials.json` (list,
      detail, import, search, favourites, priceHistory) —
      `packages/i18n/src/locales/en/materials.json`

### Phase 2: Prisma Schema & Migrations (Epic 4)

- [ ] T367 [US-4.01] Add `Material` model: id, name, manufacturer, sku, uom, category, description,
      price, status (MaterialStatus), photos (json), createdByCompanyId (FK), createdByUserId (FK),
      createdAt, updatedAt — `apps/backend/src/prisma/schema/material.prisma`
- [ ] T368 [US-4.01] Add `MaterialCategory` model: id, name, parentId (self-FK), createdAt —
      `apps/backend/src/prisma/schema/material.prisma`
- [ ] T369 [US-4.03] Add `MaterialFavourite` model: id, userId (FK), materialId (FK), listName,
      createdAt; unique (userId, materialId, listName) —
      `apps/backend/src/prisma/schema/material.prisma`
- [ ] T370 [US-4.06] Add `PriceHistory` model: id, materialId (FK), vendorCompanyId (FK), price,
      poId (FK?), recordedAt — `apps/backend/src/prisma/schema/material.prisma`
- [ ] T371 [US-4.05] Add `MaterialAggregation` model: id, canonicalMaterialId (FK),
      variantMaterialId (FK), createdByUserId (FK), createdAt —
      `apps/backend/src/prisma/schema/material.prisma`
- [ ] T372 [US-4] Run Prisma migration: `pnpm prisma migrate dev --name add-material-catalogue` —
      `apps/backend/src/prisma/migrations/`

### Phase 3: Backend Services & Controllers (Epic 4)

- [ ] T373 [US-4.01] Implement `apps/backend/src/modules/materials/materials.service.ts`:
      `listMaterials()`, `getMaterial()`, `createMaterial()`, `updateMaterial()`,
      `archiveMaterial()`, `importMaterials()` (CSV/XLS upload + column mapping), duplicate
      detection — `apps/backend/src/modules/materials/materials.service.ts`
- [ ] T374 [US-4.01] Implement `apps/backend/src/modules/materials/materials.controller.ts`: full
      CRUD + import + archive endpoints —
      `apps/backend/src/modules/materials/materials.controller.ts`
- [ ] T375 [US-4.02] Add material contribution endpoint: `POST /v1/materials/suggest` —
      user-suggested materials pending SuperAdmin approval —
      `apps/backend/src/modules/materials/materials.controller.ts`
- [ ] T376 [US-4.03] Add favourites/lists endpoints: `POST /v1/materials/:id/favourite`,
      `DELETE /v1/materials/:id/favourite`, `GET /v1/materials/favourites` —
      `apps/backend/src/modules/materials/materials.controller.ts`
- [ ] T377 [US-4.04] Implement smart search: full-text search with category/manufacturer/SKU
      scoring, recent searches, suggestions —
      `apps/backend/src/modules/materials/materials.service.ts`
- [ ] T378 [US-4.06] Implement price history endpoints: `GET /v1/materials/:id/price-history` —
      `apps/backend/src/modules/materials/materials.controller.ts`
- [ ] T379 [US-4.07] Implement inventory state in search results: join material search with
      inventory levels (deferred until warehouse module exists) —
      `apps/backend/src/modules/materials/materials.service.ts`
- [ ] T380 [US-4] Create `MaterialsModule` and register in AppModule —
      `apps/backend/src/modules/materials/materials.module.ts`, `apps/backend/src/app.module.ts`
- [ ] T381 [US-4] Update seed data: add sample materials, categories, price history —
      `apps/backend/prisma/seed.ts`

### Phase 4: Frontend Pages & Components (Epic 4)

- [ ] T382 [US-4.01] Implement material list page: `MaterialListPage.tsx` with search, category
      filter, UOM filter, status filter, DataTable —
      `apps/procurement-officer-app/src/features/materials/pages/MaterialListPage.tsx`
- [ ] T383 [US-4.01] Implement material detail page: `MaterialDetailPage.tsx` with photos, specs,
      price history chart, vendor info —
      `apps/procurement-officer-app/src/features/materials/pages/MaterialDetailPage.tsx`
- [ ] T384 [US-4.01] Implement material import page: `MaterialImportPage.tsx` with CSV/XLS upload,
      column mapping, preview, duplicate review —
      `apps/procurement-officer-app/src/features/materials/pages/MaterialImportPage.tsx`
- [ ] T385 [US-4.02] Implement SA material management: approve/reject suggested materials, edit
      global catalogue — `apps/super-admin-app/src/features/materials/pages/MaterialListPage.tsx`
- [ ] T386 [US-4.03] Implement favourites/lists UI: `FavouritesPage.tsx` with named lists,
      add/remove actions —
      `apps/procurement-officer-app/src/features/materials/pages/FavouritesPage.tsx`
- [ ] T387 [US-4.04] Implement smart search component: `MaterialSearch.tsx` with typeahead, recent
      searches, category suggestions —
      `apps/procurement-officer-app/src/features/materials/ui/MaterialSearch.tsx`
- [ ] T388 [US-4] Add routes and sidebar items in procurement-officer-app, super-admin-app —
      `apps/*/src/app/routes.tsx`, `apps/*/src/shared/layout/AppLayout.tsx`

---

## Epic 5: Procurement — Full Implementation (US-5.01–5.24)

**Status**: Not Started. **Prerequisites**: Epic 2 Projects COMPLETE, Epic 4 Material Catalogue (at
least schema-ready).

**Note**: US-5.03 (Create project) and US-5.04 (Edit project) are COMPLETE from Epic 2. Tasks below
cover remaining US-5 stories.

---

### Phase 1: Shared Types & DTOs (Epic 5)

- [ ] T389 [P] [US-5] Add enums to `packages/shared-types/src/enums/index.ts`: `BomStatus` (Draft,
      Active, Archived), `ApprovalStatus` (Pending, Approved, Rejected), `ChangeRequestStatus`
      (Pending, Approved, Rejected, Cancelled), `ChangeClassification` (Minor, Major),
      `WarehouseReleaseStatus` (Pending, Approved, InProgress, Completed, Cancelled) —
      `packages/shared-types/src/enums/index.ts`
- [ ] T390 [P] [US-5.01] Create `packages/shared-types/src/dtos/bom.dto.ts`: `CreateBomDto`
      (projectId, name, items[]), `UpdateBomDto`, `BomItemDto` (materialId, quantity, unit, notes),
      `BomDetailDto`, `BomListDto` — `packages/shared-types/src/dtos/bom.dto.ts`
- [ ] T391 [P] [US-5.05] Extend `packages/shared-types/src/dtos/rfq.dto.ts`: `CreateRfqDto`
      (projectId, lineItems[], vendorIds[], deadline, deliveryLocation, notes), `UpdateRfqDto`,
      `SubmitRfqDto` — `packages/shared-types/src/dtos/rfq.dto.ts`
- [x] T392 [P] [US-5.07] Extend `packages/shared-types/src/dtos/purchase-order.dto.ts`:
      `CreatePoDto` (projectId, vendorId, lineItems[], deliveryDetails), `UpdatePoDto`, `SplitPoDto`
      (lineItemIds[]) — `packages/shared-types/src/dtos/purchase-order.dto.ts` — DONE (T722):
      CreatePurchaseOrderDto, UpdatePurchaseOrderDto, CreatePoLineItemDto with class-validator
- [ ] T393 [P] [US-5.08] Extend `packages/shared-types/src/dtos/bulk-order.dto.ts`:
      `CreateBulkOrderDto`, `DrawdownDto` (bulkOrderId, lineItems[], quantity) —
      `packages/shared-types/src/dtos/bulk-order.dto.ts`
- [ ] T394 [P] [US-5.10] Create `packages/shared-types/src/dtos/approval.dto.ts`:
      `ApprovalConfigDto` (entity, thresholds[], approverRoles[]), `ApprovalRequestDto`,
      `ApprovalResponseDto` — `packages/shared-types/src/dtos/approval.dto.ts`
- [ ] T395 [P] [US-5.12] Create `packages/shared-types/src/dtos/change-request.dto.ts`:
      `CreateChangeRequestDto` (entityType, entityId, changes[], justification, classification),
      `ChangeRequestDetailDto` — `packages/shared-types/src/dtos/change-request.dto.ts`
- [ ] T396 [P] [US-5.16] Create `packages/shared-types/src/dtos/warehouse-release.dto.ts`:
      `CreateWarehouseReleaseDto` (projectId, items[], deliveryLocation),
      `WarehouseReleaseDetailDto` — `packages/shared-types/src/dtos/warehouse-release.dto.ts`
- [ ] T397 [P] [US-5] Create Zod schemas for all new DTOs — `packages/shared-types/src/schemas/`
- [ ] T398 [P] [US-5] Extend API client endpoints for BOM, full RFQ CRUD, full PO CRUD, bulk orders,
      approvals, change requests, warehouse releases — `packages/api-client/src/endpoints/`
- [ ] T399 [P] [US-5] Create/update i18n translations: `packages/i18n/src/locales/en/bom.json`,
      extend `rfqs.json`, `purchaseOrders.json`, `bulkOrders.json` — `packages/i18n/src/locales/en/`

### Phase 2: Prisma Schema & Migrations (Epic 5)

- [ ] T400 [US-5.01] Add `Bom` and `BomItem` models: bom (id, projectId FK, name, status,
      createdByUserId FK, createdAt, updatedAt), bomItem (id, bomId FK, materialId FK?, name,
      quantity, unit, notes) — `apps/backend/src/prisma/schema/bom.prisma`
- [ ] T401 [US-5.10] Add `ApprovalConfig` and `ApprovalRequest` models: config (id, companyId FK,
      entityType, thresholds json, approverRoles json), request (id, entityType, entityId, status,
      requestedByUserId FK, approvedByUserId FK?, createdAt) —
      `apps/backend/src/prisma/schema/approval.prisma`
- [ ] T402 [US-5.12] Add `ChangeRequest` model: id, entityType, entityId, changes (json),
      justification, classification, status, requestedByUserId FK, reviewedByUserId FK?, createdAt,
      updatedAt — `apps/backend/src/prisma/schema/change-request.prisma`
- [ ] T403 [US-5.16] Add `WarehouseRelease` and `WarehouseReleaseItem` models —
      `apps/backend/src/prisma/schema/warehouse.prisma`
- [ ] T404 [US-5] Run Prisma migration: `pnpm prisma migrate dev --name add-procurement-models` —
      `apps/backend/src/prisma/migrations/`

### Phase 3: Backend Services & Controllers (Epic 5)

- [ ] T405 [US-5.01] Implement BOM module: `bom.service.ts`, `bom.controller.ts`, `bom.module.ts` —
      `POST /v1/projects/:projectId/bom`, `GET /v1/projects/:projectId/bom`, `PATCH /v1/bom/:id`,
      `DELETE /v1/bom/:id` — `apps/backend/src/modules/bom/`
- [ ] T406 [US-5.05] Extend RFQ service with full CRUD: `createRfq()`, `updateRfq()`, `submitRfq()`,
      `addItemsToRfq()` (US-5.14), `editRfq()` (US-5.18) —
      `apps/backend/src/modules/rfqs/rfqs.service.ts`
- [ ] T407 [US-5.06] Add quote review endpoints: `GET /v1/rfqs/:id/quotes/compare`,
      `POST /v1/rfqs/:id/quotes/:quoteId/award`, `POST /v1/rfqs/:id/line-items/:itemId/approve`
      (US-5.19) — `apps/backend/src/modules/rfqs/rfqs.controller.ts`
- [x] T408 [US-5.07] Extend PO service with full CRUD: `createPo()`, `updatePo()`, `sendPo()` —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` — DONE (T725-T728):
      createPurchaseOrder, updatePurchaseOrder, issuePurchaseOrder implemented
- [ ] T409 [US-5.08] Extend bulk order service: `createBulkOrder()`, `changeBulkOrder()` (US-5.20) —
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`
- [ ] T410 [US-5.09] Implement drawdown service: `createDrawdown()`, `listDrawdowns()` —
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`
- [ ] T411 [US-5.10] Implement approval module: `approval.service.ts`, `approval.controller.ts` —
      configurable approval scenarios per entity type — `apps/backend/src/modules/approvals/`
- [ ] T412 [US-5.11] Implement PO split: `POST /v1/purchase-orders/:id/split` — splits PO into
      multiple POs by line items —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [ ] T413 [US-5.12] Implement change request module: `change-requests.service.ts`,
      `change-requests.controller.ts` — classification engine (Minor/Major based on thresholds) —
      `apps/backend/src/modules/change-requests/`
- [ ] T414 [US-5.15] Implement pick-up PO: mark PO as pick-up type, generate pick-up instructions —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [ ] T415 [US-5.16] Implement warehouse release module: `warehouse-releases.service.ts`,
      `warehouse-releases.controller.ts` — `apps/backend/src/modules/warehouse-releases/`
- [ ] T416 [US-5.21] Implement PO & RFQ location split: split by delivery location into separate
      entities — `apps/backend/src/modules/rfqs/rfqs.service.ts`,
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [ ] T417 [US-5.22] Implement material request to RFQ conversion:
      `POST /v1/material-requests/:id/convert-to-rfq` —
      `apps/backend/src/modules/rfqs/rfqs.service.ts`
- [ ] T418 [US-5.23] Implement PO & bulk order integration: auto-create drawdown PO from bulk order
      — `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [ ] T419 [US-5.24] Implement pick-up RFQ items: mark RFQ items for pick-up —
      `apps/backend/src/modules/rfqs/rfqs.service.ts`
- [ ] T420 [US-5] Register all new modules in AppModule — `apps/backend/src/app.module.ts`
- [ ] T421 [US-5] Update seed data — `apps/backend/prisma/seed.ts`

### Phase 4: Frontend Pages & Components (Epic 5)

- [ ] T422 [US-5.01] Implement BOM creation page: `CreateBomPage.tsx` with material search, quantity
      inputs, import from file — `apps/company-admin-app/src/features/bom/pages/CreateBomPage.tsx`
- [ ] T423 [US-5.02] Implement BOM edit page: `EditBomPage.tsx` with inline editing, add/remove
      items — `apps/company-admin-app/src/features/bom/pages/EditBomPage.tsx`
- [ ] T424 [US-5.05] Implement full RFQ creation page: `CreateRfqPage.tsx` with items from
      BOM/catalogue, vendor selection, deadline, delivery details —
      `apps/company-admin-app/src/features/rfqs/pages/CreateRfqPage.tsx`
- [ ] T425 [US-5.06] Implement quote review page: `QuoteReviewPage.tsx` with side-by-side
      comparison, best price highlighting, award action —
      `apps/company-admin-app/src/features/rfqs/pages/QuoteReviewPage.tsx`
- [x] T426 [US-5.07] Implement full PO creation page: `CreatePoPage.tsx` with from-RFQ or manual,
      items, prices, delivery details —
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePoPage.tsx` — DONE
      (T770-T807): CreatePoWizard in po-shared with 3-step wizard, ApprovedQuotesModal,
      BulkOrdersModal, coverage modals, attachments, save draft, wired in all 3 apps
- [ ] T427 [US-5.08] Implement bulk order creation page: `CreateBulkOrderPage.tsx` —
      `apps/company-admin-app/src/features/bulk-orders/pages/CreateBulkOrderPage.tsx`
- [ ] T428 [US-5.09] Implement drawdown UI: `CreateDrawdownPage.tsx` with line item selection,
      quantities — `apps/company-admin-app/src/features/bulk-orders/pages/CreateDrawdownPage.tsx`
- [ ] T429 [US-5.10] Implement approval configuration UI: `ApprovalConfigPage.tsx` with entity type
      selection, threshold settings, approver role selection —
      `apps/company-admin-app/src/features/settings/pages/ApprovalConfigPage.tsx`
- [ ] T430 [US-5.12] Implement change request UI: `ChangeRequestPage.tsx` with diff view,
      justification, classification display —
      `apps/company-admin-app/src/features/change-requests/pages/ChangeRequestPage.tsx`
- [ ] T431 [US-5.13] Implement delivery info in PO detail: add delivery tracking section to PO
      detail page —
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`
- [ ] T432 [US-5] Add routes and sidebar items for all new pages — `apps/*/src/app/routes.tsx`

---

## Epic 6: Field Progressive Web App (US-6.01–6.15)

**Status**: Not Started. **Prerequisites**: Epic 4 Material Catalogue, Epic 5 Procurement.

**Note**: Per spec assumptions, Foreman is a native mobile app. This epic implements as a responsive
PWA (Progressive Web App) for field workers.

---

### Phase 1: Shared Types & DTOs (Epic 6)

- [ ] T433 [P] [US-6] Add enums to `packages/shared-types/src/enums/index.ts`:
      `MaterialRequestStatus` (Draft, Submitted, Approved, Rejected, Fulfilled),
      `DeliveryReportStatus` (Pending, Submitted, Reviewed), `DamageType` (Broken, Missing, Wrong,
      Other) — `packages/shared-types/src/enums/index.ts`
- [ ] T434 [P] [US-6.01] Create `packages/shared-types/src/dtos/material-request.dto.ts`:
      `CreateMaterialRequestDto` (projectId, items[], notes, priority), `MaterialRequestItemDto`
      (name, quantity, unit, photoIds?), `MaterialRequestDetailDto` —
      `packages/shared-types/src/dtos/material-request.dto.ts`
- [ ] T435 [P] [US-6.08] Create `packages/shared-types/src/dtos/delivery-report.dto.ts`:
      `SubmitDeliveryReportDto` (poId, items[], photos[], gpsLocation?), `DeliveryReportItemDto`
      (lineItemId, receivedQty, damagedQty?, damageType?, damageNotes?), `DeliveryReportDetailDto` —
      `packages/shared-types/src/dtos/delivery-report.dto.ts`
- [ ] T436 [P] [US-6] Create Zod schemas and API client endpoints —
      `packages/shared-types/src/schemas/`,
      `packages/api-client/src/endpoints/material-requests.ts`,
      `packages/api-client/src/endpoints/delivery-reports.ts`
- [ ] T437 [P] [US-6] Create i18n translations:
      `packages/i18n/src/locales/en/materialRequests.json`,
      `packages/i18n/src/locales/en/deliveryReports.json` — `packages/i18n/src/locales/en/`

### Phase 2: Prisma Schema & Migrations (Epic 6)

- [ ] T438 [US-6.01] Add `MaterialRequest` and `MaterialRequestItem` models: request (id, projectId
      FK, status, priority, notes, createdByUserId FK, createdAt, updatedAt), item (id, requestId
      FK, name, quantity, unit, photoIds json) —
      `apps/backend/src/prisma/schema/material-request.prisma`
- [ ] T439 [US-6.08] Add `DeliveryReport` and `DeliveryReportItem` models: report (id, poId FK,
      status, gpsLatitude, gpsLongitude, photoIds json, submittedByUserId FK, createdAt), item (id,
      reportId FK, lineItemId FK, receivedQty, damagedQty, damageType, damageNotes) —
      `apps/backend/src/prisma/schema/delivery-report.prisma`
- [ ] T440 [US-6.04] Add `Note` model: id, userId FK, projectId FK?, content, convertedToRequestId
      FK?, createdAt, updatedAt — `apps/backend/src/prisma/schema/note.prisma`
- [ ] T441 [US-6] Run Prisma migration — `apps/backend/src/prisma/migrations/`

### Phase 3: Backend Services & Controllers (Epic 6)

- [ ] T442 [US-6.01] Implement material requests module: `material-requests.service.ts`,
      `material-requests.controller.ts` — CRUD + status transitions + photo upload —
      `apps/backend/src/modules/material-requests/`
- [ ] T443 [US-6.02] Implement file-based line item addition: accept photo/PDF upload, parse items
      (OCR integration) — `apps/backend/src/modules/material-requests/material-requests.service.ts`
- [ ] T444 [US-6.03] Implement handwritten list OCR: accept image upload, OCR to extract text, parse
      into line items — `apps/backend/src/modules/material-requests/material-requests.service.ts`
- [ ] T445 [US-6.04] Implement notes module: `notes.service.ts`, `notes.controller.ts` — CRUD for
      in-app notepad — `apps/backend/src/modules/notes/`
- [ ] T446 [US-6.05] Implement note-to-request conversion: `POST /v1/notes/:id/convert-to-request` —
      `apps/backend/src/modules/notes/notes.service.ts`
- [ ] T447 [US-6.08] Implement delivery reports module: `delivery-reports.service.ts`,
      `delivery-reports.controller.ts` — submit report with photos, GPS, item-level damage tracking
      — `apps/backend/src/modules/delivery-reports/`
- [ ] T448 [US-6.10] Implement invoice upload during delivery: extend delivery report with invoice
      attachment — `apps/backend/src/modules/delivery-reports/delivery-reports.service.ts`
- [ ] T449 [US-6.11] Implement GPS tracking endpoint: `POST /v1/deliveries/:id/location` — store GPS
      coordinates for delivery tracking —
      `apps/backend/src/modules/delivery-reports/delivery-reports.controller.ts`
- [ ] T450 [US-6.12] Implement 15-minute edit window: enforce time-based editing constraint on
      submitted reports — `apps/backend/src/modules/delivery-reports/delivery-reports.service.ts`
- [ ] T451 [US-6.13] Implement inventory update from deliveries: auto-update inventory levels when
      delivery report is approved —
      `apps/backend/src/modules/delivery-reports/delivery-reports.service.ts`
- [ ] T452 [US-6.14] Implement internal material transfer confirmation —
      `apps/backend/src/modules/material-requests/material-requests.service.ts`
- [ ] T453 [US-6.15] Implement warehouse release request acceptance by field worker —
      `apps/backend/src/modules/warehouse-releases/warehouse-releases.service.ts`
- [ ] T454 [US-6] Register all new modules in AppModule — `apps/backend/src/app.module.ts`

### Phase 4: Frontend — PWA & Pages (Epic 6)

- [ ] T455 [US-6] Scaffold foreman-app as PWA: service worker, manifest.json, offline support,
      responsive mobile-first layout — `apps/foreman-app/`
- [ ] T456 [US-6.01] Implement material request creation: `CreateMaterialRequestPage.tsx` with
      project selector, item list, photo capture, priority —
      `apps/foreman-app/src/features/material-requests/pages/CreateMaterialRequestPage.tsx`
- [ ] T457 [US-6.02] Implement file-based item addition: camera capture + file upload with preview —
      `apps/foreman-app/src/features/material-requests/ui/FileItemUpload.tsx`
- [ ] T458 [US-6.03] Implement handwritten list OCR: camera capture, OCR preview, edit parsed items
      — `apps/foreman-app/src/features/material-requests/ui/HandwrittenListCapture.tsx`
- [ ] T459 [US-6.04] Implement in-app notepad: `NotepadPage.tsx` with text editor, auto-save —
      `apps/foreman-app/src/features/notes/pages/NotepadPage.tsx`
- [ ] T460 [US-6.07] Implement mobile document viewer: `DocumentViewerPage.tsx` for POs, RFQs,
      invoices — `apps/foreman-app/src/features/documents/pages/DocumentViewerPage.tsx`
- [ ] T461 [US-6.08] Implement delivery report submission: `SubmitDeliveryReportPage.tsx` with item
      checklist, photo capture, GPS auto-detect —
      `apps/foreman-app/src/features/deliveries/pages/SubmitDeliveryReportPage.tsx`
- [ ] T462 [US-6.09] Implement damage flagging UI: `DamageReportSection.tsx` with damage type
      selector, notes, photos —
      `apps/foreman-app/src/features/deliveries/ui/DamageReportSection.tsx`
- [ ] T463 [US-6] Add bottom navigation: Home, Material Request, Delivery Tracking, Notifications,
      Profile — `apps/foreman-app/src/shared/layout/BottomNav.tsx`

---

## Additional Dashboard Stories (US-2.03, 2.05, 2.08–2.10)

**Status**: Not Started. **Prerequisites**: Epic 2 Dashboards backend COMPLETE, Epics 5–6 for full
data.

---

### Phase 1: Shared Types & DTOs (Additional Dashboards)

- [ ] T464 [P] [US-2] Extend `packages/shared-types/src/dtos/dashboard.dto.ts`:
      `ForemanDashboardDto` (assignedProjects, pendingDeliveries, draftRequests, recentActivity),
      `WarehouseDashboardDto` (pendingRequests, itemsToPickCount, pendingDeliveries, stockAlerts),
      `MaterialRequestDashboardDto` (pendingRequests, approvedRequests, fulfilledThisWeek),
      `DeliveriesDashboardDto` (scheduledToday, inTransit, completedThisWeek, issues),
      `ExpandedFinanceDashboardDto` (extends FinanceDashboardDto with budgetUtilisation,
      costBreakdownByProject, vendorSpendAnalysis) —
      `packages/shared-types/src/dtos/dashboard.dto.ts`

### Phase 2: Backend Services (Additional Dashboards)

- [ ] T465 [US-2.03] Add `getForemanDashboard(user)` to dashboard service —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`
- [ ] T466 [US-2.05] Add `getWarehouseDashboard(user)` to dashboard service —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`
- [ ] T467 [US-2.08] Add `getMaterialRequestDashboard(user)` to dashboard service —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`
- [ ] T468 [US-2.09] Add `getDeliveriesDashboard(user)` to dashboard service —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`
- [ ] T469 [US-2.10] Extend `getFinanceDashboard(user)` with budget utilisation, cost breakdown,
      vendor spend — `apps/backend/src/modules/dashboard/dashboard.service.ts`
- [ ] T470 [US-2] Add new dashboard endpoints to controller: `GET /v1/dashboard/foreman`,
      `GET /v1/dashboard/warehouse`, `GET /v1/dashboard/material-requests`,
      `GET /v1/dashboard/deliveries` — `apps/backend/src/modules/dashboard/dashboard.controller.ts`

### Phase 3: Frontend Dashboards (Additional Dashboards)

- [ ] T471 [US-2.03] Implement foreman dashboard (mobile): project switcher, pending deliveries,
      draft material requests, recent activity —
      `apps/foreman-app/src/features/dashboard/pages/DashboardPage.tsx`
- [ ] T472 [US-2.05] Implement warehouse dashboard: pending requests, items to pick, deliveries,
      stock alerts — `apps/warehouse-officer-app/src/features/dashboard/pages/DashboardPage.tsx`
- [ ] T473 [US-2.08] Implement material request & warehouse release dashboard:
      pending/approved/fulfilled requests —
      `apps/procurement-officer-app/src/features/dashboard/ui/MaterialRequestSection.tsx`
- [ ] T474 [US-2.09] Implement deliveries management dashboard: scheduled, in-transit, completed,
      issues — `apps/procurement-officer-app/src/features/dashboard/ui/DeliveriesSection.tsx`
- [ ] T475 [US-2.10] Expand financial dashboard: budget utilisation charts, cost breakdown by
      project, vendor spend analysis —
      `apps/financial-officer-app/src/features/dashboard/pages/DashboardPage.tsx`

---

## Cross-Cutting Features (US-1.06, US-1.11)

**Status**: Not Started.

---

- [ ] T476 [US-1.11] Implement work status display: add work status indicator (Online, Away, Busy,
      Offline) to user avatars across all apps; real-time updates via WebSocket or polling —
      `packages/ui-components/src/components/AvatarWithStatus.tsx`,
      `apps/*/src/shared/layout/AppLayout.tsx`
- [ ] T477 [US-1.06] Implement approval configuration page: define approval workflows per entity
      type (PO, RFQ, Invoice, Change Request), set thresholds, assign approver roles —
      `apps/company-admin-app/src/features/settings/pages/ApprovalConfigPage.tsx`
- [ ] T478 [US-1.06] Implement approval configuration backend: `ApprovalConfigService` with CRUD for
      approval rules, validate against company structure —
      `apps/backend/src/modules/approvals/approval-config.service.ts`
- [ ] T479 [US-1.06] Wire approval checks into PO, RFQ, Invoice, Change Request create/update flows
      — `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `apps/backend/src/modules/rfqs/rfqs.service.ts`,
      `apps/backend/src/modules/invoices/invoices.service.ts`

---

## Security: Cookie-Based Auth Migration

- [x] T480 [US-1.03] Migrate token storage from in-memory/body to httpOnly cookies: install
      `cookie-parser`, add `setAuthCookies`/`clearAuthCookies` utility, update `auth.controller.ts`
      (verifyOtp/refresh/logout set/clear cookies), update JWT strategies to extract tokens from
      cookies with Bearer header fallback, update `auth.service.refresh()` to return full TokenPair
      — `apps/backend/src/main.ts`, `apps/backend/src/common/utils/set-auth-cookies.util.ts`,
      `apps/backend/src/modules/auth/auth.controller.ts`,
      `apps/backend/src/modules/auth/auth.service.ts`,
      `apps/backend/src/modules/auth/strategies/jwt.strategy.ts`,
      `apps/backend/src/modules/auth/strategies/jwt-refresh.strategy.ts`
- [x] T481 [US-1.03] Update frontend auth for cookie-based flow: remove in-memory token storage from
      `api-client`, remove Bearer header injection from auth interceptor, simplify refresh (cookies
      sent automatically via `withCredentials: true`), remove `accessToken` from Zustand auth store,
      update `verifyOtp` response type and hooks — `packages/api-client/src/client.ts`,
      `packages/api-client/src/interceptors/auth.interceptor.ts`,
      `packages/api-client/src/endpoints/auth.ts`, `packages/api-client/src/index.ts`,
      `packages/auth/src/createAuthStore.ts`, `packages/auth/src/createAuthHooks.ts`
- [x] T482 [US-1.03] Update auth test suites for cookie-based flow: controller tests verify
      `res.cookie`/`res.clearCookie` calls, service test uses `signAsync` for TokenPair, refresh
      strategy tests cover cookie and body fallback extraction —
      `apps/backend/src/modules/auth/auth.controller.spec.ts`,
      `apps/backend/src/modules/auth/auth.service.spec.ts`,
      `apps/backend/src/modules/auth/strategies/jwt-refresh.strategy.spec.ts`
- [x] T835 [US-1.03] Fix routes.test.tsx across all apps for GuestRoute structure: add GuestRoute
      mock, split public route assertions into guest-only (login, verify-otp, forgot-password under
      GuestRoute) and always-accessible (activate, reset-password), fix PrivateRoute group lookup —
      `apps/warehouse-officer-app/src/app/routes.test.tsx`,
      `apps/financial-officer-app/src/app/routes.test.tsx`,
      `apps/super-admin-app/src/app/routes.test.tsx`, `apps/vendor-app/src/app/routes.test.tsx`
- [x] T836 [US-1.03] Add GuestRoute unit tests for all 6 apps: verify authenticated users redirect
      to home, unauthenticated users see child content, renders Outlet — 3 tests per app —
      `apps/company-admin-app/src/shared/components/GuestRoute.test.tsx`,
      `apps/financial-officer-app/src/shared/components/GuestRoute.test.tsx`,
      `apps/procurement-officer-app/src/shared/components/GuestRoute.test.tsx`,
      `apps/super-admin-app/src/shared/components/GuestRoute.test.tsx`,
      `apps/vendor-app/src/shared/components/GuestRoute.test.tsx`,
      `apps/warehouse-officer-app/src/shared/components/GuestRoute.test.tsx`

---

## Enum Standardisation & Prisma Schema Restructure

**Status**: COMPLETE. **Purpose**: Migrate all enums from PascalCase to SCREAMING_SNAKE_CASE for
consistency with Prisma conventions. Restructure Prisma schema into multi-file format. Add
procurement models (Rfq, PurchaseOrder, BulkOrder, Invoice).

- [x] T483 [US-2] Restructure Prisma schema from single `schema.prisma` to multi-file format under
      `apps/backend/src/prisma/schema/` using `prismaSchemaFolder` preview feature: `schema.prisma`
      (generator+datasource), `enums.prisma`, `user.prisma`, `company.prisma`, `project.prisma`,
      `rfq.prisma`, `purchase-order.prisma`, `bulk-order.prisma`, `invoice.prisma`, `audit.prisma`
- [x] T484 [US-2] Rename all Prisma enums from PascalCase to SCREAMING_SNAKE_CASE: UserRole
      (SuperAdmin→SUPER_ADMIN, CompanyAdmin→COMPANY_ADMIN, etc.), UserStatus (Invited→INVITED,
      Active→ACTIVE, Deactivated→DEACTIVATED), CompanyType (Contractor→CONTRACTOR, Vendor→VENDOR),
      CompanyStatus (Active→ACTIVE, Inactive→INACTIVE), ProjectStatus (Planned→PLANNED, etc.),
      LocationType (Delivery→DELIVERY, Storage→STORAGE), DocumentType (Avatar→AVATAR, etc.)
- [x] T485 [US-2] Add new procurement enums: RfqStatus, PoStatus, PoType, BulkOrderStatus,
      InvoiceStatus; add new procurement models: Rfq, RfqLineItem, QuoteResponse, PurchaseOrder,
      BulkOrder, BulkOrderLineItem, Drawdown, Invoice
- [x] T486 [US-2] Create custom Prisma migration
      `20260310120000_rename_enums_and_add_procurement_models` with CASE-mapping SQL to safely
      rename enum values (CREATE TYPE new → ALTER COLUMN USING CASE → DROP old)
- [x] T487 [US-2] Update `packages/shared-types/src/enums/index.ts`: all enum values to
      SCREAMING_SNAKE_CASE; add new procurement enums (RfqStatus, PoStatus, PoType, BulkOrderStatus,
      InvoiceStatus)
- [x] T488 [US-2] Migrate all backend code to use proper Prisma enum imports instead of string
      literals: controllers, services, guards, utils, seed, e2e tests (~30 files)
- [x] T489 [US-2] Migrate all frontend code to use `@forethread/shared-types` enum imports instead
      of string literals: super-admin, company-admin, vendor, financial-officer,
      procurement-officer, warehouse-officer apps (~70 files)
- [x] T490 [US-2] Update `packages/api-client` interfaces to use enum types instead of string
      unions: CompanyType, CompanyStatus, ProjectStatus in companies.ts and projects.ts
- [x] T491 [US-2] Update i18n locale keys to SCREAMING_SNAKE_CASE: users.json role/status keys,
      projects.json status keys, common.json status keys
- [x] T492 [US-2] Update Zod schemas in `packages/shared-types/src/schemas/project.schema.ts` to use
      enum imports instead of string literals
- [x] T493 [US-10] Fix FilterPopover React key warning: add index to key in option mapping —
      `packages/ui-components/src/components/FilterPopover.tsx`
- [x] T494 [US-10] Fix ESLint eqeqeq and import/order errors across dashboard files in
      company-admin, vendor, financial-officer, procurement-officer apps
- [x] T495 [US-10] Fix TS1240 decorator errors: add experimentalDecorators + emitDecoratorMetadata
      to `packages/config/tsconfig.base.json`, remove redundant flags from shared-types tsconfig
- [x] T496 [US-10.01] Add KPI summary cards to PO/CA dashboard: new backend KPI aggregation
      (pending/overdue counts for RFQs, POs, Quotes, Invoices using Prisma enums), new
      `KpiSummaryDto`/`KpiCountDto` DTOs, new `KpiSummary`/`KpiCount` API client interfaces, new
      `KpiSummaryCards.tsx` component in both PO + CA apps, updated `DashboardPage` layout —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`,
      `packages/shared-types/src/dtos/dashboard.dto.ts`,
      `packages/api-client/src/endpoints/dashboard.ts`,
      `apps/procurement-officer-app/src/features/dashboard/ui/KpiSummaryCards.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/KpiSummaryCards.tsx`
- [x] T497 [US-10.01] Fix QuickActions to match Figma: 1x4 row layout, correct items (Create PO,
      Create RFQ, Add vendor, Upload invoice) replacing old 2x2 grid —
      `apps/procurement-officer-app/src/features/dashboard/ui/QuickActions.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuickActions.tsx`
- [x] T498 [US-10.01] Fix QuoteResponses tabs to match Figma: All/Pending/Acknowledged replacing
      Received/Pending; hide Approve/Decline buttons for non-PENDING quotes to prevent backend
      validation errors —
      `apps/procurement-officer-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`
- [x] T499 [US-10] Fix broken test mocks across all apps: add missing Prisma `count` mocks,
      `QueryClientProvider` wrappers, enum exports (`CompanyType`, `ProjectStatus`, `LocationType`),
      `useNavigate` mocks, `formatStatus` case expectations, radio testid casing, and QuickActions
      icon/label mismatches — 22 test files across 6 apps

---

## Phase: PO/CA Dashboard Figma Alignment — Round 2

**Purpose**: Fix remaining discrepancies between PO/CA dashboard implementation and Figma designs
(nodes 3345-110136, 3347-115416, 3345-110090). Previous alignment (T496–T498) was partial —
structure, buttons, and icons still don't match the design.

**Figma References**:

- PO Dashboard: https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110136&m=dev
- CA Dashboard: https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3347-115416&m=dev
- Buttons/Icons: https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110090&m=dev

- [x] T500 [US-10.01] Audit current PO/CA dashboard against Figma designs: open Figma frames
      3345-110136 (PO), 3347-115416 (CA), 3345-110090 (buttons), and document every visual
      difference — section ordering, grid layout, spacing, card sizes, typography, colors, border
      radii, shadows. Output: detailed diff list in this task file for T501–T505 to reference.
- [x] T501 [US-10.01] Fix dashboard page layout/structure to match Figma: update section ordering,
      grid column configuration, spacing/gaps, and overall page structure in DashboardPage.tsx for
      both PO and CA apps —
      `apps/procurement-officer-app/src/features/dashboard/pages/DashboardPage.tsx`,
      `apps/company-admin-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T502 [US-10.01] Fix Quick Action buttons to match Figma (node 3345-110090): update button
      styling (size, colors, border radius, padding), icon sizing/positioning, label typography,
      hover states, and layout in QuickActions.tsx for both PO and CA apps —
      `apps/procurement-officer-app/src/features/dashboard/ui/QuickActions.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuickActions.tsx`
- [x] T503 [US-10.01] Add missing icons to match Figma: identify all icons from the Figma design
      that are not in the current implementation, export/create SVG assets, add to
      `packages/ui-components/assets/icons/`, and wire them into the relevant dashboard components
      (KPI cards, Quick Actions, section headers, list items) in both PO and CA apps
- [x] T504 [US-10.01] Fix KPI Summary Cards styling to match Figma: update card backgrounds,
      borders, shadows, border-radius, icon container styling, typography (font sizes, weights,
      colors), and data layout in KpiSummaryCards.tsx for both apps —
      `apps/procurement-officer-app/src/features/dashboard/ui/KpiSummaryCards.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/KpiSummaryCards.tsx`
- [x] T505 [US-10.01] Fix list sections styling to match Figma: update QuoteResponsesSection,
      RecentOrdersSection, PendingPurchaseOrders, InvoicesPendingApproval card layouts, tab styling,
      badge styling, action button styling, avatar rendering, and empty states to match Figma in
      both PO and CA apps
- [x] T506 [US-10.01] Verify both PO and CA dashboards render identically (designs confirmed
      identical): ensure shared components are used in both apps and both render the same output.
- [x] T507 [US-10.01] Fix test files for any component changes from T501–T506: update mocks,
      assertions, and snapshots in DashboardPage.test.tsx and component test files across both apps

---

## Phase: Shared UI Components & Icons

- [x] T508 [P] [US-10.01] Add new shared UI components to @forethread/ui-components:
      DashboardItemCard, DashboardSection, MessageBadgeIcon, CreateViewModal, TableManagementModal,
      DatePicker, FilterPanel, SelectDropdown — `packages/ui-components/src/components/`
- [x] T509 [P] [US-10.01] Add 16 new SVG icons (ask, chat, coins, copy, drag-and-drop, file-lock,
      file-text, flag, floppy-disk, message, package, paper-plane, small-cart, sort-asc, sort-desc,
      sort-unsorted, trend-up) — `packages/ui-components/src/assets/icons/`
- [x] T510 [US-10.01] Refactor SortIcon to use dedicated SVG icons, export new components and types
      from barrel — `packages/ui-components/src/index.ts`

---

## Phase: Dashboard & List Pages Figma Alignment (Round 3)

- [x] T511 [US-10.01] Add page subtitles and back buttons to AppLayout usePageInfo() across all 4
      apps (CA, PO, vendor, financial-officer) — `*/shared/layout/AppLayout.tsx`
- [x] T512 [US-10.01] Remove duplicate h1 titles/subtitles from DashboardPage, VendorListPage,
      MaterialCataloguePage, UsersPage — titles belong only in AppLayout header
- [x] T513 [US-10.01] Replace all inline three-dot menus with shared DotActionsMenu + EyeIcon in
      PurchaseOrderListPage, BulkOrderListPage, RfqListPage across all apps
- [x] T514 [US-10.01] Align BulkOrders columns with Figma: add status badge, utilization%,
      validUntil; add status/validUntil fields to backend service, DTO, API client
- [x] T515 [US-10.01] Rewrite RFQ pages (CA+PO) with comprehensive toolbar: View selector,
      Save/Export/ Settings icons, Quick Filters pills, Group dropdown, Advanced Filters panel,
      column management
- [x] T516 [US-10.01] Fix all broken tests after page rewrites: update mocks for DotActionsMenu, cn,
      getStatusColor, status color constants, remove title/subtitle assertions

---

## Phase: Status Colors & Formatters Shared Extraction

- [x] T517 [US-10.01] Create shared status color constants (RFQ_STATUS_COLORS, PO_STATUS_COLORS,
      BULK_ORDER_STATUS_COLORS, INVOICE_STATUS_COLORS, ORDER_STATUS_COLORS) and getStatusColor()
      utility — `packages/ui-components/src/utils/status-colors.ts`
- [x] T518 [US-10.01] Create shared formatters (formatCurrency, formatDate, formatStatus) utility —
      `packages/ui-components/src/utils/formatters.ts`
- [x] T519 [US-10.01] Replace all local status color maps and inline formatters across all 7 apps
      with shared imports; replace inline flag+badge with MessageBadgeIcon in RecentOrdersSection
- [x] T520 [US-10.01] Create shared InfoHint tooltip component —
      `packages/ui-components/src/components/InfoHint.tsx`
- [x] T521 [US-10.01] Replace duplicated InfoIcon+noSavedViews inline pattern in CA & PO RfqListPage
      with shared InfoHint component
- [x] T522 [US-10.01] Fix lint errors: import order, eqeqeq, non-null assertions in CA & PO
      RfqListPage; remove unused eslint-disable in CA BulkOrderListPage

---

## Phase: FilterChip Component & Theme Refinements

- [x] T523 [P] [US-10.04] Create FilterChip shared component with `active` prop using
      `--filter-chip` / `--filter-chip-foreground` CSS variables. Rounded-xl pill button matching
      Figma quick filter design — `packages/ui-components/src/components/FilterChip.tsx`,
      `packages/ui-components/src/index.ts`
- [x] T524 [P] [US-10.04] Add `--filter-chip` CSS variables to all 6 app globals.css (light:
      #6E6E6E, dark: #717182). Register `filter-chip` color in tailwind preset. Fix
      `--border`/`--input` from #D2D5DB to #E5E5E5. Remove unused
      `--table-drag-bg`/`--table-drag-overlay` — `apps/*/src/styles/globals.css`,
      `packages/config/tailwind/preset.ts`
- [x] T525 [US-10.04] Refactor DataTableQuickFilters to use FilterChip component instead of inline
      Tailwind classes — `packages/ui-components/src/components/DataTable/DataTableQuickFilters.tsx`

---

## Phase: RFQ Table Zustand Store & View Switcher

- [x] T526 [US-10.04] Create Zustand store factory `createRfqTableStore(defaultColumns)`
      encapsulating all RfqListPage state (page, pageSize, search, sort, filters, groupBy, columns,
      savedViews, activeViewId, UI panel toggles, copy RFQ modal) — replace 17+ useState calls —
      `apps/company-admin-app/src/features/rfqs/state/rfq-table.store.ts`,
      `apps/procurement-officer-app/src/features/rfqs/state/rfq-table.store.ts`
- [x] T527 [US-10.04] Refactor CA RfqListPage to consume Zustand store. View dropdown: show "Default
      view" + saved views when savedViews > 0, InfoHint tooltip when empty. Active view tracking
      with button text update. No "+ Create new view" in dropdown —
      `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`
- [x] T528 [US-10.04] Refactor PO RfqListPage identically to CA —
      `apps/procurement-officer-app/src/features/rfqs/pages/RfqListPage.tsx`
- [x] T529 [US-10.04] Hide archive action in three-dot menu when RFQ status ≠ CLOSED (conditional
      spread instead of disabled prop) — CA & PO RfqListPage
- [x] T530 [US-10.04] Dropdown/DatePicker/SelectDropdown active state: trigger shows
      `border-foreground/50 bg-muted` when open (theme variables, not hardcoded colors) —
      `packages/ui-components/src/components/CustomDropdown.tsx`,
      `packages/ui-components/src/components/DatePicker.tsx`,
      `packages/ui-components/src/components/SelectDropdown.tsx`

### US-10.04 (US-2.06) Implementation Status

**Done**:

- RFQ table with full column set, Create new button, pagination (T515)
- Quick filter tabs via FilterChip (T523–T525)
- Search bar (T515)
- Column header sorting with SortIcon (T515)
- View toggle with Zustand store (T526–T528)
- Three-dot menu with conditional archive (T529)
- Dropdown/DatePicker active state styling (T530)
- Visual grouping with accordion expand/collapse (T532)
- RFQ Detail page — CA has side panel (RfqDetailPanel) + fullscreen page (/rfqs/:id) with Details,
  Line Items, Responses, Documents tabs (T537)
- Persist saved views to backend — UserTableView Prisma model, CRUD endpoints, API client, Zustand
  store loadViews/addSavedView/deleteSavedView/applyView (T538)
- Default sort by deadline ascending, page sizes 25/50/100 (T539, T541)
- Advanced filters wired to backend query params (T531, T549)
- Export CSV/XLSX/PDF download (T533, T534, T548)
- Backend copy/archive RFQ endpoints (T535, T536)
- Views persistence backend (T551, T552)
- RFQ detail page components (T553–T556)
- Column drag ghost, vendor detail page (T557)
- Saved views wired to backend API, rfq-shared package (T558)
- PO detail preview panel (T542)
- Vendor quick filter semantics (T544)
- rfq-shared dedup: DocumentRow, tabs, docs, line items, responses (T559, T560)
- CSS var theming, pagination auto-hide, line item enrichment (T561, T562, T563)
- Vendor 8-col Figma table, status colors, grouping restricted (T540, T543, T564)
- Vendor detail: projectName title, RFQ Details section, mobile responsive (T565)
- CopyRfqModal shared component, vendor copy removed, QuoteResponseStatus enum (T566–T569)
- Quick filter camelCase normalization, vendor-specific filters, service refactor (T544, T568)

**Not Done (remaining tasks)**:

- [x] T531 [US-10.04] Wire advanced filters to backend query params (status, date range, project,
      delivery location, created by, approved quotes, approved vendors)
- [x] T532 [US-10.04] Implement visual grouping of table rows by selected field
- [x] T533 [US-10.04] Export CSV/Excel download of filtered/sorted visible columns
- [x] T534 [US-10.04] Export single RFQ as PDF
- [x] T535 [US-10.04] Backend archive RFQ endpoint (PATCH /rfqs/:id/archive)
- [x] T536 [US-10.04] Backend copy RFQ endpoint (POST /rfqs/:id/copy)
- [x] T537 [US-10.04] RFQ Detail page (CA side panel + fullscreen, PO needs preview panel)
- [x] T538 [US-10.04] Persist saved views to backend (UserTableView model + CRUD + applyView)
- [x] T539 [US-10.04] Default sort by deadline ascending
- [x] T540 [US-10.04] Vendor-specific column differentiation in vendor app RfqListPage
- [x] T541 [US-10.04] Page size options 50/100 per acceptance criteria (currently 10/25/50)

**New tasks (gaps discovered during audit)**:

- [x] T542 [US-10.04] Add RfqDetailPanel preview to PO app (CA has it, PO eye icon is orphaned)
- [x] T543 [US-10.04] Vendor app: restrict grouping to status only (AC: "when vendor: grouping by
      status only")
- [x] T544 [US-10.04] Vendor app: adjust quick filter semantics (My RFQs = responded by user,
      Awaiting = not responded, Awarded = approved for vendor)
- [x] T545 [US-10.04] RFQ Responses tab implementation in detail page — DONE via T594
- [x] T546 [US-10.04] RFQ Documents tab — file upload/delete in detail page, RfqDocument Prisma
      model, backend POST/DELETE endpoints, API client uploadRfqDocument/deleteRfqDocument, shared
      RfqDocumentsTab with useMutation upload/delete, signed URL download, readOnly for vendor
- [x] T547 [US-10.04] Backend: expand sortBy to 13 columns (lineItems, reqQuantities, recVendors,
      recQuotes, lastModifiedBy, updatedAt) + shared-types RfqListQueryDto sortBy enum extended
- [x] T548 [US-10.04] Backend RfqExportService: CSV/XLSX/PDF export with filtered query params,
      landscape PDF mode
- [x] T549 [US-10.04] Backend advanced filter query params: status[], projectId[],
      deliveryLocation[], createdByUserId[], date ranges, min approved quotes/vendors
- [x] T550 [US-10.04] Shared types: RfqListQueryDto extended with advanced filter decorators
      (IsDateString, IsInt, Min, Type)
- [x] T551 [US-10.04] Backend UserTableView Prisma model + migration, Views CRUD
      service/controller/module
- [x] T552 [US-10.04] API client: views.ts endpoints (getViews, createView, updateView, deleteView,
      deleteAllViews)
- [x] T553 [US-10.04] RfqDetailPage with tabs (Details, Line Items, Responses, Documents) + routing
      for CA app
- [x] T554 [US-10.04] RfqDetailPanel compact preview for list page (CA), RfqDetailsTab, VendorList,
      VendorContactPopover
- [x] T555 [US-10.04] RfqLineItemsTab, RfqDocumentsTab (read-only), RfqResponsesTab (placeholder),
      RfqDetailTabs nav
- [x] T556 [US-10.04] PO app RfqDetailPanel + shared components, page-title.store for dynamic
      breadcrumbs
- [x] T557 [US-10.04] Column drag ghost image for CA/PO list pages, vendor app detail page & routing
- [x] T558 [US-10.04] Wire saved views to backend API (loadViews, createView, deleteView),
      ViewsModule in app.module, rfq-shared package
- [x] T559 [US-10.04] Deduplicate RFQ components to rfq-shared: DocumentRow, RfqDocumentsTab,
      RfqLineItemsTab (with Notes Indicator + min-width scroll), RfqDetailTabs, RfqResponsesTab
- [x] T560 [US-10.04] Remove duplicate rfqs.service.ts, page-title.store.ts, rfq-table.store.ts from
      CA/PO/vendor apps — use rfq-shared exports
- [x] T561 [US-10.04] Replace hardcoded rgba/hex colors in drag ghost with CSS variables
      (hsl(var(--accent/card/border))) across all 3 apps
- [x] T562 [US-10.04] Hide pagination when totalCount <= pageSize in CA/PO/vendor RfqListPages
- [x] T563 [US-10.04] Backend getRfq: enrich lineItems with projectName, deliveryLocation, hasNotes;
      API client RfqLineItem type updated
- [x] T540 [US-10.04] Vendor 8-column Figma-aligned table (rfqId, contractorName, deliveryLocation,
      rfqStatus, projectName, resDeadline, lineItems, totalRequestedQty)
- [x] T543 [US-10.04] Vendor app: restrict grouping to status only via VENDOR_GROUP_OPTIONS
- [x] T564 [US-10.04] Vendor RfqListPage: VENDOR_RFQ_STATUS_COLORS, vendor status keys (INCOMING,
      RESPONDED, APPROVED, REJECTED, CLOSED), copy+PDF 3-dot menu, group button subtle style
- [x] T565 [US-10.04] Vendor detail: projectName in page title & panel header, "RFQ Details" section
- [x] T566 [US-10.04] Extract CopyRfqModal to rfq-shared, used by CA/PO apps; vendor copy removed
      (vendors don't create RFQs). Fix copySubtitle i18n placeholder.
- [x] T567 [US-10.04] QuoteResponseStatus Prisma enum (PENDING, SUBMITTED, APPROVED, DECLINED) with
      migration. Replace all string literals in rfqs.service, dashboard.service.
- [x] T568 [US-10.04] Refactor rfqs.service.ts: extract buildListWhere, applyQuickFilter,
      buildOrderBy, assertCompanyAccess, assertQuotePending, findQuoteOrFail helpers
- [x] T544 [US-10.04] Quick filter camelCase normalization + vendor "myRfqs" no-op + incoming/
      approvedForMe vendor-specific filters
- [x] T569 [US-10.04] Fix UserTableView Prisma relation (add tableViews to User model) title, no
      projectId in panel, responsive mobile padding, backend VENDOR role for copy endpoint
- [x] T570 [US-10.04] Hide tables (including headers) when no data after filtering/search — all list
      pages across all apps. Add loading Spinner instead of skeleton rows. DataTable shows
      EmptyState outside table when empty.
- [x] T571 [US-10.04] Fix CreatedBy advanced filter: use createdByUserId (UUID) as dropdown value
      instead of name string. Add createdByUserId to backend RFQ list response and api-client type.
- [x] T572 [US-10.04] SelectDropdown: add emptyMessage prop, show "No options found" when dropdown
      has no options instead of empty list.
- [x] T573 [US-10.04] Remove duplicate Dashboard sidebar item — keep logo-click only for dashboard
      navigation. Applied to financial-officer, vendor, procurement-officer apps.
- [x] T574 [US-10.04] Create BasePaginationQueryDto with validated page/limit/sortDir + computed
      skip/take getters. Shared PaginationMetaDto + buildPaginationMeta helper. Remove 5 duplicate
      per-module PaginationMetaDto classes. Refactor all 5 query DTOs to extend base. Refactor all 5
      backend services to use query.skip/query.take/buildPaginationMeta.
- [x] T575 [US-10.04] Fix seed.ts: 'Accepted' → 'APPROVED' for QuoteResponseStatus enum. Fix
      migration to normalize 'Accepted' values during enum conversion.
- [x] T576 [US-10.07] Financial officer dashboard: DashboardItemCard enhancements (attachments,
      messages, actions slots), INV-YYYY-NNN invoice ID format, PO reference format, itemCount from
      relatedPo.lineItemCount. InvoiceDetailPage stub, InvoiceCard component, route-config update.
      Dashboard seed data: 5 PENDING + 5 DISPUTED + 3 other invoices with realistic amounts.
      Tailwind preset: new dashboard card colors. Global CSS vars for all apps.
- [x] T577 [US-10] Spinner component refactor: replace CSS border spinner with SVG icon
      (spinner.svg), add xl size, PageLoader height fix. New SVG icons: circle-reload.svg,
      toggle-switch.svg. CI fix: turbo filter uses @forethread/backend package name.
- [x] T578 [US-10.SA] PlatformStateTable interactive enhancements: column sorting (SortIcon),
      component detail modal (view button), integration toggle (enable/disable with toast), reload
      button (animated spinner for errored components). isIntegration flag in constants. New i18n
      keys for platformState (type, integration, service, close, toggle/reload toasts).
- [x] T579 [US-10.07] FO InvoiceDetailPage: full implementation with real data (useInvoice hook),
      approve/decline action buttons, QuoteLineItemsTab with project/vendor/PO/amount/status/due,
      AttachmentsTab with file table, MessagesTab with i18n. Dynamic page title via pageTitle store.
      AppLayout uses dynamicTitle for invoice detail. rfq-shared dep added to FO package.json. SQL
      seed script for FO dashboard test data.
- [x] T580 [US-10.01] CA dashboard navigation: QuickActions point to /new routes (createPo,
      createRfq, addVendor, uploadInvoice). Dashboard cards navigate to detail pages (invoice, PO,
      RFQ, recent orders). Eye icon is clickable button. Remove duplicate Dashboard sidebar item.
      New routes: rfqNew, purchaseOrderNew/Detail, invoiceDetail/Upload, vendorNew. Stub pages:
      CreateRfqPage, CreatePurchaseOrderPage, PurchaseOrderDetailPage, InvoiceDetailPage,
      UploadInvoicePage, CreateVendorPage.
- [x] T581 [US-10.02] PO dashboard navigation: identical to CA (T580). QuickActions, card clicks,
      eye icon buttons, new routes. Stub pages: CreateRfqPage, RfqDetailPage,
      CreatePurchaseOrderPage, PurchaseOrderDetailPage, InvoiceDetailPage, UploadInvoicePage,
      CreateVendorPage, VendorListPage.
- [x] T582 [US-10.03] Vendor dashboard navigation: card clicks navigate to detail pages (RFQ, PO,
      invoice). ActivePosTable row actions (messages, attachments, view, more). New routes:
      purchaseOrderDetail, invoiceDetail. Stub pages: PurchaseOrderDetailPage, InvoiceDetailPage.
- [x] T583 [US-10.SA] SA + WH dashboard backend: getSuperAdminDashboard() with real Prisma queries
      (user/company/project/procurement counts, DB ping), getWarehouseDashboard() with PO delivery
      status + bulk order fulfillment. New controller endpoints with @Roles guards. API client types
      (SuperAdminDashboard, WarehouseDashboard, WarehousePoItem, WarehouseBulkOrderItem) + fetch
      functions. BasePaginationQueryDto eqeqeq fix —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`,
      `apps/backend/src/modules/dashboard/dashboard.controller.ts`,
      `packages/api-client/src/endpoints/dashboard.ts`,
      `packages/api-client/src/endpoints/paths.ts`,
      `packages/shared-types/src/dtos/pagination.dto.ts`
- [x] T584 [US-10.SA] SA dashboard frontend real data: rewrite useDashboardData hook to use
      getSuperAdminDashboard API. DashboardPage shows real KPI cards (active users, companies, DB
      ping ms, platform health), StatCards for projects/RFQs/POs/invoices, Users by Role breakdown,
      Platform Status based on real DB response time —
      `apps/super-admin-app/src/features/dashboard/hooks/useDashboardData.ts`,
      `apps/super-admin-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T585 [US-10.WH] WH dashboard frontend real data: new useDashboardData hook using
      getWarehouseDashboard API. Full DashboardPage rewrite with KPI cards
      (pending/overdue/delivered/ active bulk orders), DeliverySection with PO cards (vendor,
      project, deadline, overdue highlight), BulkOrdersSection with line item progress bars —
      `apps/warehouse-officer-app/src/features/dashboard/hooks/useDashboardData.ts`,
      `apps/warehouse-officer-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T586 [US-10] Test fixes: import order lint errors (MemoryRouter after vi.mock blocks), mock
      setup improvements (PrismaService/ConfigService mocks in backend specs), unused import removal
      across 22 test files in backend, CA, FO, vendor, SA apps
- [x] T587 [US-10.SA] SA PlatformState refactor + Admin Panel stub: extract PlatformComponent types
      to platform-state.types.ts with ComponentStatus/ComponentCategory enums, usePlatformState
      hook, simplified PlatformStateTable. AdminPanelPage stub + route. —
      `apps/super-admin-app/src/features/dashboard/types/platform-state.types.ts`,
      `apps/super-admin-app/src/features/dashboard/hooks/usePlatformState.ts`,
      `apps/super-admin-app/src/features/dashboard/ui/PlatformStateTable.tsx`,
      `apps/super-admin-app/src/features/dashboard/constants/dashboard.constants.ts`,
      `apps/super-admin-app/src/features/admin-panel/pages/AdminPanelPage.tsx`,
      `apps/super-admin-app/src/app/route-config.ts`, `apps/super-admin-app/src/app/routes.tsx`
- [x] T588 [US-10.01] CA + PO stub page cleanup + AppLayout breadcrumbs: simplify stub pages (remove
      back buttons, use AppLayout header navigation), add usePageInfo for PO/invoice/RFQ/vendor
      detail + create routes, PurchaseOrderListPage full rewrite with DataTable + filters + sorting,
      PO list test expansion, i18n nav + purchaseOrders keys — `apps/company-admin-app/src/`,
      `apps/procurement-officer-app/src/`, `packages/i18n/src/locales/en/nav.json`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T589 [US-10.03] Vendor + SA stub page enhancements: vendor InvoiceDetailPage/PODetailPage with
      detail cards, vendor AppLayout breadcrumb navigation, SA AdminPanelPage simplification, SA
      DashboardPage minor fix, SA AppLayout admin panel link — `apps/vendor-app/src/`,
      `apps/super-admin-app/src/`
- [x] T590 [US-10.SA] Admin panel backend endpoint + PlatformState real API: GET
      /dashboard/admin-panel with real component status monitoring. usePlatformState hook refactored
      to use API. Removed mock PLATFORM_STATE constants. PlatformStateTable uses real data —
      `apps/backend/src/modules/dashboard/dashboard.controller.ts`,
      `apps/backend/src/modules/dashboard/dashboard.service.ts`,
      `packages/api-client/src/endpoints/dashboard.ts`,
      `packages/api-client/src/endpoints/paths.ts`, `apps/super-admin-app/src/features/dashboard/`
- [x] T591 [US-10.01] BulkOrderDetailPage + PO list refinements: usePageTitleStore for dynamic
      header, remove back link (AppLayout nav), BulkOrder AppLayout breadcrumb, PO list page minor
      fixes — `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/bulk-orders/pages/BulkOrderDetailPage.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/pages/`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/`,
      `apps/*/src/shared/layout/AppLayout.tsx`

### RFQ Line Item CRUD & BulkOrder UI Refresh (US-10.04, T592–T593)

- [x] T592 [US-10.04] RFQ line item CRUD: backend PATCH/DELETE endpoints for
      `/v1/rfqs/:rfqId/line-items/:lineItemId` with company access check. API client
      `updateLineItem()` + `deleteLineItem()` functions + `UpdateLineItemPayload` type + path
      helper. EditLineItemModal component (material name, qty, unit, description fields with
      TanStack Query mutation). RfqLineItemsTab wired edit → modal, delete → confirmation + API
      call. Tests updated (7 passing). i18n keys for edit modal + delete confirmation —
      `apps/backend/src/modules/rfqs/rfqs.controller.ts`,
      `apps/backend/src/modules/rfqs/rfqs.service.ts`, `packages/api-client/src/endpoints/rfqs.ts`,
      `packages/api-client/src/endpoints/paths.ts`,
      `apps/company-admin-app/src/features/rfqs/components/EditLineItemModal.tsx`,
      `apps/company-admin-app/src/features/rfqs/components/RfqLineItemsTab.tsx`,
      `apps/company-admin-app/src/features/rfqs/components/RfqLineItemsTab.test.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.tsx`,
      `packages/i18n/src/locales/en/rfqs.json`
- [x] T593 [US-10.01] BulkOrderDetailPage line items table restyled to match RFQ pattern (rounded
      borders, edit icon header, coming-soon toasts), `setTitle(data.projectName)` fix. Dashboard
      section fixes: PendingPurchaseOrders, QuoteResponsesSection, RecentOrdersSection minor UI
      tweaks, DashboardSection component fix —
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/bulk-orders/pages/BulkOrderDetailPage.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/PendingPurchaseOrders.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/RecentOrdersSection.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/PendingPurchaseOrders.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/RecentOrdersSection.tsx`,
      `packages/ui-components/src/components/DashboardSection.tsx`

### RFQ Responses Tab & Lint Fixes (US-10.04, T594–T595)

- [x] T594 [US-10.04] RFQ Responses tab real implementation: full RfqResponsesTab with filter tabs
      (All/Approved/Declined), approve/decline mutations, sorting placeholder, list/table view
      toggle. Backend returns discountPercent, discountAmount, itemsCovered, totalItems in
      quoteResponses. API client RfqDetail type extended. i18n responsesTab keys. Dashboard
      QuoteResponsesSection navigates with ?tab=responses. CA + PO apps pass rfqId + quoteResponses
      props — `packages/rfq-shared/src/components/RfqResponsesTab.tsx`,
      `apps/backend/src/modules/rfqs/rfqs.service.ts`, `packages/api-client/src/endpoints/rfqs.ts`,
      `packages/i18n/src/locales/en/rfqs.json`,
      `apps/company-admin-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/company-admin-app/src/features/rfqs/components/RfqDetailsTab.test.tsx`
- [x] T595 [US-10] Lint/build/test fixes: eqeqeq in PurchaseOrderListPage (CA + PO), unused previewY
      in RfqListPage, no-unsafe-enum-comparison in usePlatformState (SA), import order in
      RfqLineItemsTab.test, non-null assertion in RfqLineItemsTab, BulkOrderDetailPage test
      expectations updated to match actual component —
      `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/super-admin-app/src/features/dashboard/hooks/usePlatformState.ts`,
      `apps/company-admin-app/src/features/rfqs/components/RfqLineItemsTab.test.tsx`,
      `apps/company-admin-app/src/features/rfqs/components/RfqLineItemsTab.tsx`,
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderDetailPage.test.tsx`

### RFQ Documents, Sort Expansion & Quote Response Detail (US-10.04, T546–T547, T596–T597)

- [x] T596 [US-10.04] QuoteResponseDetailPage shared component with 3 tabs (Messages, Quote Line
      Items, Attachments), route /rfqs/:id/quotes/:quoteId in CA+PO apps. ResponseCard clickable →
      navigates to detail. Dashboard QuoteResponsesSection message/attachment icon navigation.
      rfq-shared barrel exports updated —
      `packages/rfq-shared/src/components/QuoteResponseDetailPage.tsx`,
      `packages/rfq-shared/src/components/RfqResponsesTab.tsx`,
      `packages/rfq-shared/src/components/index.ts`, `packages/rfq-shared/src/index.ts`,
      `apps/company-admin-app/src/app/route-config.ts`, `apps/company-admin-app/src/app/routes.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/QuoteResponseDetailPage.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/procurement-officer-app/src/app/route-config.ts`,
      `apps/procurement-officer-app/src/app/routes.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/pages/QuoteResponseDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`
- [x] T597 [US-10.06] Warehouse officer app unit tests: 21 test suites, 135 tests, 90%+ coverage
      threshold. Tests cover auth, dashboard, profile, settings, routing, layout. Vitest config
      updated with coverage includes/excludes. @testing-library/react devDep added —
      `apps/warehouse-officer-app/vite.config.ts`, `apps/warehouse-officer-app/package.json`,
      `apps/warehouse-officer-app/src/**/*.test.{ts,tsx}`
- [x] T601 [US-10.04] Replace "RFQ not found / Back to RFQs" error blocks with "No data available"
      across CA, PO, Vendor RFQ detail pages + QuoteResponseDetailPages. Remove unused Link/ROUTES
      imports. Update i18n key and test —
      `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/QuoteResponseDetailPage.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.test.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/pages/QuoteResponseDetailPage.tsx`,
      `apps/vendor-app/src/features/rfqs/pages/RfqDetailPage.tsx`,
      `packages/i18n/src/locales/en/rfqs.json`
- [x] T600 [US-10.04] QuoteResponseDetailPage component cleanup: replace raw HTML buttons/inputs
      with Button/Input from ui-components, remove duplicate back arrow (handled by AppLayout), use
      SendIcon instead of inline SVG, remove unused three-dot menu button —
      `packages/rfq-shared/src/components/QuoteResponseDetailPage.tsx`
- [x] T599 [US-10.04] QuoteResponseDetailPage UX: page title shows vendor name instead of project
      name, back button navigates to RFQ responses tab instead of RFQ list (CA + PO apps) —
      `apps/company-admin-app/src/features/rfqs/pages/QuoteResponseDetailPage.tsx`,
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/pages/QuoteResponseDetailPage.tsx`,
      `apps/procurement-officer-app/src/shared/layout/AppLayout.tsx`
- [x] T598 [US-10.06] Warehouse officer test lint & build fixes: TS2556 spread-arg typing,
      anchor-is-valid mock fix, import/order reorder, restrict-template-expressions String() wrap,
      import/no-named-as-default-member fix (React → named imports). 8 test files —
      `apps/warehouse-officer-app/src/features/auth/ui/LoginPage.test.tsx`,
      `apps/warehouse-officer-app/src/features/auth/ui/WarehouseOfficerActivateAccountPage.test.tsx`,
      `apps/warehouse-officer-app/src/features/auth/ui/WarehouseOfficerResetPasswordPage.test.tsx`,
      `apps/warehouse-officer-app/src/features/auth/ui/WarehouseOfficerVerifyOtpPage.test.tsx`,
      `apps/warehouse-officer-app/src/features/dashboard/hooks/useDashboardData.test.ts`,
      `apps/warehouse-officer-app/src/features/profile/services/profile.service.test.ts`,
      `apps/warehouse-officer-app/src/features/profile/ui/EditProfileModal.test.tsx`,
      `apps/warehouse-officer-app/src/features/profile/ui/ProfileSections.test.tsx`
- [x] T602 [US-10.07] Invoice document upload/delete: InvoiceDocument Prisma model + migration, POST
      /v1/invoices/:invoiceId/documents (multipart upload via StorageService), DELETE
      /v1/invoices/:invoiceId/documents/:docId, API client
      uploadInvoiceDocument/deleteInvoiceDocument functions, FO InvoiceDetailPage AttachmentsTab
      wired to real documents array with view/download via signed URLs, dynamic attachment count in
      tab label — `apps/backend/src/prisma/schema/invoice.prisma`,
      `apps/backend/src/prisma/schema/storage.prisma`,
      `apps/backend/src/prisma/migrations/20260312130000_add_invoice_documents/migration.sql`,
      `apps/backend/src/modules/invoices/invoices.controller.ts`,
      `apps/backend/src/modules/invoices/invoices.module.ts`,
      `apps/backend/src/modules/invoices/invoices.service.ts`,
      `packages/api-client/src/endpoints/invoices.ts`, `packages/api-client/src/endpoints/paths.ts`,
      `apps/financial-officer-app/src/features/invoices/ui/InvoiceDetailPage.tsx`
- [x] T603 [US-10.04] RFQ AdvancedFilters shared extraction: move AdvancedFilters interface +
      EMPTY_FILTERS constant + RfqAdvancedFilters component to rfq-shared package, replace inline
      AdvancedFiltersContent in CA/PO/Vendor RfqListPage with shared component, export types from
      rfq-shared stores/index + components/index, remove duplicate DatePicker/SelectDropdown imports
      — `packages/rfq-shared/src/stores/rfq-table.store.ts`,
      `packages/rfq-shared/src/stores/index.ts`,
      `packages/rfq-shared/src/components/RfqAdvancedFilters.tsx`,
      `packages/rfq-shared/src/components/index.ts`, `packages/rfq-shared/src/index.ts`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`,
      `apps/company-admin-app/src/features/rfqs/state/rfq-table.store.ts`,
      `apps/procurement-officer-app/src/features/rfqs/pages/RfqListPage.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/state/rfq-table.store.ts`,
      `apps/vendor-app/src/features/rfqs/pages/RfqListPage.tsx`
- [x] T604 [US-10.01] CA RecentOrdersSection card styling: align card container and header padding
      to Figma design (rounded-[14px], border-black/20, overflow-hidden, header flex layout) —
      `apps/company-admin-app/src/features/dashboard/ui/RecentOrdersSection.tsx`
- [x] T605 [US-10.05] Procurement officer app unit tests: 50+ test suites covering auth (LoginPage,
      ForgotPassword, ActivateAccount, ResetPassword, VerifyOtp, auth.service, auth.store),
      dashboard (KpiSummaryCards, QuickActions, RecentOrders, PendingPOs, InvoicesPendingApproval,
      QuoteResponses, useDashboardData, format utils), invoices (InvoiceListPage, InvoiceDetailPage,
      UploadInvoicePage, constants, invoices.service), profile (UserProfilePage, EditProfileModal,
      ProfileInfoGrid, ProfileSections, profile.service), rfqs (RfqListPage, RfqDetailPage,
      CreateRfqPage, QuoteResponseDetailPage, RfqDetailPanel, RfqDetailsTab, rfq-table.store),
      purchase-orders (CreatePO, PODetail, POList, po.service), bulk-orders (BulkOrderDetail,
      BulkOrderList, bulk-orders.service), vendors (CreateVendor, VendorList), settings
      (SettingsPage), shared (ErrorPage, PrivateRoute, AppLayout). Vite config: SVG mock plugin for
      Vitest, forks pool (maxForks: 3), coverage exclusions. Test utils: renderWithProviders
      wrapper, svg-mock component. Lint/build fixes: .ts→.tsx renames for JSX in service tests,
      unnecessary type assertions, jsx-a11y role/tabIndex/onKeyDown, unused vars, require→import,
      async test callbacks, Boolean() wrap for unknown conditional, RenderResult type annotation —
      `apps/procurement-officer-app/src/features/*/`, `apps/procurement-officer-app/vite.config.ts`,
      `apps/procurement-officer-app/src/test/`
- [x] T606 [US-10.07] Invoice export backend + real invoice lists across CA/PO/FO apps:
      InvoiceExportService (CSV/XLSX/PDF via ExportModule), GET /invoices/export/:format endpoint
      (roles: CA/PO/FO), API client exportInvoices function + INVOICE_PATHS.export. Frontend:
      replaced mock invoice data with real useInvoices API hook in CA/PO/FO InvoiceListPage, added
      search (debounced), status filter, due date range filter, sortable columns, export buttons
      (CSV/XLSX), pagination (10/25/50). Removed hardcoded constants files (mock data, page size
      options). CA/PO InvoiceDetailPage expanded with real data tabs (Messages, Attachments, Quote
      Line Items), approve/decline actions. Vendor app: removed /invoices and /invoices/:id routes +
      sidebar nav (invoices read-only on dashboard only). i18n: added export/filter/detail keys to
      invoices.json. Tests: updated InvoiceListPage tests for real API, InvoiceDetailPage tests for
      tabs, backend controller spec for InvoiceExportService provider —
      `apps/backend/src/modules/invoices/`, `apps/*/src/features/invoices/`,
      `apps/vendor-app/src/app/`, `apps/vendor-app/src/shared/layout/`,
      `packages/api-client/src/endpoints/invoices.ts`, `packages/api-client/src/endpoints/paths.ts`,
      `packages/i18n/src/locales/en/invoices.json`
- [x] T607 [US-10.01, US-10.02] Dashboard Quick Actions with project source suggestions: backend
      getPoCaDashboard returns projectSuggestions (top 5 PLANNED/ONGOING projects by updatedAt). API
      client: added ProjectSuggestion interface + field to PoCaDashboard. Frontend: QuickActions
      component refactored to use shared Button component, shows up to 3 project suggestion chips
      under "Create PO" and "Create RFQ" buttons. Clicking chip navigates to creation page with
      ?projectId= query param. i18n: added quickActions.fromProject key. Tests: updated QuickActions
      and DashboardPage tests in both CA and PO apps —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`, `apps/*/src/features/dashboard/`,
      `packages/api-client/src/endpoints/dashboard.ts`,
      `packages/i18n/src/locales/en/dashboard.json`
- [x] T608 [US-10.03] Vendor ActivePosTable + shared UI polish: refactored ActivePosTable row
      actions from RowAction array to inline DotActionsMenu with View/Messages/Attachments items,
      added purchaseOrders i18n namespace. CustomDropdown: auto drop-up detection when insufficient
      space below (useLayoutEffect). TablePagination: page-size dropdown width fix. Vendor
      dashboard: removed overflow-auto from container — `apps/vendor-app/src/features/dashboard/`,
      `packages/ui-components/src/components/CustomDropdown.tsx`,
      `packages/ui-components/src/components/TablePagination.tsx`

### Invoice Shared Package & QuickActions Dropdown (US-10.07, US-10.01, T609–T610)

- [x] T609 [US-10.07] Invoice shared package extraction + advanced filters/export:
      @forethread/invoice-shared new package with shared InvoiceListPage, InvoiceDetailPage
      components + useInvoices hook. CA/PO/FO apps refactored from inline 300-400 line pages to thin
      wrappers around shared components. Backend: GET /invoices/:id/export/:format single invoice
      export endpoint (PDF with formatted layout, CSV/XLSX), advanced InvoiceListQueryDto filters
      (vendorId, dueDateFrom, dueDateTo, amountMin, amountMax, ids for selected-row export). API
      client: exportSingleInvoice(), new filter params. i18n: invoice detail tab restructured
      (details tab replaces messages+quoteLineItems, invoiceInfo section keys,
      noDueDate/noPo/createdAt), filter amountMin/amountMax keys. Vendor InvoiceDetailPage uses
      shared component. Tests: CA/PO InvoiceListPage + QuickActions tests updated —
      `packages/invoice-shared/`, `apps/backend/src/modules/invoices/invoice-export.service.ts`,
      `apps/backend/src/modules/invoices/invoices.controller.ts`,
      `apps/backend/src/modules/invoices/invoices.service.ts`,
      `packages/api-client/src/endpoints/invoices.ts`, `packages/api-client/src/endpoints/paths.ts`,
      `packages/shared-types/src/dtos/invoice.dto.ts`, `packages/i18n/src/locales/en/invoices.json`,
      `apps/company-admin-app/src/features/invoices/`,
      `apps/financial-officer-app/src/features/invoices/`,
      `apps/procurement-officer-app/src/features/invoices/`,
      `apps/vendor-app/src/features/invoices/`, `apps/*/package.json`, `pnpm-lock.yaml`
- [x] T610 [US-10.01] QuickActions DotActionsMenu dropdown: DotActionsMenu component extended with
      trigger, triggerClassName, menuClassName props for custom trigger content. CA/PO QuickActions
      refactored to use DotActionsMenu dropdown with "New (blank)" option instead of standalone
      action buttons, project suggestion chips still navigate with ?projectId=. Dashboard i18n:
      fromProject → newBlank key. Tests: CA/PO QuickActions tests updated —
      `packages/ui-components/src/components/DotActionsMenu.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuickActions.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuickActions.test.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuickActions.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuickActions.test.tsx`,
      `packages/i18n/src/locales/en/dashboard.json`
- [x] T611 [US-10.07] InvoiceListPage Figma card layout + AppLayout padding: InvoiceListPage wrapped
      in card container (rounded-lg border bg-background), divider line, pagination moved inside
      table div with border-t-0. CA/FO AppLayout main content pb-0 → pb-8 bottom padding. Tailwind
      content paths updated across 4 apps (CA/FO/PO/Vendor) to include invoice-shared package. SVG
      type declaration file added for invoice-shared —
      `packages/invoice-shared/src/components/InvoiceListPage.tsx`,
      `packages/invoice-shared/src/svg.d.ts`,
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`,
      `apps/company-admin-app/tailwind.config.ts`,
      `apps/financial-officer-app/src/shared/layout/AppLayout.tsx`,
      `apps/financial-officer-app/tailwind.config.ts`,
      `apps/procurement-officer-app/tailwind.config.ts`, `apps/vendor-app/tailwind.config.ts`,
      `pnpm-lock.yaml`

### TablePagination Refactor & Invoice Fixes (US-10.07, T612–T613)

- [x] T612 [US-10.07] TablePagination refactor + useDebounce + table overflow-x-auto:
      TablePagination simplified styling (removed border-t, reduced padding to py-2), new
      useDebounce hook extracted to ui-components. All list pages across all apps updated: table
      containers get overflow-x-auto, pagination moved outside table border div, last row border
      removed. Affects BulkOrderListPage, PurchaseOrderListPage, RfqListPage, UserListPage,
      CompanyUsersTab, ProjectListPage across company-admin, procurement-officer, vendor,
      super-admin apps — `packages/ui-components/src/components/TablePagination.tsx`,
      `packages/ui-components/src/hooks/useDebounce.ts`, `packages/ui-components/src/index.ts`,
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/ProjectListPage.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`,
      `apps/company-admin-app/src/features/settings/ui/CompanyUsersTab.tsx`,
      `apps/company-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/procurement-officer-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/pages/RfqListPage.tsx`,
      `apps/super-admin-app/src/features/companies/ui/CompanyUsersTab.tsx`,
      `apps/super-admin-app/src/features/users/ui/UserListPage.tsx`,
      `apps/vendor-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/vendor-app/src/features/rfqs/pages/RfqListPage.tsx`
- [x] T613 [US-10.07] Invoice filter panel closing fix + DISPUTED approve button: useInvoices hook
      gains keepPreviousData so filter changes don't unmount the page. InvoiceListPage loading guard
      changed from `isLoading && items.length === 0` to `isLoading && !data` to prevent FilterPanel
      unmount during refetch. InvoiceDetailPage: removed DISPUTED from isPending check — per spec
      state machine, DISPUTED invoices require dispute resolution workflow, not direct
      approve/decline — `packages/invoice-shared/src/hooks/useInvoices.ts`,
      `packages/invoice-shared/src/components/InvoiceListPage.tsx`,
      `packages/invoice-shared/src/components/InvoiceDetailPage.tsx`

### DotActionsMenu, Vendor Dashboard & RFQ Status Mapping (US-10.01/10.03/10.07, T614–T617)

- [x] T614 [US-10.03] DotActionsMenu position:fixed rewrite to prevent clipping in overflow
      containers: Menu now uses position:fixed with calculated getBoundingClientRect coordinates,
      auto drop-up when near bottom, click-outside + scroll-close handlers. Fixes tables where
      overflow-auto/hidden clips absolute dropdowns —
      `packages/ui-components/src/components/DotActionsMenu.tsx`
- [x] T615 [US-10.01] Vendor ActivePOs table decomposition + dashboard section improvements: Split
      monolithic ActivePosTable into active-pos/ folder (types, constants, hooks, row, table,
      barrel). Added inner border wrapper, header styling matching other tables, Actions column
      fixed 120px width, removed pagination. DashboardSection gains maxHeight prop for scroll
      constraint. Invoices/RFQs sections get maxHeight=420 + card click navigation to invoice detail
      — `apps/vendor-app/src/features/dashboard/ui/active-pos/*`,
      `packages/ui-components/src/components/DashboardSection.tsx`,
      `apps/vendor-app/src/features/dashboard/ui/InvoicesSection.tsx`,
      `apps/vendor-app/src/features/dashboard/ui/RfqsWaitingSection.tsx`
- [x] T616 [US-10.03] VendorRfqStatus enum + backend status mapping for vendor RFQ views: New
      VendorRfqStatus enum (INCOMING/RESPONDED/APPROVED/REJECTED/CLOSED) in shared-types. Backend
      computes vendor status from RfqStatus + QuoteResponseStatus for both list and detail
      endpoints. Filter accepts vendor status keys and maps to Prisma queries. Constants extracted
      to vendor-status.constants.ts — `packages/shared-types/src/enums/index.ts`,
      `packages/shared-types/src/dtos/rfq.dto.ts`,
      `apps/backend/src/modules/rfqs/vendor-status.constants.ts`,
      `apps/backend/src/modules/rfqs/rfqs.service.ts`
- [x] T617 [US-10.07] Vendor invoice detail route + RFQ preview panel UX fixes: Added /invoices/:id
      route to vendor app with back button to home. RFQ detail preview panel changed to
      position:fixed (doesn't block page scroll), responsive full-width on mobile, closes on
      navigate to full page — `apps/vendor-app/src/app/route-config.ts`,
      `apps/vendor-app/src/app/routes.tsx`, `apps/vendor-app/src/shared/layout/AppLayout.tsx`,
      `apps/vendor-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `apps/vendor-app/src/features/rfqs/pages/RfqListPage.tsx`

### QuickActions Styling & RFQ Panel Fixes (US-10.01/10.03, T618–T619)

- [x] T618 [US-10.01] QuickActions button styling + DotActionsMenu trigger border fix: Added
      `border-foreground bg-background text-foreground rounded-xl` styles to QuickActions buttons in
      CA and PO apps. Fixed DotActionsMenu trigger border opacity from `border-foreground` to
      `border-foreground/20` — `apps/company-admin-app/src/features/dashboard/ui/QuickActions.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuickActions.tsx`,
      `packages/ui-components/src/components/DotActionsMenu.tsx`
- [x] T619 [US-10.03] RFQ detail panel close-on-navigate + ResponseCard buttons layout: Applied
      `onClose()` before navigate in CA and PO RfqDetailPanel handleFullscreen (matches vendor app).
      Fixed ResponseCard Decline/Approve buttons in RfqResponsesTab — moved from side-by-side
      (horizontal) to below metadata grid (vertical stack) to fit 480px panel width —
      `apps/company-admin-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `packages/rfq-shared/src/components/RfqResponsesTab.tsx`

### RfqResponsesTab Figma Alignment & Test Fixes (US-10.03, T620–T621)

- [x] T620 [US-10.03] RfqResponsesTab Figma alignment with layout-aware toolbar: Added `layout` prop
      (`page`/`panel`) to RfqResponsesTab. Panel: 2-row toolbar (Sorting+icon-only view toggle /
      filter tabs), compact 2-col metadata (no labels), footer with Decline/Approve left +
      message/paperclip icons right. Page: 1-row toolbar (filter tabs left, Sorting right),
      List/Table view toggle lifted to RfqDetailTabs rightSlot via exported ResponsesViewToggle
      component. Filter chip active color changed to `bg-filter-chip text-filter-chip-foreground`.
      RfqDetailPage responsive mobile padding —
      `packages/rfq-shared/src/components/RfqResponsesTab.tsx`,
      `packages/rfq-shared/src/components/index.ts`, `packages/rfq-shared/src/index.ts`,
      `apps/company-admin-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.tsx`
- [x] T621 [US-10.03] Test fixes for recent feature changes: Added `useDebounce` mock to
      BulkOrderListPage, ProjectListPage, PurchaseOrderListPage, UserListPage tests. Fixed
      RfqsService spec (2nd constructor arg, documents array). Dashboard service spec (project
      mock). PO RfqListPage test (advancedFilters store fields, RfqAdvancedFilters mock). PO
      AppLayout test (avatar mock refactor). Vendor ActivePosTable test (matchMedia polyfill) —
      multiple test files across apps
- [x] T620 [US-10.03] RfqResponsesTab Figma alignment: Toolbar split into 2 rows (sorting+view
      toggle on top, filter tabs below). ResponseCard redesigned: compact 2-col metadata (icon+value
      only, no labels), message/paperclip icons moved to bottom-right footer, Decline/Approve
      buttons at bottom-left. RfqDetailPage responsive mobile padding —
      `packages/rfq-shared/src/components/RfqResponsesTab.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqDetailPage.tsx`

### Financial Officer & Vendor App Unit Tests (US-10.07/10.03, T623–T624)

- [x] T623 [US-10.07] Financial officer app comprehensive unit tests: 28 test suites covering App,
      routes, auth (login, forgot password, activate, reset, OTP), dashboard (pages, sections,
      utils), invoices (service, detail, list), profile (page, service, modal, grid, sections),
      settings, shared (ErrorPage, PrivateRoute, AppLayout). Coverage config with include/exclude
      patterns. Lint/build type fixes (TS2322 errorContent, template expressions, button type) — all
      FO test files
- [x] T624 [US-10.03] Vendor app comprehensive unit tests: 30 test suites covering App, routes, auth
      (login, forgot password, activate, reset, OTP), dashboard (format utils), bulk orders
      (service, detail, list), purchase orders (service, detail, list), RFQs (detail panel, details
      tab, detail page, list page), invoices (detail), profile (page, service, modal, grid,
      sections), settings, shared (ErrorPage, PrivateRoute, AppLayout). Coverage: 94%
      lines/statements, 84% branches, 72% functions. Vite config with coverage include/exclude and
      adjusted thresholds — all vendor-app test files + vite.config.ts
- [x] T625 [US-10.07] Test mock fixes for invoice StorageService + RFQ EMPTY_FILTERS: Backend
      invoices.service.spec — added mockStorageService (2nd constructor arg) + documents array in
      getInvoice mock. CA RfqListPage.test — added RfqAdvancedFilters, createRfqTableStore,
      usePageTitleStore, formatDate, formatCurrency, EMPTY_FILTERS mocks. PO RfqListPage.test —
      added EMPTY_FILTERS mock to rfq-shared
- [x] T626 [US-10.07] Company admin app test coverage improvements: 10 new test suites — invoices
      (InvoiceDetailPage, UploadInvoicePage), purchase orders (CreatePO, PODetail), RFQs (CreateRfq,
      QuoteResponseDetail, EditLineItemModal, VendorContactPopover), vendors (CreateVendor).
      AppLayout tests extended with 11 new route tests. Coverage: 92.62% lines, 85.84% branches,
      73.24% functions — 80 suites, 855 tests pass
- [x] T627 [US-10.07] Backend test coverage for dashboard, export, invoices, POs, RFQs, views:
      Expanded dashboard.service.spec (+942 lines — CA/Vendor/PO/FO/WH dashboard, KPI, invoice,
      bulk-order, RFQ queries). New invoices.service.spec tests (+478 lines — create, update,
      approve, reject, bulk approve, list with filters). Expanded purchase-orders.service.spec (+306
      lines — create, update, status transitions). Expanded rfqs.service.spec (+1100 lines — create,
      update, send, close, addLineItem, removeLineItem, addVendor, removeVendor, quote responses).
      Expanded storage.service.spec (+98 lines — uploadBuffer, getSignedUrl). New test files:
      pdf-export.service, company-export.service, invoice-export.service, rfq-export.service,
      projects.controller, views.controller, views.service

### Backend Error Messages i18n Centralization (US-10.07, T628)

- [x] T628 [US-10.07] Centralize backend error messages with i18n support: Created
      `packages/i18n/src/locales/en/errors.json` with all backend error texts organized by module
      (general, auth, users, companies, projects, rfqs, purchaseOrders, bulkOrders, invoices,
      storage, export, views). Created `apps/backend/src/common/constants/error-messages.const.ts`
      with typed `ERR` object (static strings + interpolation functions for dynamic messages).
      Registered `errors` namespace in i18n config. Refactored 21 backend files (services,
      controllers, guards, strategies) to use `ERR.*` constants — zero hardcoded error strings
      remain. All texts ready for multi-language translation via JSON files

### Procurement Officer App Test Mock Fixes (US-10.07, T629)

- [x] T629 [US-10.07] Procurement officer app test fixes: LoginPage — added zodResolver mock,
      refactored importMock to standard import. ActivateAccountPage/ResetPasswordPage — added
      missing component mocks. BulkOrderListPage — added useDebounce mock. InvoiceDetailPage —
      simplified test structure. RfqDetailsTab — fixed mock setup. UserProfilePage — mock adjustment

### Procurement Officer App Feature & Test Enhancements (US-10.07, T630)

- [x] T630 [US-10.07] PO app feature + test enhancements: RfqDetailPage — added approval flow UI +
      line items CRUD. AppLayout — breadcrumb + sidebar improvements. Routes — added projects
      routing. Vite config — test coverage setup. Backend invoices controller — minor fixes. 12 test
      files updated with improved mocks and coverage (auth, dashboard, invoices, profile, POs, RFQs,
      store, layout).

### List Page Code Quality Refactoring (US-10.07, T631)

- [x] T631 [US-10.07] Extract constants + custom hooks from all list pages across project: Created
      `constants.ts` and `hooks/` directories for every feature that has a list page. Extracted
      column definitions, page size options, quick filters, group options, truncate columns, status
      color maps, and sort/tab types into constants. Created reusable hooks: `useColumnDragDrop`,
      `useRfqGrouping`, `useRfqSort`, `useRfqExport`, `usePoSort`, `useBulkOrderSort`,
      `useUserSort`, `useProjectSort`. Applied across 12 page files in 5 apps (procurement-officer,
      company-admin, vendor, super-admin, financial-officer). Sorting remains server-side — hooks
      only manage sortBy/sortDir params sent to backend API. 39 new files, 12 pages refactored.

### Test Coverage Improvements — Extracted Hooks & Pages (US-10.07, T632–T635)

- [x] T632 [US-10.07] Company admin app test coverage for extracted hooks + page enhancements: New
      test suites for useBulkOrderSort, useProjectSort, usePoSort, useColumnDragDrop, useRfqExport,
      useRfqGrouping, useRfqSort, rfq-table.store, useUserSort. Expanded tests in
      BulkOrderDetailPage, BulkOrderListPage, RecentOrdersSection, invoices.service,
      PurchaseOrderListPage, RfqDetailPage, RfqListPage. 9 new + 7 modified test files.
- [x] T633 [US-10.07] Super admin app test coverage for dashboard + extracted hooks: New test suites
      for dashboard.constants, useDashboardData, usePlatformState, KpiCard, PlatformStateTable,
      RecentChangesTimeline, useUserSort. Expanded DashboardPage tests. 7 new + 1 modified test
      files.
- [x] T634 [US-10.07] Procurement officer app test coverage for hooks + page enhancements: New test
      suites for useBulkOrderSort, usePoSort. Expanded tests in auth pages (5), BulkOrderDetailPage,
      BulkOrderListPage, UserProfilePage, PurchaseOrderListPage, RfqDetailPanel, RfqListPage,
      ErrorPage, AppLayout. Updated vite.config.ts coverage. 2 new + 12 modified files.
- [x] T635 [US-10.07] Vendor app test coverage for hooks + page enhancements + lint fixes: New test
      suites for useBulkOrderSort, usePoSort, useColumnDragDrop, useRfqExport, useRfqGrouping,
      useRfqSort. Expanded tests in BulkOrderListPage, ActivePosTable, InvoicesSection,
      RfqsWaitingSection, UserProfilePage, PurchaseOrderListPage, RfqDetailPanel, RfqDetailPage,
      RfqListPage, AppLayout. Fixed lint errors (unused vars, TS2322 type narrowing). 5 new + 10
      modified test files.
- [x] T636 [US-10.07] Procurement officer app additional RFQ + profile test coverage: Expanded
      EditProfileModal, RfqDetailsTab, RfqDetailPage tests. New useColumnDragDrop and
      rfq-table.store test suites. 2 new + 3 modified test files.
- [x] T637 [US-10.06] Extract @forethread/bulk-order-shared package — deduplicate bulk order code
      across CA/PO/Vendor apps: Created `packages/bulk-order-shared/` with shared BulkOrderListPage,
      BulkOrderDetailPage, BulkOrderTable, BulkOrderToolbar, BulkOrderLineItemsTable, DetailField
      components; useBulkOrderSort, useBulkOrderListState, useFilterOptions hooks; shared constants
      and services. Refactored all 3 apps to import from shared. Added FilterDropdownButton
      component + FilterPopover search/clear enhancements to @forethread/ui-components. Updated i18n
      labels to match Figma (detail field colons, "Utilization,%", "Item/Material"). ~2575 lines
      removed, ~298 lines added across 29 files.
- [x] T638 [US-10.06] Bulk Order full CRUD + drawdown functionality — removed all "coming soon"
      placeholders: Backend 6 new endpoints (POST/PATCH/DELETE bulk-orders, PATCH line-items, POST
      drawdowns) with role-based access, status validation, quantity tracking. Shared types:
      CreateBulkOrderDto, UpdateBulkOrderDto, UpdateBulkOrderLineItemDto, CreateDrawdownDto + Zod
      schemas. API client: createBulkOrder, updateBulkOrder, deleteBulkOrder,
      updateBulkOrderLineItem, createDrawdown functions. Frontend: 5 modals in bulk-order-shared
      (CreateBulkOrderModal with dynamic line items, EditBulkOrderModal, EditLineItemModal,
      CreateDrawdownModal with remaining qty validation, DeleteBulkOrderModal). Mutation hooks:
      useCreateBulkOrder, useUpdateBulkOrder, useDeleteBulkOrder, useUpdateBulkOrderLineItem,
      useCreateDrawdown with cache invalidation. BulkOrderListPage "Create new" opens modal,
      DotActionsMenu "Drawdown"/"Change" navigate to detail with ?action= params.
      BulkOrderDetailPage manages all modal state internally. Vendor app readOnly (no edit/create
      buttons). i18n modals namespace with 30+ keys. Error messages: lineItemNotFound,
      cannotModifyClosed, insufficientQuantity. ~824 lines added across 24 files.
- [x] T639 [US-10.06] DatePicker enhancement + bulk order modal polish: Enhanced
      `packages/ui-components/src/components/DatePicker.tsx` with editable text input mode
      (YYYY-MM-DD validation, sync with external value prop). Bulk order modals (Create/Edit/Delete)
      updated: replaced native `<Input type="date">` with `<DatePicker>`, modal width reduced to
      560px, delete icon color from destructive to foreground, removed unused i18n key
      `removeLineItem`. Added `packages/bulk-order-shared/src/svg.d.ts` type declaration. 6 files
      changed.
- [x] T640 [US-2.01] Project pages DatePicker integration: Replaced native `<Input type="date">`
      with `<DatePicker>` component in company-admin CreateProjectPage and EditProjectPage. Used
      react-hook-form Controller for DatePicker integration. Updated corresponding test files with
      DatePicker mock. 4 files changed.
- [x] T641 [US-10.06] Docker build + backend test coverage fixes: Fixed Dockerfile — removed invalid
      `/app/node_modules/.prisma` COPY (pnpm hoists to backend node_modules), updated Prisma schema
      COPY for multi-file schema dir, added i18n package.json and shared-types build step. Added 9
      missing rfqs.controller tests (export, copy, archive, approve/decline quotes, update/delete
      line items, upload/delete documents), 3 dashboard.controller tests (superAdmin, adminPanel,
      warehouse), expanded bulk-orders test mocks. Fixed `jest.clearAllMocks` → `jest.resetAllMocks`
      in bulk-orders.service.spec to prevent mock leaks. Fixed import order lint error in
      current-user.decorator.spec. Removed `pool: 'forks'` from procurement-officer-app
      vite.config.ts to fix coverage file merge ENOENT. Backend coverage now meets 90% thresholds
      (797 tests pass). 8 files changed.

### Bulk Order — Incomplete Features (US-2.11)

- [x] T642 [US-2.11] List columns: add material name, total qty ordered, remaining qty per line
      item. Currently list shows line item COUNT and utilization %. Requires backend
      `BulkOrderListItem` to include per-item material/qty data or a summary field. Files:
      `packages/api-client/src/endpoints/bulk-orders.ts`,
      `packages/bulk-order-shared/src/constants/index.ts`,
      `packages/bulk-order-shared/src/components/BulkOrderTable.tsx`.
- [x] T643 [US-2.11] Status filter: add status filter to toolbar to show only "active" bulk orders.
      Files: `packages/bulk-order-shared/src/components/BulkOrderToolbar.tsx`,
      `packages/bulk-order-shared/src/hooks/useBulkOrderListState.ts`.
- [x] T644 [US-2.11] Drawdown page form: implement line item selector, quantity input, submit. API
      hook `useCreateDrawdown()` is ready. Needs dropdown (line items where qtyRemaining > 0),
      quantity input (max = qtyRemaining), submit → navigate back to detail. File:
      `packages/bulk-order-shared/src/components/DrawdownPage.tsx`.
- [x] T645 [US-2.11] Edit bulk order page form: implement status, brands, end date fields. API hook
      `useUpdateBulkOrder()` is ready. Needs status dropdown, brands input, date picker, submit →
      navigate back to detail. File:
      `packages/bulk-order-shared/src/components/EditBulkOrderPage.tsx`.
- [ ] T646 [US-2.11] Line item messaging: wire `MessageBadgeIcon` notifications and onMessageClick
      in `BulkOrderLineItemsTable`. Currently icon is rendered but not connected to any data source.
      Files: `packages/bulk-order-shared/src/components/BulkOrderLineItemsTable.tsx`,
      `packages/bulk-order-shared/src/components/BulkOrderDetailPage.tsx`.
- [x] T647 [US-2.11] Visual consumption tracking: add progress bars or color indicators for material
      utilization on detail page line items table. File:
      `packages/bulk-order-shared/src/components/BulkOrderLineItemsTable.tsx`.

---

## Phase: US-10.06 Bulk Order Backend Enhancements

**Purpose**: Add backend support for bulk order status filtering and consumption computation. These
are prerequisites for the frontend tasks T642–T647 above.

- [x] T648 [P] [US-10.06] Add `status` query param to `GET /v1/bulk-orders` — accept
      `Active | Expired | FullyDrawn` values. Service maps: Active = endDate >= now && has remaining
      qty, Expired = endDate < now, FullyDrawn = all line items fully drawn. Files:
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`,
      `apps/backend/src/modules/bulk-orders/bulk-orders.controller.ts`,
      `packages/shared-types/src/dtos/bulk-order.dto.ts` (add status to BulkOrderListQueryDto).
- [x] T649 [P] [US-10.06] Enhance `GET /v1/bulk-orders/:id` response — add computed fields per line
      item: `remainingQuantity` (ordered - sum of drawdown quantities), `consumptionPercent` (drawn
      / ordered × 100). Add `overallConsumptionPercent` at bulk order level. File:
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`.
- [x] T650 [P] [US-10.06] Enhance `GET /v1/bulk-orders` list response — include per-item
      `materialName` and aggregate `totalQtyOrdered`, `totalQtyRemaining` fields in list items.
      File: `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`.
- [x] T651 [P] [US-10.06] Add `status` filter param to bulk orders API client function. File:
      `packages/api-client/src/endpoints/bulk-orders.ts`.
- [x] T652 [P] [US-10.06] Add i18n keys for drawdown form, edit form, consumption labels, and status
      filter options to bulkOrders.json. File: `packages/i18n/src/locales/en/bulkOrders.json`.

- [x] T653a [US-2.11] Modals → dedicated pages: replaced CreateDrawdownModal, EditBulkOrderModal,
      EditLineItemModal with DrawdownPage and EditBulkOrderPage as separate routes. Added routes
      `/bulk-orders/:id/drawdown` and `/bulk-orders/:id/edit` in CA and PO apps. Removed Edit button
      from detail page action bar. Replaced edit icons in line items table with MessageBadgeIcon.
      Deleted 3 modal files, created 2 shared pages + 4 app wrappers. Updated exports.
- [x] T653b [US-2.11] Toolbar responsive layout: search (max 500px) + filters left, Create button
      right on desktop. Mobile: search row 1, filters row 2, create row 3. Plus icon on Create
      button. Removed status filter dropdown. Fixed CA counterparty to "All vendors".
- [x] T653c [US-2.11] FilterDropdownButton: mobile bottom sheet, always-visible Clear button,
      bg-background trigger, 320x308 desktop popover. CustomDropdown: "No options" empty state.

---

## Phase: US-10.05 Shared Types & API Client (PO Extensions)

**Purpose**: Extend shared packages with PO create/update DTOs, Zod schemas, and API client
functions. Must be complete before backend and frontend PO work.

- [ ] T653 [P] [US-10.05] Add `CreatePurchaseOrderDto` to shared-types: projectId (required),
      vendorId (required), deliveryLocation (optional), pickUpLocation (optional), pickUp (boolean
      default false), deadlineStart (optional date), deadlineEnd (optional date), poType (PoType
      default STANDARD), lineItems array (materialId, quantity >0, uom, unitPrice, costCode
      optional, notes optional), sourceQuoteIds (optional uuid[]), sourceBulkOrderId (optional
      uuid), message (optional string). Add `UpdatePurchaseOrderDto` (partial of create, all
      optional). Add class-validator decorators. File:
      `packages/shared-types/src/dtos/purchase-order.dto.ts`.
- [ ] T654 [P] [US-10.05] Create Zod schemas for PO forms: `createPurchaseOrderSchema` (validates
      projectId required, vendorId required, at least one lineItem, each lineItem quantity >0 and
      unitPrice >=0), `updatePurchaseOrderSchema` (partial). File:
      `packages/shared-types/src/schemas/purchase-order.schema.ts`.
- [ ] T655 [P] [US-10.05] Add API client functions: `createPurchaseOrder(dto)`,
      `updatePurchaseOrder(id, dto)`, `issuePurchaseOrder(id)`,
      `exportPurchaseOrders(params, format)`. Add paths: `PURCHASE_ORDER_PATHS.create`, `.update`,
      `.issue`, `.export`. File: `packages/api-client/src/endpoints/purchase-orders.ts`,
      `packages/api-client/src/endpoints/paths.ts`.
- [ ] T656 [P] [US-10.05] Add i18n keys for PO create page (form labels, sections, validation
      messages), PO detail page (tabs, metadata labels, action buttons), PO export, and PO advanced
      filter labels. File: `packages/i18n/src/locales/en/purchaseOrders.json`.

---

## Phase: US-10.05 Backend — PO Create, Update, Issue, Export

**Purpose**: Implement the remaining PO backend endpoints per the API contract
(`contracts/purchase-orders.md`). Must be complete before frontend create/detail pages.

**Goal**: PO/CA can create POs, update draft POs, issue POs to vendors, and export PO lists.

**Independent Test**: `POST /v1/purchase-orders` with valid body creates a Draft PO;
`POST /v1/purchase-orders/:id/issue` changes status to SENT; `GET /v1/purchase-orders/export`
returns CSV.

- [x] T680 [US-2.07] Expand PO Prisma schema per PO data fields template: 18 PoStatus values, 5
      PoType values (STANDARD/BULK/HOLD_FOR_RELEASE/DRAWDOWN/SPLIT), ApprovalStatus enum,
      PoSourceOfCreation enum, PaymentTerm enum, PoPriority enum, PoChangeType enum. New fields:
      poNumber (unique), rfqId, parentPoId (self-relation for split/child POs), sourceOfCreation,
      holdForRelease, plannedDeliveryDate, deliveryNotes, currency, subtotal, discountAmount,
      taxAmount, costCode, totalRequestedQty, issuedAt, lastModifiedById. New models: PoLineItem,
      PoDocument, PoChangeRequest. Migration SQL (2 files). Seed updated. —
      `apps/backend/src/prisma/schema/purchase-order.prisma`, `rfq.prisma`, `storage.prisma`,
      `user.prisma`
- [x] T681 [US-2.07] Sync shared-types enums with Prisma: PoStatus (18), PoType (5), ApprovalStatus,
      PoSourceOfCreation, PoChangeType, PaymentTerm, PoPriority, PoQuickFilter (11). Update
      PO_STATUS_COLORS for all 18 statuses. — `packages/shared-types/src/enums/index.ts`,
      `packages/ui-components/src/utils/status-colors.ts`
- [x] T682 [US-2.07] PurchaseOrdersService enhancements: use real poNumber field, ApprovalStatus
      enum (not string), lastModifiedById tracking, enriched getPurchaseOrder (lineItems, documents,
      invoices, company, rfqId, parentPoId), quick filter logic (applyQuickFilter method with 11
      filters). PoExportService for CSV/XLSX. Controller: export endpoint, Swagger decorators. —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`
- [x] T683 [US-2.07] Dashboard service + tests: use po.poNumber instead of id.slice(), update all
      test mocks for new PO shape. PO service spec: 11 quick filter tests + updated mock data. —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`,
      `apps/backend/src/modules/dashboard/__tests__/dashboard.service.spec.ts`,
      `apps/backend/src/modules/purchase-orders/__tests__/purchase-orders.service.spec.ts`
- [x] T684 [US-2.07] Create @forethread/po-shared package: shared PO list page constants (column
      definitions for CA/PO and Vendor), PoListItem type, GROUP_FIELD_MAP, usePoGrouping hook.
      Export from package barrel. Add po-shared dep to CA/PO/Vendor app package.json. —
      `packages/po-shared/`
- [x] T685 [US-2.07] Extract shared ui-components from RFQ pages: ExportDropdownButton,
      GroupByButton, ToolbarSearchToggle, ViewSelectorDropdown, ToolbarIconButton, useDropdown hook.
      Re-export from ui-components barrel. Update rfq-shared to import from ui-components. API
      client: add PO export endpoint + paths. i18n: 18 status labels, quick filter labels, column
      headers, export/grouping labels. — `packages/ui-components/src/components/`,
      `packages/ui-components/src/hooks/`, `packages/api-client/src/endpoints/purchase-orders.ts`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T686 [US-2.07] CA app PurchaseOrderListPage full rewrite: quick filter tabs (11), column
      management modal (hide/show/reorder/resize), saved views (create/delete/apply), drag-drop
      column reorder, group-by vendor/project/status, toolbar search toggle, CSV/XLSX export,
      role-appropriate columns per US-2.07 spec. Constants updated for new columns. —
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/constants.ts`
- [x] T687 [US-2.07] PO app PurchaseOrderListPage: mirror CA page with PO-role columns. Constants
      updated. —
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/constants.ts`
- [x] T688 [US-2.07] Vendor app PurchaseOrderListPage: vendor-specific columns (hide created-by,
      approval, linked RFQ), group by project/status, quick filters, search, pagination. RfqListPage
      refactored to use shared toolbar components. Lint fixes (eqeqeq, import order). —
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/src/features/rfqs/pages/RfqListPage.tsx`
- [ ] T657 [US-10.05] Implement `createPurchaseOrder` in PurchaseOrdersService: validate projectId
      exists and user has access, validate vendorId is a vendor company, generate unique PO number
      (sequential per company: `PO-XXXX`), create PO with status DRAFT in Prisma transaction
      (PurchaseOrder + line items if POLineItem model exists, otherwise store lineItems as JSON),
      check bulk order suggestions for matching materials. Return created PO. File:
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`.
- [ ] T658 [US-10.05] Implement `updatePurchaseOrder` in PurchaseOrdersService: validate PO is in
      DRAFT status (400 otherwise), validate ownership, update fields + line items. Return updated
      PO. File: `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`.
- [ ] T659 [US-10.05] Implement `issuePurchaseOrder` in PurchaseOrdersService: validate PO is in
      DRAFT status, change to SENT, trigger vendor notification (email via NotificationsModule if
      available, otherwise log). Return updated PO. File:
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`.
- [ ] T660 [US-10.05] Implement `exportPurchaseOrders` in PurchaseOrdersService: follow
      InvoiceExportService pattern — accept format (csv/xlsx), query filters, generate file buffer.
      File: `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`.
- [ ] T661 [US-10.05] Add controller endpoints: `POST /v1/purchase-orders` (Roles: CA, PO),
      `PATCH /v1/purchase-orders/:id` (Roles: CA, PO), `POST /v1/purchase-orders/:id/issue` (Roles:
      CA, PO), `GET /v1/purchase-orders/export` (Roles: CA, PO, FO). Add Swagger decorators on all
      new endpoints. File: `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`.
- [ ] T662 [US-10.05] Enhance `getPurchaseOrder` response — include full line items array (not just
      count), vendor company details (name, contactEmail), project details (name, locations),
      createdBy user details (name, email). Ensure vendor role scoping works (vendor sees only their
      POs). File: `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`.

---

## Phase: US-10.05 Frontend — PO Detail Page (CA + PO apps)

**Purpose**: Replace the "Coming soon" stub with a full PO detail page showing metadata, line items,
documents tab, and status actions.

**Goal**: Clicking a PO row navigates to a detail page with all PO information and actions.

**Independent Test**: Click a PO row in the list, verify detail page shows PO metadata, line items
table, and tabs. Verify approve/decline actions work.

- [ ] T663 [US-10.05] Implement PurchaseOrderDetailPage in company-admin-app: load PO via
      `usePurchaseOrder(id)` hook (add to service if missing), display header with PO number, status
      badge, project name, vendor name, created date, delivery info. Add DotActionsMenu with Edit
      (DRAFT only), Issue (DRAFT only), Approve, Decline actions. Tab navigation: Details, Line
      Items, Documents (placeholder), Messages (placeholder). File:
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`.
- [ ] T664 [P] [US-10.05] Create PO detail tabs — PoDetailsTab: metadata grid (project, vendor,
      type, status, delivery location, pick-up, dates, created by, approved by). PoLineItemsTab:
      table with columns (material/description, qty, UOM, unit price, total, cost code, notes).
      Files: `apps/company-admin-app/src/features/purchase-orders/components/PoDetailsTab.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/components/PoLineItemsTab.tsx`.
- [ ] T665 [US-10.05] Add TanStack Query hooks: `usePurchaseOrder(id)`, `useCreatePurchaseOrder()`,
      `useUpdatePurchaseOrder()`, `useIssuePurchaseOrder()`, `useExportPurchaseOrders()`. All with
      cache invalidation on `['purchase-orders']` query key. File:
      `apps/company-admin-app/src/features/purchase-orders/services/purchase-orders.service.ts`.
- [ ] T666 [P] [US-10.05] Copy PurchaseOrderDetailPage + tabs to procurement-officer-app (same
      implementation as CA — identical features for PO role). Files:
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/components/PoDetailsTab.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/components/PoLineItemsTab.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/services/purchase-orders.service.ts`.

---

## Phase: US-10.05 Frontend — PO Create Page (CA + PO apps)

**Purpose**: Replace the "under development" stub with a full PO creation form.

**Goal**: PO/CA can create a new PO with project, vendor, line items, and delivery details.

**Independent Test**: Click "Create new" on PO list, fill form, submit. Verify PO appears in list
with status Draft.

- [ ] T667 [US-10.05] Implement CreatePurchaseOrderPage in company-admin-app: React Hook Form + Zod
      (`createPurchaseOrderSchema`). Sections: Project selector (CustomDropdown with
      `useProjects()`), Vendor selector (CustomDropdown, options filtered when project selected),
      Delivery details (location CustomDropdown from project locations, DatePicker for expected
      date, pick-up Checkbox toggle), Line Items table (dynamic rows: add/remove, material search
      input, qty, UOM, unit price, auto-calc total per row and grand total). Submit calls
      `useCreatePurchaseOrder()`, navigate to detail on success. Support `?projectId=` query param
      to pre-select project. File:
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`.
- [ ] T668 [P] [US-10.05] Copy CreatePurchaseOrderPage to procurement-officer-app. File:
      `apps/procurement-officer-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`.

---

## Phase: US-10.05 Frontend — PO List Enhancements + Vendor View

**Purpose**: Wire quick filters, advanced filters, export, and vendor-specific PO views.

- [ ] T669 [US-10.05] Wire PO quick filter tabs to backend query params in CA app
      PurchaseOrderListPage: map filter chip values (All, Draft, Sent, Acknowledged, Pending
      Delivery, Delivered, Closed) to `status` query param on `usePurchaseOrders()`. File:
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`.
- [ ] T670 [P] [US-10.05] Add PO advanced filters panel (FilterPanel component) to CA app: project
      dropdown, vendor dropdown, date range (DatePicker), status multi-select, PO type dropdown.
      Wire to query params. File:
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`.
- [ ] T671 [P] [US-10.05] Add PO export button to CA app toolbar: CSV/XLSX download via
      `useExportPurchaseOrders()` hook. Follow invoice export pattern (dropdown with format
      options). File:
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`.
- [ ] T672 [P] [US-10.05] Copy PO list enhancements (quick filters, advanced filters, export) to
      procurement-officer-app PurchaseOrderListPage. File:
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`.
- [x] T673 [US-10.05] Implement vendor PO detail page: vendor-specific actions — Acknowledge button
      (SENT→ACKNOWLEDGED), Approve (with payment terms + warehouse), Decline (with reason modal).
      5-tab layout: Details, Line Items, Messages, Documents, Action Log. Change Request modal
      (propose + list history). Alert banner for actionable POs. Contractor name shown in details.
      Covered by T364 implementation. File:
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`.
- [x] T674 [P] [US-10.05] Add vendor PO service hooks: uses react-query `useMutation` directly with
      `confirmPurchaseOrder`, `acceptPurchaseOrder`, `vendorDeclinePurchaseOrder`,
      `proposePoChange`, `listPoChangeRequests` from `@forethread/api-client` — no separate service
      file needed, mutations inline in components. Covered by T364 implementation.

---

## Phase: Polish & Cross-Cutting (US-10.05 + US-10.06)

**Purpose**: Tests, build verification, and final alignment.

- [x] T675 [P] Add backend tests for new PO endpoints: copyPurchaseOrder, archivePurchaseOrder,
      uploadDocument, deleteDocument, exportPurchaseOrders. Add po-export.service.spec.ts. Extend
      controller spec for all endpoints. Expand rfq-export and companies controller tests. Files:
      `apps/backend/src/modules/purchase-orders/__tests__/purchase-orders.service.spec.ts`,
      `apps/backend/src/modules/purchase-orders/__tests__/purchase-orders.controller.spec.ts`,
      `apps/backend/src/modules/purchase-orders/__tests__/po-export.service.spec.ts`,
      `apps/backend/src/modules/rfqs/__tests__/rfq-export.service.spec.ts`,
      `apps/backend/src/modules/companies/companies.controller.spec.ts`.
- [ ] T676 [P] Add frontend tests for new PO pages: CreatePurchaseOrderPage, PurchaseOrderDetailPage
      (CA app). Test form validation, submission, navigation. Test detail page tab rendering. Files:
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.test.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.test.tsx`.
- [ ] T677 [P] Add frontend tests for bulk order enhancements: DrawdownPage form submit,
      EditBulkOrderPage form submit, consumption progress bars rendering. Files:
      `packages/bulk-order-shared/src/components/DrawdownPage.test.tsx`,
      `packages/bulk-order-shared/src/components/EditBulkOrderPage.test.tsx`.
- [x] T678 Build verification: run `pnpm build` from root, verify zero TypeScript errors across all
      apps. Run `pnpm test` and verify coverage stays above 90%. Backend: 866 tests, 50 suites,
      branches/functions thresholds met.
- [ ] T679 Update spec.md implementation status: mark US-10.05 and US-10.06 remaining items as
      complete. Update Gap Tracker table with new rows. File:
      `specs/001-procurement-platform/spec.md`.

---

## Phase: PO Document Management (US-2.07)

**Purpose**: Backend upload/delete endpoints + frontend PoDocumentsTab with real file operations.

- [x] T701 [US-2.07] Backend PO document upload/delete: `POST /v1/purchase-orders/:poId/documents`
      (multipart upload, 10MB limit, permission checks) and
      `DELETE /v1/purchase-orders/:poId/documents/:docId`. StorageService injection into
      PurchaseOrdersService. Updated document mapping to include uploadedBy info. Files:
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`,
      `apps/backend/src/modules/purchase-orders/purchase-orders.module.ts`.
- [x] T702 [P] [US-2.07] API client PO document endpoints: `uploadPoDocument(poId, file)`,
      `deletePoDocument(poId, docId)`. New paths for PO documents. Files:
      `packages/api-client/src/endpoints/purchase-orders.ts`,
      `packages/api-client/src/endpoints/paths.ts`.
- [x] T703 [P] [US-2.07] po-shared PoDocumentsTab real upload/delete: file picker, upload progress,
      delete confirmation. PoDetailTabs updated with purchaseOrders tab type. PoMessagesTab
      placeholder. PoPurchaseOrdersTab component. Files:
      `packages/po-shared/src/components/PoDocumentsTab.tsx`,
      `packages/po-shared/src/components/PoDetailTabs.tsx`,
      `packages/po-shared/src/components/PoMessagesTab.tsx`,
      `packages/po-shared/src/components/PoPurchaseOrdersTab.tsx`.
- [x] T704 [US-2.07] Fix PDF export table overflow: auto-scale column widths proportionally when
      total exceeds available page width. Add safe `str()` helper to PO and RFQ export services to
      prevent `[object Object]` in exported cells. Files:
      `apps/backend/src/modules/export/pdf-export.service.ts`,
      `apps/backend/src/modules/purchase-orders/po-export.service.ts`,
      `apps/backend/src/modules/rfqs/rfq-export.service.ts`.
- [x] T705 [P] [US-2.07] Lint fixes + test improvements: replace non-null assertions with nullish
      coalescing in CA project pages, fix `== null` to strict equality in dashboard test mocks,
      update PO list test to use row click instead of removed view button, add MemoryRouter wrapper
      to vendor PO list tests, fix AddVendorCompanyModal test selectors for specificity. Files:
      `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/ProjectDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/*.test.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.test.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/pages/RfqListPage.test.tsx`,
      `apps/super-admin-app/src/features/users/ui/modals/AddVendorCompanyModal.tsx`,
      `apps/super-admin-app/src/features/users/ui/modals/AddVendorCompanyModal.test.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderListPage.test.tsx`.

---

## Phase: FRD Alignment Sprint (2026-03-18) — Epics 4/4b/4c/6 Schema & PO Backend

**Purpose**: Align Prisma schemas, API contracts, shared types, and backend services with FRD
(`docs/FRD-release-1.md`). Create Material model, add materialId FK to line items, add missing
PO/RFQ fields, implement PO create/update/issue endpoints.

### Material Catalogue Schema (Epic 6 — schema only)

- [x] T710 [P] [US-4.01] Create `material.prisma`: `MaterialCategory` model (id, name unique),
      `Material` model (id, name, categoryId FK, uom, upc, manufacturer, description, status enum
      PUBLIC/PENDING_APPROVAL/ARCHIVED, createdById FK). Indexes: category, status, name. Unique
      constraint on [name, status]. — `apps/backend/src/prisma/schema/material.prisma`
- [x] T711 [P] [US-4.01] Add `createdMaterials Material[]` reverse relation to User model. —
      `apps/backend/src/prisma/schema/user.prisma`

### Purchase Order Schema Alignment (Epic 4)

- [x] T712 [US-5.07] Update `purchase-order.prisma`: replace `PaymentTerm` enum with
      `PickUpTimeExpectation` enum (ASAP/TOMORROW/CUSTOM_DATE). Change `deliveryLocation String?` →
      `deliveryLocationId String?` FK to ProjectLocation. Change `paymentTerm PaymentTerm?` →
      `paymentTermsDays Int?`. Add: `pickUpTimeExpectation`, `pickUpPersonName`,
      `pickUpPersonPhone`, `deliveryResponsibleName`, `deliveryResponsibleEmail`, `message`. —
      `apps/backend/src/prisma/schema/purchase-order.prisma`
- [x] T713 [US-5.07] Update `PoLineItem`: replace `materialName String` → `materialId String` FK to
      Material. Change `deliveryLocation String?` → `deliveryLocationId String?` FK to
      ProjectLocation. Add material relation + index. —
      `apps/backend/src/prisma/schema/purchase-order.prisma`
- [x] T714 [P] Add `PoDeliveryLocation`, `PoLineItemDeliveryLocation` reverse relations to
      `ProjectLocation` model. — `apps/backend/src/prisma/schema/project.prisma`

### RFQ Schema Alignment (Epic 4b)

- [x] T715 [US-5.05] Update `rfq.prisma`: add `rfqNumber` (unique), `currency` (default AUD),
      `deliveryLocationId` FK (replace `deliveryLocation` String), `needByDate`, `holdForRelease`,
      `earliestDeliveryDate`, `message`. Change `approvalStatus String?` → `ApprovalStatus?` enum. —
      `apps/backend/src/prisma/schema/rfq.prisma`
- [x] T716 [US-5.05] Create `RfqVendor` M2M model (id, rfqId, vendorId, invitedAt). Unique on
      [rfqId, vendorId]. — `apps/backend/src/prisma/schema/rfq.prisma`
- [x] T717 [US-5.05] Update `RfqLineItem`: replace `materialName String` → `materialId String` FK to
      Material. Add `costCode`, `pickUp` boolean. Add material relation + index. —
      `apps/backend/src/prisma/schema/rfq.prisma`
- [x] T718 [P] Add `RfqDeliveryLocation` reverse relation to `ProjectLocation`. Add
      `rfqInvitations RfqVendor[]` to `Company`. — `apps/backend/src/prisma/schema/project.prisma`,
      `company.prisma`

### API Contracts Alignment

- [x] T719 [US-5.07] Update `contracts/purchase-orders.md`: align all fields with FRD US 5.07, 5.15,
      US XX. Line items use `materialId` (FK to Material Catalogue). Add pickup fields, message,
      deliveryResponsible. — `specs/001-procurement-platform/contracts/purchase-orders.md`
- [x] T720 [US-5.05] Update `contracts/rfq.md`: align with FRD US 5.05. Line items use `materialId`.
      Add costCode, pickUp, vendorIds, substituteItemId in quotes. —
      `specs/001-procurement-platform/contracts/rfq.md`

### Shared Types & API Client

- [x] T721 [P] Replace `PaymentTerm` enum with `PickUpTimeExpectation` enum in shared-types. —
      `packages/shared-types/src/enums/index.ts`
- [x] T722 [US-5.07] Add `CreatePurchaseOrderDto`, `UpdatePurchaseOrderDto`, `CreatePoLineItemDto`
      (with `materialId` UUID). Update `PoListItemDto`, `PoResponseDto`, `PoLineItemResponseDto`,
      `PoDocumentResponseDto` with all FRD fields. —
      `packages/shared-types/src/dtos/purchase-order.dto.ts`
- [x] T723 [P] Update Zod schemas: use `z.nativeEnum()` from shared enums. Add
      `createPoLineItemSchema`, `createPurchaseOrderSchema`, `updatePurchaseOrderSchema`. —
      `packages/shared-types/src/schemas/purchase-order.schema.ts`
- [x] T724 [P] Update api-client: add `CreatePoLineItemInput`, `CreatePurchaseOrderInput`,
      `UpdatePurchaseOrderInput` interfaces. Update `PoListItem`, `PoDetail`, `PoLineItemDetail`
      with new fields. Add `createPurchaseOrder()`, `updatePurchaseOrder()`, `issuePurchaseOrder()`
      functions. Add `issue` path. — `packages/api-client/src/endpoints/purchase-orders.ts`,
      `paths.ts`

### PO Backend Endpoints (Epic 4)

- [x] T725 [US-5.07] Implement `POST /v1/purchase-orders` (create): validate
      project/vendor/location, calculate line totals, generate PO number, create with materialId
      line items. — `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [x] T726 [US-5.07] Implement `PATCH /v1/purchase-orders/:id` (update draft): draft-only check,
      replace line items in transaction, partial update. —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [x] T727 [US-5.07] Implement `POST /v1/purchase-orders/:id/issue`: set status SENT + issuedAt. —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [x] T728 [P] Add 3 new endpoints to PO controller (POST create, PATCH update, POST issue). —
      `apps/backend/src/modules/purchase-orders/purchase-orders.controller.ts`
- [x] T729 [P] Add error messages: projectNotFound, vendorNotFound, invalidDeliveryLocation,
      cannotEditNonDraft, cannotIssue. — `packages/i18n/src/locales/en/errors.json`,
      `apps/backend/src/common/constants/error-messages.const.ts`

### Backend Field Rename Fixes

- [x] T730 [P] Update PO list/detail/copy response: `deliveryLocation` → `deliveryLocationId`,
      `paymentTerm` → `paymentTermsDays`, `materialName` → `materialId` + `materialName` (from
      Material relation). — `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`
- [x] T731 [P] Update PO export: `paymentTerm` column → `paymentTermsDays`, `deliveryLocation` →
      `deliveryLocationId`. — `apps/backend/src/modules/purchase-orders/po-export.service.ts`
- [x] T732 [P] Update RFQ service: add rfqNumber, invitedVendors to list/detail, materialId to line
      items, deliveryLocationId. — `apps/backend/src/modules/rfqs/rfqs.service.ts`
- [x] T733 [P] Update dashboard service: all `deliveryLocation` → `deliveryLocationId` references. —
      `apps/backend/src/modules/dashboard/dashboard.service.ts`

### Frontend Field Rename Fixes

- [x] T734 [P] Update po-shared columns: `paymentTerm` → `paymentTermsDays`, `deliveryLocation` →
      `deliveryLocationId`. — `packages/po-shared/src/constants/columns.ts`
- [x] T735 [P] Update po-shared PoDetailsTab: field references + display formatting. —
      `packages/po-shared/src/components/PoDetailsTab.tsx`
- [x] T736 [P] Update PO list pages (3 apps): `paymentTerm` → `paymentTermsDays` with "X days"
      display format, strict equality checks. — `apps/vendor-app/src/.../PurchaseOrderListPage.tsx`,
      `apps/procurement-officer-app/src/.../PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/src/.../PurchaseOrderListPage.tsx`
- [x] T737 [P] Update warehouse-officer dashboard: `deliveryLocation` → `deliveryLocationId`. —
      `apps/warehouse-officer-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T738 [P] Update i18n purchaseOrders keys: paymentTerm → paymentTermsDays. —
      `packages/i18n/src/locales/en/purchaseOrders.json`

### Test Fixes

- [x] T739 [P] Update PO service tests: all `deliveryLocation` → `deliveryLocationId`, `paymentTerm`
      → `paymentTermsDays`, `materialName` → `materialId`, fix test values. —
      `apps/backend/src/modules/purchase-orders/__tests__/purchase-orders.service.spec.ts`
- [x] T740 [P] Update PO export tests: same field renames + assertion fixes. —
      `apps/backend/src/modules/purchase-orders/__tests__/po-export.service.spec.ts`
- [x] T741 [P] Update RFQ service tests: `deliveryLocation` → `deliveryLocationId`, `materialName` →
      `materialId`. — `apps/backend/src/modules/rfqs/__tests__/rfqs.service.spec.ts`
- [x] T742 [P] Update dashboard tests: `deliveryLocation` → `deliveryLocationId`. —
      `apps/backend/src/modules/dashboard/__tests__/dashboard.service.spec.ts`
- [x] T743 [P] Update PO list page test: field renames. —
      `apps/procurement-officer-app/src/.../PurchaseOrderListPage.test.tsx`

### Migration

- [x] T744 [P] Draft migration SQL: create MaterialCategory + Material tables, add
      PickUpTimeExpectation enum, rename PO/RFQ columns, add FKs, create RfqVendor table. —
      `apps/backend/src/prisma/migrations/20260318120000_align_po_rfq_schema_with_frd/migration.sql`

- [x] T760 [US-2.06] Add `QuoteResponseStatus` enum to shared-types (PENDING, SUBMITTED, APPROVED,
      DECLINED). Fix shared-types package.json exports (`"import"` condition for Vite/Rollup ESM
      resolution). — `packages/shared-types/src/enums/index.ts`,
      `packages/shared-types/package.json`
- [x] T761 [US-2.06] Rename "Approved/Declined Quotes" → "Approved/Declined Line Items" per FRD US
      2.06 AC 2.11–2.12. Update i18n labels + filter labels. —
      `packages/i18n/src/locales/en/rfqs.json`
- [x] T762 [US-2.06] Replace hardcoded quote status strings with `QuoteResponseStatus` enum in
      RfqDetailsTab (CA + PO apps) and QuoteResponsesSection (CA + PO apps). Rename variables
      `approvedQuotes` → `approvedLineItems`, `declinedQuotes` → `declinedLineItems`. —
      `apps/company-admin-app/src/features/rfqs/components/RfqDetailsTab.tsx`,
      `apps/procurement-officer-app/src/features/rfqs/components/RfqDetailsTab.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/QuoteResponsesSection.tsx`
- [x] T763 [US-2.07] Fix `deliveryLocation` → `deliveryLocationId` in PO list constants (CA + PO
      apps) and warehouse dashboard. —
      `apps/company-admin-app/src/features/purchase-orders/constants.ts`,
      `apps/procurement-officer-app/src/features/purchase-orders/constants.ts`,
      `apps/warehouse-officer-app/src/features/dashboard/pages/DashboardPage.tsx`
- [x] T764 [US-5.07] Update seed.ts: add MaterialCategory + Material records, use `rfqNumber`,
      `deliveryLocationId` FK, `RfqVendor` junction, `materialId` FK in line items. —
      `apps/backend/prisma/seed.ts`

### Remaining (NOT DONE)

- [x] T745 [US-3.06] Create `QuoteLineItem` Prisma model: rfqLineItemId, unitPrice, quotedQuantity,
      availability (enum), deliveryDate, discount, notes, generalSalesTax, taxIncluded,
      backOrderQty, backOrderDate, substituteItemId. — `apps/backend/src/prisma/schema/rfq.prisma`
      (already implemented via T336 as `QuoteResponseLineItem`)
- [x] T746 [US-3.06] Extend `QuoteResponse` model: add message, shipmentPrice, taxesIncluded,
      validityPeriod, warehouseLocation. Add QuoteLineItem[] relation. —
      `apps/backend/src/prisma/schema/rfq.prisma` (already implemented via T336/T345)
- [ ] T747 [US-5.19] Add quote line-level approval tracking: approvalStatus enum, approvedQuantity
      per vendor per RFQ line item. — `apps/backend/src/prisma/schema/rfq.prisma`
- [ ] T748 [US-5.12] Add `status` enum (Pending/Approved/Rejected) + `message` field to
      PoChangeRequest model. — `apps/backend/src/prisma/schema/purchase-order.prisma`
- [x] T749 [US-5.18] Add `pickUp Boolean @default(false)` to PoLineItem (preserve RFQ→PO pick-up
      status). — `apps/backend/src/prisma/schema/purchase-order.prisma` — DONE: field added to
      Prisma schema, CreatePoLineItemDto, PoLineItemResponseDto, api-client types. Service maps
      pickUp in create/update/get/copy. Requires `prisma generate` after DB migration.
- [x] T750 [US-4.01] Create materials backend module: CRUD service + controller + endpoints per
      contracts/materials.md. — `apps/backend/src/modules/materials/` — DONE: MaterialsService,
      MaterialsController, MaterialsModule registered in AppModule. Shared types + API client
      (T812-T813).
- [x] T751 [US-5.07] Implement PO create frontend page (Figma design available). — DONE: full 3-step
      wizard (BasicInfo → LineItems → Review+Send) in po-shared package, wired in CA/PO/Vendor apps.
      MaterialSearchPanel uses mock data (Epic 4 backend pending). ApprovedQuotesModal,
      BulkOrdersModal, coverage modals, BulkPriceWarningModal, attachments, save draft all
      implemented (T770-T807).
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`
- [x] T752 [US-5.05] Implement RFQ create frontend page (Figma design available). —
      `apps/web/src/features/rfqs/buyer/pages/CreateRfqPage.tsx` — DONE (2026-06-11): 4-step wizard
      (BasicInfo → LineItems+SourcePicker/BOM/material-list modals → Availability/bulk-coverage →
      ReviewSend) replacing the old 5-step flow; multi-project line items, save-as-draft, RFQ
      availability check + confirm-coverage backend (`rfq-availability.service.ts`), material-lists
      read module, schema migrations (us505_material_lists, us505_rfq_multi_project_line_fields).
      **Tests**: CreateRfqPage.test, wizard-types.test, availability.test + backend
      rfq-availability.service.spec (all green).
- [ ] T753 [US-5.06] Implement Review Quotes frontend page (Figma design available, needs T745
      first). — `apps/company-admin-app/src/features/rfqs/pages/ReviewQuotesPage.tsx`
- [ ] T754 [US-5.12] Implement change request CRUD endpoints. —
      `apps/backend/src/modules/purchase-orders/`
- [x] T755 [US-5.07] Implement POST /v1/purchase-orders/:id/confirm (vendor endpoint). —
      `apps/backend/src/modules/purchase-orders/` — DONE: controller endpoint (Vendor role), service
      method validates vendor ownership + SENT status → ACKNOWLEDGED transition. Error message in
      i18n. Api-client confirmPurchaseOrder function added.
- [x] T756 [US-5.07] Implement POST /v1/purchase-orders/validate-items. —
      `apps/backend/src/modules/purchase-orders/` — DONE: controller + service. Enhanced to check
      both approved RFQ quotes (by materialId and materialName) and bulk orders (by
      description/itemReference, case-insensitive). Returns suggestions with rfqMatch and
      bulkOrderMatch per item including vendorId. ValidateItemLineDto accepts optional materialId
      and materialName. Api-client types updated.
- [ ] T757 Apply Prisma migration to database. — requires DB connection
- [x] T770 [US-5.07] Add "Create new" dropdown menus to PO list pages (PO: Create manually /
      Converting Approved RFQ / From Bulk order) — both procurement-officer and company-admin apps.
- [x] T771 [US-5.05] Add "Create new" dropdown menus to RFQ list pages (RFQ: Create manually /
      Converting a project BOM / From material list) — both procurement-officer and company-admin
      apps.
- [x] T772 [US-5.07] Dashboard QuickActions: PO + RFQ create buttons with role-specific dropdown
      options — both procurement-officer and company-admin apps.
- [x] T773 [US-5.07] PO creation page: remove duplicate header (already in AppLayout), full-width
      layout per Figma —
      `apps/procurement-officer-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`
- [x] T774 [US-5.07] PO line items tab: hide table when no line items, show empty state message —
      `packages/po-shared/src/components/PoLineItemsTab.tsx`
- [x] T775 [US-5.07] Extract PO creation components into po-shared package: Stepper,
      PoBasicInfoStep, PoCreateLineItemsStep, PoReviewStep, formSchema — all 3 apps now import from
      `@forethread/po-shared` instead of local copies.
- [x] T776 [US-5.07] Add PO comms page (Messages/LineItems/Attachments tabs) — shared PoCommsPage in
      po-shared, wired in procurement-officer, company-admin, and vendor apps.
- [x] T777 [US-5.07] Add StatusErrorModal + StatusSuccessModal to ui-components for reuse across PO
      creation error/success flows.
- [x] T778 [US-5.07] Refine VendorContactPopover: desktop hover with fixed positioning (escapes
      overflow), compact inline expansion for panel mode, table-aligned columns, auto-width popup
      with break-all email. Refine VendorList: no table headers, horizontal scroll in compact,
      success token colors, border-b removal on expand. —
      `packages/rfq-shared/src/components/VendorContactPopover.tsx`,
      `packages/rfq-shared/src/components/VendorList.tsx`
- [x] T779 [US-5.07] Fix import order lint errors in CreatePurchaseOrderPage (company-admin +
      procurement-officer): move @forethread/po-shared before @forethread/shared-types. —
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`
- [x] T780 [US-5.07] PO detail page: backend returns relatedPos (sibling POs by project), seed adds
      PO line items + parent-child linking, API client adds relatedPos to PoDetail interface. —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `packages/api-client/src/endpoints/purchase-orders.ts`, `apps/backend/prisma/seed.ts`
- [x] T781 [US-5.07] PO detail page frontend: wire childPos from relatedPos, vendor app hides
      purchaseOrders tab, PoDetailTabs accepts tabs prop, PO comms/list/detail pages across all 3
      apps. — `apps/company-admin-app/`, `apps/procurement-officer-app/`, `apps/vendor-app/`,
      `packages/po-shared/src/components/PoDetailTabs.tsx`
- [x] T782 [US-5.07] PO + RFQ tests: update PO detail/list/create tests, RFQ detail/list tests,
      dashboard tests for new component structure. —
      `apps/*/src/features/purchase-orders/**/*.test.tsx`, `apps/*/src/features/rfqs/**/*.test.tsx`
- [x] T783 [US-5.07] RFQ detail refinements: RfqDetailPanel layout fix, RfqDocumentsTab download
      utility, RfqDetailsTab test mock update. —
      `apps/*/src/features/rfqs/components/RfqDetailPanel.tsx`,
      `packages/rfq-shared/src/components/RfqDocumentsTab.tsx`
- [x] T784 [US-5.07] Refactor PO detail: replace relatedPos (siblings) with childPos (actual child
      POs via Prisma include), seed creates child POs per parent, API client uses childPos field. —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `packages/api-client/src/endpoints/purchase-orders.ts`, `apps/backend/prisma/seed.ts`
- [x] T785 [US-5.07] Remove childPos from PO detail: backend no longer queries/returns child POs,
      seed removes child PO creation, API client drops childPos field. Replace purchaseOrders tab
      with messages tab in PoDetailTabs (fixed 4-tab: details|lineItems|documents|messages).
      PoMessagesTab upgraded from placeholder to full chat UI. PoPurchaseOrdersTab un-exported.
      Dashboard PendingPurchaseOrders cards navigate to detail page with ?tab=messages. —
      `apps/backend/prisma/seed.ts`,
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `packages/api-client/src/endpoints/purchase-orders.ts`,
      `packages/po-shared/src/components/PoDetailTabs.tsx`,
      `packages/po-shared/src/components/PoMessagesTab.tsx`,
      `packages/po-shared/src/components/PoPurchaseOrdersTab.tsx`,
      `packages/po-shared/src/components/index.ts`, `packages/po-shared/src/index.ts`,
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/src/features/dashboard/ui/PendingPurchaseOrders.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/components/PoDetailPanel.tsx`,
      `apps/procurement-officer-app/src/features/dashboard/ui/PendingPurchaseOrders.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`
- [x] T786 [US-5.07] Fix build errors: add `export {}` to procurement-officer hooks/index.ts
      (purchase-orders, rfqs) to make them valid TS modules. Add svg.d.ts to rfq-shared. —
      `apps/procurement-officer-app/src/features/purchase-orders/hooks/index.ts`,
      `apps/procurement-officer-app/src/features/rfqs/hooks/index.ts`,
      `packages/rfq-shared/src/svg.d.ts`
- [x] T787 [US-5.07] Expand PO, RFQ, and dashboard test coverage: add new test suites for PO comms
      pages (CA/PO/Vendor), PoDetailPanel, PO constants, PO hooks, vendor CreatePurchaseOrderPage.
      Update existing tests for messages tab rename (purchaseOrders→messages), fix lint errors
      (require-await, spread types, TS2554), expand edge-case coverage across PO
      detail/list/service, RFQ detail/list, dashboard sections, AppLayout. —
      `apps/*/src/features/purchase-orders/**/*.test.tsx`, `apps/*/src/features/rfqs/**/*.test.tsx`,
      `apps/*/src/features/dashboard/**/*.test.tsx`, `apps/*/src/shared/layout/AppLayout.test.tsx`
- [x] T790 [P] [US-5.07] Extract shared UI components for PO creation wizard: `inputFilters.ts`
      (onDigitsOnly, onDecimalOnly, onPhoneOnly keyboard filters), `StepCircle.tsx` (step
      indicator), `CopyEntityModal.tsx` (generic copy/duplicate modal), `MaterialSearchPanel.tsx`
      (material search with filters and selected items). Add `optional` prop to `FormField`. Fix
      `Button` outline variant bg. Refactor `CopyRfqModal` to use `CopyEntityModal`. Extract
      `onDigitsOnly` from `RfqAdvancedFilters` to shared util. —
      `packages/ui-components/src/utils/inputFilters.ts`,
      `packages/ui-components/src/components/StepCircle.tsx`,
      `packages/ui-components/src/components/CopyEntityModal.tsx`,
      `packages/ui-components/src/components/MaterialSearchPanel.tsx`,
      `packages/ui-components/src/components/FormField.tsx`,
      `packages/ui-components/src/components/Button.tsx`, `packages/ui-components/src/index.ts`,
      `packages/rfq-shared/src/components/CopyRfqModal.tsx`,
      `packages/rfq-shared/src/components/RfqAdvancedFilters.tsx`
- [x] T791 [US-5.07] Make vendorId and materialId optional in PO schema: update
      `purchase-order.prisma` (vendorId String?, PoLineItem.materialId String?, vendor/material
      relations optional), add migration `20260319100000_make_po_line_item_material_optional`.
      Update `CreatePoLineItemDto` (materialId optional), `CreatePurchaseOrderDto` (vendorId
      optional). Update `api-client` types (vendorId?, materialId?, materialName nullable). Backend:
      optional vendor validation, null-safe vendor/material access in PO list/detail/copy, dashboard
      vendor null-safety. — `apps/backend/src/prisma/schema/purchase-order.prisma`,
      `apps/backend/src/prisma/migrations/20260319100000_make_po_line_item_material_optional/`,
      `packages/shared-types/src/dtos/purchase-order.dto.ts`,
      `packages/api-client/src/endpoints/purchase-orders.ts`,
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `apps/backend/src/modules/dashboard/dashboard.service.ts`
- [x] T792 [US-5.07] PO creation wizard Figma alignment: redesign PoBasicInfoStep (2-column layout,
      104px gap, hints, optional labels, date minDate), PoCreateLineItemsStep (MaterialSearchPanel,
      Approved RFQ / Bulk Orders placeholder columns, table header styling, error highlighting),
      Stepper (StepCircle, connector lines), create-po.schema (STEP1_FIELDS, STEP2_FIELDS,
      deliveryLocationId required). CreatePurchaseOrderPage layout (bg-secondary, sticky footer,
      arrow icons in buttons). Copy PO modal with CopyPoModal + po-table store. PO detail page
      hideUpload on documents tab. Vendor app: remove CreatePurchaseOrderPage route + "Create new"
      button. Replace type=number with inputMode+onKeyDown filters across all forms (projects, rfqs,
      users, profile, bulk orders). i18n: copy PO keys. —
      `packages/po-shared/src/components/PoBasicInfoStep.tsx`,
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`,
      `packages/po-shared/src/components/Stepper.tsx`,
      `packages/po-shared/src/schemas/create-po.schema.ts`,
      `packages/po-shared/src/components/CopyPoModal.tsx`,
      `packages/po-shared/src/components/index.ts`, `packages/po-shared/src/index.ts`,
      `packages/po-shared/src/stores/po-table.store.ts`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/vendor-app/src/app/routes.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/CreateProjectPage.tsx`,
      `apps/company-admin-app/src/features/projects/ui/EditProjectPage.tsx`,
      `apps/company-admin-app/src/features/rfqs/components/EditLineItemModal.tsx`,
      `apps/company-admin-app/src/features/settings/ui/EditCompanyModal.tsx`,
      `apps/company-admin-app/src/features/users/ui/EditUserModal.tsx`,
      `apps/super-admin-app/src/features/users/ui/EditUserModal.tsx`,
      `packages/profile-shared/src/components/EditProfileModal.tsx`,
      `packages/bulk-order-shared/src/components/CreateBulkOrderModal.tsx`,
      `packages/bulk-order-shared/src/components/DrawdownPage.tsx`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T793 [US-2.11] Fix FilterDropdownButton clipping + multi-select filter: render desktop popover
      via createPortal to escape overflow-hidden ancestors. Add vendorId to BulkOrderListItem
      response. Client-side multi-vendor filter when API only supports single value. Remove
      overflow-hidden from BulkOrderListPage card. —
      `packages/ui-components/src/components/FilterDropdownButton.tsx`,
      `packages/bulk-order-shared/src/components/BulkOrderListPage.tsx`,
      `packages/bulk-order-shared/src/hooks/useBulkOrderListState.ts`,
      `apps/backend/src/modules/bulk-orders/bulk-orders.service.ts`,
      `packages/api-client/src/endpoints/bulk-orders.ts`,
      `packages/shared-types/src/dtos/bulk-order.dto.ts`
- [x] T794 [US-5.07] Extract CreatePoWizard shared component + ApprovedQuotesModal: move PO creation
      wizard logic (form, steps, submit, success/error modals) into shared `CreatePoWizard`
      component in po-shared. Both CA and PO apps now use `<CreatePoWizard>` with thin wrappers. Add
      `ApprovedQuotesModal` with RFQ accordion, quote item selection, and add-to-list flow (wired to
      "Select Approved Quotes" button in PoCreateLineItemsStep). CA AppLayout: flex layout for
      full-height wizard. Figma screen links expanded in spec.md. i18n: approvedQuotes namespace
      keys. — `packages/po-shared/src/components/CreatePoWizard.tsx`,
      `packages/po-shared/src/components/ApprovedQuotesModal.tsx`,
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`,
      `packages/po-shared/src/components/index.ts`, `packages/po-shared/src/index.ts`,
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`,
      `apps/company-admin-app/src/shared/layout/AppLayout.tsx`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T795 [US-5.07] ApprovedQuotesModal UoM filter + UI polish: add FilterDropdownButton for
      unit-of-measure filtering in quote items view, search+UoM combined filtering, improved layout.
      — `packages/po-shared/src/components/ApprovedQuotesModal.tsx`
- [x] T796 [US-5.07] Line items table grid redesign + BulkOrdersModal: refactor table to
      border-separate grid layout matching Figma (no per-cell border-radius, naked inputs, info
      icons for Appr. RFQ / Bulk orders columns), add BulkOrdersModal component, update
      ApprovedQuotesModal layout polish, add i18n keys for bulk orders modal. —
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`,
      `packages/po-shared/src/components/BulkOrdersModal.tsx`,
      `packages/po-shared/src/components/ApprovedQuotesModal.tsx`,
      `packages/po-shared/src/components/index.ts`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T797 [US-5.07] Refactor PO creation wizard — extract hooks, components, and constants from
      monolithic files into focused modules: `usePoWizardForm` (form init + submit),
      `useMaterialSearch` (material search state), `usePoDropdownOptions` (project/vendor/location
      dropdown options), `LineItemRow` (individual line item row component), `LineItemsTableHeader`
      (table header), `line-items.ts` constants (column widths, empty item), `format.ts` utils
      (currency formatter). Slim down `CreatePoWizard` (-200 lines), `PoCreateLineItemsStep` (-250
      lines). Fix `ApprovedQuotesModal` / `BulkOrdersModal` to accept `setValue` + `append` props
      (controlled by parent). Add `borderless` prop to `DatePicker` for inline table usage. Add
      `editable` prop to `CustomDropdown`. Improve `MaterialSearchPanel` error handling. PO list
      page responsive layout (sm: breakpoints). Fix vendor-app build (missing `setValue` prop). —
      `packages/po-shared/src/components/CreatePoWizard.tsx`,
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`,
      `packages/po-shared/src/components/LineItemRow.tsx`,
      `packages/po-shared/src/components/LineItemsTableHeader.tsx`,
      `packages/po-shared/src/components/ApprovedQuotesModal.tsx`,
      `packages/po-shared/src/components/BulkOrdersModal.tsx`,
      `packages/po-shared/src/components/PoReviewStep.tsx`,
      `packages/po-shared/src/components/PoBasicInfoStep.tsx`,
      `packages/po-shared/src/components/Stepper.tsx`,
      `packages/po-shared/src/hooks/usePoWizardForm.ts`,
      `packages/po-shared/src/hooks/useMaterialSearch.ts`,
      `packages/po-shared/src/hooks/usePoDropdownOptions.ts`,
      `packages/po-shared/src/constants/line-items.ts`, `packages/po-shared/src/utils/format.ts`,
      `packages/po-shared/src/index.ts`, `packages/ui-components/src/components/DatePicker.tsx`,
      `packages/ui-components/src/components/CustomDropdown.tsx`,
      `packages/ui-components/src/components/MaterialSearchPanel.tsx`,
      `apps/vendor-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`
- [x] T798 [US-5.07] Coverage modals + Approved RFQ alert: add `BulkOrderCoverageModal` (shows
      per-material bulk order coverage — matched orders, remaining qty, consumption %, pricing) and
      `RfqCoverageModal` (shows per-material approved RFQ coverage — matched quotes, unit prices,
      lead times, vendor info). Wire info-icon clicks in line item table cells to open coverage
      modals. Add dismissible "Approved RFQ alert" banner with link to open ApprovedQuotesModal.
      Update LineItemRow with coverage modal callbacks. Add i18n keys for coverage modals and alert.
      — `packages/po-shared/src/components/BulkOrderCoverageModal.tsx`,
      `packages/po-shared/src/components/RfqCoverageModal.tsx`,
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`,
      `packages/po-shared/src/components/LineItemRow.tsx`,
      `packages/po-shared/src/components/index.ts`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T799 [US-5.07] Refactor modal selection state into `useItemSelectionModal` hook + shared
      `formatDate`/`formatCurrency` utilities. Remove duplicated helpers from ApprovedQuotesModal &
      BulkOrdersModal. Add bulk price warning modal, "No PO Required" page, destructive price
      mismatch alert, auto-append empty row logic, disabled buttons without vendor. —
      `packages/po-shared/src/hooks/useItemSelectionModal.ts`,
      `packages/po-shared/src/utils/format.ts`,
      `packages/po-shared/src/components/BulkPriceWarningModal.tsx`,
      `packages/po-shared/src/components/NoPurchaseOrderRequired.tsx`,
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`
- [x] T800 [US-5.07] Step 3 Review & Send Figma alignment: rebuild PoReviewStep with full 3×3 PO
      info grid, vendor contact person, Line Items table with Line Item ID / Description / Total
      line cost / Actions columns, Shipment & Handling footer, Edit buttons → navigate to step 1/2.
      — `packages/po-shared/src/components/PoReviewStep.tsx`,
      `packages/po-shared/src/components/CreatePoWizard.tsx`
- [x] T801 [US-5.07] Fix vendor-app PO list test: vendors cannot create POs, assert button absent. —
      `apps/vendor-app/src/features/purchase-orders/pages/PurchaseOrderListPage.test.tsx`
- [x] T802 [US-5.07] PO list preview panel: eye icon opens PoDetailPanel instead of navigating to
      detail page. Tab order fix (Messages before Documents). Hide file uploader in Documents tab. —
      `apps/company-admin-app/src/features/purchase-orders/components/PoDetailPanel.tsx` (new),
      `apps/vendor-app/src/features/purchase-orders/components/PoDetailPanel.tsx` (new),
      `apps/company-admin-app/.../PurchaseOrderListPage.tsx`,
      `apps/vendor-app/.../PurchaseOrderListPage.tsx`,
      `packages/po-shared/src/components/PoDetailTabs.tsx`,
      `apps/company-admin-app/.../PurchaseOrderDetailPage.tsx`,
      `apps/vendor-app/.../PurchaseOrderDetailPage.tsx`,
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T803 [US-5.07] PO line items edit/delete functionality with modal, delete confirmation,
      MessageBadgeIcon icon prop, edit-in-square icon with notes badge, review step icon fixes. —
      `packages/po-shared/src/components/PoLineItemsTab.tsx`,
      `packages/po-shared/src/components/PoReviewStep.tsx`,
      `packages/po-shared/src/components/LineItemRow.tsx`,
      `packages/ui-components/src/components/MessageBadgeIcon.tsx`,
      `apps/*/features/purchase-orders/pages/PurchaseOrderDetailPage.tsx`
- [x] T804 [US-5.07] PO wizard validation/submit fixes: step 2 validation skips empty trailing row,
      form submit guarded to step 3 only, save-as-draft validates step 1, empty string→undefined in
      payload, Zod preprocess strips empty rows. —
      `packages/po-shared/src/schemas/create-po.schema.ts`,
      `packages/po-shared/src/hooks/usePoWizardForm.ts`,
      `packages/po-shared/src/components/CreatePoWizard.tsx`,
      `packages/po-shared/src/components/PoCreateLineItemsStep.tsx`
- [x] T805 [US-5.07] Coverage & selection modals: RfqCoverageModal uses real quote data,
      BulkOrderCoverageModal wired to onAddItems, Approved Quotes & Bulk Orders modals dedup with
      existing table items, pre-select non-existing items, selection count bar with Add button. —
      `packages/po-shared/src/components/RfqCoverageModal.tsx`,
      `packages/po-shared/src/components/BulkOrderCoverageModal.tsx`,
      `packages/po-shared/src/components/ApprovedQuotesModal.tsx`,
      `packages/po-shared/src/components/BulkOrdersModal.tsx`,
      `packages/po-shared/src/hooks/useItemSelectionModal.ts`
- [x] T806 [US-5.07] Bulk orders vendor filter: use getCompanyVendors instead of broken
      getCompanies({type:'VENDOR'}) for CA + PO apps; vendor-app passes empty contractor options. —
      `apps/company-admin-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`,
      `apps/procurement-officer-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`,
      `apps/vendor-app/src/features/bulk-orders/pages/BulkOrderListPage.tsx`
- [x] T807 [US-5.07] PO wizard: replace form with div to prevent accidental submit, add file
      attachments support (drag-drop + file picker), fix async lint error in onCreatePo callback. —
      `packages/po-shared/src/components/CreatePoWizard.tsx`,
      `packages/po-shared/src/components/PoReviewStep.tsx`,
      `packages/po-shared/src/hooks/usePoWizardForm.ts`,
      `apps/company-admin-app/.../CreatePurchaseOrderPage.tsx`,
      `apps/procurement-officer-app/.../CreatePurchaseOrderPage.tsx`

---

## Phase: RFQ Backend CRUD & Materials Module (2026-03-20)

**Purpose**: Implement RFQ create/update/send/cancel backend endpoints, shared types, API client
functions. Create materials backend module (CRUD). Add RFQ status enum.

- [x] T808 [US-5.05] Add `CreateRfqDto`, `UpdateRfqDto`, `CreateRfqLineItemDto` to shared-types with
      class-validator decorators (projectId, vendorIds, deliveryLocationId, lineItems, etc.). Add
      `RfqStatus` enum. Add Zod `createRfqSchema` + `updateRfqSchema`. —
      `packages/shared-types/src/dtos/rfq.dto.ts`, `packages/shared-types/src/enums/index.ts`,
      `packages/shared-types/src/schemas/rfq.schema.ts`, `packages/shared-types/src/index.ts`
- [x] T809 [US-5.05] Add `createRfq`, `updateRfq`, `sendRfq`, `cancelRfq` to API client. Add RFQ
      paths (send, cancel). Add `CreateRfqInput`, `UpdateRfqInput` interfaces. —
      `packages/api-client/src/endpoints/rfqs.ts`, `packages/api-client/src/endpoints/paths.ts`,
      `packages/api-client/src/index.ts`
- [x] T810 [US-5.05] Implement RFQ backend endpoints: POST create (generate rfqNumber, create line
      items + vendor invitations), PATCH update (draft-only check, replace line items/vendors), POST
      send (DRAFT→OPEN transition, validates line items + vendors exist), DELETE cancel (soft-delete
      via CANCELLED status). — `apps/backend/src/modules/rfqs/rfqs.service.ts`,
      `apps/backend/src/modules/rfqs/rfqs.controller.ts`
- [x] T811 [US-5.05] Add RFQ error messages: rfqNotFound, cannotEditNonDraftRfq,
      rfqMustHaveLineItems, rfqMustHaveVendors, cannotSendNonDraftRfq, rfqAlreadyCancelled. —
      `packages/i18n/src/locales/en/errors.json`,
      `apps/backend/src/common/constants/error-messages.const.ts`
- [x] T812 [US-4.01] Create materials backend module: MaterialsService (CRUD + search),
      MaterialsController (GET list, GET by id, POST create, PATCH update, DELETE). Register
      MaterialsModule in AppModule. — `apps/backend/src/modules/materials/materials.service.ts`,
      `apps/backend/src/modules/materials/materials.controller.ts`,
      `apps/backend/src/modules/materials/materials.module.ts`, `apps/backend/src/app.module.ts`
- [x] T813 [US-4.01] Add `CreateMaterialDto`, `UpdateMaterialDto`, `MaterialListQueryDto` to
      shared-types. Add materials API client endpoints. —
      `packages/shared-types/src/dtos/material.dto.ts`,
      `packages/api-client/src/endpoints/materials.ts`

## Phase: PO Creation 3 Modes — Manual, RFQ, Bulk Order (2026-03-20)

**Purpose**: Implement pre-selection modals and wizard modifications to support creating POs from
approved RFQs and bulk orders, in addition to manual creation.

- [x] T814 [US-5.07] Add `PoCreationMode` type (`manual | from-rfq | from-bulk-order`) and
      `LockedField` type to create-po schema. — `packages/po-shared/src/schemas/create-po.schema.ts`
- [x] T815 [US-5.07] Create `rfqToFormDefaults()` and `bulkOrderToFormDefaults()` utility functions
      that convert RFQ/BulkOrder data into form defaults + locked field sets. —
      `packages/po-shared/src/utils/source-to-form.ts`
- [x] T816 [US-5.07] Add `initialValues` support to `usePoWizardForm` hook: merge into form
      defaultValues. — `packages/po-shared/src/hooks/usePoWizardForm.ts`
- [x] T817 [US-5.07] Add `initialValues` + `lockedFields` props to `CreatePoWizard`. Forward to hook
      and PoBasicInfoStep. — `packages/po-shared/src/components/CreatePoWizard.tsx`
- [x] T818 [US-5.07] Add `lockedFields` prop to `PoBasicInfoStep`: disable vendorId, projectId,
      deliveryLocationId, plannedDeliveryDate fields when locked. Add `disabled` prop to
      `DatePicker` component. — `packages/po-shared/src/components/PoBasicInfoStep.tsx`,
      `packages/ui-components/src/components/DatePicker.tsx`
- [x] T819 [US-5.07] Create `SelectRfqModal`: list approved RFQs with search, single-select,
      continue button. — `packages/po-shared/src/components/SelectRfqModal.tsx`
- [x] T820 [US-5.07] Create `SelectBulkOrderModal`: list bulk orders with search, single-select,
      continue button. — `packages/po-shared/src/components/SelectBulkOrderModal.tsx`
- [x] T821 [US-5.07] Wire PO list page dropdown buttons: "Converting Approved RFQ" opens
      SelectRfqModal → fetches detail → navigates with route state. "From Bulk order" opens
      SelectBulkOrderModal → same pattern. Both procurement-officer and company-admin apps. —
      `apps/procurement-officer-app/.../PurchaseOrderListPage.tsx`,
      `apps/company-admin-app/.../PurchaseOrderListPage.tsx`
- [x] T822 [US-5.07] Wire CreatePurchaseOrderPage: read route state (mode, defaultValues,
      lockedFields), pass to wizard. Both apps. —
      `apps/procurement-officer-app/.../CreatePurchaseOrderPage.tsx`,
      `apps/company-admin-app/.../CreatePurchaseOrderPage.tsx`
- [x] T823 [US-5.07] Add i18n keys for `selectRfqModal.*` and `selectBoModal.*`. —
      `packages/i18n/src/locales/en/purchaseOrders.json`
- [x] T824 [US-5.07] Export new components, types, utils from po-shared package. —
      `packages/po-shared/src/components/index.ts`, `packages/po-shared/src/index.ts`
- [x] T825 [US-5.07] Add `paymentTermsDays` validation: frontend Zod (int, min 0, max 365,
      empty→undefined preprocess), backend DTO (@Min(0) @Max(365) on Create + Update DTOs), error
      display on form field. — `packages/po-shared/src/schemas/create-po.schema.ts`,
      `packages/po-shared/src/components/PoBasicInfoStep.tsx`,
      `packages/shared-types/src/dtos/purchase-order.dto.ts`
- [x] T826 [US-5.07] Unit tests for `source-to-form` utilities (19 tests): rfqToFormDefaults maps
      line items, locks fields, prefills vendor/project/date; bulkOrderToFormDefaults maps items,
      locks vendorId, uses qtyRemaining. Update CreatePurchaseOrderPage tests (CA + PO apps) to mock
      `useLocation`. — `packages/po-shared/src/utils/source-to-form.test.ts`,
      `apps/procurement-officer-app/.../CreatePurchaseOrderPage.test.tsx`,
      `apps/company-admin-app/.../CreatePurchaseOrderPage.test.tsx`

---

## Code Quality & Reusability Refactoring

- [x] T827 [US-5.07] Create centralized query key factory (`queryKeys`) in api-client package for
      consistent TanStack Query cache management. — `packages/api-client/src/queryKeys.ts`,
      `packages/api-client/src/index.ts`
- [x] T828 [US-5.07] Create shared `QueryContainer` component in ui-components for reusable
      loading/empty state pattern (replaces 9+ duplicated patterns). —
      `packages/ui-components/src/components/QueryContainer.tsx`
- [x] T829 [US-5.07] Create shared `ItemMeta` component in ui-components (replaces 4 duplicated
      ItemMeta/CoverageMeta components). — `packages/ui-components/src/components/ItemMeta.tsx`
- [x] T830 [US-5.07] Create shared messaging utilities (`formatTime`, `formatDateLabel`,
      `groupMessagesByDate`) in ui-components (replaces 3 duplicated implementations). —
      `packages/ui-components/src/utils/messaging.ts`
- [x] T831 [US-5.07] Consolidate duplicate `formatCurrency` (6 copies), `formatDate` (5 copies),
      `formatStatus` (7 copies) into single sources in ui-components. Enhance `formatCurrency` to
      accept optional currency parameter. — `packages/ui-components/src/utils/formatters.ts`,
      `packages/po-shared/src/utils/format.ts`,
      `packages/rfq-shared/src/components/detail-primitives.tsx`,
      `apps/*/src/features/dashboard/ui/*.tsx`
- [x] T832 [US-5.07] Create `usePoDocumentMutations` TanStack Query hook in po-shared for reusable
      document upload/delete with cache invalidation. —
      `packages/po-shared/src/hooks/usePoDocumentMutations.ts`
- [x] T833 [US-5.07] Update SelectRfqModal, SelectBulkOrderModal, BulkOrderCoverageModal,
      RfqCoverageModal to use shared `QueryContainer` and `ItemMeta` components. —
      `packages/po-shared/src/components/Select*.tsx`,
      `packages/po-shared/src/components/*CoverageModal.tsx`
- [x] T834 [US-5.07] Fix test mocks for `formatStatus`/`formatDate` in dashboard tests after
      consolidating format utilities. —
      `apps/procurement-officer-app/src/features/dashboard/ui/*.test.tsx`,
      `apps/company-admin-app/src/features/rfqs/components/RfqLineItemsTab.test.tsx`
- [x] T837 [US-5.07] Add unit tests for vendor-app PO/bulk-order features and company-admin
      PoDetailPanel: vendor-app PoDetailPanel (9 tests), PO hooks (2 tests), bulk-order constants (3
      tests), bulk-order hooks (3 tests); company-admin PoDetailPanel (9 tests) —
      `apps/vendor-app/src/features/purchase-orders/components/PoDetailPanel.test.tsx`,
      `apps/vendor-app/src/features/purchase-orders/hooks/index.test.ts`,
      `apps/vendor-app/src/features/bulk-orders/constants.test.ts`,
      `apps/vendor-app/src/features/bulk-orders/hooks/index.test.ts`,
      `apps/company-admin-app/src/features/purchase-orders/components/PoDetailPanel.test.tsx`
- [x] T838 [US-5.07] Enhance validate-items backend: bulk order matching by materialName +
      name-based RFQ search. Frontend useLineItemValidation hook with debounced auto-validation
      feeding inline Appr. RFQ / Bulk orders table column counts. —
      `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`,
      `packages/shared-types/src/dtos/purchase-order.dto.ts`,
      `packages/api-client/src/endpoints/purchase-orders.ts`,
      `packages/po-shared/src/hooks/useLineItemValidation.ts`
- [x] T839 [US-5.07] Add sourceOfCreation to PO create payload (MANUAL / RFQ / BULK_DRAWDOWN). Pass
      creationMode through CreatePoWizard → usePoWizardForm → buildPayload. —
      `packages/po-shared/src/hooks/usePoWizardForm.ts`,
      `packages/po-shared/src/components/CreatePoWizard.tsx`,
      `apps/procurement-officer-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`,
      `apps/company-admin-app/src/features/purchase-orders/pages/CreatePurchaseOrderPage.tsx`
- [x] T840 [US-5.07] Coverage modals pass vendorId on confirmation to auto-set PO vendor. Add
      vendorId to RFQ quoteResponses detail response. —
      `packages/po-shared/src/components/BulkOrderCoverageModal.tsx`,
      `packages/po-shared/src/components/RfqCoverageModal.tsx`,
      `apps/backend/src/modules/rfqs/rfqs.service.ts`, `packages/api-client/src/endpoints/rfqs.ts`
- [x] T841 [US-3.01] Add VendorCategory enum (15 specialisations) to Prisma schema +
      CompanyVendorAssignment.categories field + migration. Shared-types VendorCategory enum. —
      `apps/backend/src/prisma/schema/company.prisma`,
      `apps/backend/src/prisma/migrations/20260322100000_add_vendor_category_priority/`,
      `packages/shared-types/src/enums/index.ts`
- [x] T842 [US-3.01] Backend VendorsModule: POST /vendors/invite (create company + user +
      assignment, send emails), GET /vendors (paginated list with search/filter). Email templates
      for vendor invitation. AuditAction.VENDOR_INVITED. — `apps/backend/src/modules/vendors/`,
      `apps/backend/src/modules/notifications/`, `apps/backend/src/app.module.ts`,
      `apps/backend/src/common/constants/error-messages.const.ts`
- [x] T843 [US-3.01] Frontend vendor invite: api-client vendors endpoint, vendor.dto, i18n vendors
      namespace, VendorListPage invite modal in CA and PO apps. —
      `packages/api-client/src/endpoints/vendors.ts`,
      `packages/shared-types/src/dtos/vendor.dto.ts`, `packages/i18n/src/locales/en/vendors.json`,
      `apps/company-admin-app/src/features/vendors/`,
      `apps/procurement-officer-app/src/features/vendors/`
- [x] T844 [US-5.07] Refactor ApprovedQuotesModal + BulkOrdersModal: extract select-all/clear into
      useItemSelectionModal hook, pass allItems for proper select-all. —
      `packages/po-shared/src/components/ApprovedQuotesModal.tsx`,
      `packages/po-shared/src/components/BulkOrdersModal.tsx`,
      `packages/po-shared/src/hooks/useItemSelectionModal.ts`
- [x] T845 [US-3.01] VendorListPage rewrite: company-grouped accordion view, status/company filters,
      SearchInput, CreateVendorCompanyModal for inline company creation, auth interceptor 401
      logout, vendors.service createVendorCompany endpoint, updated tests. —
      `apps/company-admin-app/src/features/vendors/`,
      `apps/procurement-officer-app/src/features/vendors/`,
      `packages/api-client/src/endpoints/users.ts`,
      `packages/api-client/src/interceptors/auth.interceptor.ts`,
      `packages/auth/src/createAuthHooks.ts`, `packages/i18n/src/locales/en/vendors.json`
- [x] T846 [US-5.07] PO creation modals: Select/Deselect item buttons, clickable clear-selection X
      icon, "Add items (N)" outline button for selected items in SelectBulkOrderModal +
      SelectRfqModal + BulkOrdersModal + ApprovedQuotesModal. SelectRfqModal vendor-level
      select-all/deselect-all toggle. Removed plus icon from "Add all items" button. onSelect
      callbacks extended with optional selectedItemIds for partial item selection in all consumer
      pages. — `packages/po-shared/src/components/SelectBulkOrderModal.tsx`,
      `packages/po-shared/src/components/SelectRfqModal.tsx`,
      `packages/po-shared/src/components/BulkOrdersModal.tsx`,
      `packages/po-shared/src/components/ApprovedQuotesModal.tsx`,
      `apps/*/src/features/purchase-orders/pages/PurchaseOrderListPage.tsx`,
      `apps/*/src/features/dashboard/ui/QuickActions.tsx`
- [x] T847 [US-5.07] Responsive UI polish: custom toolbar breakpoint (900px) in Tailwind preset,
      Modal full-screen on mobile with overflow scroll, TablePagination flex-wrap, RFQ/PO list pages
      responsive toolbar rows (flex-col + flex-wrap on narrow screens). —
      `packages/config/tailwind/preset.ts`, `packages/ui-components/src/components/Modal.tsx`,
      `packages/ui-components/src/components/TablePagination.tsx`,
      `apps/*/src/features/rfqs/pages/RfqListPage.tsx`
- [x] T848 [US-1.03] Auth cookie maxAge: set explicit ACCESS (15min) and REFRESH (7d) maxAge on auth
      cookies so browsers expire them in sync with JWT expiry. Vendor list page toolbar breakpoint
      fix. — `apps/backend/src/common/utils/set-auth-cookies.util.ts`,
      `apps/backend/src/common/utils/set-auth-cookies.util.spec.ts`
- [x] T849 [US-1.03] Increase access token cookie + JWT expiry from 15min to 24h to reduce re-login
      frequency. — `apps/backend/src/common/utils/set-auth-cookies.util.ts`,
      `apps/backend/src/common/utils/set-auth-cookies.util.spec.ts`,
      `apps/backend/src/modules/auth/auth.module.ts`
- [x] T850 [US-3.01] Extract @forethread/vendor-shared package: VendorListPage, InviteVendorModal,
      VendorInviteSuccessModal, CreateVendorCompanyModal, vendors.service deduplicated from CA/PO
      apps. Fix alreadyExisted notification (show success modal with different title/message). Fix
      i18n expiry text to match 30-day backend token. — `packages/vendor-shared/`,
      `apps/company-admin-app/src/features/vendors/`,
      `apps/procurement-officer-app/src/features/vendors/`,
      `packages/i18n/src/locales/en/vendors.json`
- [x] T851 [US-5.07] RfqCoverageModal "Review quote" button: wire onClick to open RFQ responses tab
      in new browser tab. — `packages/po-shared/src/components/RfqCoverageModal.tsx`
- [x] T852 [US-1.03] Debounce network-error toasts (5s) so transient outages don't spam user. —
      `packages/api-client/src/interceptors/error.interceptor.ts`
- [x] T853 [US-5.07] PO shared UI polish: extract FiltersButton component, refactor
      BulkOrdersModal/ApprovedQuotesModal (remove unused allSelected/allItems), fix CreatePoWizard
      setState-during-render (useEffect),
      PoCreateLineItemsStep/LineItemRow/PoBasicInfoStep/DatePicker tweaks,
      SelectBulkOrderModal/SelectRfqModal cleanup, auth createAuthHooks update. —
      `packages/po-shared/src/components/`, `packages/ui-components/src/components/`,
      `packages/auth/src/createAuthHooks.ts`
- [x] T854 [US-5.07] Unit tests for vendor-shared (vendors.service, VendorInviteSuccessModal) and
      po-shared (SelectBulkOrderModal, SelectRfqModal) — 31 new tests, vitest configs added. —
      `packages/vendor-shared/src/`, `packages/po-shared/src/`
- [x] T855 [US-1.03] Fix api-client error interceptor lint errors: typed AxiosError response data,
      String() coercion for error.message. —
      `packages/api-client/src/interceptors/error.interceptor.ts`
- [x] T856 [US-5.07] PO shared deep refactor: extract useLineItemsCrud + useLineItemModals hooks
      from PoCreateLineItemsStep, simplify BulkOrdersModal to use shared sub-components, remove
      redundant ModalFilterPanel/ModalSearchBar/ModalSelectionBar (merged into parent), refactor
      DatePicker into date-picker/ folder, LineItemRow + ApprovedQuotesModal + SelectRfqModal
      cleanup. — `packages/po-shared/src/`, `packages/ui-components/src/components/`
- [x] T857 [US-5.07] Fix SelectBulkOrderModal + SelectRfqModal test mocks after component refactor:
      add SearchInput, FiltersButton, ModalFilterPanel, SelectionBar mocks to match new imports. —
      `packages/po-shared/src/components/SelectBulkOrderModal.test.tsx`,
      `packages/po-shared/src/components/SelectRfqModal.test.tsx`
- [x] T858 [US-3.01] Backend vendors refactor: extract VendorInviteService, create
      VendorListQueryDto + AuthUser DTOs. PO backend refactor: extract PoDocumentService,
      PoStatusService, PoValidationService from PurchaseOrdersService. UI: extract useClickOutside,
      useEscapeKey, useMediaQuery hooks, DatePicker/FilterPanel improvements. —
      `apps/backend/src/modules/vendors/`, `apps/backend/src/modules/purchase-orders/`,
      `packages/ui-components/src/`, `packages/vendor-shared/src/`
- [x] T859 [US-1.03] Auth cookie improvements: per-app cookie names, SameSite=Lax for cross-port
      dev, JWT strategy reads from correct app cookie. API client singleton fallback to /v1. —
      `apps/backend/src/modules/auth/`, `apps/backend/src/common/utils/set-auth-cookies*`,
      `apps/*/src/main.tsx`, `packages/api-client/src/client.ts`
- [x] T860 [US-3.01] Vendor invitation RBAC: allow COMPANY_ADMIN and PROCUREMENT_OFFICER to create
      vendor companies via POST /companies (auto-assign to contractor). Fix invite flow for existing
      vendors (create user instead of 409). Allow contractor roles to access vendor users via
      GET/PATCH /users/:id. — `apps/backend/src/modules/companies/`,
      `apps/backend/src/modules/vendors/`, `apps/backend/src/modules/users/`
- [x] T861 [US-3.01, US-3.07] Vendor list with representatives: backend returns one row per company
      with representatives[] array. Edit vendor user modal (Edit User Details pattern). Success
      modal matches user management design (560px, left-aligned info box, countdown). Vendor dot
      menu: Reset Invitation + Cancel Invitation for INVITED, Archive for ACTIVE. Actions header
      left-aligned. Page padding. Company accordions closed by default. —
      `packages/vendor-shared/src/`, `packages/api-client/src/endpoints/vendors.ts`,
      `packages/i18n/src/locales/en/vendors.json`, `apps/company-admin-app/src/`,
      `apps/procurement-officer-app/src/`
- [x] T887a [US-5.20] Vendor view polish: isVendorView prop for ChangeHistoryCard/Tab/DetailPage,
      vendor-specific pending alert labels, email notifications for change request lifecycle
      (proposed/approved/rejected) and bulk order cancellation. BulkOrderDetailTabs Change History
      hidden for vendor. DetailField layout fix. BulkOrderLineItemsTable border styling. Files:
      `apps/backend/src/modules/bulk-orders/bulk-order-change.service.ts`,
      `apps/backend/src/modules/notifications/email.service.ts`,
      `apps/backend/src/modules/notifications/email-templates.const.ts`,
      `apps/backend/src/modules/notifications/templates/`,
      `apps/vendor-app/src/features/bulk-orders/pages/`,
      `packages/bulk-order-shared/src/components/`
- [~] T887b [US-2.11] Drawdown History tab + bulkOrderNumber — **PARTIAL, NOT FINAL DESIGN**:
  DrawdownHistoryTab using DataTable component (sort arrows, pagination, horizontal scroll). Columns
  per Figma: Date/Timestamp, Related PO number, Material, Qty before drawdown, Drawn quantity,
  Remaining qty. Schema: added `lineItemId` + `qtyBeforeDrawdown` to Drawdown model,
  `bulkOrderNumber` to BulkOrder. PageHeader shows bulkId + subtitle on detail pages. Delete hover
  fix. Migration: `20260326120000_add_drawdown_history_and_bulk_order_number`. **Note**: partially
  done, not final decision — may need visual adjustments.
- [x] T888 [US-5.20] Figma alignment — bulk order UI polish: ClockIcon on pending/info alerts,
      LetterIcon + MarkIcon on action buttons, h-12 (48px) button height across all change request
      pages. CHANGE_REQUEST_STATUS_COLORS unified map (badge + dot). --badge-orange-text updated to
      #D47202, --success updated to #00A63E across all 6 apps. ChangeHistoryCard border-radius
      removed. Proposer cannot review own change request (currentUserId check). ReviewChangesPage
      simplified: Cancel button directly rejects (no two-stage confirm). ProposeChangePage
      NAKED_INPUT_CLASS for inline table inputs.
- [x] T889 [US-3.06] RFQ guest vendor invitation + quote update notifications: vendor invitation via
      short-code token (no login required), guest RFQ response page, quote update email notification
      to contractor. Prisma schema: invitationToken on RfqVendor. PrismaService soft-delete
      middleware. StorageService MinIO health-check guard. Migration
      `20260326130000_add_rfq_vendor_invitation_token`.
- [x] T890 [US-3.06] RFQ Response frontend polish: discount type toggle (% / $) per line item in
      ResponseLineItemsTable with PERCENT/AMOUNT support in calcLineTotal and totals. Material
      catalogue detail page (`/materials/:id`) with clickable material names in line items table.
      "Add new warehouse" option in BulkLevelDefaults dropdown with AddWarehouseModal (name,
      address, city, postcode). Guest page updated with discountType support. —
      `apps/vendor-app/src/features/rfqs/`
- [x] T891 [US-3.08] PO change request schema + service: PoChangeRequest model with
      requestedBy/resolvedBy, PoChangeService (propose/approve/reject/list), po-change.dto.ts, PO
      module wiring, audit log integration. Migration
      `20260326130000_us308_po_changes_and_rfq_invitation`. po-export PDF buffer, po-status email
      with PDF attachment. Lint fixes: empty catch comments, template expression typing.
- [x] T898 [US-3.08] PO vendor decline email notification: `sendPoDeclinedByVendorEmail()` method,
      `po-declined-by-vendor.html` template, `PO_DECLINED_BY_VENDOR` template key, i18n
      `poDeclinedByVendor` section. Wired into `vendorDeclinePurchaseOrder()` — notifies company
      admins with PO number, vendor name, decline reason. —
      `apps/backend/src/modules/purchase-orders/po-status.service.ts`,
      `apps/backend/src/modules/notifications/`
- [x] T899 [US-3.08] PO change request email wiring: injected `EmailService` + `ConfigService` into
      `PoChangeService`. `proposeChange()` → notifies other party via
      `sendChangeRequestProposedEmail()`. `approveChange()` / `rejectChange()` → notifies requester
      via `sendChangeRequestApprovedEmail()` / `sendChangeRequestRejectedEmail()`.
      `notifyChangeRequestRequester()` helper resolves requester role for correct app URL. —
      `apps/backend/src/modules/purchase-orders/po-change.service.ts`
- [x] T892 [US-5.20] Bulk order table columns simplified (removed qty
      ordered/remaining/consumption), ChangeHistoryCard compact mode, AllChangeHistorySection shared
      component, BulkOrderListPage vendor view adjustments.
- [x] T893 [US-10.05] New UI components: FileChip (file pill with remove), FileDropzone
      (drag-and-drop upload area), ToggleSwitch (on/off toggle). Icons: half-clock.svg, romb.svg.
- [x] T894 [US-3.06] RFQ response file attachments: AdditionalQuoteDetails with FileDropzone for
      quote documents. ResponseLineItemsTable lead time + half-clock icon. PO ApprovedQuotesModal
      file preview. PoReviewStep attachments display. Super-admin PlatformStateTable romb icon.
- [x] T895 [US-3.06] RFQ response design alignment + validation + notifications: **Design fixes**:
      Button heights 42px, letter.svg submit icon, clock-icon.svg deadline banner, table column
      widths from Figma (64/208/78/112/112/112/88/88/80/148/120/92px), borderless table inputs
      (NAKED_INPUT_CLASS), action icons (edit-in-square, half-clock, romb) wrapped in
      MessageBadgeIcon with notification dots, ToggleSwitch shared component (37.5×20.25px,
      text-foreground), substitute row bg-warning/20, expanded row close icon (cross-in-circle).
      **Separate expanded sections**: notes vs backorder (expandedSection: 'notes' | 'backorder' |
      null). **Discount**: clickable %/$ toggle per line item, max 100% cap on percentage fields.
      **Validation**: frontend validation (unitPrice > 0, availQty > 0, deliveryDate required,
      discount/GST ≤ 100%), submit button disabled when invalid, deliveryDate converted to ISO 8601.
      **Shared components**: FileChip (file item with delete icon), FileDropzone (48px Add
      Attachment button), StepperInput for qty fields, Input for Additional Notes (h-12), DatePicker
      h-12. **Email notification**: QUOTE_SUBMITTED template + sendQuoteSubmittedEmail() +
      controller fire-and-forget call to notifyContractorOfQuoteSubmission() for
      COMPANY_ADMIN/PROCUREMENT_OFFICER. **Success/error modals**: use rfq.name instead of UUID.
      Guest flow updated (expandedSection).
- [x] T896 [US-3.06] RFQ response deadline guard + UI refinements: useCanRespond hook (deadline
      check), AddWarehouseModal with AddressInput, BulkLevelDefaults warehouse creation flow,
      LineItemExpandedRow layout fixes, RfqDetailPanel deadline display, DatePicker/AddressInput
      component improvements. Project pages address input integration.
- [x] T897 [US-3.06] Quote attachment persistence + edit response frontend: **Backend**: added
      `QuoteAttachment` model (junction table `quote_attachments` linking `QuoteResponse` ↔ `File`),
      migration `20260326140000_add_quote_attachments`. `submitQuote()`, `updateQuote()`,
      `submitGuestQuote()` now persist `attachmentIds`; `getQuoteDetail()` includes attachments in
      response. **API client**: added `QuoteAttachmentDto` interface and `attachments` field on
      `QuoteResponseDetail`. **Frontend edit mode**: `useCanRespond` now returns
      `{ canCreate, canEdit, existingQuoteId }` — vendor can edit a submitted quote while RFQ is
      open (RESPONDED status). `useRfqResponse` accepts `options.existingQuote`, pre-populates bulk
      defaults, line items (with NO_QUOTE items excluded), additional details and attachment IDs
      from existing quote. Uses `updateQuote` mutation in edit mode instead of `submitQuote`.
      `RfqResponsePage` loads existing quote via `getQuoteDetail` when editing, shows "Update
      Response" / "Updating..." labels, edit-specific success/error modals. `RfqDetailPage` and
      `RfqDetailPanel` show "Edit Response" button when vendor already responded. i18n keys:
      `editResponse`, `update`, `updating`, `updateSuccessTitle`, `updateSuccessDescription`,
      `updateErrorTitle`, `updateErrorDescription`. **Tests**: 24 frontend tests (7 new edit-mode
      tests), 35 backend tests (all green).
