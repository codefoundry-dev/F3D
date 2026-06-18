---
name: usermgmt-superadmin-actionlog-editmodals
description: Super Admin board final chunk (US 1.05) — Action Log tab timeline + Edit User / Edit Company modals Figma-fidelity pass; shared deactivate copy 1→2 sentences
metadata:
  type: project
---

Figma-fidelity alignment of the SUPER_ADMIN board's final chunk (US 1.05), 2026-06-17. Files:
`apps/web/src/features/users/super-admin/ui/{ActionLogTab,EditUserModal}.tsx` +
`.../ui/modals/EditCompanyModal.tsx` + `packages/i18n/src/locales/en/users.json`.
Reference = company-admin EditUserModal (verified) and the profile-shared timeline. See
[[usermgmt-superadmin-profile-company-detail]], [[usermgmt-superadmin-list]], [[usermgmt-edit-status-modals]].

**Why:** user demands exact Figma match (auto-memory figma-fidelity-workflow). Logic already worked;
targeted styling/copy edits only.

**How to apply (deltas closed):**
- ACTION LOG tab: heading was `tabs.actionLog` ("Action Log") → Figma card heading reads "Activity
  Log". Added NEW key `tabs.activityLogTitle` = "Activity Log" (do NOT reuse `tabs.actionLog` — that's
  the TAB label). Timeline chip was `rounded-full` (circle) → Figma + the profile-shared `TimelineRow`
  use `rounded-xl` (rounded SQUARE). Everything else (w-10 h-10 bg-muted, CheckCircleIcon w-5 h-5
  text-muted-foreground, connector `w-0.5 bg-border min-h-[24px]`, title text-sm font-semibold, clock
  w-3.5, desc text-sm text-muted-foreground mt-1) already matched the reference. KEPT the real data
  wiring (`${targetType}: ${targetLabel} by ${performedBy.name}`) — ActionLogTab.test asserts `/User:
  Alice/` + `/by Admin/`; "visually identical" = timeline chrome, not dropping data. `formatDateTime`
  (en-AU) already prints "28/11/2025, 09:30:00 am" (Figma shows "9:30" no leading-zero hour — that's the
  shared util's `hour:'2-digit'`, app-wide, out of scope).
- super-admin EDIT USER modal: bumped title `text-lg`→`text-2xl font-semibold leading-[140%]` (modal-
  family convention per [[usermgmt-edit-status-modals]]); removed `required` off FullName/Email/Role
  FormFields (Figma has no asterisks; zod editUserFormSchema still enforces); Email `disabled`→`readOnly`
  + `className="cursor-not-allowed"` (full opacity). Email+Phone 2-col, vertical button stacking, field
  icons were ALREADY correct. **REMOVED the "Company (read-only)" FormField** — super-admin version had
  one but Figma `sa-edit-user.png` + the task's field list OMIT it (company-admin reference has none).
  Dropped the now-unused `user` from the `useEditUserForm` destructure. Updated EditUserModal.test: the
  `renders company read-only field` test → `does not render a company field` (queryByText not present).
- super-admin EDIT COMPANY modal: title `text-lg`→`text-2xl font-semibold leading-[140%]`; IconBadge
  had `className="bg-muted"` override → REMOVED so it uses the default `bg-foreground/10` gray chip (the
  verified modal-family chip; bg-muted is a slightly different gray). Removed `required` off Company name
  FormField. Added a company-appropriate placeholder via NEW key `editCompanyModal.companyNamePlaceholder`
  = "Company name". DELIBERATE DEVIATION: Figma's Company-name leading icon is a person/user-outline AND
  its placeholder is "Name Surname" — both are leftovers from the cloned Full-name field. Kept the
  semantically-correct building `DepartmentIcon` + company placeholder (task flagged the placeholder as a
  leftover; same logic applies to the icon).
- STATUS/RESET copy (users.json, SHARED with company-admin board — fine, same design): `deactivateModal.
  subtitle` 1→2 sentences to match Figma: "This user will lose access to the system immediately. They
  will not be able to log in until reactivated." ALSO shortened `deactivateModal.info` tail to Figma's
  "...the user will receive a message by email." (was "...will no longer be able to log in and will
  receive a notification by email" — redundant once the subtitle carries the log-in clause). `activateModal.*`,
  reset-password-success (`resetPasswordSuccess.*`) ALREADY matched Figma exactly — no change. The
  StatusActionModal/StatusSuccessModal/ResetPasswordSuccessModal COMPONENTS were off-limits (copy only).
- SHARED-COPY SAFETY: grep showed only locale JSONs reference the deactivate strings; user-mgmt tests
  mock `t` to return the KEY, so none assert the English value. Full `src/features/users` suite = 636
  tests / 46 files all green after the change.

**Harness:** `.tmp/figma-usermgmt/shot_sa_chunkd.mjs` (copy of shot_sa_list.mjs). SUPER_ADMIN auth in
localStorage. Action Log via `/users?tab=actionLog` + mock `/v1/audit-logs`→4 entries (match BEFORE the
generic `/users` and catch-all; AuditLogResponse needs `performedBy:{id,name}` + `targetLabel`). Edit
Company via company-row ⋮ (aria "Actions") → "Edit company details". Edit User via row pencil (aria
"Edit") after expanding the company group; modal pre-fills from `/v1/users/:id` (returns USERS[0]).
Shots → `.tmp/figma-usermgmt/shots/sa-{actionlog,edit-company,edit-user}.png`. Targets
`.tmp/figma-usermgmt/figma/sa-{action-log,edit-user,edit-company}.png`. All 3 verified faithful.
Standard monorepo harness conventions (root MEMORY.md: MSYS_NO_PATHCONV=1 on the Vite cmd, baseURL `/v1`,
deviceScaleFactor 2, `--strictPort`).
