# ADR-0013: `apps/web` is the unified consolidation shell

**Status:** Accepted **Date:** 2026-05-21

## Context

Ayo's primary complaint on the kickoff call: "the platform feels like six disconnected apps." The
previous build had separate Company Admin, Financial Officer, Procurement Officer, Super Admin,
Vendor, and Warehouse Officer frontends. Each one had to be updated whenever the backend contract
changed. Six React apps × N backend changes = a maintenance multiplier we cannot ship a pilot with.

The recent commits already made the move:

- `7dc3004 feat: scaffold unified apps/web frontend and migrate auth pages`
- `52388ba feat: complete feature migration to unified apps/web`
- `545972f chore: remove legacy per-role apps and unify backend URLs`

This ADR captures the decision retroactively so future contributors understand _why_ `apps/web` is
the only frontend and what the migration strategy was for the five legacy apps.

## Decision

**`apps/web` is the single unified frontend.** It is a Vite 5 + React 18 + Tailwind + TanStack
Query + Zustand application. Every role lands in this app:

- Role-based routing via `RoleRoute` and `RoleSwitch` components under `apps/web/src/shared/role/`
- `HomeRedirect` chooses the role-specific landing page on login (e.g. Super Admin → `/admin-panel`,
  Vendor → vendor dashboard)
- Each domain has buyer/vendor sub-folders under `apps/web/src/features/<domain>/{buyer,vendor}/`
  where the surface diverges
- Shared components and design tokens live in `packages/ui-components`
- Per-feature shared logic lives in
  `packages/{po-shared, rfq-shared, vendor-shared, invoice-shared, profile-shared, bulk-order-shared, api-client, auth, i18n}`

The six legacy per-role apps have been **deleted** from the repo (commit `545972f`). Anything
historical lives in git history.

## Consequences

- One bundle, one router, one auth flow, one design system. Backend contract changes flip exactly
  one frontend.
- Role gates are enforced in two places: the JWT-stamped role on the backend (authoritative) and the
  `RoleRoute`/`RoleSwitch` components on the frontend (UX). The frontend gates only hide UI — they
  are not a security boundary.
- Feature folders are organised by domain first, role second. This is the opposite of the previous
  structure (role first, domain second) which is what produced six apps. Folder placement enforces
  the policy: a vendor PO page lives in `features/purchase-orders/vendor/`, not in a separate
  `apps/vendor/...`.
- The `packages/*-shared` packages exist so that buyer/vendor branches of the same feature reuse
  types, validation, and helpers. Without these the consolidation would just be six apps glued into
  one router.
- Vite (not Next.js) means no server-rendered pages from the frontend bundle. That is fine —
  Forethread is a logged-in tool, not a public-marketing site. The marketing landing page
  (`forethread.com`) is a separate concern (see FOR-193).
- The Field PWA (ADR-0008) is _also_ `apps/web`, with PWA-mode toggled by URL/route, not a separate
  app. This keeps Foreman / Warehouse Officer flows part of the same shell with no extra deploy
  target.

## Alternatives considered

- **Keep one of the six existing apps as the shell, lift the others in.** Rejected. Each of the six
  was structured around one role, so the underlying assumption (each app _is_ a role) was wired into
  their stores, routing, and layouts. Lifting felt strictly more painful than rebuilding the shell
  once and porting features. The commits prove this out.
- **Next.js as the shell.** Rejected for Release 1. SSR is unnecessary for a logged-in tool; the
  bundle and cold-start cost is real; and the team has higher velocity with Vite given the existing
  test setup. We can revisit Next.js if there's ever a customer marketing surface inside the
  authenticated product.
- **Six apps + a shared monorepo for primitives.** Rejected. This is essentially the failure mode
  Ayo flagged — the monorepo doesn't solve the "ripple effect across six apps" pain. The cost of six
  builds, six bundles, six deploys remains.
- **A micro-frontend approach (Module Federation).** Rejected as severely premature for a 3-week
  sprint with two developers. Adds significant build-time complexity, runtime fragility, and an
  extra concept the team would have to reason about constantly.
