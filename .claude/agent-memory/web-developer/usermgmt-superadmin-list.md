---
name: usermgmt-superadmin-list
description: Super Admin User Management list page (US 1.05) Figma-fidelity pass — pills, tabs, filters incl. a new Date range filter, action menus, grouped table
metadata:
  type: project
---

Figma-fidelity alignment of the SUPER_ADMIN cross-company grouped User Management list
(`apps/web/src/features/users/super-admin/ui/UserListPage.tsx`, rendered at `/users` via
`UserListRoleSwitch` by role — `/users` is gated by `RoleRoute allow={USERS_VIEWERS}`, role-based not
permission-based). Reference board = company-admin UserListPage (verified). See
[[usermgmt-create-invite-modal]] / [[usermgmt-edit-status-modals]] for the sibling modal work.

**Why:** user demands exact Figma match (see auto-memory figma-fidelity-workflow). The page logic
already worked; this was targeted styling/UX edits only.

**How to apply (gotchas for future User-Mgmt SA work):**
- Role pill (uniform gray) + status pill (light) patterns are shared across all user list boards:
  role = `inline-flex items-center rounded-full bg-[hsl(var(--badge-neutral))] px-2 py-1 text-xs
  text-[hsl(var(--badge-neutral-text))]`; status = same but `border border-border bg-secondary`.
  Do NOT use the per-role COLORED `ROLE_BADGE_COLORS` / `STATUS_TEXT_COLORS` from
  `super-admin/constants/roles.ts` on the page — but LEAVE those exports (its `roles.test.ts`
  asserts every role/status key is defined, so deleting them breaks that test).
- Tab pattern (all list boards): container `flex items-start border-b border-[#c9c9c9]`, each tab
  `-mb-px border-b-2 p-3 text-lg font-medium leading-4 ...` active `border-foreground text-foreground`
  else `border-transparent text-[#686868]`.
- Grouping keys off `user.company.{id,legalName}` (`useGroupedUsers`), seeded by the `useCompanies`
  list — a harness that only sets `companyId` (no `company` object) dumps everyone under
  "Unassigned". `expandedCompanyIds` starts EMPTY (all collapsed) → harness must click a company
  header to expand before screenshotting.
- DATE RANGE FILTER: there is a ready shared `DateRangeFilterDropdown` in ui-components, but it has a
  full-width input-style trigger that does NOT match the FilterPopover pill row. So this page uses a
  small LOCAL `DateRangeFilterPopover` (`super-admin/ui/DateRangeFilterPopover.tsx`) that mirrors
  FilterPopover's pill trigger (label + active "(1)" badge + chevron) and opens a popover with two
  shared `DatePicker`s (`From – To`). Stores `yyyy-mm-dd`; wired to `useUsers({dateFrom,dateTo})`
  (the api-client `UserListParams` already has `dateFrom?`/`dateTo?`; backend honors them). Reset
  page→1 on change; Clear empties both. Close-outside handler must allow clicks inside
  `[data-datepicker-portal]` (DatePicker calendar is portalled to body).
- FilterPopover `popoverTitle` + `searchable` + `searchPlaceholder` + `clearLabel` are existing
  props. GOTCHA: its "Clear" only renders when `activeCount > 0` (can't show an always-visible Clear
  without modifying the shared component) — acceptable deviation from the Figma popovers which draw a
  static Clear.
- Row ⋮ menu: active = `{Reset password, Deactivate}` (NO Edit — edit is the pencil icon), inactive =
  `{Activate}`, invited = `{Resend, Cancel}`. Company row = eye(view) + pencil(edit) + ⋮; ⋮ menu =
  `{View company details, Edit company details, Deactivate all users}` (or Activate all when all
  inactive). i18n: `actions.viewCompanyDetails` / `actions.editCompanyDetails`, `filters.date/from/to
  /searchCompany/clear` added to `users.json`.

**Harness:** `.tmp/figma-usermgmt/shot_sa_list.mjs` (SUPER_ADMIN user in localStorage auth + route-mock
`/v1/users` grouped across 2 companies with `company:{id,legalName}` + mixed statuses/roles, `/v1/companies`
matching list). Shots → `.tmp/figma-usermgmt/shots/sa-list-*.png`. Same harness conventions as the rest of
this monorepo (see root MEMORY.md Verification Commands — MSYS_NO_PATHCONV=1, baseURL `/v1`, deviceScaleFactor 2).
