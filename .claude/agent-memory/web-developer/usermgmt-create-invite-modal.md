---
name: usermgmt-create-invite-modal
description: Company-Admin US 1.07 Create/Invite user modal + invitation-sent success modal — Figma fidelity fixes and the position-optional schema gotcha
metadata:
  type: project
---

Company Admin "User Management" US 1.07 cluster (Create/Invite user modal + Invitation-sent success modal). Figma PNG source of truth in `.tmp/figma-usermgmt/figma/create-{1-details,2-role,3-sent}.png`. Files: `apps/web/src/features/users/company-admin/ui/{CreateUserModal,InvitationSuccessModal}.tsx` (+ `schemas/user-form.schema.ts`).

GOTCHA (position field): the Figma Create-user design labels **Position** as `(optional)`, and the backend `CreateUserDto` (`packages/api-client/src/endpoints/users.ts`) types `position?: string` (optional) — but `createUserFormSchema` had `position: z.string().min(1, 'Position is required')`, which BLOCKED submit with an empty position. To honor the design's `(optional)` label you MUST relax the schema to `z.string().max(255).optional()`, else the form rejects submission and the success modal never opens. Updated the matching `user-form.schema.test.ts` case (`rejects empty position` → now allows empty/omitted).

**Why:** design + DTO both say optional; only the form zod was over-strict (inconsistency, not intended behavior).
**How to apply:** when a Figma field is marked `(optional)`, verify the zod schema AND the api-client DTO agree before adding the `optional` label — a label that lies breaks submit.

Fidelity notes:
- Create modal title was `font-normal`; Figma is bolder → `text-2xl font-semibold`.
- `FormField` has an `optional` prop that renders ` (Optional)` (capital O); Figma shows lowercase `(optional)`. Used the prop anyway (correct muted gray styling, shared pattern) — capital O is the only trivial deviation; do NOT fork shared FormField for it.
- Success modal: the shared `StatusSuccessModal` hardcodes `text-lg` title, but Figma create-3 title is ~24px (same size as create-1). It's shared by activation/deactivation/reset success modals (out of scope), so I did NOT change it — instead inlined `InvitationSuccessModal` with `Modal`+`ModalBody`+`IconBadge`+`Button` and its own 3s countdown `useEffect` to get the larger `text-2xl font-semibold` title.
- Success icon chip is GRAY (`IconBadge` default `bg-foreground/10`) with a DARK (`text-foreground`) check-circle — NOT green. The earlier version used `bg-success/10` + `text-success` (green) which was wrong vs Figma.
- Green info box: email rendered **bold**. i18n value `invitationSuccess.emailSent` embeds `{{email}}` mid-sentence with no markup, and `packages/i18n` is off-limits → split the resolved string on the email value and wrap the match in `<strong>` on the React side.
- Error banner uses existing `Alert variant="destructive"` + `InfoIcon` (filled circle). Figma shows an outlined alert-circle; no exact outlined icon exists in the set — filled `info` reads fine at small red-tinted size (acceptable deviation).

Harness: `.tmp/figma-usermgmt/shot_create.mjs` (copy of shot_usermgmt.mjs). Opens modal on `/users`, fills fields, routes POST `/v1/users`→400 (email-in-use banner) then →201 on a 2nd fresh page for the success modal. NOTE the success modal auto-closes after a 3s countdown — screenshot it within ~150ms of the title appearing or you capture the bare list page. Run `SHOT_PORT=5179 node .tmp/figma-usermgmt/shot_create.mjs`.
