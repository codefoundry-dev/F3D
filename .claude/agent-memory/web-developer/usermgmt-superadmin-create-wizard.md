---
name: usermgmt-superadmin-create-wizard
description: Super Admin "Register new user" wizard + Add contractor/vendor company modals Figma-fidelity pass (US 1.01)
metadata:
  type: project
---

Super Admin invite-user wizard + Add-company modals Figma pass (US 1.01), ad-hoc.
Files: `apps/web/src/features/users/super-admin/ui/{CreateUserModal,steps/*,modals/*}` + `constants/roles.ts`.

**Why:** user demands pixel-level Figma fidelity (see [[figma-fidelity-workflow]]); functionality
already worked. Figma targets staged at `.tmp/figma-usermgmt/figma/sa-reg-1.*.png`,
`sa-add-{contractor,vendor}-co.png`, `sa-roles.png` (NOTE: success step file is misnamed
`sa-register-1.3.png`, others are `sa-reg-`).

**How to apply (key deltas, all confirmed via screenshots):**
- Modal-family header convention reused from CA-side CreateUserModal: title
  `text-2xl font-semibold leading-[140%]`, IconBadge DEFAULT (no className) = gray `bg-foreground/10`
  + icon `text-foreground`. Step 1 AND step 2 both use the SAME "Create a new user account" header
  (`createUserPage.title/subtitle`) — step 2 is NOT "User details" and has NO company-info box (both
  removed for fidelity). Buttons STACKED vertical: primary (`w-full`) on TOP, Cancel outline below.
- Step-2 field icons (EXACT): Representative name=user-outline, email=envelope-simple,
  **Role=department (building)** per instruction even though Figma icon is ambiguous, Position=id-badge.
  Contractor Role dropdown DEFAULTS to COMPANY_ADMIN always (was: only when isNewlyCreatedCompany).
  Vendor variant HIDES Role entirely + submits role=VENDOR.
- "(optional)" label: project convention is FormField has an `optional` prop but it renders CAPITAL
  "(Optional)". Figma wants lowercase → DON'T use the prop; render inline label with
  `({t('common:optional')})` muted span (copied from EditUserModal). `common:optional` = "optional".
- AddVendorCompanyModal: REMOVED assign-contractors field + selectedContractorIds + the
  useCompanies(CONTRACTOR) fetch + the disable-on-empty-contractors gate (deliberate match-to-Figma
  simplification; `assignedContractorIds?` is optional in api-client CreateCompany DTO so omitting is
  safe). Specialisation = SINGLE CustomDropdown (wrench icon, "Choose specialisation"), submits
  `specialisations: value ? [value] : undefined`. Both add-company modals: building badge, Company-name
  field has NO leftIcon, title text-2xl, buttons stacked (Create company dark on top, Cancel below).
- roles.ts CONTRACTOR_ROLE_OPTIONS reordered Foreman before Warehouse Officer (Figma order); roles.test
  uses `.toContain` (order-agnostic) so no test change.

**Item 9 (invited ⋮ menu label):** `sa-reg-1.4.png` shows "Reset Invitation" + "Cancel Invitation".
Changed shared i18n `users.actions.resendInvitation` "Resend Invitation"→"Reset Invitation". GOTCHA:
this key is consumed by FOUR list pages (super-admin + company-admin UserListPage, CompanyUsersTab,
vendor VendorUserListPage) — the change hits all of them. Action key/handler (`resendInvitation`) +
the `resendInvitationSuccess` toast ("...resent successfully") were left unchanged per scope. No test
broke (all list tests mock `t` to echo the key; no source asserts the literal string).

Harnesses (extend the route-mock pattern, see [[forethread-web-screenshot-harness]]):
`.tmp/figma-usermgmt/shot_sa_wizard.mjs` (open wizard via "Invite user" btn → radios by text →
CustomDropdown trigger by "Choose company" name → getByRole('option') → Continue; success step needs
POST /v1/users mock → 200 + role default now makes contractor valid w/o picking role). Crop via
`page.locator('[role="dialog"] > div').first()`. Tall vendor modal overflows the crop box — content
is fine, just a screenshot artifact.
