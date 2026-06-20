---
name: epic6-delivery-visual-harness
description: How to render & visually audit the Epic 6 Delivery screens (desktop authed + mobile public portal) against the Figma reference PNGs
metadata:
  type: reference
---

Visual-fidelity harness for Epic 6 — Delivery (apps/web). Reference PNGs live in `.tmp/figma-delivery/NN-*.png`; live shots go to `.tmp/figma-delivery/shots/`.

**Dev server**: `cd apps/web && npx vite --port 5199 --strictPort`. Web api-client baseURL defaults to `/v1` (apps/web/src/main.tsx), so a Playwright `page.route('**/v1/**', ...)` returning 200 JSON intercepts everything. Kill via taskkill on the :5199 LISTENING PID when done.

**Auth mock (desktop authed pages)**: only `GET /v1/users/me` is needed to bootstrap auth — return `{data: UserResponse}` with `role: 'COMPANY_ADMIN'` and `permissions: ['delivery.list','delivery.read','delivery.create']`. Role must be in DELIVERY_VIEWERS (COMPANY_ADMIN | PROCUREMENT_OFFICER | WAREHOUSE_OFFICER | FINANCIAL_OFFICER); routes are gated by RoleRoute + PermissionRoute reading useAuthStore.currentUser. Cookies-only (withCredentials), no localStorage seeding required.

**Response envelopes**: single objects are `{data: ...}`; list endpoints are `{data:{items, meta:{page,limit,total,totalPages}}}`.

**Routes / mocks per screen** (harnesses: `.tmp/figma-delivery/shot_desktop.mjs`, `shot_dashboard.mjs`, `shot_mobile2.mjs`, plus original `shot_portal.mjs`):
- list `/deliveries` → `GET /v1/delivery-reports` (list of DeliveryReportListItem). Approve/Reject buttons are `hidden group-hover:flex` — must `page.hover('[data-testid=delivery-card-<id>]')` to reveal (screen 16).
- detail `/deliveries/:id` → `GET /v1/delivery-reports/:id` (DeliveryReportDetailResponse). Approve/Reject bar only when status SUBMITTED.
- create `/deliveries/new?poId=po-1` → `GET /v1/purchase-orders/:id` (PoDetail with `lineItems[]`). Set a row's Outcome `<select>` to DAMAGED to expand the inline DamageDetailsForm.
- QR (screen 09) `/purchase-orders/po-1` (Details tab) → needs PO detail + `/change-requests`(→[]) + `/audit`(→[]) + `/projects/:id`; click `[data-testid=delivery-generate-qr]`, mock `POST /purchase-orders/:id/delivery-link` → `{token,url,poNumber}`.
- dashboard (screen 15) `/` → `GET /v1/dashboard/po-ca` ({data: PoCaDashboard}). GOTCHA: each `recentOrders` item MUST carry `type:'rfq'|'po'|'bulk-order'` (RecentOrdersSection.formatOrderId does `item.type.toUpperCase()` → crashes the whole dashboard into the error boundary if missing). QuickActions "Delivery report" is the 5th outline card → navigates to /deliveries.
- mobile portal (10-14) `/delivery/:token` (390x844 @2x, no auth) → mock `/v1/delivery-portal/{po,identify,verify,submit,finalize,lines,attachments}`. Step machine: fill name+email → Send code → fill 6 `portal-code-digit-N` → Verify → form → `portal-line-damaged-<lineId>` to expand damage sub-form, `portal-line-reject-<lineId>` to collapse to "Change status" → submit. Use `clip:{x:0,y:0,width:390,height:844}` (NOT fullPage) to match the fixed-height refs.

**Status badge tokens (verified correct vs spec)**: DELIVERY_STATUS_COLORS (ui-components/utils/status-colors.ts) = SUBMITTED orange, APPROVED success/green, REJECTED destructive/red.

**Known fidelity deltas found 2026-06-18 (NOT yet fixed)**: (1) mobile report qty/damage steppers use ui-components StepperInput (input + stacked chevrons) instead of the design's `[−][value][+]` segmented stepper; (2) mobile per-line status toggles stack full-width at 390px (grid-cols-1, sm:grid-cols-3 only ≥640px) vs the design's inline Not-Delivered + side-by-side Damaged/Rejected with a filled-red Rejected; (3) detail-page damage photo thumbnails + the mobile "Damaged" toggle use a paperclip icon instead of an image icon. Everything else (list, detail/review, reject modal, create base+damaged, QR section, dashboard quick-action) is a faithful match.

**Harness-data artifacts to ignore (not app bugs)**: a DamageType value of "DEFECTIVE" renders the raw key "damageType.DEFECTIVE" — DEFECTIVE is not in the enum; real values (IN_TRANSIT, MANUFACTURING_DEFECT, PACKAGING, WATER, OTHER) DO have i18n. "undefined%" on the dashboard quote card = incomplete quote mock.
