---
name: usermgmt-edit-status-modals
description: US 1.08 Company-Admin Edit User + Deactivate/Activate (+success) modals Figma-fidelity pass; shared StatusActionModal/StatusSuccessModal title-size convention
metadata:
  type: project
---

US 1.08 Company-Admin user-management modal cluster — Figma-fidelity pass (2026-06-17).
Files: `apps/web/src/features/users/company-admin/ui/EditUserModal.tsx` +
shared `packages/ui-components/src/components/{StatusActionModal,StatusSuccessModal}.tsx`.

**Why:** continuation of [[usermgmt-create-invite-modal]] (US 1.07) — same modal design language;
user cares a lot about exact Figma match.

**How to apply (reusable findings):**
- Modal title convention for this whole modal family is `text-2xl font-semibold leading-[140%]`
  (verified sibling `CreateUserModal` uses exactly this; `UserAlreadyExistsModal` uses
  `text-2xl font-normal`). The shared `StatusActionModal`/`StatusSuccessModal` were the OUTLIERS at
  `text-lg font-semibold` — bumped both to `text-2xl ...`. API unchanged; all 28 consumers (PO wizard,
  RFQ, companies, vendor, super-admin) benefit and their tests still pass (CompanyUsersTab,
  VendorUserListPage, super-admin UserListPage, InvitationSuccessModal all green). No tests assert on
  these h2 classes.
- EditUserModal had `required` on FormFields → rendered ` *` asterisks; Figma shows NO asterisks
  (clean labels + only "(optional)" suffix). Removed `required` — zod (editUserFormSchema) still
  enforces, errors still surface via `error` prop. Matches verified CreateUserModal (no asterisks).
- Email field used `disabled` → `disabled:opacity-50` dimmed it; Figma shows email at FULL opacity
  (gray-filled like other prefilled fields). Switched to `readOnly` + `cursor-not-allowed` (still
  non-editable, full opacity). Position/Department use hand-written labels with lowercase
  `(optional)` which already matches Figma (common:optional = "optional" lowercase; FormField's
  `optional` prop renders capital "(Optional)").
- IconBadge default `bg-foreground/10` chip reads correctly as the Figma light-gray chip — do NOT
  change it (used app-wide; verified CreateUserModal uses the default).
- i18n was OFF-LIMITS this task ("keys exist, don't edit"). Remaining deviations are pure copy:
  deactivate subtitle is 1 sentence vs Figma's 2; deactivate info wording differs slightly. Layout/
  type/color/icons all faithful. Success-modal copy DOES match Figma exactly.

**Harness:** `.tmp/figma-usermgmt/shot_edit.mjs` (copy of shot_usermgmt.mjs). Opens EditUserModal via
row pencil (aria-label "Edit user"), Deactivate/Activate via ⋮ (aria-label "Actions") menu items,
success modals by clicking the confirm button then snapping within ~250ms before the 3s countdown
auto-closes. Catch-all `**/v1/**` 200 mock makes deactivate/reactivate POST succeed. Run
`SHOT_PORT=5179 node .tmp/figma-usermgmt/shot_edit.mjs`.

**Parallel-agent caution:** during this pass, OTHER agents were concurrently rewriting
`UserListPage.tsx` (278-line diff) + CompanyProfilePage + InvitationSuccessModal + AppLayout in the
same working tree. The company-admin `UserListPage.test.tsx` had 6 FAILURES (view/edit row buttons,
sort icons — `getAllByLabelText('Edit')`) that are THEIRS, not from the modal title change (all
deactivate/activate modal tests passed). Don't "fix" files you don't own mid-parallel-run.
