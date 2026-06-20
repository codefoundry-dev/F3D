---
name: usermgmt-superadmin-profile-company-detail
description: Super Admin User Profile detail + Company detail (3 tabs) Figma-fidelity pass (US 1.05) — shared ProfileInfoGrid, 18px tabs, company-overview sentence-case labels, doc cards
metadata:
  type: project
---

Figma-fidelity alignment of the SUPER_ADMIN **User Profile** page
(`apps/web/src/features/users/super-admin/ui/UserDetailPage.tsx`, route `/users/:id`) and the
**Company detail** page (`apps/web/src/features/companies/pages/CompanyDetailPage.tsx` +
`ui/{OverviewTab,CompanyUsersTab,DocumentsTab}.tsx`, route `/companies/:id?tab=`). Reference =
company-admin UserDetailPage (verified). See [[usermgmt-superadmin-list]] for the sibling SA list.

**Why:** user demands exact Figma match (auto-memory figma-fidelity-workflow). Logic already worked;
targeted styling/UX edits only.

**How to apply (gotchas):**
- `ProfileInfoGrid` + `ProfileSections` are NOT app-local — `apps/web/src/features/profile/ui/*`
  are one-line RE-EXPORTS of `@forethread/profile-shared`. Both the SA and company-admin
  UserDetailPages import via the `profile/ui` shim. So the real shared components live in
  `packages/profile-shared/src/components/`. Achieve per-board differences with PROPS, not by editing
  the shared file: `ProfileInfoGrid` renders the "Company" field only when `company` prop is non-null,
  and the "Project access" row only when `projects` is non-empty. SA profile target shows ONLY
  Position+Department → drop the `company` prop (don't pass `projects` either). Didn't need to touch
  profile-shared at all.
- SA UserDetailPage was MISSING the page-title wiring the company-admin one has — add
  `usePageTitleStore` (`@forethread/rfq-shared`) + `useEffect(setPageTitle(t('detail.pageTitle'),
  t('detail.pageSubtitle'), ROUTES.users))`. Name weight is `font-semibold` (SA had `font-bold`).
- Company detail page-title: keys `detailPageTitle`/`detailPageSubtitle` (added to company.json),
  backTo `ROUTES.companies`. The detail page did NOT set page-title before this pass.
- Tabs: replace the old `px-4 py-3 text-sm` + absolute-underline-span pattern with the standard 18px
  pattern (container `flex items-start border-b border-[#c9c9c9]`, each `-mb-px border-b-2 p-3
  text-lg font-medium leading-4`, active `border-foreground text-foreground` else
  `border-transparent text-[#686868]`). Header card avatar bumped 14→20 (w-20 h-20), name
  text-lg→text-2xl, header divider `mx-6`→full-width.
- COMPANY-USERS table: drop the colored `ROLE_BADGE_COLORS` Badge + `STATUS_TEXT_COLORS` colored text;
  use the shared gray role pill + light status pill (same classes as [[usermgmt-superadmin-list]]).
  Remove the `Badge`/`ROLE_BADGE_COLORS`/`STATUS_TEXT_COLORS` IMPORTS (leave the exports in
  super-admin/constants/roles.ts — roles.test asserts them). Add a "Company users" heading
  (`company:companyUsersTitle`) left of the existing Invite button.
- COMPANY-OVERVIEW field labels: the Figma is SENTENCE case ("Legal name"/"Tax code"/"Email"/"Phone
  number") but the existing company.json keys (`legalName`/`contactEmail`/...) are Title Case AND are
  SHARED with the buyer Company Profile page + EditCompanyDetailsModal (out of scope). Don't mutate the
  shared keys — added a dedicated `overviewLabels.*` block and pointed OverviewTab's read AND edit
  grids at it. (Section headings `legalInfo`/`contactInfo` ARE safe to sentence-case — only OverviewTab
  uses them; its test asserts the KEY not the value via mocked `t`.)
- ABN read view uses a pre-existing `maskValue` (every char→`#`) — intentional PII masking, left as-is
  (icon `#` + grouped format match Figma's placeholder).
- DOCUMENTS tab rewrite: single divided container → separate bordered rounded cards (`space-y-3`,
  each `rounded-lg border`). Add uploader avatar (initials chip from `uploadedBy.email.slice(0,2)` —
  CompanyDocumentResponse.file.uploadedBy is ONLY `{email}`, no name/avatarUrl) + ClockIcon + date.
  Right side = eye/download/trash (was eye/delete only). Use api-client `openFileInNewTab(fileId)` +
  `downloadFile(fileId, filename)` utils (exported from the barrel) instead of the old manual
  `window.open`+`getFileUrl`. Removed the header global export button (`exportCompanyDocuments`); the
  download is now per-row. Kept literal aria-labels "View"/"Download"/"Delete" (DocumentsTab.test
  selects by those). Had to update DocumentsTab.test: swap the api-client mock to
  `downloadFile`/`openFileInNewTab`, add a `clock.svg` icon mock, and rewrite the two old handleView
  tests to assert the new utils.

**Harness:** `.tmp/figma-usermgmt/shot_sa_profile_company.mjs` (SUPER_ADMIN auth in localStorage +
route-mock; PROFILE_USER for `/users/:id`, COMPANY+COMPANY_USERS+DOCS for `/companies/:id`; mock
`/audit-logs`→empty so the activity-log placeholder rows render; doc URL is
`/companies/:id/documents`, match it BEFORE the generic `/companies/:id` catch-all). Shots →
`.tmp/figma-usermgmt/shots/sa-{userprofile,company-overview,company-users,company-docs}.png`. Targets
`.tmp/figma-usermgmt/figma/sa-{user-profile,company-detail-1,company-detail-2,company-detail-3}.png`.
All four verified faithful. Standard monorepo harness conventions (root MEMORY.md: MSYS_NO_PATHCONV=1,
baseURL `/v1`, deviceScaleFactor 2).
