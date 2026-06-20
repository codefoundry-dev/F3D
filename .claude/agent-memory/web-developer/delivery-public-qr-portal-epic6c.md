---
name: delivery-public-qr-portal-epic6c
description: Epic 6 Part C — public mobile QR delivery portal (PublicDeliveryPage) step machine + portalLines mapping
metadata:
  type: project
---

Built the **public mobile QR delivery flow** (Epic 6 Part C) — the unauthenticated
page a delivery person reaches by scanning a PO's delivery QR. Parts A (backend)
and B (desktop deliveries) pre-existed; this was the mobile portal + its public
route only.

**Why:** Closes the delivery loop — a delivery person with no account submits a
delivery report against a PO via a tokenised link, no login.

**How to apply (key facts for future delivery/portal work):**

- Lives at `apps/web/src/features/deliveries/public/` (NEW subdir, separate from
  the desktop `pages/`+`components/`): `PublicDeliveryPage.tsx` (step machine +
  identify/code/form/submitted steps inlined), `PortalLineItem.tsx` (one mobile
  line card), `portalLines.ts` (pure helpers), + 2 test files.
- Route `/delivery/:token` = `ROUTES.guestDelivery` (already in route-config),
  registered in routes.tsx **always-public block** next to `guestPurchaseOrder`
  (NO AppLayout, lazy `PublicDeliveryPage` import next to the 3 authed delivery
  pages). Mirrors `GuestPurchaseOrderPage` for token-from-useParams + 403-vs-other
  error states (uses `isApiError(error, 403)` from @forethread/api-client).
- api-client portal fns ALREADY existed in `packages/api-client/src/endpoints/deliveries.ts`
  — used verbatim, added/renamed NOTHING. They send the token via `X-Access-Token`
  header w/ `skipErrorHandler:true` internally. identify/verify take the QR token;
  verify returns `{sessionToken}` → pass THAT to submit/upload/finalize. Submit
  flow = `submitDeliveryPortal` → best-effort `uploadDeliveryPortalLinePhoto`/
  `uploadDeliveryPortalAttachment` (Promise.allSettled) → `finalizeDeliveryPortal`.
- **`portalLines.ts` is the testable core** (pure, runner-independent): the portal
  has NO outcome dropdown (unlike the desktop create page) — delivery person sets a
  Delivered-qty stepper + toggles NOT_DELIVERED/DAMAGED/REJECTED. `resolveOutcome()`
  DERIVES PARTIALLY_DELIVERED (0<qty<ordered) / DELIVERED / NOT_DELIVERED from qty
  when no explicit toggle; an explicit toggle wins. `portalLineToInput()` ZEROES
  quantityReceived for NOT_DELIVERED+REJECTED, carries damage fields for DAMAGED.
  `summarisePortalLines()` feeds the screen-14 counts. Reuses desktop `constants.ts`
  DAMAGE_TYPE_OPTIONS + DELIVERY_ATTACHMENT_ACCEPT.
- Mobile OTP entry copies the TwoFactorCard 6-box pattern (refs array, auto-advance,
  backspace-back, paste-to-fill+auto-verify) inline — TwoFactorCard itself is
  auth-store-coupled so not reused. Inputs use a local `PORTAL_INPUT_CLASS` copy of
  authStyles `AUTH_INPUT_CLASS` (`h-12 rounded-lg border-black/15 bg-card text-base`).
- "View PO" affordance links to `/po/:token` (the FOR-246 guest PO portal) reusing
  the SAME QR token — assumes the token authorises both; if the backend mints a
  delivery-only token this link 403s (flag for QA). Photo capture uses a hidden
  `<input type=file accept=image>` (mobile browser opens camera) — not verified on a
  real device.
- Per-line outcome BADGE colors: there's NO shared outcome-color export
  (`DELIVERY_STATUS_COLORS` is for report STATUS Submitted/Approved/Rejected only).
  Defined a local `OUTCOME_BADGE` map in PortalLineItem using the same token style
  (success/10, badge-orange, destructive/10, muted).

**Verify:** apps/web `npx tsc --noEmit` clean; `npx vitest run --pool=threads
src/features/deliveries` = 44 pass (19 new: 12 portalLines + 7 step-machine; 25
pre-existing B specs green). Harness `.tmp/figma-delivery/shot_portal.mjs` (390x844
mobile viewport, NO auth needed — just route-mock `/v1/delivery-portal/*`). Screens
10–14 matched faithfully. See [[delivery-feature-test-harness-conventions]].
