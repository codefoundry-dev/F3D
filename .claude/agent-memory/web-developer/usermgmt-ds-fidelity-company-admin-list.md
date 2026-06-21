---
name: usermgmt-ds-fidelity-company-admin-list
description: DS-fidelity rebuild of company-admin UserListPage mirroring the super-admin anchor (in-content header, DS Tabs, F9F9FA table container, shared badges)
metadata:
  type: project
---

Company-admin `apps/web/src/features/users/company-admin/ui/UserListPage.tsx` rebuilt to design-system
fidelity by mirroring the verified anchor `.../super-admin/ui/UserListPage.tsx` (part of the
`feat/ds-fidelity-refresh` Stage D propagation — see auto-memory `ds-fidelity-refresh-user-mgmt`).

**Why:** DS refresh standardises every user-mgmt list on the same chrome. The super-admin list is the
anchor; company-admin (and the vendor list) get the same treatment.

**How to apply (the DS recipe, copy from the anchor verbatim):**
- In-content page header: gradient icon chip (`size-7 rounded-[8px] border-gray-100 bg-gradient-to-b
  from-[#F9F9FA] to-white` + `UsersGroupIcon size-[15px]`) + `<h1 text-[20px] font-medium
  tracking-[0.3px] text-gray-900>` left, primary `<Button leftIcon={<NewUserIcon/>}>` right.
- DS `<Tabs items value onValueChange>` with per-tab `icon: <Icon className="size-[18px]" />`.
- Table lives in `rounded-[18px] border-gray-100 bg-[#F9F9FA] p-3 shadow-...` container; inner table
  card is white `rounded-[10px]`; header row `border-b border-gray-100 bg-[#F9F9FA]`, sortable `<th
  h-9 px-2>` with a `font-semibold text-gray-500` button + `<SortIcon>`; rows `border-b border-gray-50
  hover:bg-gray-25`, cells `text-gray-800 font-medium`.
- Role/Status cells use `RoleBadge`/`StatusBadge` from `@/features/users/shared/userBadges` (the
  fleshed-out DS pills). Row actions use the `ICON_BTN_28` const (copy from anchor) for View/Edit +
  `<DotActionsMenu bordered={false} triggerClassName={ICON_BTN_28} />`.
- Empty state: `<EmptyState illustration={<EmptyBoxIllustration/>} ...>` in a white `rounded-[10px]`
  card.
- Breadcrumb (app-wide, no back-arrow): `setPageTitle(t('userManagement'), null, null, [{ label:
  t('userManagement') }])` + keep `return () => setPageTitle(null)` cleanup. `setTitle` sig =
  `(title, subtitle?, backTo?, breadcrumbs?)` from `@forethread/rfq-shared`.

**GOTCHAS:**
- The brief's import list named `cn`, but the company-admin version never uses it → `tsc` TS6133. Only
  import `cn` if you actually call it.
- Company-admin keeps a **Projects** column (vs anchor's dateJoined) + `ProjectAccessModal` +
  `InvitationSuccessModal` + the simpler hook set (`useResetUserPassword`, no grouped-by-company /
  filters / bulk / company-card). Don't copy the anchor's CompanyCard grouping into it.
- Tabs available icons: `settings.svg`, `shield-icon.svg`, `users-group.svg`, `new-user.svg` in
  `packages/ui-components/src/assets/icons/` (used settings→approvalConfiguration, shield→rolePermissions).
- Test mirrors anchor test: mock `../../shared/userBadges`, `@forethread/rfq-shared`, and add the new
  svg names (`settings`,`shield-icon`,`users-group`) to the `svgIcons.forEach` list + add `Tabs` /
  `EmptyBoxIllustration` stubs to the wholesale `@forethread/ui-components` mock. 55 tests pass
  unchanged (label-in-`<button>` keeps the `getByText('columns.fullName')` click-to-sort selectors
  working). Pre-existing super-admin file TS6133 errors on this branch are unrelated.
