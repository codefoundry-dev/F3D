# Web Developer Agent Memory

## Feature Notes

- [Orange-grid modal conversion recipes](modal-grid-conversion-recipes.md) — app-wide GridModal /
  ModalGridBackground rollout; Recipe A (narrow→GridModal) vs B (wide→add decoration + `relative`);
  GOTCHA: Recipe B + `scrollBody` can't wrap children in one div → per-element `relative` (added
  optional `className` to shared `ModalHeader`); test mock gotchas for both recipes.

- [User Mgmt DS-fidelity company-admin list](usermgmt-ds-fidelity-company-admin-list.md) — rebuilt
  company-admin UserListPage mirroring the super-admin anchor (gradient icon-chip header + DS
  `<Tabs>`
  - `#F9F9FA rounded-[18px]` table container + `ICON_BTN_28` row actions + shared
    `RoleBadge`/`StatusBadge`); breadcrumb via `setPageTitle(t,null,null,[{label}])`; GOTCHA: don't
    import `cn` unless used (TS6133); keeps the Projects column + ProjectAccessModal +
    InvitationSuccessModal (not the anchor's CompanyCard grouping); test mirrors anchor (mock
    userBadges + rfq-shared + Tabs/EmptyBoxIllustration stubs); 55 green.

- [Delivery public QR portal (Epic 6 Part C)](delivery-public-qr-portal-epic6c.md) — public mobile
  `/delivery/:token` PublicDeliveryPage (no auth, no shell): identify→code→form→submitted step
  machine; portalLines.ts pure helpers (resolveOutcome DERIVES partial/delivered/not-delivered from
  qty unless an explicit toggle wins; portalLineToInput zeroes qty for NOT_DELIVERED+REJECTED,
  carries damage for DAMAGED; summarisePortalLines → screen-14 counts); api-client portal fns used
  verbatim (X-Access-Token, verify→sessionToken→submit/upload/finalize); copies TwoFactorCard 6-box
  OTP + authStyles input look inline; "View PO"→/po/:token same token; harness shot_portal.mjs
  (390x844).
- [Deliveries test/harness conventions](delivery-feature-test-harness-conventions.md) — vitest
  mock-everything style for the deliveries feature; GOTCHA: `vi.mock` with a template-literal path
  in a `.forEach` throws "x is not defined" (hoisting) — write each icon mock literally; run
  `--pool=threads`; PUBLIC-page harness needs no auth seeding, just route-mock
  `/v1/delivery-portal/*`.

- [User Mgmt Create/Invite modal (US 1.07)](usermgmt-create-invite-modal.md) — Figma-fidelity for
  CreateUserModal + InvitationSuccessModal; POSITION-OPTIONAL gotcha (design+DTO say optional but
  zod forced it → blocked submit); inlined success modal off shared StatusSuccessModal for bigger
  title + gray (not green) icon chip + bold email; shot_create.mjs success-modal 3s auto-close
  timing.
- [User Mgmt Edit + Deactivate/Activate modals (US 1.08)](usermgmt-edit-status-modals.md) —
  Figma-fidelity for EditUserModal + shared StatusActionModal/StatusSuccessModal; modal-family title
  convention = `text-2xl font-semibold leading-[140%]` (shared modals were outliers at text-lg —
  bumped, safe across all 28 consumers); remove FormField `required` asterisks (Figma has none, zod
  still enforces); email `disabled`→`readOnly` for full opacity; shot_edit.mjs.
- [User Mgmt SA Create/Invite wizard + Add-company modals (US 1.01)](usermgmt-superadmin-create-wizard.md)
  — SA invite wizard Figma pass: step1+step2 share "Create a new user account" header (no company
  box), contractor Role defaults COMPANY_ADMIN + building icon, vendor hides Role;
  AddVendorCompanyModal DROPS assign-contractors + Specialisation→single dropdown; lowercase
  "(optional)" via `common:optional` span (not FormField `optional` prop which is capital); invited
  ⋮ label "Reset Invitation" hits 4 list pages.
- [User Mgmt Super Admin list (US 1.05)](usermgmt-superadmin-list.md) — SA cross-company grouped
  list Figma pass: uniform-gray role pill + light status pill (leave ROLE_BADGE_COLORS export,
  roles.test needs it); company-admin tab pattern; NEW local DateRangeFilterPopover (FilterPopover
  pill trigger + shared DatePicker, wired to useUsers dateFrom/dateTo); row ⋮ drops Edit (pencil
  icon); company row = eye+pencil+⋮ menu {View/Edit company details, Deactivate all};
  shot_sa_list.mjs.
- [User Mgmt SA User Profile + Company detail (US 1.05)](usermgmt-superadmin-profile-company-detail.md)
  — SA `/users/:id` profile + `/companies/:id` 3-tab detail Figma pass; ProfileInfoGrid/Sections are
  RE-EXPORTS of profile-shared (diff via props: drop `company` prop → no Company field); 18px tabs +
  page-title wiring; company-users gray-role/light-status pills (drop ROLE_BADGE_COLORS import, keep
  export); company-overview SENTENCE-case labels via NEW `overviewLabels.*` (shared field-keys feed
  the out-of-scope buyer Company Profile — don't mutate); Documents → bordered cards +
  uploader-initials avatar + ClockIcon + per-row eye/download/trash via
  `openFileInNewTab`/`downloadFile`.
- [User Mgmt SA Action Log + Edit modals (US 1.05)](usermgmt-superadmin-actionlog-editmodals.md) —
  SA board final chunk: ActionLogTab heading "Action Log"→NEW `tabs.activityLogTitle` "Activity
  Log" + chip `rounded-full`→`rounded-xl` (match profile-shared timeline); SA EditUserModal
  title→text-2xl, drop required asterisks, email readOnly, REMOVE Company field (not in Figma, fix
  its test); EditCompanyModal title→text-2xl + drop bg-muted IconBadge override + NEW
  companyNamePlaceholder (kept building icon, the person-icon is a leftover); deactivate subtitle
  1→2 sentences + shorter info (SHARED copy, t-mocked tests safe, 636 users tests green);
  shot_sa_chunkd.mjs.
- [Material catalogue feature (FOR-228)](material-catalogue-feature.md) — catalogue list + import
  flow reusing doc-intelligence upload/poll hooks; api-client MaterialListItemDto drift gotcha.
- [Bulk Order flow (US 5.08)](bulk-order-flow-us508.md) — Create-page-from-approved-RFQ +
  propose-extension modal + inline extension review; consumptionPercent column; bulk-order-shared
  test infra setup (no runner before); approved-RFQ data source = getRfqs(minApprovedQuotes)+getRfq.
- [Drawdown flow (US 5.09)](drawdown-flow-us509.md) — drawdown PO via SHARED CreatePoWizard
  (`creationMode='from-bulk-order'` + `bulkOrderId`); getBulkOrder detail has NO projectId/vendorId
  (resolve by name); Available-qty column + banner + over-limit gate; Flow 3 extends same wizard.
- [PO Change Request (FLOW 3)](po-change-request-flow-us-flow3.md) — change-mode CreatePoWizard
  (`mode='change'`+`existingPo`+`onProposeChange`, locks documentName, step3=diff); change-diff util
  (lineItemId match, allowlist-only, COMMERCIAL/INTERNAL); PoChangeDiff shared renderer;
  Changes-request tab (pending CR, self-approve guard); Action log sources resolved CRs from
  listPoChangeRequests (NO PO audit feed); `po.proposeChange` is a real permission.
- [RFQ Dashboard Vendor US 2.06](rfq-dashboard-vendor-us206.md) — Figma pass on VENDOR RfqListPage
  mirroring the buyer: drop Create btn, page-title store, shared toolbar dropdowns, Spinner,
  row-anchored preview; VENDOR_QUICK_FILTERS→4-set (incoming→openRfqs, approvedForMe label "Approved
  for a vendor"); VENDOR_COLUMNS→11 canonical (contractorCompany+contractorName BOTH=createdBy,
  totalRespondedQuotes=recQuotes — DTO gaps); panel title rfqNumber + paper-plane + Project ID;
  rfq-shared vendor consts SAFE (PO uses po-shared); harness
  .tmp/figma-vendor-rfq/shot_vendor_rfq.mjs
- [RFQ Dashboard US 2.06 (PO+CA)](rfq-dashboard-us206.md) — Figma pass on buyer RfqListPage: wire
  new RfqListItem cols (invitedVendors/approvedItems/declinedItems/avgQuoteCost), DROP
  recVendors/applIssues/arcBlocksDist; column KEYS == export `columns` param (don't drift);
  table-mgmt modal needs LONG labels (NEW `columnLabels.*`) vs short headers (`columns.*`);
  avgQuoteCost cell = `$ <int>` literal (not formatCurrency); count cols 0-is-valid; resDeadline
  parses `"YYYY-MM-DD - YYYY-MM-DD"`; pick-up=gray Badge; panel title=rfqNumber not projectName;
  ViewSelectorDropdown NEW `defaultViewItemLabel`; harness vendor mock must use real RfqVendor shape
  (`contacts` not `salesContacts`) or VendorList crashes; getViews mock = flat `{data:[]}`.
- [PO Week-3 Approvals/States/Delivery](po-week3-approvals-states-delivery.md) — REAL audit timeline
  now exists: usePoActionLog hook + humanizeAuditAction pure mapper (supersedes the "NO PO audit
  feed" note above for the detail PAGES; List-page PoDetailPanel still placeholder);
  AwaitingApprovalSection approver inbox (listPendingApproval, has('po.approve'), above grids);
  ReceiveDeliveryModal (receivePurchaseOrder cumulative lines, RECEIVABLE_STATUSES,
  has('po.receive')).

- [Super-Admin dashboard content fidelity](super-admin-dashboard-figma-fidelity.md) — SA `/`
  dashboard CONTENT Figma pass (node 3345-110088): drop StatCard row + StatCard helper, "Users by
  role"→"Google Analytics" empty Phase-2 card; KpiCard trend now GRAY text + direction arrow
  (`trendDirection` replaces `trendUp`) + `formatDelta` fixes the `+-2` double-sign; DB-perf trend
  omitted (no DTO delta field); dark pills `bg-[#131313]` 18px/24px-icon, 3rd pill → "Public
  Material Catalogue" ENABLED to ROUTES.materialCatalogue; table status pills UNIFORM gray (accent
  token), toggle only on integration rows; timeline icon → rounded SQUARE + fixed-height scroll;
  page title via usePageTitleStore; harness shot_dashboard.mjs.
- [Vendor + Finance dashboard content fidelity](vendor-finance-dashboard-figma-fidelity.md) — VENDOR
  (node 3345-110220) + FINANCE (3346-110351) `/` dashboards Figma pass: both now set page title via
  usePageTitleStore (own the header on `/`); vendor "Response" btn icon letter→paper-plane (Figma
  "Responce" is a typo, copy stays "Response"); Active POs status+Revision → UNIFORM gray pills
  (drop ORDER_STATUS_COLORS) + Revision renders "Active" pill not raw number + actions centered
  - outer card → shared rounded-[14px]/border-black/20 chrome; finance Upload btn → hardcoded
    bg-[#131313] dark pill (not Button primary, dark-mode-safe); KPI disputed value 28px→24px
    (uniform)
  - px-[16.8px]/py-[12.8px] + icon bg foreground/10; harness shot_vendor.mjs + shot_finance.mjs.
- [App-shell Figma fidelity (sidebar + header)](app-shell-figma-fidelity.md) — global shell tuned to
  dashboard frames: sidebar `bg-secondary` + active `bg-accent` + inactive `text-foreground/80`,
  rail `w-[72px]`, real `logo.svg` glyph + appName wordmark (Figma chip is a placeholder); SA gets
  NEW Admin panel + Users management items (sidebarConfig.test asserts the 4-item list); header
  DROPS SearchInput app-wide, bordered bell + red dot (always-on placeholder, no unread hook), user
  pill avatar+name+chevron; title is page-owned via usePageTitleStore; harness shot_shell.mjs (SA
  expanded → /admin-panel, vendor collapsed → /).

## UI Component Gotchas

- [Alert/Badge don't forward props](alert-component-no-prop-spread.md) — ui-components Alert (and
  likely Badge) drop `data-testid`/extra props; wrap in a div to attach a testid.

## Project Auth UI Patterns (Confirmed)

- All auth form components use `space-y-6` for top-level section spacing
- Form fields within the same logical group use `space-y-4`
- Back/navigation links are placed INSIDE the form content wrapper (not outside with manual mt-4)
- Auth components: LoginForm, ForgotPasswordForm, CheckEmailCard, ResetPasswordForm, TwoFactorCard
- All live in `packages/ui-components/src/components/`
- All use AuthLayout + IconBadge as shared wrapper
- TwoFactorCard was the most recently added and reflects the latest Figma alignment

## Design Token System

- CSS custom properties defined in each app's `globals.css` (light + dark mode)
- Tailwind theme references these via `hsl(var(--token-name))` pattern
- Colors, typography, and spacing must use design tokens (Constitution Principle IX)
- Key files: `packages/config/tailwind/colors.ts`, `packages/config/tailwind/typography.ts`
- Semantic color tokens that exist: `success`, `warning`, `destructive`, `primary`, `muted`,
  `foreground`. Status pills should use `bg-<token>/10 text-<token>` (mirrors the `Alert`
  component). NOTE: some older Badges hardcode hex (`bg-[#e4e4e4]`) — do NOT copy that anti-pattern.

## RFQ / PO Detail Page Tab Architecture

- RFQ buyer detail tabs are split: `RfqDetailTabs` + `RfqTab` type live in
  `packages/rfq-shared/src/components/`, but the individual tab CONTENT components
  (`RfqQuoteAuditTab`, `RfqEmailLogTab`, etc.) live in
  `apps/web/src/features/rfqs/buyer/components/`. The page (`RfqDetailPage.tsx`) imports the type
  from rfq-shared and renders the apps/web tab components.
- PO detail tabs are fully in `packages/po-shared/src/components/` — both `PoDetailTabs`/`PoTab` AND
  the content tabs (`PoDocumentsTab`, `PoEmailLogTab`, `PoActionLogTab`).
  `PurchaseOrderDetailPage.tsx` imports all from `@forethread/po-shared`.
- GOTCHA: `PoDetailTabs` has an internal default `TABS` list. `PurchaseOrderDetailPage` must pass
  `tabs={validTabs}` explicitly or a newly-added tab key won't render in the tab bar (RFQ page
  already passes `tabs`).
- Tab labels are dynamic i18n: `t(\`tabs.${tab}\` as
  never)`. Add the key under `tabs.\*`in`packages/i18n/src/locales/en/{rfqs,purchaseOrders}.json`.
- Adding a tab = update the `*Tab` union type + page `validTabs` + render branch + i18n
  `tabs.<key>`.

## i18n

- Only `en` locale exists. Keys typed via `typeof resources` in `packages/i18n/src/types.ts` —
  adding keys to the en JSON auto-types them; NO codegen step. Static `t('x.y')` keys are
  type-checked; dynamic keys use `as never`.

## shared-types/client Boundary

- Frontend + api-client + rfq-shared + po-shared import shared DTOs/enums from
  `@forethread/shared-types/client` (NEVER root barrel — root drags in @nestjs/swagger, breaks
  Vite).
- The `/client` barrel re-exports real string `enum`s (e.g. `EmailDeliveryStatus`) usable as runtime
  values. po-shared/rfq-shared don't declare shared-types in package.json but resolve it via
  workspace hoist (existing `usePoWizardForm.ts` does the same) — typecheck/build pass.
- TanStack Query hooks live in `packages/{rfq,po}-shared/src/hooks/use{Rfqs,PurchaseOrders}.ts`;
  queryKey style `['rfqs', id, 'sub-resource']` / `['purchase-orders', id, 'sub-resource']`,
  `enabled: !!id`. Export from both the hooks `index.ts` and the package root `index.ts`.
- GOTCHA (RFQ lineItems): zod types `lineItems[].source` as a string union but the api-client DTO
  uses the `RfqLineItemSource` enum — nominally incompatible at `tsc`. Cast at the service boundary.
  See [rfq-line-item-source-enum-vs-zod.md](rfq-line-item-source-enum-vs-zod.md).

## Verification Commands (this monorepo, Windows)

- `pnpm --filter <pkg> run <script>` prints a harmless "No projects matched ... f3d in ... F3D"
  path-casing line — ignore, command still runs.
- Web app pkg = `@forethread/web` (scripts: typecheck, lint, build, test). api-client has
  typecheck+lint. po-shared has only `test`; rfq-shared & i18n have NO scripts — they get
  typechecked transitively by the web app's `build` (`tsc --noEmit`) since apps import their
  `./src`.
- Run a single test file: `pnpm --filter <pkg> exec vitest run <path>`.
- SCREENSHOT HARNESS (apps/web, no backend): Vite dev + Playwright route-mock `**/v1/**` (mock
  cookie-auth `GET /v1/users/me` → `{data: USER}` flips `isAuthenticated`; persist auth via
  initScript `localStorage['forethread-web-auth'] = {state:{currentUser},version:0}`). The wizard's
  required step-1 Delivery location + Expected Delivery Date are NOT seeded from a source — fill
  them to advance (DatePicker is a custom sectioned mask, not native `type=date`; open it and click
  today's day-of-month cell in `[data-datepicker-portal]`). GOTCHA: Git Bash MANGLES
  `VITE_API_URL=/v1` into `C:/Program Files/Git/v1` (MSYS path conversion) → baseURL wrong → getMe
  404 → app bounces to /login. Fix: prefix with `MSYS_NO_PATHCONV=1`. Default baseURL is `/v1`
  (main.tsx `VITE_API_URL ?? '/v1'`). Pattern lives in `.tmp/figma-flows/shot_drawdown.mjs` +
  `.tmp/figma-po/shot_po.mjs` + `.tmp/figma-flows/shot_change.mjs`.
- HARNESS GOTCHA (PO wizard step 2 manual/change mode): `useLineItemValidation` runs in non-drawdown
  modes and POSTs `/v1/purchase-orders/validate-items`; if your route-mock returns the generic list
  `{data:{items,meta}}` instead of `{data:{suggestions:[]}}`, the page CRASHES at
  `suggestions.filter` (undefined). Mock validate-items → `{data:{suggestions:[]}}` BEFORE the
  generic `/purchase-orders` catch-all.
- Test conventions: vitest, `globals: true`, hoisted mocks via `vi.hoisted`, mock `@forethread/i18n`
  (t returns key), mock `@forethread/ui-components`, mock `*.svg?react` icons, mock the hook module.
  Lint flags `${unknown}` in template literals — wrap mock interpolations in `String(...)`.

## Figma Access

- Figma MCP IS configured (mcp**figma**\* tools available): get_screenshot, get_design_context,
  get_metadata, get_variable_defs. Use `get_screenshot` (maxDimension ~2000-2400 for table detail) +
  `get_design_context` per sub-node; don't fetch whole boards (1M+ chars). Forethread file key =
  `CFA6k0XCvImOmWXbBgdWYZ` (the local Forethread.fig). Returns a short-lived URL + curl by default.
