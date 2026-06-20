---
name: vendor-finance-dashboard-figma-fidelity
description: Vendor + Financial-Officer dashboard CONTENT Figma fidelity pass (RFQ/Invoice cards, Active POs table, KPI cards, Upload-invoice pill) — deltas, token mappings, and the per-role dashboard screenshot harness
metadata:
  type: project
---

Vendor (`pages/vendor/` + `ui/vendor/`) and Finance (`pages/finance/` + `ui/finance/`) dashboard
CONTENT fidelity-tuned to Figma file CFA6k0XCvImOmWXbBgdWYZ — vendor node 3345-110220 (ref
`.tmp/figma-dashboard/vendor.png`), finance node 3346-110351 (`.tmp/figma-dashboard/finance.png`).
Both already existed + were structurally correct; this was pixel-polish, not a rebuild. The
app-shell + super-admin + buyer dashboards were earlier passes in the same effort —
see [[app-shell-figma-fidelity]] and [[super-admin-dashboard-figma-fidelity]].

**Why:** established project workflow demands EXACT Figma match (user auto-memory
[[figma-fidelity-workflow]]). Both VENDOR and FINANCIAL_OFFICER now land on `/`
(`roleHome.ts` maps both → '/'; `DashboardRoleSwitch` renders the right page; finance routing was
changed from `/invoices` to `/`), so each dashboard now OWNS the global header copy.

**Deltas applied (so a later pass doesn't re-derive or regress):**
- PAGE TITLE: both `pages/{vendor,finance}/DashboardPage.tsx` now set
  `usePageTitleStore` → `t('title')`/`t('subtitle')` ("Dashboard" / "Monitor and manage your
  activities") in an effect with `return () => setPageTitle(null)` cleanup (same pattern as buyer
  DashboardPage). Before this pass the shell rendered an empty title on `/` for these two roles.
- VENDOR "Response" button (`RfqsWaitingSection`): icon swapped `letter.svg` (envelope) →
  `paper-plane.svg` (the Figma glyph is a paper-plane tilt). i18n `vendor.rfqsWaiting.response`
  ALREADY reads "Response" — the Figma label "Responce" is a design typo; correct copy kept. Button
  chrome (border-black h-8 px-3 py-2 rounded-xl gap-1.5 text-sm font-medium) already matched; added
  `leading-6`.
- VENDOR Active POs table (`active-pos/`): status pill + Revision pill are now UNIFORM gray
  `bg-accent text-foreground rounded-full px-2 py-1 text-xs font-normal` (frame renders both with the
  same neutral chip; `--accent` #e8eaed ≈ frame #e4e4e4 / #262626). DROPPED the colored
  `ORDER_STATUS_COLORS`/`getStatusColor` import from `useActivePosColumns`. Revision column renders an
  "Active" PILL (new i18n `vendor.activePOs.revisionActive` = "Active"), NOT the raw `revision`
  number — frame shows the revision *state* and the DTO only carries a number. Actions cell
  alignment `justify-end`→`justify-center` (frame centers the flag/paperclip/eye/dots 16px icons).
  Outer card chrome aligned to the shared section card: `rounded-[14px] border-black/20 bg-white` +
  title `text-lg font-medium` (was `rounded-xl border-border bg-card` + `text-base font-semibold`).
  Table header bg/text were ALREADY token-correct: `--table-header` = #f2f2f2 (= frame), 
  `--table-header-foreground` = #2a2a2a (= frame).
- FINANCE Upload-invoice button: replaced `<Button variant="primary" size="lg">` (= `bg-foreground`
  #171717, flips in dark mode) with a hardcoded dark pill `bg-[#131313] px-6 py-4 rounded-xl text-lg
  font-medium text-white` + 24px upload icon — matches the frame #131313 AND the super-admin
  quick-action pills (dark-mode-safe hardcode, same rationale as [[super-admin-dashboard-figma-fidelity]]).
- FINANCE KPI cards (`InvoiceKpiCards`): extracted shared CARD/ICON_BOX/LABEL/VALUE/SUBTEXT class
  consts. Disputed value `text-[28px]`→`text-2xl` (frame uses uniform 24px/leading-32 across all 3).
  Card padding `px-4 py-3`→`px-[16.8px] py-[12.8px]`, border `border`→`border-[0.8px]`. Icon box
  `bg-black/10`→`bg-foreground/10` (frame rgba(3,2,19,0.1); matches super-admin KpiCard chip).
  Title #525252 + subtext #717182 + TrendUp gated on `disputedTrend !== 0` all already correct.

**Retained intentional deltas (NOT fixed — flagged):**
- Currency renders via `formatCurrency` → "$10,000,000.00" / "$175,800.00" (real formatting) where
  the frame shows the unrealistic placeholder "$10000000" / "$175,800". Keep real formatting.
- `finance.invoiceCount` i18n = "{{count}} invoice(s)" → renders "8 invoice(s)"; frame says
  "8 invoices". Awkward "(s)" is a pre-existing copy choice; left as-is (would need plural keys).
- Shared `DashboardItemCard` border is `border-border` vs frame `#dfdfdf` (negligible); NOT changed
  because the card is shared with the buyer dashboard (out of scope).
- Shared `DashboardSection` title is `text-lg font-medium` = the frame's 18px/medium — CONFIRMED via
  the title text node (18px font, 16px line-height). NO change needed; left untouched (buyer shares it).

**No tests:** no dashboard feature has co-located tests (confirmed via glob — buyer's old
AwaitingApprovalSection.test is gone too). Visual harness is the verification loop, consistent with
the prior fidelity passes. typecheck + lint (`--max-warnings 0`) both clean. GOTCHA hit:
`import/order` flagged `paper-plane` before `package` — alphabetical, fixed.

**Screenshot harness** `.tmp/figma-dashboard/shot_vendor.mjs` + `shot_finance.mjs` (clone of
`shot_buyer.mjs`; SHOT_PORT + SHOT_LABEL env). Vendor: mock VENDOR `users/me` + `/dashboard/vendor`
(rfqsWaiting/invoices/activePOs, 11 sample POs), navigate `/`. Finance: mock FINANCIAL_OFFICER +
`/dashboard/finance` (totals + pending/disputed arrays w/ frame sample values $175,800 / 8 / 5 / 5 /
+3), navigate `/`. A Vite dev was already live on 5194 — reused it (don't double-start). before/after
saved under `.tmp/figma-dashboard/shots/{vendor,finance}-dashboard-{before,after}.png`;
`{vendor,finance}_side_by_side.png` (frame left, render right) built via PIL. Element-level crops
(`_inspect_vendor.mjs` → Response button + first table row) confirmed the paper-plane icon + uniform
gray Accepted/Active pills + centered action icons.
