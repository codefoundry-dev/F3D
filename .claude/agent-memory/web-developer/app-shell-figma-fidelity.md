---
name: app-shell-figma-fidelity
description: Global app-shell (sidebar + header) Figma fidelity pass — tokens, new SA nav items, collapse-rail width, bell/user-pill, and the screenshot-harness route to reach each shell state
metadata:
  type: project
---

Global app-shell (AppLayout header + shared Sidebar + sidebarConfig) was fidelity-tuned to the
Figma dashboard frames (file CFA6k0XCvImOmWXbBgdWYZ: super-admin 3345-110088 expanded, vendor
3345-110220 collapsed, finance 3346-110351 collapsed). Reference PNGs in `.tmp/figma-dashboard/`.

**Why:** established project workflow demands EXACT Figma match for the shell (see user auto-memory
[[figma-fidelity-workflow]]); the app-shell was the last deferred piece after the user-mgmt + auth
boards. Dashboard page CONTENT is a separate pass — only the shell was in scope here.

**How to apply / key facts (so a later pass doesn't re-derive or regress):**
- Sidebar surface = `bg-secondary` (frame `#f1f1f3` ≈ token `#F4F4F6`), NOT `bg-card` (white).
  Active nav item = `bg-accent` (= `#E8EAED`, the old hardcoded value, now tokenized). Inactive
  label/icon = `text-foreground/80` (≈#454545, matches frame `text/tertiary #40454f`,
  dark-mode-safe) — do NOT revert to `text-muted-foreground` (#717182 reads too light vs frame).
- Nav labels: `text-sm font-semibold tracking-[0.3px]`; icons 24px (`w-6 h-6`). Frame uses Urbanist
  14/600/0.3px and our `--font-sans` is Urbanist-first, so the typeface already matches.
- Collapsed rail width = `w-[72px]` (frame), expanded `w-[240px]`. Collapse behavior
  (localStorage `sidebar-collapsed`, hover tooltips) was pre-existing — untouched.
- Logo lockup: render the REAL brand mark (`logo.svg`, a self-contained full-color blue rounded
  square — NOT a monochrome icon) at 32px + the `common:appName` ("Forethread") wordmark when
  expanded. The Figma `#262626` chip + literal "Logo" is a placeholder; do not build a fake dark
  chip. Wordmark is `text-xl` (not the frame's 28px) so it co-exists with the collapse toggle.
- SUPER_ADMIN sidebar items (sidebarConfig): now Admin panel (`dashboard.svg` grid,
  ROUTES.adminPanel) + Users management (`users-group.svg`, ROUTES.users, matchPathname for
  /users + /users/:id) ABOVE the existing list → SA resolves to exactly
  [Admin panel, Users management, Material Catalogue, Settings]. Labels = NEW nav keys
  `adminPanelNav` + `usersManagement` (kept distinct from longer page-title `adminPanel` =
  "Administration Panel"). `sidebarConfig.test.ts` asserts this 4-item list — update it if the SA
  set changes.
- Header: SearchInput REMOVED app-wide (every authed page). NotificationBell tuned to frame
  (`w-10 h-10 rounded-xl` border `rgba(19,19,19,0.2)`, red `bg-destructive` dot) — AppLayout is its
  ONLY consumer so it was safe to change defaults. Bell `hasNotifications` is passed
  unconditionally = visual placeholder (no unread hook exists yet — wire a real count when one
  lands). User button = bordered pill `h-10 w-[180px]` avatar+name+chevron-down; hover dropdown
  (My profile / Logout) kept.
- Header title/subtitle = page-owned via `usePageTitleStore` (rfq-shared, NOT persisted, not on
  window) — dashboard pages set "Dashboard / Monitor and manage your activities" in a later pass.
  Shell renders empty title until then; PageHeader wiring untouched.

**Screenshot harness** `.tmp/figma-dashboard/shot_shell.mjs` (follows the standard route-mock
pattern). To see the SA EXPANDED sidebar: mock SUPER_ADMIN + navigate `/admin-panel`
(HomeRedirect bounces SA off `/`); AdminPanelPage is static (no fetches → no crash). COLLAPSED rail:
mock VENDOR + `/` + initScript `localStorage['sidebar-collapsed']='true'`. The vendor collapsed rail
shows the vendor's REAL items (RFQ/PO/Bulk/Invoice/Settings), not the Figma placeholder glyphs —
that's expected; the rail width/padding/logo/icon-size are what match. before/ vs after shots saved
under `.tmp/figma-dashboard/shots/`.
