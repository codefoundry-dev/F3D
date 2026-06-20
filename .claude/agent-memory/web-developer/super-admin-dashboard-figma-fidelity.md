---
name: super-admin-dashboard-figma-fidelity
description: Super-Admin dashboard page-content Figma fidelity pass (KPI cards, quick-action pills, Platform State table, bottom row) — deltas, token mappings, and the dashboard screenshot harness
metadata:
  type: project
---

Super-Admin dashboard CONTENT (`apps/web/src/features/dashboard/.../super-admin/`) fidelity-tuned to
Figma frame CFA6k0XCvImOmWXbBgdWYZ node 3345-110088 (ref PNG `.tmp/figma-dashboard/super-admin.png`).
This was the CONTENT pass; the shell (sidebar/header) was a separate earlier pass —
see [[app-shell-figma-fidelity]].

**Why:** established project workflow demands EXACT Figma match (see user auto-memory
[[figma-fidelity-workflow]]). Super-admin now lands on `/` (HomeRedirect → DashboardRoleSwitch →
SuperAdminDashboard for SUPER_ADMIN; `roleHome.ts` maps SUPER_ADMIN→'/').

**Deltas applied (so a later pass doesn't re-derive or regress):**
- REMOVED the extra StatCard row (Projects/RFQs/POs/Invoices) + its local `StatCard` helper — NOT in
  the frame.
- "Users by role" card → replaced with a "Google Analytics" empty Phase-2 placeholder (titled card,
  empty body, `h-[448px]`); i18n key `googleAnalytics.title` ("Google analytic") already existed.
- KpiCard.tsx: title `text-sm font-medium text-muted-foreground` (was text-xs); value `font-normal`
  (was bold); trend is now GRAY text (`text-muted-foreground`) with a DIRECTION arrow — NOT
  green/red. New prop `trendDirection: 'up'|'down'|'flat'` replaces the old `trendUp` boolean. Card =
  `rounded-[14px] border-[0.8px] border-[rgba(0,0,0,0.2)] px-[16.8px] py-[12.8px]`, icon chip
  `rounded-xl bg-[hsl(var(--foreground))]/10` (frame `rgba(3,2,19,0.1)`).
- TREND SIGN FIX: page does `formatDelta(delta)` → `-2` / `+3` / `0` (raw signed, NO double `++`).
  The old code did `+${newThisWeek}` → rendered `+-2`. Arrow: down if <0, else up (frame shows
  up-arrow even for `0 this week`).
- DB Performance KPI has NO trend: the `SuperAdminDashboard` DTO (api-client) exposes no
  week-over-week delta for `dbResponseMs`, and that DTO is out of scope. Frame shows "+3 this week" +
  a "Phase 2" annotation; we omit rather than fabricate. Wire a real delta if the API adds one.
- Quick-action pills: `bg-[#131313]` (HARDCODED hex — exact frame value; `--foreground` #171717 is a
  hair lighter AND flips near-white in dark mode, so the hardcode is the dark-mode-safe choice for an
  always-dark pill), `text-lg` (18px), icons 24px (`w-6 h-6`), `rounded-xl px-6 py-4`. 3rd pill
  relabelled "Public Material Catalogue" + ENABLED → `navigate(ROUTES.materialCatalogue)` (was
  disabled "Material Catalogue"); icon = `material-catalogue.svg`.
- Platform State table: status pills are now UNIFORM gray for Healthy/Warning/Error (frame renders
  all the same — severity lives in the Error-info column, not pill colour). `STATUS_COLORS` in
  dashboard.constants.ts now maps all three to `bg-accent text-foreground` (`--accent` #e8eaed ≈ frame
  `#e4e4e4`); badge is `rounded-full px-2 py-1 text-xs font-normal`. Actions = eye (always) + the
  shared `ToggleSwitch` ONLY on `category === 'integration'` rows (canToggle), reload icon on
  Error/Warning. Subtitle "Real-time status of critical platform components" already present.
- RecentChangesTimeline: node icon chip changed `rounded-full`→`rounded-xl` (rounded SQUARE per
  frame, 48px, `CheckCircleIcon` 24px); card is `h-[448px] flex flex-col` with the list
  `overflow-y-auto flex-1` (frame is a fixed-height internally-scrolling card). The blue
  initial-avatar is a substitute — audit logs carry no user photo (frame shows a real avatar).
- Page title: `usePageTitleStore` (from `@forethread/rfq-shared`) set to `t('title')` /
  `t('subtitle')` in an effect with `return () => setPageTitle(null)` cleanup (same pattern as
  CompanyProfilePage). AppLayout reads it.

**No tests existed** for super-admin dashboard (only buyer `AwaitingApprovalSection.test.tsx`); the
super-admin `KpiCard` is consumed ONLY by the super-admin DashboardPage (warehouse has a different
inline `KpiCard`), so dropping `trendUp` was safe. typecheck + lint (`--max-warnings 0`) both clean.

**Screenshot harness** `.tmp/figma-dashboard/shot_dashboard.mjs` (SHOT_PORT + SHOT_LABEL env). Mocks a
SUPER_ADMIN `users/me` + `/dashboard/super-admin` + `/dashboard/admin-panel` + `/audit-logs` with the
frame's sample values, navigates `/`, full-page screenshot. before/after saved under
`.tmp/figma-dashboard/shots/super-admin-dashboard-{before,after}.png`; `side_by_side.png` (frame
left, render right) built via PIL. Dev server: a Vite was already live on 5193 — reused it (don't
double-start, port-in-use).
