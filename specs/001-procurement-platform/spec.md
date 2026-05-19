# Feature Specification: Procurement Platform — Release 1

**Feature Branch**: `001-procurement-platform` **Created**: 2026-02-21 **Status**: In Progress — 6
Epics, ~80 User Stories (US-1.01–1.11 COMPLETE — verified by code audit 2026-03-05, all gaps fixed
(T194–T200); UI polish T201–T206 done; US-5.03/5.04 (Projects) Complete; US-10 Super Admin Dashboard
COMPLETE (T232–T240, T583–T584 real data, T587 PlatformState refactor, T590 admin panel API);
US-10.WH Warehouse Dashboard COMPLETE (T583, T585 real data); Epic 2 Dashboards SPECIFIED
(US-2.01–2.11 from product backlog 2026-03-10); Epic 3 Vendor Management FRONTEND IN PROGRESS
(US-3.01–3.12, backend complete, vendor profile/user management/list/invite pages done, company
profile page done, representative editing done, RFQ response form COMPLETE (T362, T889, T890, T894,
T895, T896, T897, T920 — design alignment, validation, quote-submitted email notification, quote
attachment persistence, edit existing response with pre-populated form + Decimal→Number fix, all
acceptance criteria met), PO vendor actions COMPLETE (T921 — decline invalidation, accept requires
acknowledgement), messaging pending); Epic 4 Material Catalogue SPECIFIED (US-4.01–4.07); Epic 5
Procurement SPECIFIED (US-5.01–5.24); Epic 6 Field PWA SPECIFIED (US-6.01–6.15); US-10.01 PO/CA
Dashboard Figma alignment + stub cleanup COMPLETE (T580–T582, T588–T589, T591); US-10.04 RFQ line
item CRUD COMPLETE (T592–T593, backend PATCH/DELETE endpoints, EditLineItemModal, BulkOrder UI
refresh); US-10.06 bulk-order-shared dedup COMPLETE (T637); US-10.06 Bulk Order CRUD + drawdowns
COMPLETE (T638); all new epics Not Started; FRD alignment complete (2026-03-17) — US-3/4/5/7
expanded with detailed acceptance criteria from product FRD; FRD schema alignment sprint
(2026-03-18) — Prisma schemas, contracts, PO backend create/update/issue, Material model created,
all field renames applied (T710–T744); QuoteResponseStatus enum + i18n "Line Items" rename +
hardcoded status cleanup (T760–T764)) **Last Updated**: 2026-03-18 **Input**: Make specification
based on initial FRD document + designer wireframe documentation (2026-03-03) + Figma Epic 2:
Dashboard designs (node 3344-58649) + Full product backlog CSV (2026-03-10, 6 epics)

### Epic 1 — Implementation Gap Tracker

| US   | AC # | Criterion                                         | Backend | Frontend | Status                                                                                                                                                                      |
| ---- | ---- | ------------------------------------------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.05 | 1    | View all platform users in table                  | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.05 | 2    | Search/filter/sort by company, role, status, date | Done    | Done     | COMPLETE: dynamic sortBy/sortDir in backend                                                                                                                                 |
| 1.05 | 3    | Edit user/company details, change role            | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.05 | 4    | Deactivate/reactivate user + email notification   | Done    | Done     | COMPLETE (bulk deactivate/activate all company users done)                                                                                                                  |
| 1.05 | 5    | Initiate password reset (US 1.04)                 | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.05 | 6    | Activity/audit log history for each user          | Done    | Done     | COMPLETE: ActionLogTab wired to getAuditLogs API with timeline UI, pagination                                                                                               |
| 1.07 | 1    | CompanyAdmin creates user for own company only    | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 2    | Auto-assign to admin's company                    | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 3    | Choose predefined role for contractor             | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 4    | Can assign CompanyAdmin role                      | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 5    | Mandatory fields: name, email, position, role     | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 6    | Invitation sent + status "Invited"                | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 7    | Invitation link valid 30 days                     | Done    | —        | COMPLETE                                                                                                                                                                    |
| 1.07 | 8    | Duplicate email prevention                        | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 9    | Success notification after invitation             | —       | Done     | COMPLETE                                                                                                                                                                    |
| 1.07 | 10   | Status → Active on activation                     | Done    | Done     | COMPLETE (US-1.02)                                                                                                                                                          |
| 1.08 | 1    | View user list (name, role, status)               | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 2    | Edit user details (name, position, role)          | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 3    | Role dropdown restricted to contractor roles      | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 4    | Sole CompanyAdmin protection                      | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 5    | Deactivate user (incl. other CompanyAdmins)       | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 6    | Deactivated users cannot log in                   | Done    | —        | COMPLETE                                                                                                                                                                    |
| 1.08 | 7    | Reactivate previously deactivated user            | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 8    | Email notification on deactivate/reactivate       | Done    | —        | COMPLETE: reactivation email template + sendReactivationEmail() added                                                                                                       |
| 1.08 | 9    | Initiate password reset (US 1.04)                 | Done    | Done     | COMPLETE                                                                                                                                                                    |
| 1.08 | 10   | Resend or cancel invitation for Invited users     | Done    | Done     | COMPLETE: Bugfix T213 — added success toast notifications, fixed DotActionsMenu focus jump                                                                                  |
| 1.09 | 1    | View and edit company profile                     | Done    | Done     | COMPLETE: CompanyProfilePage redesign — ABN/Tax fields, section headers, no input icons (T203). ABN masked in super-admin (T210). Google Places address autocomplete (T212) |
| 1.09 | 2    | Profile fields (logo, legal info, contacts, docs) | Done    | Done     | COMPLETE: T222 public MinIO URLs — removed proxy/blob, direct `<img src>` for avatars and logos                                                                             |
| 1.09 | 3    | Mandatory fields validation before save           | Done    | Done     | COMPLETE: EditCompanyModal Zod + ABN (11 digits) / taxCode (1-11 digits) regex validation (T207). Empty-string→undefined fix (T211)                                         |
| 1.09 | 4    | Changes saved immediately, apply to all workflows | Done    | Done     | COMPLETE: updateCompany mutation invalidates cache                                                                                                                          |
| 1.05 | 7    | Super-admin company detail page (tabbed)          | Done    | Done     | COMPLETE: CompanyDetailPage redesign — tabs outside card, company header inside card, name-only EditCompanyModal (T202)                                                     |
| 1.10 | —    | Users view and edit own profile                   | Done    | Done     | COMPLETE: UserProfilePage all apps; approval→empty state (T208), activity log→real API (T209)                                                                               |
| 1.02 | 5    | Expired link → error + admin resend only          | Done    | Done     | COMPLETE: Admin-only resend per FRD. ContactSupportLink component (placeholder mailto:support@forethread.com — TODO: real URL).                                             |
| 1.03 | —    | Cookie-based auth token storage (security)        | Done    | Done     | COMPLETE: httpOnly cookies for JWT access/refresh tokens; `cookie-parser` middleware; Bearer header fallback; frontend simplified (no in-memory tokens) (T480–T482)         |
| 1.06 | —    | Assign/remove users to/from projects (optional)   | Done    | Done     | COMPLETE: ProjectAccessModal in company-admin-app                                                                                                                           |

### Super Admin Dashboard — Implementation Gap Tracker (US-10 partial)

| US    | AC # | Criterion                                       | Backend | Frontend | Status                                                                                                    |
| ----- | ---- | ----------------------------------------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------- |
| 10.SA | 1    | 4 KPI cards (Status, Users, Companies, DB Perf) | —       | Done     | COMPLETE (T232): Real data users/companies, mock status/DB. Responsive 4→2→1 grid. KpiCard component      |
| 10.SA | 2    | Quick action buttons (4) navigate correctly     | —       | Done     | COMPLETE (T233): User Mgmt, Company Mgmt, Material Catalogue (disabled), Admin Panel                      |
| 10.SA | 3    | Platform State table with status badges         | —       | Done     | COMPLETE (T234, T578): Mock data, status badges, sorting, detail modal, integration toggle, reload button |
| 10.SA | 4    | Recent changes feed (5 audit log entries)       | Done    | Done     | COMPLETE (T235): getAuditLogs API, timeline UI with avatar+name+timestamp. RecentChangesTimeline          |
| 10.SA | 5    | Google Analytics placeholder card               | —       | Done     | COMPLETE (T236): Placeholder with i18n "coming soon" message                                              |
| 10.SA | 6    | All text from i18n (zero hardcoded strings)     | —       | Done     | COMPLETE (T237): dashboard.json namespace with all keys                                                   |
| 10.SA | 7    | All colors use CSS variables (zero hardcoded)   | —       | Done     | COMPLETE (T238): --success, --destructive, --warning CSS vars                                             |
| 10.SA | 8    | formatDateTime shared utility (deduplicated)    | —       | Done     | COMPLETE (T239): Moved to @forethread/ui-components, removed from 7 files in 6 apps                       |
| 10.SA | 9    | Refactored into components + hook + constants   | —       | Done     | COMPLETE (T240): KpiCard, PlatformStateTable, RecentChangesTimeline, useDashboardData                     |

### Enum Standardisation & Prisma Restructure — Gap Tracker

| US    | AC # | Criterion                                        | Backend | Frontend | Status                                                                                                                                                                                                                                                                |
| ----- | ---- | ------------------------------------------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2     | —    | Prisma multi-file schema with procurement models | Done    | —        | COMPLETE (T483–T486): 10 schema files, custom migration with CASE mapping                                                                                                                                                                                             |
| 2     | —    | Enums SCREAMING_SNAKE_CASE across all code       | Done    | Done     | COMPLETE (T487–T492): ~100 files updated, proper enum imports from @prisma/client and shared-types                                                                                                                                                                    |
| 10    | —    | FilterPopover key warning fix                    | —       | Done     | COMPLETE (T493): Added index to key in option mapping                                                                                                                                                                                                                 |
| 10    | —    | ESLint eqeqeq + import/order lint fixes          | —       | Done     | COMPLETE (T494): Dashboard files across 4 apps                                                                                                                                                                                                                        |
| 10    | —    | PO/CA dashboard Figma alignment (partial)        | Done    | Partial  | PARTIAL (T496–T498): KPI cards + QuickActions + QuoteResponses tabs done, but layout structure, button styling, and icons still don't match Figma                                                                                                                     |
| 10    | —    | PO/CA dashboard Figma alignment (round 2)        | —       | Done     | COMPLETE (T500–T507): Structure, buttons, icons aligned per Figma. Flag icon added, inline icons, tab pills, card layouts                                                                                                                                             |
| 10    | —    | Shared UI components & icons                     | —       | Done     | COMPLETE (T508–T510): DashboardItemCard, MessageBadgeIcon, CreateViewModal, TableManagementModal, DatePicker, FilterPanel, SelectDropdown, DashboardSection, SortIcon refactor, 16 new SVG icons                                                                      |
| 10    | —    | Dashboard/list pages Figma alignment (round 3)   | Done    | Done     | COMPLETE (T511–T516): AppLayout headers with back buttons, duplicate title removal, DotActionsMenu everywhere, BulkOrders columns aligned, RFQ comprehensive toolbar, status badge backend fields                                                                     |
| 10    | —    | Status colors & formatters shared extraction     | —       | Done     | COMPLETE (T517–T519): Extracted status color maps + formatCurrency/formatDate/formatStatus to @forethread/ui-components, replaced across all 7 apps, MessageBadgeIcon reuse                                                                                           |
| 10    | —    | InfoHint component + lint fixes                  | —       | Done     | COMPLETE (T520–T522): Shared InfoHint tooltip component, replaced duplicated pattern in CA/PO RfqListPage, fixed lint errors across apps                                                                                                                              |
| 10    | —    | FilterChip component + theme refinements         | —       | Done     | COMPLETE (T523–T525): FilterChip shared component, filter-chip CSS vars, border color fix (#E5E5E5), DataTableQuickFilters refactor                                                                                                                                   |
| 10.04 | 1    | RFQ table with all columns, Create new button    | Done    | Done     | COMPLETE (T515): Full column set, Create new button, paginated DataTable                                                                                                                                                                                              |
| 10.04 | 2    | Quick filter tabs                                | —       | Done     | COMPLETE (T515, T523): My RFQs, Open, Awaiting, No Quotes, Awarded, Closed filters via FilterChip                                                                                                                                                                     |
| 10.04 | 3    | Search bar across key fields                     | —       | Done     | COMPLETE (T515): Search input filters RFQ ID, project name                                                                                                                                                                                                            |
| 10.04 | 4    | Column header sorting                            | —       | Done     | COMPLETE (T515): Click header to sort asc/desc, SortIcon indicator                                                                                                                                                                                                    |
| 10.04 | 5    | Pagination 25 default, Back/Next                 | Done    | Done     | COMPLETE (T515, T541): 25 default, page size selector (25/50/100)                                                                                                                                                                                                     |
| 10.04 | 6    | Advanced filters panel                           | Done    | Done     | COMPLETE (T531, T549, T571–T572): Advanced filters wired; CreatedBy filter uses userId; SelectDropdown empty message                                                                                                                                                  |
| 10.04 | 7    | View toggle (Default/List)                       | Done    | Done     | COMPLETE (T526–T528, T551): Zustand store, view dropdown, saved views persisted to backend via UserTableView                                                                                                                                                          |
| 10.04 | 8    | Group by field                                   | —       | Done     | COMPLETE (T532): Visual grouping with collapsible accordion sections, group by status/project/vendor                                                                                                                                                                  |
| 10.04 | 9    | Vendor perspective                               | Done    | Done     | COMPLETE (T540, T543, T544, T564–T569): Vendor 8-col table, status colors, grouping restricted, detail page projectName, PDF download only (no copy for vendor), QuoteResponseStatus enum                                                                             |
| 10.04 | 10   | Export CSV/Excel                                 | Done    | Done     | COMPLETE (T533, T534, T548): CSV/XLSX download via RfqExportService, single RFQ PDF export                                                                                                                                                                            |
| 10    | —    | rfq-shared dedup + UX polish                     | Done    | Done     | COMPLETE (T559–T576): Dedup to rfq-shared, CSS var theming, pagination auto-hide, CopyRfqModal shared, QuoteResponseStatus enum, service refactor, quick filter normalization, UX fixes, pagination DTO                                                               |
| 10.07 | —    | FO dashboard Figma alignment                     | Done    | Done     | COMPLETE (T576, T579): DashboardItemCard, InvoiceDetailPage with real data, approve/decline, tabs, seed script                                                                                                                                                        |
| 10    | —    | Zustand store + view switcher + dropdown styling | —       | Done     | COMPLETE (T526–T530): createRfqTableStore factory, view switcher, archive hide, dropdown/datepicker active state                                                                                                                                                      |
| 10.01 | —    | CA dashboard navigation to detail/create pages   | —       | Done     | COMPLETE (T580): QuickActions → /new routes, card clicks → detail pages, eye icon buttons, stub pages                                                                                                                                                                 |
| 10.02 | —    | PO dashboard navigation to detail/create pages   | —       | Done     | COMPLETE (T581): Identical to CA — QuickActions, card clicks, stub pages for all entities                                                                                                                                                                             |
| 10.03 | —    | Vendor dashboard navigation to detail pages      | —       | Done     | COMPLETE (T582): Card clicks → detail, ActivePosTable row actions, stub pages for PO/invoice detail                                                                                                                                                                   |
| 10.SA | —    | SA dashboard real data (replace mock KPIs)       | Done    | Done     | COMPLETE (T583–T584): Backend getSuperAdminDashboard with Prisma queries, API client types, frontend rewrite with real user/company/project/procurement counts, DB ping, Users by Role                                                                                |
| 10.WH | —    | WH dashboard real data (replace stub)            | Done    | Done     | COMPLETE (T583, T585): Backend getWarehouseDashboard with PO delivery status + bulk orders, API client, frontend KPI cards + delivery sections + bulk order progress bars                                                                                             |
| 10    | —    | Test fixes (import order, mock setup)            | Done    | Done     | COMPLETE (T586): Fixed import order lint errors, mock setup issues across 22 test files in backend + CA + FO + vendor + SA apps                                                                                                                                       |
| 10.SA | —    | SA PlatformState refactor + AdminPanel stub      | —       | Done     | COMPLETE (T587): Extracted types/enums, usePlatformState hook, AdminPanelPage route                                                                                                                                                                                   |
| 10.01 | —    | CA + PO stub cleanup + AppLayout breadcrumbs     | —       | Done     | COMPLETE (T588): Simplified stubs, PO list page rewrite with DataTable, AppLayout nav for all entity types                                                                                                                                                            |
| 10.03 | —    | Vendor + SA stub page enhancements               | —       | Done     | COMPLETE (T589): Vendor detail pages with cards, AppLayout breadcrumbs, SA admin panel link                                                                                                                                                                           |
| 10.SA | —    | SA AdminPanel backend + PlatformState real API   | —       | Done     | COMPLETE (T590): GET /admin/panel, real API call in usePlatformState                                                                                                                                                                                                  |
| 10.01 | —    | BulkOrderDetail + PO list refinements            | —       | Done     | COMPLETE (T591): usePageTitleStore, BulkOrderDetail restyled, PO list fixes                                                                                                                                                                                           |
| 10.04 | —    | RFQ line item CRUD + BulkOrder UI refresh        | —       | Done     | COMPLETE (T592–T593): Backend PATCH/DELETE endpoints, EditLineItemModal, BulkOrder table restyle                                                                                                                                                                      |
| 10.04 | —    | RFQ Responses tab (real implementation)          | Done    | Done     | COMPLETE (T594): Full RfqResponsesTab with filter tabs, approve/decline actions, discount/coverage fields, ?tab=responses dashboard nav                                                                                                                               |
| 10    | —    | Lint/build/test fixes across apps                | —       | Done     | COMPLETE (T595): eqeqeq, unused vars, enum cast, import order, non-null assertion, test expectations                                                                                                                                                                  |
| 10.04 | —    | Quote Response Detail page (shared)              | —       | Done     | COMPLETE (T596): Shared QuoteResponseDetailPage in rfq-shared with 3 tabs (Messages, Quote Line Items, Attachments), route /rfqs/:id/quotes/:quoteId in CA+PO apps, message/paperclip icon navigation                                                                 |
| 10.04 | —    | Backend sortBy expansion (6→13 columns)          | —       | Done     | COMPLETE (T547): lineItems, reqQuantities, recVendors, recQuotes, lastModifiedBy, updatedAt sort cases in rfqs.service + RfqListQueryDto sortBy enum extended                                                                                                         |
| 10.04 | —    | RFQ Documents tab upload/delete                  | —       | Done     | COMPLETE (T546): RfqDocument Prisma model, POST/DELETE endpoints, API client functions, shared RfqDocumentsTab with upload/delete mutations, signed URL download, vendor readOnly                                                                                     |
| 10.06 | —    | Warehouse officer unit tests                     | —       | Done     | COMPLETE (T597): 21 test suites, 135 tests, 90%+ coverage threshold, auth/dashboard/profile/settings/routing/layout coverage                                                                                                                                          |
| 10.07 | —    | Invoice document upload/delete + FO attachments  | Done    | Done     | COMPLETE (T602): InvoiceDocument Prisma model, POST/DELETE endpoints, API client, FO InvoiceDetailPage attachments tab real data with view/download                                                                                                                   |
| 10.04 | —    | RFQ AdvancedFilters shared extraction            | —       | Done     | COMPLETE (T603): Extract AdvancedFilters component + store types to rfq-shared, deduplicate across CA/PO/Vendor RfqListPage                                                                                                                                           |
| 10.01 | —    | CA RecentOrdersSection card styling              | —       | Done     | COMPLETE (T604): Align card border/padding to Figma (rounded-[14px], border-black/20, header padding)                                                                                                                                                                 |
| 10.05 | —    | Procurement officer app unit tests               | —       | Done     | COMPLETE (T605): 50+ test suites covering auth/dashboard/invoices/profile/rfqs/POs/bulk-orders/vendors/settings/shared, vite SVG mock plugin, vitest forks pool config, lint/build fixes                                                                              |
| 10.07 | —    | Invoice export + real invoice lists              | Done    | Done     | COMPLETE (T606): InvoiceExportService (CSV/XLSX/PDF), real API in CA/PO/FO invoice list pages, filters/sort/export, CA/PO InvoiceDetailPage with tabs, vendor invoice route removal                                                                                   |
| 10.01 | —    | QuickActions with project source suggestions     | Done    | Done     | COMPLETE (T607): Backend projectSuggestions in PoCaDashboard, shared Button component, up to 3 project chips under Create PO/RFQ with ?projectId= nav                                                                                                                 |
| 10.02 | —    | PO dashboard project source suggestions          | Done    | Done     | COMPLETE (T607): Identical to CA — shared QuickActions with projectSuggestions                                                                                                                                                                                        |
| 10.03 | —    | Vendor ActivePosTable DotActionsMenu + UI polish | —       | Done     | COMPLETE (T608): DotActionsMenu in ActivePosTable, CustomDropdown drop-up, TablePagination width fix                                                                                                                                                                  |
| 10.07 | —    | Invoice shared package + advanced filters/export | Done    | Done     | COMPLETE (T609): @forethread/invoice-shared package (InvoiceListPage, InvoiceDetailPage, useInvoices hook), single invoice export endpoint, advanced query filters (vendorId, dueDate range, amount range, ids), CA/PO/FO/Vendor apps refactored to shared components |
| 10.01 | —    | QuickActions DotActionsMenu dropdown             | —       | Done     | COMPLETE (T610): DotActionsMenu trigger/triggerClassName/menuClassName props, CA/PO QuickActions "New (blank)" dropdown, dashboard i18n newBlank key                                                                                                                  |
| 10.07 | —    | InvoiceListPage Figma card layout + padding      | —       | Done     | COMPLETE (T611): Card container with border/rounded-lg, pagination inside table div, AppLayout pb-8 bottom padding, tailwind content paths for invoice-shared across 4 apps, SVG type declarations                                                                    |
| 10.07 | —    | TablePagination refactor + table overflow        | —       | Done     | COMPLETE (T612): TablePagination simplified styling, useDebounce hook, overflow-x-auto on all table containers, pagination moved outside table border across all apps                                                                                                 |
| 10.07 | —    | Invoice filter + DISPUTED approve fix            | Done    | Done     | COMPLETE (T613): keepPreviousData prevents filter panel unmount, loading guard uses !data, DISPUTED invoices no longer show approve/decline buttons per spec state machine                                                                                            |
| 10.03 | —    | DotActionsMenu position:fixed rewrite            | —       | Done     | COMPLETE (T614): position:fixed with getBoundingClientRect, auto drop-up, scroll-close handler — fixes overflow clipping in all tables                                                                                                                                |
| 10.01 | —    | Vendor ActivePOs table decomposition + scroll    | —       | Done     | COMPLETE (T615): Split into active-pos/ folder, inner border, header styling, 120px Actions column, DashboardSection maxHeight prop, invoice card navigation                                                                                                          |
| 10.03 | —    | VendorRfqStatus enum + backend status mapping    | Done    | Done     | COMPLETE (T616): VendorRfqStatus enum, computeVendorStatus from RfqStatus+QuoteResponseStatus, filter mapping, vendor-status.constants.ts                                                                                                                             |
| 10.07 | —    | Vendor invoice detail route + RFQ preview fixes  | —       | Done     | COMPLETE (T617): /invoices/:id route, AppLayout back button, RFQ preview fixed position, responsive mobile, close on navigate                                                                                                                                         |
| 10.07 | —    | Backend error messages i18n centralization       | Done    | —        | COMPLETE (T628): errors.json i18n namespace, ERR constants object, all 21 backend files refactored — zero hardcoded error strings                                                                                                                                     |
| 10.07 | —    | Procurement officer app test mock fixes          | —       | Done     | COMPLETE (T629): LoginPage zodResolver mock, importMock→import refactor, activate/reset page mocks, BulkOrderListPage/InvoiceDetailPage/RfqDetailsTab test fixes                                                                                                      |
| 10.07 | —    | Company admin hook + page test coverage          | —       | Done     | COMPLETE (T632): 9 new hook/store test suites + 7 page test expansions — useBulkOrderSort, useProjectSort, usePoSort, useColumnDragDrop, useRfqExport, useRfqGrouping, useRfqSort, rfq-table.store, useUserSort                                                       |
| 10.07 | —    | Super admin dashboard + hook test coverage       | —       | Done     | COMPLETE (T633): 7 new test suites (dashboard.constants, useDashboardData, usePlatformState, KpiCard, PlatformStateTable, RecentChangesTimeline, useUserSort) + DashboardPage expansion                                                                               |
| 10.07 | —    | Procurement officer hook + page test coverage    | —       | Done     | COMPLETE (T634): 2 new hook tests (useBulkOrderSort, usePoSort) + 12 page/component test expansions (auth 5, bulk-orders 2, profile, POs, RFQs 2, shared 2), vite coverage config                                                                                     |
| 10.07 | —    | Vendor app hook + page test coverage + lint fix  | —       | Done     | COMPLETE (T635): 5 new hook tests (useBulkOrderSort, usePoSort, useColumnDragDrop, useRfqExport, useRfqGrouping, useRfqSort) + 10 page test expansions + lint/TS fixes                                                                                                |
| 10.07 | —    | PO app additional RFQ + profile test coverage    | —       | Done     | COMPLETE (T636): EditProfileModal, RfqDetailsTab, RfqDetailPage test expansions + new useColumnDragDrop, rfq-table.store test suites                                                                                                                                  |
| 10.06 | —    | bulk-order-shared dedup + FilterDropdownButton   | —       | Done     | COMPLETE (T637): @forethread/bulk-order-shared package (BulkOrderListPage, BulkOrderDetailPage, hooks, services, constants), FilterDropdownButton + FilterPopover search, CA/PO/Vendor apps refactored, i18n Figma label alignment                                    |
| 10.06 | —    | Bulk Order CRUD + drawdown modals                | Done    | Done     | COMPLETE (T638): Backend POST/PATCH/DELETE bulk-orders + line-items + drawdowns endpoints, 5 modals (Create/Edit/EditLineItem/Drawdown/Delete), mutation hooks, "coming soon" eliminated, vendor readOnly                                                             |
| 10.06 | —    | DatePicker + bulk order modal polish             | Done    | Done     | COMPLETE (T639): Enhanced DatePicker (editable text input, validation), bulk order modals use DatePicker, Delete icon color, modal width tuning                                                                                                                       |
| 2.01  | —    | Project pages DatePicker integration             | —       | Done     | COMPLETE (T640): Create/Edit project pages use DatePicker component instead of native date inputs, Controller-based integration with react-hook-form                                                                                                                  |
| 10.06 | —    | Docker build + backend test coverage fixes       | Done    | Done     | COMPLETE (T641): Dockerfile fix (Prisma copy, i18n, shared-types build), backend test coverage (rfqs/dashboard/bulk-orders controllers), procurement-officer coverage config fix                                                                                      |
| 2.07  | 1    | PO schema expansion per data fields template     | Done    | —        | COMPLETE (T680): 18 PoStatus, 5 PoType, ApprovalStatus/PoSourceOfCreation/PoChangeType enums, PoLineItem/PoDocument/PoChangeRequest models, poNumber, parentPoId self-relation, financial fields, vendor delivery fields                                              |
| 2.07  | 2    | Shared enums + quick filters + service           | Done    | —        | COMPLETE (T681–T683): PoQuickFilter (11 filters), enriched list/detail responses, ApprovalStatus enum, lastModifiedBy tracking, po-export service, dashboard poNumber fix                                                                                             |
| 2.07  | 3    | PO list shared UI components + packages          | —       | Done     | COMPLETE (T684–T685): @forethread/po-shared package, ui-components (ExportDropdown, GroupByButton, ToolbarSearchToggle, ViewSelectorDropdown, useDropdown), api-client export endpoint, i18n 18 status labels + quick filter labels                                   |
| 2.07  | 4    | PO list pages for CA/PO/Vendor apps              | —       | Done     | COMPLETE (T686–T688): Full rewrite with quick filters, column management, saved views, drag-drop, grouping, search, export, vendor-specific columns, RfqListPage shared toolbar extraction                                                                            |

## Design References

- **Primary Figma File**:
  [Forethread Procurement Platform](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/)
- **Epic 2 Dashboards**:
  [Dashboard Designs (node 3344-58649)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3344-58649)
- **PO/CA Dashboard (detailed Figma frames)**:
  - [PO Dashboard (node 3345-110136)](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110136&m=dev)
  - [CA Dashboard (node 3347-115416)](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3347-115416&m=dev)
  - [Dashboard Buttons/Icons (node 3345-110090)](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110090&m=dev)

> Per-screen Figma links are embedded in each User Story under **Figma Screens** below.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - User Registration & Access Management (Priority: P1)

**Figma Screens**:

- [US 1.01 – New user registration](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88438)
  - [Register new user 1.1](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88440)
  - [Register new user 1.2 - Contractor](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88572)
  - [Register new user 1.2 - Vendor](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88598)
  - [Register new user - 1.3](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88623)
  - [Register new user - 1.4](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88688)
- [US 1.02 – User account activation](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-90777)
  - [User account activation - 1.1](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-90826)
  - [User account activation - 1.2](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3899-118107)
- [US 1.03 – User login (Super Admin)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88176)
  - [Log in](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3694-118738)
- [US 1.03 – User login (All users)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-90924)
  - [Log in](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3903-118584)
  - [2FA](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3903-121255)
- [US 1.04 – Password reset (Super Admin)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88222)
  - [Reset Password](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-88340)
- [US 1.04 – Password reset (All users)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91072)
  - [Reset Password](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91207)
- [US 1.05 – RBA management](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-89157)
  - [User Management](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-90180)
  - [User Management (1.05)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3944-7048)
  - [User Profile](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-89223)
  - [Company detail page](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-89371)
  - [Action Log](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-89161)
- [US 1.07 – Add users to contractor](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91507)
  - [Add users to contractor-1](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91509)
  - [Add users to contractor-2](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91831)
  - [Add users to contractor-3](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91857)
  - [Add users to contractor-4](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91892)
- [US 1.08 – Manage users within a company](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91910)
  - [Manage users within a company-1](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91912)
  - [User Profile](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-92239)
- [US 1.09 – Contractor profile management](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-92484)
  - [My Profile](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-92486)
- [US 1.10 – Manage user profile](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91305)
  - [My Profile](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3647-91307)

A Super Admin can invite users to the platform, assign them to companies and roles, and manage their
lifecycle (invite, activate, deactivate, reactivate). All users receive a secure email invitation
and activate their account by setting a password. Once active, users log in with email + password
and confirm via an OTP code.

**Why this priority**: Nothing else on the platform is usable without authenticated users. This is
the access foundation for every other workflow.

**Independent Test**: Create a Super Admin account, invite a Company Admin to a new contractor
company, follow the invitation link, set a password, log in with OTP, and verify the correct
dashboard is displayed. The platform delivers immediate value: a real user can now log in and access
their workspace.

**Acceptance Scenarios**:

- [x] **Given** a Super Admin is logged in, **When** they create a new user and assign them to an
      existing contractor company with the Procurement Officer role, **Then** an invitation email is
      sent and the user appears in the user list with status "Invited."
- [x] **Given** a user has received an invitation email, **When** they click the link and set a
      password within 30 days, **Then** their account status changes to "Active" and the invitation
      link expires immediately.
- [x] **Given** an active user enters correct email and password, **When** they submit the login
      form, **Then** an OTP code is sent to their email and they must enter it to complete login.
- [x] **Given** a user's account is deactivated by an admin, **When** the user attempts to log in,
      **Then** access is denied and the user receives a notification about deactivation.
- [x] **Given** an invitation link is older than 30 days, **When** the user clicks it, **Then** an
      error is shown and the Super Admin can resend a fresh invitation.

---

### User Story 2 - Project Creation & Management (Priority: P2)

**Figma Screens**:

- [US 5.03 – Create a Project](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2974-38530)
- [US 5.04 – View & edit all projects](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2934-12123)

A Company Admin or Procurement Officer can create projects, assign users to them, and manage project
details. Projects are the organisational container for all procurement documents — without a
project, no RFQ, PO, or invoice can be created.

**Why this priority**: Projects are the second required building block. Every procurement workflow
is scoped to a project. A minimal working procurement flow requires at least one project.

**Independent Test**: Create a project with a name, location, storage location, and two assigned
users. Verify that only assigned users can access project documents, and that unassigned users see
no project data. The platform delivers value: team members can now be organised around their work.

**Acceptance Scenarios**:

- [x] **Given** a Procurement Officer is logged in, **When** they create a project with name, at
      least one location (marked default), storage location, and assigned users, **Then** the
      project is saved, the procurement officer is automatically assigned to it, and they cannot add
      or remove other users.
- [x] **Given** a Company Admin creates a project, **When** they view the project detail page,
      **Then** they can see overview, BOM, procurement documents, vendor list, and financial summary
      sections.
- [x] **Given** two users exist — one assigned to a project and one not — **When** the unassigned
      user logs in, **Then** they cannot see or access any documents belonging to that project.
- [x] **Given** a project already exists with a given name, **When** a user attempts to create
      another project with the same name, **Then** the system prevents saving and shows a clear
      error.

---

### User Story 3 - RFQ Creation & Vendor Quote Collection (Priority: P3)

**Figma Screens**:

- [5.05 Create RFQ (PO + CA)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2974-38530)
- [US 2.06 RFQ dashboard (PO + CA)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2934-12123)
- [US 2.06 RFQ dashboard (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2934-12122)

A Procurement Officer or Company Admin can create Requests for Quotation (RFQs), add material line
items from the catalogue, send the RFQ to selected vendors, and receive their quotes. The system
checks active bulk orders and suggests drawdowns to avoid unnecessary re-quoting for pre-committed
materials.

**RFQ Screens** (from designer 3.3 — CORE of the system):

- **RFQ list**: Status (draft, sent, responded, closed). Filters: vendor, project, date
- **Create RFQ**: Add items (from catalog), add quantities, project selector (multi-project allowed
  for office workers), delivery needed by (deadline for vendor reply), notes, attach BOM (PDF, image
  → OCR)
- **Send RFQ**: Vendor receives tokenized link (no login required)
- **Vendor Response Viewer**: Table of quotes from each vendor, compare view (side-by-side),
  highlight best price, accept winning quote

**Why this priority**: RFQ is the starting point of the procurement cycle. Without the ability to
solicit quotes from vendors, purchase orders cannot be created from market pricing.

**Independent Test**: Create an RFQ with at least two line items for an existing project, send it to
two vendors, have one vendor submit a quote response, and verify the quote appears in the
contractor's RFQ dashboard. This delivers immediate value: the core procurement initiation flow is
end-to-end testable.

**Acceptance Scenarios**:

- [ ] **Given** a Procurement Officer is creating an RFQ, **When** they add a line item that exists
      in an active bulk order, **Then** the system notifies them and suggests a drawdown for that
      item; accepting removes it from the RFQ and initiates the drawdown workflow automatically.
- [ ] **Given** an RFQ has been created, **When** the user selects vendors from their company's
      vendor list and sends the RFQ, **Then** each selected vendor receives an email notification
      with an invitation link to respond, even if their account is not yet activated.
- [ ] **Given** a vendor receives an RFQ invitation link, **When** they open it and submit a quote
      with prices, quantities, and delivery dates for the requested items, **Then** the quote
      appears in the RFQ detail page on the contractor side.
- [ ] **Given** an RFQ has been sent to vendors, **When** a Procurement Officer edits the RFQ before
      any vendor submits a response, **Then** the changes are saved and vendors are notified of the
      update.
- [ ] **Given** a user adds line items to an RFQ and confirms them, **When** those items exist in
      active bulk orders, **Then** the system notifies the user per item and suggests drawdown; if
      confirmed, items are removed from the RFQ and drawdown is initiated.
- [ ] **Given** all RFQ items are fully covered by bulk orders and the user confirms, **Then** the
      RFQ creation flow is closed and user is informed no RFQ is required.
- [ ] **Given** a user creates an RFQ from a saved material list or by copying an existing RFQ,
      **When** the data is loaded, **Then** line items are pre-populated and the user can review,
      edit, add, or remove items before proceeding.
- [ ] **Given** a user manually enters a material name not found in the catalogue, **When** they
      attempt to add it, **Then** they can create a new private catalogue item directly from the RFQ
      creation flow.

---

### User Story 4 - Quote Review & Approval (Priority: P4)

**Figma Screens**:

- [5.06 Review quotes (PO + CA)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3001-32552)

A Procurement Officer or Company Admin can compare vendor quotes side-by-side, approve or decline
quotes at the line-item level, and convert approved quotes into purchase orders, bulk orders, or
hold-for-release orders.

**Why this priority**: Quote review closes the RFQ loop and is the gateway to PO creation. It is the
primary decision point in the procurement workflow.

**Independent Test**: With an RFQ containing two vendor responses, open the comparison view, approve
one vendor's line items, and convert the approved lines to a purchase order. Verify the PO is
created with pre-populated data from the quote.

**Acceptance Scenarios**:

- [ ] **Given** multiple vendor quotes exist for an RFQ, **When** the user opens the quote review
      screen, **Then** they can toggle between a side-by-side comparison table and a list view; the
      lowest price per line item is visually highlighted.
- [ ] **Given** a user approves specific line items from a vendor quote, **When** the approval is
      saved, **Then** only those approved items and quantities can be converted to procurement
      documents; the vendor is notified of their approved items.
- [ ] **Given** a quote has been approved, **When** the user initiates conversion, **Then** they can
      choose to create a standard PO, a bulk order, or a hold-for-release order; data from the quote
      pre-populates the resulting document.
- [ ] **Given** all vendor quotes for an RFQ have been reviewed, **When** the user closes the RFQ,
      **Then** all non-approved vendors are notified that they were not selected.
- [ ] **Given** a user is in the comparison table view, **When** they review vendor quotes, **Then**
      each vendor column shows: price per unit, quoted quantity, line total (with tax indicator),
      delivery date, discount, shipment/handling, total with taxes, and substitution indicator.
- [ ] **Given** a user wants to approve individual line items from different vendors, **When** they
      approve items, **Then** they can specify approved quantity per vendor per line item; total
      approved quantity cannot exceed the RFQ requested quantity.
- [ ] **Given** a user allocates approved quantities across multiple vendors for the same item,
      **When** they save, **Then** each vendor is notified only of their approved items and
      quantities.

---

### User Story 5 - Purchase Order Creation & Issuance (Priority: P5)

**Figma Screens**:

- [5.07 (reference)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3021-41329)
- [PO Management](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3038-37041)
- [PO Management (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-49246)
- [PO Management (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-50404)
- [copying the existing PO](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3215-82211)
- [1.4 creating a PO manually -1](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3040-39705)
- [1.4 creating a PO manually -1 (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3163-43970)
- [1.4 creating a PO manually -1 (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3265-50554)
- [1.4 creating a PO manually -2.0](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-43083)
- [1.4 creating a PO manually -2.0 (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-46260)
- [1.4 creating a PO manually -2.1](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-40607)
- [1.4 creating a PO manually -2.1 (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3123-41091)
- [1.4 creating a PO manually -2.1 (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-40701)
- [1.4 creating a PO manually - add notes](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-46864)
- [1.4 creating a PO manually - add notes (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-48037)
- [1.4 creating a PO manually - add notes (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-48884)
- [1.4 creating a PO manually - add notes (variant 4)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-54256)
- [1.4 creating a PO manually - add notes (variant 5)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-54554)
- [Add from Approved quotes](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-47842)
- [Add from Approved quotes (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-47301)
- [Add from Approved quotes (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-47327)
- [Add from Approved quotes (variant 4)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53924)
- [Approved RFQs](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-74267)
- [Approved RFQs (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-75118)
- [Add from Bulk Orders](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-48068)
- [Add from Bulk Orders (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53357)
- [Add from Bulk Orders (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53453)
- [Add from Bulk Orders (variant 4)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53953)
- [Add from Bulk Orders (variant 5)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-77509)
- [Add from Bulk Orders (variant 6)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-77848)
- [Bulk Order](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-76575)
- [Bulk Order (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-76998)
- [Converting Approved RFQ](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-58096)
- [Converting Approved RFQ (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-55891)
- [Converting Approved RFQ (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-57126)
- [Converting Approved RFQ (variant 4)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-79099)
- [Converting BOM](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-78079)
- [Converting BOM (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-78589)
- [Converting BOM (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-51476)
- [Converting BOM (variant 4)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-51899)
- [1.3. PO manually - 3.2](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-45236)
- [1.3. PO manually -4](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-45662)
- [1.3. PO manually - success](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-46069)
- [1.3. PO manually - success (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3220-49232)
- [1.3. PO manually - error](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3041-46079)
- [Loading](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3216-83262)
- [Success](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3216-83273)
- [US 2.07 PO dashboard (All users)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2952-17268)
- [US 2.07 PO dashboard (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2960-32928)

A Procurement Officer or Company Admin can create purchase orders by: converting approved RFQ
quotes, drawing down from bulk orders, converting material requests, manual creation, or copying an
existing PO. **Release 1 supports single vendor and single project per PO.**
Multi-vendor/multi-project POs with automatic splitting are deferred to US-5.11 (post-Release 1).
The system validates mandatory fields, checks line items against warehouse inventory, bulk orders,
and approved RFQs, assigns a unique PO number, and sends the PO to the vendor.

**PO Status Lifecycle** (from designer):
`Draft → Sent → Acknowledged → Pending Delivery → Delivered → Closed`

**PO Details** (from designer): Items, Prices, Vendor acknowledgement upload, Internal chat /
comment thread (Office ↔ Vendor ↔ Field), Change Order section (see US-15).

**Send PO** (from designer): Vendor receives tokenized link showing items, quantities, prices with
buttons to Acknowledge or Reject, and ability to upload receipt.

**Why this priority**: The PO is the formal commitment to a vendor and the anchor document for
delivery and invoicing. It is the most critical output of the procurement cycle.

**Independent Test**: Create a PO manually for an existing project and vendor, add at least one line
item with price and quantity, issue the PO, and verify the vendor receives a notification. Verify
the PO is accessible from both the project detail page and the PO dashboard.

**Acceptance Scenarios**:

- [x] **Given** a user creates a PO manually, **When** they click "Create new" on the PO list page
      or dashboard, **Then** a dropdown shows creation options (Create manually, Converting Approved
      RFQ, From Bulk order). "Create manually" navigates to the PO creation form. _PO creation
      wizard aligned to Figma: 3-step Stepper, PoBasicInfoStep (2-col layout with document name,
      vendor (optional), project, payment terms, delivery location, delivery date, pick-up /
      hold-for-release checkboxes), PoCreateLineItemsStep (MaterialSearchPanel, table with Approved
      RFQ and Bulk Orders placeholder columns), PoReviewStep. Wizard refactored (T797) — extracted
      usePoWizardForm, useMaterialSearch, usePoDropdownOptions hooks,
      LineItemRow/LineItemsTableHeader components, line-items constants, format utils. DatePicker
      borderless mode for table cells. Full wizard wired in CA, PO, Vendor apps via po-shared
      package. Backend POST create + PATCH update + POST issue endpoints operational (T725-T728).
      Document upload/delete (T701-T703). Copy PO (T784-T785). Save as draft. Zod validation on all
      mandatory fields. Attachments with drag-and-drop, format/size validation._
- [x] **Given** a user creates a PO manually and adds items, **When** the system detects those items
      are covered by an active bulk agreement with the selected vendor, **Then** it automatically
      applies bulk pricing to those items and shows how much bulk quantity remains available. _DONE:
      validate-items endpoint enhanced — now checks both approved RFQs and bulk orders by
      materialName (case-insensitive). Frontend auto-validation via useLineItemValidation hook feeds
      inline "N quotes" / "N orders" counts into Appr. RFQ and Bulk orders table columns. Coverage
      modals pass vendorId on confirmation to auto-set PO vendor._
- [x] **Given** a PO is created and issued, **When** the vendor views it, **Then** they can see all
      line items, delivery details, and can confirm or propose changes. _DONE: POST
      /v1/purchase-orders/:id/confirm (T755) — vendor confirms SENT→ACKNOWLEDGED. Propose changes
      requires change request CRUD (T754, separate US). Vendor PO detail page already shows line
      items and delivery details._
- [ ] **Given** a PO is marked as a pick-up order, **When** the vendor receives it, **Then**
      delivery information fields are hidden and the PO is labelled "Pick-up" in all views.
      _BLOCKED: Vendor tokenized PO page not implemented._
- [x] **Given** a user creates a PO from an approved RFQ quote, **When** they confirm the
      conversion, **Then** the PO is pre-populated with vendor, items, quantities, and agreed prices
      from the quote, which the user can still adjust before issuing. _DONE (UI):
      ApprovedQuotesModal (T794) — RFQ accordion with quote items, search, UoM filter, select and
      add-to-list flow. RfqCoverageModal for per-item RFQ coverage check. Items added with
      quantities and pricing, user can adjust before submission. Backend quote comparison API (T407)
      still pending for real data — currently uses mock/placeholder data._
- [x] **Given** a user creates a PO manually, **When** they add line items, **Then** the system
      checks each item against warehouse inventory, existing bulk orders, and approved RFQs, and
      informs the user which items are: available for warehouse release, available for bulk order
      drawdown, or covered by an approved RFQ with agreed pricing. _DONE (bulk orders + RFQs):
      validate-items endpoint checks approved RFQs by materialId/materialName and bulk orders by
      description/itemReference. useLineItemValidation hook auto-triggers debounced validation in
      manual mode. Results shown inline in table columns per Figma design. Warehouse inventory check
      not started (warehouse module not implemented)._
- [x] **Given** a user selects a vendor during PO creation, **When** the vendor is selected,
      **Then** the system auto-populates the vendor's details (company name, legal info, address).
      _DONE: Review step (PoReviewStep) displays vendor company name (legalName/tradeName), contact
      email, and phone number from the vendor data fetched via useCompanyVendors hook. vendorId is
      optional — PO can be created without a vendor for manual creation._
- [x] **Given** a PO includes items covered by an approved RFQ, **When** the user confirms RFQ
      conversion, **Then** the system adds the vendor and items from the approved RFQ to the current
      PO with quantities and pricing. _DONE (UI): ApprovedQuotesModal + RfqCoverageModal implement
      this flow. Backend real quote data pending (T407)._
- [ ] **Given** a PO includes items available in warehouse inventory, **When** the user confirms a
      warehouse release, **Then** the corresponding warehouse release flow is initiated and the
      released items are removed from the current PO. _BLOCKED: Warehouse module not started._
- [x] **Given** a PO includes items covered by a bulk order, **When** the user confirms a bulk order
      drawdown, **Then** the system adds the bulk order vendor and reserved items to the current PO
      with agreed bulk quantities and pricing. _DONE (UI): BulkOrdersModal +
      BulkOrderCoverageModal + BulkPriceWarningModal implement this flow. Backend drawdown API
      integration pending._
- [x] **Given** a PO is created from an external source (RFQ, bulk order, or material request),
      **When** the system auto-populates data, **Then** the user can review and adjust all values
      before submission. _DONE: ApprovedQuotesModal and BulkOrdersModal add items with pre-filled
      data (material, qty, UoM, price). User can edit all values in the line items table and review
      in Step 3 before submission. Material request source not yet implemented._
- [ ] ~~**Given** a user creates a multi-vendor PO, **When** the PO is issued, **Then** the system
      automatically splits it into separate POs per vendor according to the split workflow
      (US-5.11).~~ _Deferred to post-Release 1 (US-5.11). Release 1 enforces single vendor and
      single project per PO._

---

### User Story 5b - Change Request Management (Priority: P5)

A Vendor, Company Admin, or Procurement Officer can create and manage change orders for existing
purchase orders, adjusting quantities, items, or terms with the correct approvals and a full audit
trail.

**Acceptance Scenarios**:

- [ ] **Given** a user initiates a Commercial change on an issued PO, **When** the change is
      submitted, **Then** the other party receives the request with status "Pending change" and can
      see proposed values alongside current values.
- [ ] **Given** a commercial change request is approved, **When** both parties are notified,
      **Then** the PO is updated with the approved changes and both parties can see the new values.
- [ ] **Given** a user makes an Internal change (cost codes, material codes, project references),
      **When** they save, **Then** the change is applied immediately and the other party is
      notified.
- [ ] **Given** any change is made to a PO, **When** the user views version history, **Then** they
      can see: who made the change, who approved it, changed fields, previous/new values, change
      type, and timestamp.

---

### User Story 5c - Pick-up PO & RFQ Items (Priority: P5)

A Procurement Officer or Company Admin can mark purchase orders as pick-up orders and mark
individual RFQ line items as pick-up, so that vendors quote without shipment costs and materials are
collected directly.

**Acceptance Scenarios**:

- [ ] **Given** a user marks a PO as pick-up, **When** the vendor receives it, **Then** delivery
      fields are disabled, PO is labelled "Pick-up", and the user can set pick-up time expectation
      and contact details.
- [ ] **Given** a user marks RFQ line items as pick-up, **When** a vendor responds, **Then**
      shipment/handling costs are not required for those items; pick-up status is preserved when
      converted to PO.

---

### User Story 5d - PO & Bulk Auto-Apply (Priority: P5)

**Figma Screens**:

- [Add from Bulk Orders](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3165-48068)
- [Add from Bulk Orders (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53357)
- [Add from Bulk Orders (variant 3)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53453)
- [Add from Bulk Orders (variant 4)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3195-53953)
- [Add from Bulk Orders (variant 5)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-77509)
- [Add from Bulk Orders (variant 6)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-77848)
- [Bulk Order](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-76575)
- [Bulk Order (variant 2)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3208-76998)

When creating a PO for a vendor with an active bulk agreement, bulk pricing and terms are
automatically applied to covered items, with remaining non-bulk items orderable in the same PO.

**Acceptance Scenarios**:

- [ ] **Given** a user creates a PO and selects a vendor with an active bulk agreement, **When**
      they add line items that exist in the bulk agreement, **Then** bulk pricing is applied
      automatically and remaining bulk quantity is shown.
- [ ] **Given** a user enters a quantity exceeding remaining bulk quantity, **When** the PO is
      submitted, **Then** only available bulk quantity uses bulk pricing and the remainder is
      treated as standard pricing.
- [ ] **Given** a PO with bulk items is issued, **When** the system processes it, **Then**
      quantities are deducted from the bulk agreement and updated remaining quantities are visible.

---

### User Story 5e - Delivery Responsible Person (Priority: P5)

A Procurement Officer or Company Admin can specify a delivery responsible person on a PO, who then
receives the PO PDF and a tokenized link to submit the delivery report.

**Acceptance Scenarios**:

- [ ] **Given** a user creates a PO and enters a delivery responsible person (name + email),
      **When** the PO is issued, **Then** the responsible person receives an email with PO PDF and a
      tokenized link to submit the delivery report.

---

### User Story 6 - Vendor & Supplier Management (Priority: P6)

**Figma Screens**:

- [US 2.06 RFQ dashboard – Vendor list](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3171-49465)
- [US 2.06 RFQ dashboard (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2934-12122)
- [US 2.07 PO dashboard (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2960-32928)
- [Vendor Dashboard](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3350-65375)

Procurement Officers and Company Admins can invite vendors to the platform, manage vendor profiles
(including their sales representatives and specialisations), and communicate with vendors within the
context of specific documents. Vendors can manage their own profiles and respond to RFQs and POs.

**Why this priority**: Without a vendor network, no RFQ can be sent or quotes received. Vendor
management supports the entire procurement cycle.

**Independent Test**: Invite a vendor to the platform, have them activate their account, update
their profile (specialisations, warehouse locations, representatives), and verify their profile is
visible in the contractor's vendor list with correct details.

**Acceptance Scenarios**:

- [x] **Given** a Procurement Officer invites a vendor by providing company name, company email, rep
      name, and rep email, **When** the invitation is sent, **Then** both the company email and the
      rep email receive the invitation; the vendor appears in the contractor's vendor list with
      status "Invited." _DONE: Backend VendorsModule with POST /vendors/invite (creates company +
      user + assignment, sends invitation emails). GET /vendors (paginated list with search/filter).
      Frontend VendorListPage with invite modal in CA and PO apps. VendorCategory enum (15
      specialisations) added to CompanyVendorAssignment. Email templates for vendor invitation.
      UPDATED: VendorListPage rewritten with company-grouped accordion view, status/company filters,
      CreateVendorCompanyModal for creating vendor companies inline, auth interceptor logout on 401.
      Extracted @forethread/vendor-shared package (T850). Fixed alreadyExisted notification —
      success modal now shown for both new and existing vendors. RBAC: COMPANY_ADMIN and
      PROCUREMENT_OFFICER can now create vendor companies (POST /companies auto-assigns to
      contractor). Invite flow fixed: existing vendors get new user created (not 409). Vendor list
      returns one row per company with representatives[] array. Edit User Details modal for vendor
      reps. Success modal matches user management design (560px). Dot menu: Reset/Cancel Invitation
      for INVITED status. Contractor roles can access vendor users via GET/PATCH /users/:id
      (T860-T861)._
- [x] **Given** a vendor already exists on the platform (invited by another contractor), **When** a
      different contractor invites that vendor, **Then** the vendor is added directly to the
      contractor's vendor list and a new representative user is created. _DONE: Backend checks
      vendor company by contactEmail; if exists, creates CompanyVendorAssignment (if not already
      assigned) and creates new vendor user with invitation. Returns alreadyExisted flag. Frontend
      shows full invitation success modal with email info and countdown (T860)._
- [ ] **Given** a user is on the vendor selection screen during RFQ creation, **When** they expand
      the vendor sales rep panel, **Then** they can see name, email, phone, and role for each sales
      representative without selecting the vendor.
- [ ] **Given** a Procurement Officer and a vendor are both viewing a specific PO, **When** either
      party sends a message in the in-app communication thread, **Then** the other party receives an
      in-app and email notification; messages are timestamped and linked to the document.

---

### User Story 7 - Material Catalogue Management (Priority: P7)

**Figma Screens**:

- [Material Request flow (Mobile)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2002-176)

A Super Admin can manage the public material catalogue (add, edit, archive, delete materials,
approve/reject suggestions). Procurement Officers and Company Admins can contribute materials via
file upload with column mapping, search with smart suggestions, create lists and favourites, and
create/edit Bills of Materials (BOMs) for their projects. The system supports duplicate detection,
file import (XLS, XLSX, CSV, PDF for BOMs), and BOM-to-catalogue matching with confidence scores.

**Material Catalog Screens** (from designer 3.2):

- **List of materials**: Filterable by category, UOM, price, duplicates
- **Material details**: Name, Manufacturer, SKU/internal ID, UOM, Price, Description, Photos,
  Deprecated (yes/no) flag
- **Tools**: Duplicate detection (flag UI to surface potential duplicate entries), Archive /
  Unarchive (soft-delete materials from active catalogue)

**Why this priority**: The material catalogue is the data backbone for RFQ and PO line items.
Without catalogued materials, procurement documents cannot be created correctly.

**Independent Test**: Upload a CSV file of materials, map columns, confirm the import, and verify
that the imported materials are searchable and can be added as line items in a new RFQ. This
delivers value: users have a working catalogue to drive procurement.

**Acceptance Scenarios**:

- [ ] **Given** a Super Admin uploads a file to the catalogue, **When** the file is processed,
      **Then** the system presents a column-mapping step where data types are auto-suggested; the
      admin can confirm or adjust mappings before committing.
- [ ] **Given** a Procurement Officer searches the catalogue while creating an RFQ, **When** they
      type a material name, **Then** real-time suggestions appear including frequently used
      materials, recently used materials, and BOM materials for the selected project.
- [ ] **Given** a Procurement Officer suggests a new material, **When** they submit the suggestion,
      **Then** the material is not visible to other users until a Super Admin reviews and approves
      it.
- [ ] **Given** a Super Admin approves a suggested material, **When** the approval is saved,
      **Then** the material is immediately available in the public catalogue for all users.
- [ ] **Given** a Super Admin reviews a suggested material, **When** they approve it, **Then** it is
      published immediately to the public catalogue visible to all users.
- [ ] **Given** a Procurement Officer uploads a file (XLS/XLSX/CSV) with material data, **When** the
      system processes it, **Then** a column-mapping step is shown where the user can confirm or
      adjust auto-detected column types before importing.
- [ ] **Given** imported materials include duplicates of existing catalogue items, **When** the user
      attempts to save, **Then** the system prevents saving and shows which items are duplicates
      with options to resolve.
- [ ] **Given** a user marks materials as preferred and adds them to a list, **When** another user
      in the same company views the catalogue, **Then** they can see the preferred materials and
      lists.
- [ ] **Given** a user types in the catalogue search field, **When** matching materials exist,
      **Then** the system suggests matching names in real time plus recommendations (frequently
      used, recently used, project BOM items).
- [ ] **Given** a user uploads a BOM document (XLS/XLSX/CSV/PDF), **When** the system extracts data,
      **Then** it displays an editable table with matched catalogue items, confidence scores, and
      allows manual matching for low-confidence items.
- [ ] **Given** a BOM item has no catalogue match, **When** the user reviews it, **Then** they can
      create a new private catalogue item directly from the BOM review screen.
- [ ] **Given** a user edits an existing BOM, **When** they add, edit, or remove items, **Then**
      changes are saved immediately but don't impact existing RFQs, POs, invoices, or material
      requests.

---

### User Story 8 - Bulk Order Management (Priority: P8)

**Figma Screens**:

- [US 2.11 – Bulk order view (CA, PO)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3347-110497)
- [US 2.11 – Bulk order view (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3350-70597)

Procurement Officers and Company Admins can create bulk orders from approved RFQ responses to lock
in pricing and quantity commitments over time. They can draw down from active bulk orders when
creating POs, and vendors can review, accept, or propose changes to bulk agreement terms. Both
parties can track remaining quantities and agreement status.

**Why this priority**: Bulk orders are an advanced procurement feature that reduces per-transaction
costs for high-volume materials. It is independent of standard PO flows.

**Independent Test**: Create a bulk order from an approved RFQ quote, perform a drawdown to create a
PO for part of the bulk quantity, and verify the remaining available quantity in the bulk order is
reduced accordingly.

**Acceptance Scenarios**:

- [ ] **Given** a Procurement Officer creates a bulk order from an approved RFQ response, **When**
      they define the end date, **Then** the system tracks available quantities and auto-suggests
      drawdowns when those materials appear in future RFQ or PO creation flows.
- [ ] **Given** a bulk order is assigned to a specific project, **When** a user not assigned to that
      project opens the PO creation flow, **Then** the bulk order does not appear as an available
      option for drawdown.
- [ ] **Given** either party proposes a change to an active bulk agreement, **When** the proposal is
      submitted, **Then** the current active version remains unchanged; the other party is notified
      and can approve, reject, or request modifications.
- [ ] **Given** a bulk order has expired, **When** the Procurement Officer wants to extend it,
      **Then** they can propose a new end date; the vendor must approve the extension before it
      takes effect.

---

### User Story 9 - Invoice Reconciliation & Dispute Resolution (Priority: P9)

**Figma Screens**:

- [US 8.07 – Manage invoice states (CA, PO, Finance Officer)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3346-110482)

Finance Officers, Procurement Officers, and Company Admins can upload invoices, have them
automatically matched to purchase orders via data extraction, reconcile quantities and pricing
against POs (and optionally delivery reports), approve or dispute line items, and track full invoice
history. Vendors can respond to disputes and propose changes.

**Why this priority**: Invoice reconciliation closes the financial loop of the procurement cycle. It
ensures payments are made only for goods received at agreed prices.

**Independent Test**: Upload a PDF invoice, verify the system extracts header data and line items,
match extracted items to a PO's line items, approve the reconciliation, and verify the invoice is
marked as ready for payment. Verify a complete audit trail is visible in the history section.

**Acceptance Scenarios**:

- [ ] **Given** a user uploads a PDF invoice, **When** the system processes it, **Then** it extracts
      invoice header data (vendor, invoice number, date, totals, payment terms) and line items
      (description, quantity, unit price) and presents them for review alongside the original
      document.
- [ ] **Given** extracted invoice data is displayed, **When** the user initiates reconciliation,
      **Then** the system presents a table comparing ordered quantities (from PO), delivered
      quantities (from linked delivery reports if available), and invoiced quantities, flagging any
      discrepancies.
- [ ] **Given** a contractor rejects an invoice line item, **When** the rejection is saved, **Then**
      a dispute is created; the vendor is notified with the discrepancy details, supporting
      references, and a prompt to respond or propose a change.
- [ ] **Given** a dispute is open, **When** either party proposes a change to an invoice field,
      **Then** the other party can approve or reject the proposed change; all actions are recorded
      with user name and timestamp in the invoice history.
- [ ] **Given** an approved invoice is approaching its payment due date, **When** the configured
      notification lead time is reached, **Then** the Finance Officer and Company Admin receive
      in-app, dashboard, and email notifications with a direct link to the invoice.
- [ ] **Given** a user uploads an invoice from the PO details page, **When** the upload succeeds,
      **Then** the system creates an invoice record linked to that PO, recording the uploading user
      and timestamp; the user can preview the file before submitting.
- [ ] **Given** extracted invoice data is displayed in an editable form alongside the original
      document, **When** the user changes or removes an alignment between an invoice line item and a
      PO line item, **Then** the change is preserved and reflected in the reconciliation step.
- [ ] **Given** a user initiates reconciliation and some line items are rejected, **When** they
      attempt to approve the full document, **Then** the system blocks document-level approval until
      all rejected items are resolved.
- [ ] **Given** a dispute is open on an invoice, **When** one party proposes a change to a specific
      field, **Then** no further changes to that field can be made until the proposal is approved or
      rejected by the other party.
- [ ] **Given** a user configures payment notification lead time, **When** an approved invoice's due
      date approaches within that window, **Then** the system sends in-app, dashboard, and email
      notifications; notifications clear automatically when the invoice status changes to Paid.
- [ ] **Given** a user uploads an invoice and links it to multiple POs, **When** reconciliation is
      initiated, **Then** the system aggregates ordered and delivered quantities across all linked
      POs into a single reconciliation table.

---

### User Story 9b - Financial Reports (Priority: P9, Optional)

Finance Officers, Company Admins, and Procurement Officers can view financial reports including
price per item, total spend, spend vs committed, and spend by date range, filtered by project,
vendor, material code, or cost code.

**Acceptance Scenarios**:

- [ ] **Given** a user accesses the reporting section, **When** they select a date range and
      filters, **Then** they can view price report per item (aggregated from RFQs, POs, invoices),
      total spend, and spend vs committed amount.
- [ ] **Given** a user generates a report, **When** the data is displayed, **Then** they can export
      it; reports reflect only project data the user has access to.

---

### User Story 11 - System-Wide Requirements (Cross-Cutting)

The platform supports configurable notifications (in-app + email), immutable system logs on all
business documents, multi-currency with AUD default, and an admin panel for monitoring integrations
and background jobs.

**Acceptance Scenarios**:

- [ ] **Given** a user configures notification preferences, **When** a relevant event occurs (RFQ
      response, PO approved, delivery, etc.), **Then** the notification is delivered via the
      configured channels; notifications are grouped by type and marked as read when opened.
- [ ] **Given** a user views a business document, **When** they open the system log section,
      **Then** they see all actions (who, what changed, when) in a read-only, immutable log.
- [ ] **Given** a user creates a new document (RFQ, PO, invoice), **When** they enter price fields,
      **Then** AUD is the default currency displayed; the user can select a different currency from
      a predefined list, and the selected currency is stored per document.
- [ ] **Given** a Super Admin opens the admin panel, **When** they view system status, **Then** they
      see health indicators for integrations, background jobs, and notification delivery, with the
      ability to retry failed jobs and view error logs.

---

### User Story 10 - Epic 2: Dashboards & Management Views (Priority: P10)

**Figma Screens (Epic 2 overview)**:

- [Epic 2: Dashboard (overview)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3344-58649)
- [US X - Main page (Super Admin SA)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3345-110088)
- [US X - Main page (PO + CA)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3345-110089)
- [US X - Main page (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3345-110220)
- [US X - Main page (Finance Officer)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3346-110351)
- [US 2.06 RFQ dashboard (PO + CA)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2934-12123)
- [US 2.06 RFQ dashboard (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2934-12122)
- [US 2.07 PO dashboard (All users)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2952-17268)
- [US 2.07 PO dashboard (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2960-32928)
- [US 2.11 Bulk order view (CA, PO)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3347-110497)
- [US 2.11 Bulk order view (Vendor)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3350-70597)
- [US 8.07 Manage invoice states (CA, PO, Finance Officer)](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=3346-110482)

Epic 2 delivers role-specific home dashboards and procurement management table views. Each role
lands on a dashboard tailored to their daily actions, with dedicated management pages for RFQs, POs,
Bulk Orders, and Invoices.

**Super Admin dashboard is COMPLETE** (US-10.SA, T232–T240). The remaining dashboards and management
views are defined below.

**Why this priority**: Dashboards are the user's primary workspace. Without them, users cannot see
or act on pending documents efficiently.

**Independent Test**: Log in as each role (PO/CA, Vendor, Finance Officer), verify the home
dashboard renders all sections with correct data, navigate to each management page (RFQ, PO, Bulk
Order, Invoice), and verify tables, filters, and actions work.

#### US 10.01 — PO/CA Home Dashboard

When a Procurement Officer or Company Admin logs in, they land on a home dashboard that surfaces
actionable procurement data: quick action buttons, pending quote responses, recent orders across all
order types, pending purchase orders, and invoices awaiting approval.

**Acceptance Scenarios**:

- [x] **Given** a PO/CA is logged in, **When** they view the dashboard, **Then** they see four KPI
      summary cards at the top showing pending and overdue counts for: RFQs, POs, Quotes, and
      Invoices.
- [x] **Given** a PO/CA is logged in, **When** they view the dashboard, **Then** they see four quick
      action buttons in a single row: "Create PO", "Create RFQ", "Add vendor", "Upload invoice" —
      each navigating to its respective page.
- [x] **Given** there are quote responses, **When** the dashboard loads, **Then** the "Quote
      responses" section shows vendor cards with: vendor name, flag icon, attachment icon, RFQ ID,
      project name, date range, total cost, discount percentage and amount, item coverage (e.g. "5/5
      items"), and Decline/Approve action buttons (only for Pending quotes). Cards are filterable
      by: All, Pending, Acknowledged tabs.
- [x] **Given** there are recent orders, **When** the dashboard loads, **Then** the "Recent Orders"
      section shows the latest RFQs (with RFQ ID, status badge, project name, delivery location,
      date range, item count, cost), POs (with PO ID, status badge, project name, vendor name, date
      range, item count, cost, delivery/pick-up location), and Bulk Orders (with Bulk ID, status
      badge, project name, vendor name, date, item count, cost, remaining quantity %).
- [x] **Given** there are purchase orders in pending status, **When** the dashboard loads, **Then**
      the "Purchase orders" section shows PO cards with: vendor name (with flag + attachment icons),
      "Pending" status badge, PO number, project name, date, item count, delivery type (Pick-up),
      cost, and Decline/Approve action buttons. Cards are filterable by: All, Pending, Acknowledged.
- [x] **Given** there are invoices pending approval, **When** the dashboard loads, **Then** the
      "Invoices pending approval" section shows invoice cards with: vendor name (with flag +
      attachment icons), invoice ID, project name, PO reference, date, cost, item count, and
      Reject/Approve action buttons.
- [x] **Given** a dashboard section has no data, **When** the dashboard loads, **Then** that section
      shows an appropriate empty state with guidance.

**Known Remaining Discrepancies (2026-03-11)**:

The PO/CA dashboard was partially aligned in T496–T498 but still does not match the Figma designs.
Reference Figma frames:
[PO node 3345-110136](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110136&m=dev),
[CA node 3347-115416](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3347-115416&m=dev),
[Buttons node 3345-110090](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3345-110090&m=dev).

- **Structure**: Overall page layout/section ordering/grid arrangement doesn't match the Figma
  design
- **Buttons**: Quick Action buttons styling and layout don't match the Figma design (node
  3345-110090)
- **Icons**: Icons referenced in the Figma design are missing or not rendered correctly

**Additional Acceptance Criteria (Round 2 — Figma pixel alignment)**:

- [x] **Given** the PO Dashboard is loaded, **When** compared side-by-side with Figma frame
      3345-110136, **Then** all sections, grid layout, spacing, and visual hierarchy match exactly.
- [x] **Given** the CA Dashboard is loaded, **When** compared side-by-side with Figma frame
      3347-115416, **Then** the layout matches the CA-specific design.
- [x] **Given** the dashboard Quick Action buttons are visible, **When** compared with Figma frame
      3345-110090, **Then** button styling (size, color, border radius, icon position, label font),
      hover states, and layout all match exactly.
- [x] **Given** the dashboard is fully loaded, **When** every icon slot is inspected, **Then** 100%
      of icons from the Figma design are present — no missing icons, no broken references, no
      fallback placeholders.

---

#### US 10.02 — Vendor Home Dashboard

Vendors have a dedicated dashboard showing RFQs waiting for their quote response, their invoices,
and their active POs in a table view.

**Acceptance Scenarios**:

- [x] **Given** a Vendor is logged in, **When** they view the dashboard, **Then** they see three
      sections: "RFQs waiting for quote", "Invoices", and "Active POs".
- [x] **Given** there are RFQs awaiting the vendor's quote, **When** the dashboard loads, **Then**
      each RFQ card shows: company name (with flag + attachment icons), RFQ ID, project name, date
      range, cost, item count, delivery location, and a "Response" button.
- [x] **Given** there are invoices for the vendor, **When** the dashboard loads, **Then** each
      invoice card shows: company name, status badge, flag + attachment icons, invoice ID, project
      name, PO reference, date, cost, item count.
- [x] **Given** the vendor has active POs, **When** the dashboard loads, **Then** the "Active POs"
      table shows columns: PO number, Project Name, Project ID, Contractor name, PO status
      (Accepted/Active badges), Revision, PO type (Standard), Pick up (Yes/No), and action buttons
      (view, edit, download, more).

---

#### US 10.03 — Finance Officer Home Dashboard

Finance Officers have a specialized dashboard focused on invoice management with KPI cards, invoices
pending approval, and disputed invoices.

**Acceptance Scenarios**:

- [x] **Given** a Finance Officer is logged in, **When** they view the dashboard, **Then** they see
      an "Upload invoice" quick action button at the top.
- [x] **Given** there are pending invoices, **When** the dashboard loads, **Then** three KPI cards
      display: "Total Pending Invoice Amount" (dollar value + invoice count, e.g. "$175,800 — 8
      Invoices"), "Invoices Due This Week" (count + total amount), "Disputed Invoices" (count +
      weekly trend with arrow indicator).
- [x] **Given** there are invoices pending approval, **When** the dashboard loads, **Then** the
      "Invoices pending approval" section shows invoice cards with: vendor name, status badge,
      flag + attachment icons, invoice ID, project name, PO reference, date, cost, item count, and
      Reject/Approve action buttons.
- [x] **Given** there are disputed invoices, **When** the dashboard loads, **Then** the "Disputed
      Invoices" section shows invoice cards with: vendor name, status badge, flag + attachment
      icons, invoice ID, project name, PO reference, date, cost, item count.

---

#### US 10.04 — RFQ Management Dashboard (US 2.06)

A comprehensive RFQ management view for PO/CA with a data-rich table, quick filters, search,
grouping, and view toggles. Vendors see the same structure from their perspective.

**Implementation Status**: PARTIAL — core table, filters, grouping, views done; export, vendor
differentiation, advanced filter wiring, detail tabs remaining.

**Acceptance Scenarios**:

- [x] **Given** a PO/CA navigates to RFQ Management, **When** the page loads, **Then** they see a
      "Create new" button and a paginated table with columns: RFQ ID, Project Name, Project ID, RFQ
      Status, Req. Quantities, Pick-up, Delivery Location, Pick-up Location, Rec. Vendors, Rec.
      Quotes, Appl. Vendors, Line Items, Deadline Range, Appl. Issues, Total Requested Qty, Arc.
      Blocks Dist., Created Date, Created By, Approval Status, Approved By, Last Modified By,
      Actions. Default sort: deadline ascending. Pagination: 25/50/100 per page.
- [x] **Given** a PO/CA is on the RFQ Management page, **When** they use the quick filter tabs,
      **Then** the table filters by: My RFQs, Open RFQs, Awaiting Responses, No Quotes, Awarded
      RFQs, Closed RFQs.
- [x] **Given** any user is on the RFQ table, **When** they use the search bar, **Then** results
      filter across RFQ ID, project name, and other key fields.
- [x] **Given** any user is on the RFQ table, **When** they click column headers, **Then** the table
      sorts by that column (ascending/descending toggle with SortIcon).
- [x] **Given** there are more than 25 RFQs, **When** the page loads, **Then** pagination controls
      appear with configurable rows per page (25 default, 50, 100) and page navigation.
- [x] **Given** a user clicks the "Filters" button, **When** they apply advanced filters, **Then**
      the table filters by selected criteria. _UI fully built (8 filter fields), NOT wired to
      backend query params yet (T531)._
- [x] **Given** a user clicks the view toggle, **When** they switch between saved views, **Then**
      the table configuration (columns, sort, filters, grouping) changes accordingly. Saved views
      persisted to backend via UserTableView model.
- [x] **Given** a user clicks the "Group" button, **When** they select a grouping field, **Then**
      table rows are grouped by that field with accordion expand/collapse.
- [x] **Given** a Vendor navigates to RFQ Management, **When** the page loads, **Then** they see
      RFQs they've been invited to. _Vendor app exists but column differentiation (T540), group
      restriction (T543), and filter semantics (T544) not yet implemented._
- [x] **Given** a user clicks the export button, **Then** the system downloads CSV or Excel. _UI
      buttons exist, backend export not implemented (T533, T534)._

**Additional implemented features** (not in original AC):

- Configurable visible columns with drag-and-drop reorder (TableManagementModal)
- RFQ Detail page with side panel + fullscreen (CA app): Details, Line Items tabs
- Copy RFQ modal with loading/success states
- Conditional archive action (only for CLOSED RFQs)
- FilterChip component with proper Figma-matched styling

**Remaining work**: T531 (wire advanced filters), T533–T534 (export), T535–T536 (backend
archive/copy). Most detail-page tasks now DONE: T545 (Responses → T594), T546 (Documents), T547
(sort expansion), T596 (QuoteResponseDetail), T597 (WH unit tests).

---

#### US 10.05 — PO Management Dashboard (US 2.07)

A PO management view for all platform users with a data table, sorting, filtering, and actions.
Role-specific column sets for internal users vs vendors.

**Acceptance Scenarios**:

- [x] **Given** a PO/CA navigates to Purchase Orders, **When** the page loads, **Then** they see a
      "Create new" button and a paginated table with columns: PO ID, Project Name, Project ID, PO
      Status, Req. Quantities, Pick-up date, Delivery Location, Pick-up Location, Rec. Vendors, Line
      Items, Deadline Range, Total Requested Qty, Created Date, Created By, Approval Status,
      Approved By, Last Modified By, Actions.
- [x] **Given** a PO/CA is on the PO page, **When** they use quick filter tabs, **Then** the table
      filters by relevant PO categories (similar quick filter bar to RFQ dashboard).
- [x] **Given** a Vendor navigates to Purchase Orders, **When** the page loads, **Then** they see
      POs assigned to them with columns: PO number, Project Name, Project ID, Contractor name, PO
      status (Accepted/Active badges), Revision, PO type (Standard), Pick up (Yes/No), Actions.
- [ ] **Given** any user clicks a PO row or action, **When** the detail view opens, **Then** they
      can see full PO details and take role-appropriate actions (view, edit, download, more).
- [x] **Given** the PO table has pagination, **When** the user changes rows per page or navigates,
      **Then** pagination behaves identically to the RFQ table (25 default, Back/Next controls).

**Implementation Status** (2026-03-17):

- ✅ Shared package `@forethread/po-shared` — constants, hooks, stores (mirroring `rfq-shared`)
- ✅ Shared toolbar components in `@forethread/ui-components` — GroupByButton, ExportDropdownButton,
  ViewSelectorDropdown, ToolbarSearchToggle, ToolbarIconButton, useDropdown
- ✅ **PO list page** in company-admin-app, procurement-officer-app, vendor-app
- ✅ **Columns** — full spec columns for CA/PO (24 cols) and Vendor (19 cols, without createdBy,
  lastModifiedBy, approvalStatus, approvedBy per spec)
- ✅ **Sort** — click any column header to sort asc/desc/unsorted
- ✅ **Column drag-and-drop** — reorder columns by dragging headers (reuses `useColumnDragDrop` from
  RFQ)
- ✅ **Column hide/show** — TableManagementModal for configuring visible columns
- ✅ **Quick filters** — 10 filter chips for CA/PO, 11 for Vendor (including splitedPos)
- ✅ **Group by** — Group by Project / Group by Status (CA/PO/Vendor)
- ✅ **Search** — collapsible search toggle by PO number, project name, vendor name
- ✅ **Advanced filters** — FilterPanel with status, type, project, vendor, amount, dates,
  operational state checkboxes
- ✅ **Saved views** — backend-persisted via `/views` API (load, create, apply, delete, delete all)
- ✅ **View selector** — dropdown with saved views, default view, no-views hint
- ✅ **Aging** column — computed on frontend from `issuedAt ?? updatedAt` (spec AC 25.26)
- ✅ **Is Bulk order** column — derived from `poType === 'BULK'` (spec AC 25.15)
- ✅ **Is Hold for release** column — from `holdForRelease` field (spec AC 25.14)
- ✅ **Planned delivery date** column — from `plannedDeliveryDate` field (spec AC 25.17)
- ✅ **Approval status / Approved by** columns — CA/PO only, hidden for Vendor (spec AC 25.27-28)
- ✅ **Export** — CSV/XLSX dropdown via `exportPurchaseOrders` API
- ✅ **Pagination** — rows per page (10/25/50), Back/Next controls
- ✅ **Create new** button — navigates to PO creation route
- ✅ **Row actions** — View (eye icon) + DotActionsMenu (edit, download, copy PO)
- ✅ **Copy PO** — CopyPoModal using shared CopyEntityModal, navigates to new draft PO on success
- ✅ **Row click → PO detail** — PO detail page with 4 tabs (details, lineItems, documents,
  messages). Messages tab has full chat UI. ChildPos removed, purchaseOrders tab replaced with
  messages tab
- ✅ **Column width resize** — drag right edge of column header to resize (useColumnResize hook,
  spec AC 27.3)
- ✅ **Linked RFQ average price** — backend computes avg QuoteResponse.totalCost per linked RFQ
  (spec AC 25.12, CA/PO only)
- ✅ **Line items delivered / Quantity delivered** — backend aggregates from
  PoLineItem.quantityDelivered (spec AC 25.19, 25.21)
- ✅ **Attachments indicator** — backend returns PoDocument count per PO (spec AC 25.29)
- ⬜ **Message indicator** — placeholder (messaging system not yet implemented, returns `false`)
  (spec AC 25.30)
- ✅ **DatePicker** — sectioned masked input (DD/MM/YYYY) with minDate/maxDate validation, disabled
  calendar days, Arrow Up/Down increment, Tab between sections

---

#### US 10.06 — Bulk Order Management (US 2.11)

Bulk order list with filtering and a detail view with line items and drawdown creation. Two
perspectives: CA/PO (filter by project + vendor) and Vendor (filter by project + contractor).

**Acceptance Scenarios**:

- [x] **Given** a PO/CA navigates to Bulk Orders, **When** the page loads, **Then** they see a
      "Create new" button and a paginated table with columns: Bulk Order ID, Project Name, Project
      ID, Vendor name, Brands, Line Items, Deliveries %, # of amount, Total amount, Solid Gold,
      Date, Actions.
- [x] **Given** a PO/CA is on the Bulk Order list, **When** they use filter dropdowns, **Then** they
      can filter by "All projects" and "All vendors". _Fixed: multi-vendor selection now works
      (client-side filtering when >1 selected). FilterDropdownButton uses portal to avoid clipping._
- [x] **Given** a PO/CA selects a bulk order row action, **When** they choose from the context menu,
      **Then** they see options "Drawdown" and "Change" with project and vendor context dropdowns.
- [x] **Given** a PO/CA opens a bulk order detail, **When** the detail view loads, **Then** they
      see: Bulk Details section (Bulk ID, RFQ reference, Contractor name, Vendor name, Project name,
      Created date, End date, Created by) and a Line Items table with columns: Line Item ID, Item
      Reference, Description, Qty, Unit, Ordered, Qty Remaining, Deliveries %, Price/unit, Total
      line inc., and edit/delete actions per row.
- [x] **Given** a PO/CA is on the bulk order detail, **When** they click "+ Create drawdown",
      **Then** a drawdown creation flow starts.
- [x] **Given** a Vendor navigates to Bulk Orders, **When** the page loads, **Then** they see the
      same list structure but with "All Contractors" filter instead of "All vendors".
- [x] **Given** a Vendor opens a bulk order detail, **When** the detail view loads, **Then** they
      see the same detail structure with vendor-perspective data.

**Implementation Status** (2026-03-17):

- ✅ List page with project/counterparty filters, search, pagination, "Create new" button
- ✅ Detail page with Bulk Details section and Line Items table
- ✅ Drawdown/Change actions in list context menu navigate to dedicated pages
- ✅ Vendor read-only view with "All Contractors" filter
- ✅ Shared package `@forethread/bulk-order-shared` across CA, PO, Vendor apps
- ✅ **List columns** — material name, total qty ordered, remaining qty per item (T642, T650)
- ⬜ **Status filter** — backend ready (T648, T651), frontend removed from toolbar pending design
- ✅ **Visual consumption tracking** — progress bars on list and detail pages (T647, T649)
- ✅ **DrawdownPage** — functional form with line item selection + quantity validation (T644). ⚠️
  Temporary layout — no Figma design yet
- ✅ **EditBulkOrderPage** — functional form with status/brands/endDate fields (T645). ⚠️ Temporary
  layout — no Figma design yet
- ⬜ **Line item messaging** — `MessageBadgeIcon` rendered but not wired to data (T646, blocked on
  Epic 4 messaging backend)

---

#### US 10.07 — Invoice State Management (US 8.07)

Invoice list with checkbox selection, individual and bulk approve/export actions. Used by CA, PO,
and Finance Officers.

**Acceptance Scenarios**:

- [x] **Given** a CA/PO/FO navigates to Invoices, **When** the page loads, **Then** they see a
      "Create new" button, a "Filters" button, and a paginated table with columns: checkbox, Invoice
      ID, Project Name, Project ID, Vendor name, Status (with colored badge), Related PO, Total
      amount, Due Date, Actions.
- [x] **Given** a user right-clicks or uses the actions menu on a row, **When** the menu appears,
      **Then** they can select "Approve" or "Export" for that individual invoice.
- [x] **Given** a user selects multiple invoices via checkboxes, **When** the bulk actions bar
      appears at the top, **Then** they see "[N] Item Selected" count with "Approve all" and "Export
      as" bulk action buttons.
- [x] **Given** a user clicks "Filters", **When** they apply filters, **Then** the table filters by
      selected criteria.
- [x] **Given** the invoice table has pagination, **When** the user navigates, **Then** pagination
      shows rows per page selector (25 default) and Back/Next page controls.

---

#### Epic 2 — Shared Table Behaviour

All management tables (RFQ, PO, Bulk Order, Invoice) share these common behaviours:

- **Pagination**: Default 25 rows per page, configurable. Page navigation: Back, numbered pages,
  Next. Display "Showing X to Y of Z [items]".
- **Sorting**: Click column header to sort ascending; click again for descending. Sort indicator
  arrow shown on active column.
- **Search**: Search bar filters across key fields in real-time.
- **Filters**: Advanced filter panel with criteria specific to each entity.
- **Actions column**: Row-level actions via icon buttons (view, edit, download, more/context menu).
- **Empty states**: When no data or filters return zero results, show helpful empty state message.
- **Loading**: Each section/table shows loading skeleton while data fetches.
- **Responsive**: All views adapt to viewport width; sidebar collapses on smaller screens.
- **i18n**: 100% of text sourced from i18n (zero hardcoded strings).
- **CSS variables**: All colors use CSS custom properties (zero hardcoded hex values).

---

### User Story 11 - Delivery Report Submission (Priority: P11 — Optional)

Procurement Officers and Company Admins can submit delivery reports against purchase orders,
recording delivered quantities and outcomes per line item. Optionally, a non-registered delivery
person can submit a report by scanning a QR code on the PO and verifying their identity via OTP.
Company Admins review and approve externally submitted reports before they affect the PO and invoice
reconciliation.

**Why this priority**: Delivery reports are optional for Release 1 but enable the full three-way
match (PO → delivery → invoice) when implemented. The core platform functions without this feature.

**Independent Test**: From a PO detail page, initiate a delivery report, record partial delivery for
two line items with one item marked as damaged, submit, and verify the PO delivery status is
updated. This delivers value: delivery tracking is end-to-end functional.

**Acceptance Scenarios**:

- [ ] **Given** a user initiates a delivery report from a PO, **When** the form opens, **Then** it
      is pre-populated with the PO's line items; for each item the user must specify delivered
      quantity and outcome (Delivered / Partially Delivered / Not Delivered / Rejected).
- [ ] **Given** a delivery responsible person receives a QR code link for a PO, **When** they scan
      it or follow the tokenized URL, **Then** they must enter their name and email, receive a
      15-minute OTP, and after verification can access the delivery report form for that specific PO
      only.
- [ ] **Given** an external delivery report is submitted, **When** a Company Admin reviews it,
      **Then** they can approve or reject it with a comment; only approved reports affect the PO
      delivery status and become available for invoice reconciliation.

---

### User Story 12 - System Administration & Observability (Priority: P12)

**Figma Screens**:

- [Super Admin SA – Dashboard](https://figma.com/design/4DRZfmvvDQJfgsFCffaceD/?node-id=2784-5674)

A Super Admin can access an administration panel showing the health status of all external
integrations, background jobs, and notification services. They can view error logs, retry failed
jobs, and receive alerts for critical system failures.

**Why this priority**: The admin panel is essential for operating the platform in production but is
not required for the core procurement workflow to deliver value.

**Independent Test**: Log in as Super Admin, navigate to the admin panel, and verify it shows status
indicators for integrations and background jobs. Simulate a failed background job and verify the
Super Admin receives a notification and can retry the job from the panel.

**Acceptance Scenarios**:

- [ ] **Given** a Super Admin opens the admin panel, **When** they view the integrations dashboard,
      **Then** each component shows current status (healthy / warning / error), last successful run
      time, and last error message if applicable.
- [ ] **Given** a background job fails repeatedly, **When** the failure threshold is reached,
      **Then** the system generates a system alert and notifies the Super Admin via in-app
      notification.
- [ ] **Given** an integration is in error state, **When** the Super Admin clicks "Retry", **Then**
      the system attempts to re-run the job and records the retry action with user name and
      timestamp in the system log.

---

### User Story 13 - Warehouse Operations Management (Priority: P13)

A Warehouse Officer can view incoming warehouse requests from office or field workers, confirm items
in stock, prepare items for pickup or dispatch, and manage inventory via barcode scanning and manual
search. The warehouse home screen acts as a task queue showing pending actions.

**Why this priority**: Warehouse operations are critical to the delivery pipeline — materials must
be confirmed in stock, picked, and dispatched before they reach the field. Without warehouse
management, the procurement-to-delivery chain is incomplete.

**Screens** (from designer documentation):

- **4.1 Home**: Task queue showing new warehouse requests, items to pick, pending deliveries,
  deliveries to confirm
- **4.2 Warehouse Request (from Office or Field)**:
  - List of incoming requests
  - Request details view
  - Confirm items in stock (Yes/No per item)
  - Mark "Ready for pickup" or "Sent to jobsite"
- **4.3 Inventory**:
  - Barcode scanner screen (live camera)
  - Manual search
  - Stock levels screen
  - Incoming / Outgoing logs

**Independent Test**: Receive a warehouse request for 3 items, confirm 2 are in stock and 1 is not,
mark the request as "Ready for pickup", and verify the requesting user sees the updated status. Scan
a barcode to look up stock levels for a material.

**Acceptance Scenarios**:

- [ ] **Given** a new warehouse request arrives from a field worker, **When** the Warehouse Officer
      opens their home screen, **Then** the request appears in the "New warehouse requests" task
      queue with project name, requester, and item count.
- [ ] **Given** a Warehouse Officer opens a warehouse request, **When** they review line items,
      **Then** they can confirm each item as in-stock or out-of-stock; out-of-stock items trigger a
      notification to the requester.
- [ ] **Given** all confirmed items are picked, **When** the Warehouse Officer marks the request as
      "Ready for pickup" or "Sent to jobsite", **Then** the requester and project admin receive a
      notification with the dispatch status.
- [ ] **Given** a Warehouse Officer opens the barcode scanner, **When** they scan a material
      barcode, **Then** the system displays current stock level, incoming/outgoing history, and
      associated projects for that material.

---

### User Story 14 - Field Material Requests & Delivery Confirmation (Priority: P14)

A Field Worker (Foreman) can create material requests from the field (with photos, offline support),
track assigned projects with a multi-project switcher, confirm deliveries by taking photos,
recording quantities, reporting defects, and communicating with the office via the PO comment
thread.

**Why this priority**: Field workers are the consumers of procured materials. Their requests
initiate the procurement cycle, and their delivery confirmations close it. Without field input,
procurement decisions are disconnected from actual site needs.

**Screens** (from designer documentation):

- **5.1 Home**:
  - Assigned projects (multi-project switcher)
  - Pending deliveries
  - Draft RFQs
- **5.2 Material Request**:
  - Add items (from catalog or free-text)
  - Add quantity per item
  - Add photos (handwriting board, defects, receipts)
  - Offline mode (save draft, sync when connected)
- **5.3 Delivery Confirmation**:
  - Take photo of delivery
  - Mark quantity received per item
  - Report defects
  - Chat with Office inside PO comment thread

**Independent Test**: Create a material request for 5 items with 2 photos while offline, verify the
draft is saved locally, connect to network and sync, verify the request appears in the warehouse
queue. Confirm a delivery by marking 3 of 4 items as received and reporting 1 defect.

**Acceptance Scenarios**:

- [ ] **Given** a Foreman opens the app on-site without network, **When** they create a material
      request with items and photos, **Then** the request is saved as a draft locally; when
      connectivity is restored, it syncs automatically and appears in the warehouse queue.
- [ ] **Given** a Foreman is assigned to 3 projects, **When** they open the home screen, **Then**
      they can switch between projects and see pending deliveries and draft requests for each.
- [ ] **Given** a delivery arrives at the site, **When** the Foreman opens the delivery confirmation
      screen for the relevant PO, **Then** they can photograph the delivery, mark each item as
      received/short/damaged, and submit the confirmation report.
- [ ] **Given** a defect is reported during delivery confirmation, **When** the Foreman submits the
      report, **Then** the office team and vendor receive a notification with the defect details and
      photos, and a message thread is opened on the PO.

---

### User Story 15 - Change Orders for Purchase Orders (Priority: P15)

A Procurement Officer can initiate a Change Order on an existing approved/active Purchase Order to
modify quantities, items, prices, delivery dates, or commercial terms. The system classifies each
change as Minor (auto-approved) or Major (requires approval), tracks full before/after history, and
notifies all relevant stakeholders.

**Why this priority**: Change orders are an essential part of construction procurement — project
requirements change frequently, and the system must support controlled modifications to committed
purchase orders without losing audit trail or vendor alignment.

**Screens** (from designer documentation, US22):

- **Entry point**: PO Details → "Request Change / Change Order" button (only for Approved/Active
  POs)
- **Step 1 — Start Change Order**: System opens Change Order – Edit PO panel with PO header,
  read-only original values, and user selects what to change: Quantities, Items
  (add/remove/substitute), Prices/discounts, Delivery dates/terms, Other commercial terms (optional
  text)
- **Step 2 — Edit & Justify**: User edits fields inline. Must provide Change Reason (required text)
  and optional Internal Note. System calculates delta vs original PO, classifies as Minor or Major
  based on configurable thresholds (value change %, date shift, etc.)
- **Step 3 — Submit Change Order**: Validates required fields. If Minor: auto-approves, generates
  new PO version (e.g. PO-1005 v2), attaches change log, notifies stakeholders. If Major: status
  "Pending Approval", sent to Approval Engine, approver sees change summary (original vs revised)
- **Step 4 — Approval Outcome**: If Approved: PO status back to Approved/Active, new PO version with
  full change log, updated PO sent to Vendor. If Rejected: original PO unchanged, Change Order
  status Rejected, requester notified with rejection reason
- **Step 5 — History & Audit**: PO Details shows "Change History" / "Change Orders" section with
  list of all COs (status, date, initiator). Each CO opens details view with before/after, reason,
  approvers, timestamps

**Acceptance Criteria** (from designer):

- [ ] Only users with appropriate permissions can initiate a Change Order on an existing
      Approved/Active PO. Change orders cannot be created for POs in terminal statuses (Cancelled,
      Closed, etc.).
- [ ] Change Order allows updating: line item quantities, line items (add/remove/substitute), unit
      prices/discounts, delivery dates and delivery terms, other commercial terms (as free-text
      note).
- [ ] System classifies each Change Order as Minor or Major based on configurable rules (e.g. value
      change %, date shift, item type). Classification result is visible to the requester before
      submission.
- [ ] If classified as Minor, the Change Order is auto-approved upon successful validation. System
      updates the PO with revised values, creates a new PO version (v2, v3, etc.), and logs the
      change in the Change History.
- [ ] If classified as Major, the Change Order status becomes Pending Approval. Approval request is
      sent to configured approver(s) via the Approval Engine. Approvers can Approve or Reject and
      must be able to add a comment.
- [ ] Outcome handling — Approved: PO updated and new version generated, Vendor and stakeholders
      notified. Rejected: original PO remains unchanged, Change Order status set to Rejected,
      requester sees the rejection reason in the UI.
- [ ] System maintains a full audit trail for each Change Order: initiator, approver(s), timestamps
      for creation/submission/approval/rejection, before/after values for all changed fields. Users
      with permission can view the Change History from the PO Details screen.
- [ ] Required fields (e.g. Change Reason, mandatory item fields) must be validated before
      submission. System prevents submission if rules are violated (e.g. negative quantity, invalid
      date) and shows clear, actionable error messages.

**Independent Test**: Open an approved PO, initiate a Change Order, change 2 item quantities and add
1 new item, provide a reason, submit. Verify the system classifies it as Minor or Major. If Minor,
verify new PO version is created. If Major, verify it routes to approver and returns
Approved/Rejected with full change log visible.

---

### Edge Cases

- What happens when a user's invitation link expires before they activate? The Super Admin can
  cancel the existing invitation and resend a fresh one; the old link must become invalid
  immediately.
- What happens when an RFQ is sent and all items are covered by bulk orders? The system notifies the
  user that no RFQ is required and closes the RFQ creation flow.
- What happens when a drawdown quantity exceeds the remaining bulk quantity? The system shows a
  validation error and prevents submission; the user must reduce the quantity or proceed as a
  standard (non-bulk) order for the excess.
- What happens when an invoice file cannot be parsed by OCR? The system shows an error message; the
  user can manually enter all invoice data in the review form.
- What happens when a Company Admin attempts to deactivate themselves as the only active Company
  Admin? The system prevents the action and shows a clear error.
- What happens when an approval scenario is configured but the assigned approver is deactivated? The
  system must prevent deactivation of a user who is the sole approver for any active approval
  scenario, or reassign the approval role first.
- What happens when a bulk order expires and drawdowns are still pending? The system prevents new
  drawdowns; existing POs created from the bulk order are not affected.
- What happens when a user uploads a duplicate material to the catalogue? The system detects the
  duplicate, shows a warning, and prevents saving without the user explicitly resolving the
  conflict.
- What happens when a Company Admin tries to assign the CompanyAdmin role to a new user? The system
  allows it — CompanyAdmin is included in the role dropdown when inviting users within the same
  company. Both SuperAdmin and CompanyAdmin can assign the CompanyAdmin role to users in their own
  company.
- What happens when a Company Admin creates a user without specifying a position? The system shows a
  validation error — position is a mandatory field on the invite user form (per Figma design).
- What happens when a warehouse request is made for an item with zero stock? The Warehouse Officer
  marks it as out-of-stock and the requester is notified; the item can be escalated to a new RFQ.
- What happens when a field worker creates a material request offline and the same item was already
  ordered by office? When synced, the system flags potential duplicates for the Procurement Officer
  to review before processing.
- What happens when a Change Order is submitted but the PO status changes to Closed before approval?
  The Change Order is automatically rejected with a system note explaining the PO is no longer
  modifiable.
- What happens when a Minor change auto-approves but the PO total exceeds the project budget? The
  system generates a warning notification to the Company Admin and Finance Officer; the PO version
  is still created but flagged as over-budget.
- What happens when a barcode scan returns no match in the inventory system? The Warehouse Officer
  is prompted to add the item manually or report it as an unrecognised material.
- What happens when a delivery confirmation reports 100% defects? The system marks the delivery as
  rejected, notifies the vendor and office team, and prevents the PO from moving to Delivered
  status.
- What happens when a dashboard section has no data (e.g. no pending quotes)? The section displays
  an appropriate empty state with guidance (e.g. "No pending quotes — create an RFQ to get
  started").
- What happens when a user has no permission to a dashboard action (e.g. Vendor cannot approve POs)?
  Action buttons are hidden or disabled based on role.
- What happens when a quick filter on a management table returns zero results? The table body shows
  an empty state message ("No matching results") while preserving the filter tabs.
- What happens when a bulk order drawdown is created for a fully delivered order? The system
  prevents drawdown creation and shows a message that remaining quantity is zero.
- What happens when multiple users approve/reject the same dashboard item simultaneously? The system
  uses optimistic locking — the second user sees a conflict message and must refresh.
- What happens on slow connections when dashboard sections load asynchronously? Each section shows
  an independent loading skeleton while data fetches.

## Requirements _(mandatory)_

### Functional Requirements

**User Management & Authentication**

- **FR-001**: System MUST allow Super Admins to create users and assign them to a company (existing
  or newly created in the same flow) with exactly one access role.
- **FR-002**: System MUST send an invitation email to newly created users with a secure link valid
  for 30 days; the Super Admin can resend or cancel the invitation.
- **FR-003**: Users MUST activate their account by following the invitation link and setting a
  password; activation changes status from "Invited" to "Active."
- **FR-004**: System MUST authenticate users via email + password followed by an OTP code sent to
  their email; only "Active" users may log in.
- **FR-005**: System MUST enforce role-based access control; each user has exactly one role
  determining which actions and documents they can access.
- **FR-006**: Super Admin MUST be able to deactivate and reactivate any user; deactivated users
  cannot log in or perform any actions.
- **FR-007**: Company Admin MUST be able to invite users to their own company, assign roles, and
  manage (edit, deactivate, reactivate) users within their company.
- **FR-008**: System MUST prevent deactivation or role downgrade of the sole active Company Admin in
  a company.
- **FR-009**: System MUST support optional approval scenario configuration per company, allowing
  Company Admins to activate scenarios, define conditions, and assign approvers per workflow type.
  _(Deferred to post-Release 1 — see Assumptions. No tasks generated for Release 1.)_
- **FR-010**: System MUST support optional RBAC overrides allowing Company Admins to restrict
  specific actions for each role within their company. _(Deferred to post-Release 1 — see
  Assumptions. No tasks generated for Release 1.)_

**Projects**

- **FR-011**: System MUST allow Company Admins and Procurement Officers to create projects with
  mandatory fields: name, at least one location (with a default designated), storage location(s),
  and assigned users.
- **FR-012**: System MUST prevent duplicate project names within a company.
- **FR-013**: System MUST restrict access to all project documents to users assigned to that project
  only.
- **FR-014**: Procurement Officers MUST be automatically assigned to projects they create and cannot
  add or remove other users from projects.

**Material Catalogue**

- **FR-015**: System MUST maintain a public material catalogue accessible to all platform users,
  managed by the Super Admin.
- **FR-016**: System MUST support bulk material import via file upload (XLS, XLSX, CSV) with an
  interactive column-mapping step.
- **FR-017**: System MUST prevent duplicate materials in the public catalogue.
- **FR-018**: User-suggested materials MUST remain unpublished until approved by a Super Admin.
- **FR-019**: System MUST provide real-time search suggestions including recently used, frequently
  used, and BOM-linked materials when users search the catalogue.

**RFQ Workflow**

- **FR-020**: System MUST allow RFQ creation from: project BOM conversion, manual entry using the
  material catalogue, copy of existing RFQ, or saved material list.
- **FR-021**: System MUST check active bulk orders when line items are added to an RFQ and suggest
  drawdown for covered items; user may ignore the suggestion.
- **FR-022**: System MUST allow RFQs to be sent to individual vendors or the entire company vendor
  list; vendors with "Invited" status MUST be able to receive and respond to RFQs without activating
  their account.
- **FR-023**: System MUST allow the user to approve RFQ quote responses at line-item level,
  specifying approved vendor and approved quantity per line item.
- **FR-024**: Only approved line items and their approved quantities MUST be convertible into
  purchase orders, bulk orders, or hold-for-release orders.
- **FR-025**: System MUST support editing an RFQ before any vendor submits a response.

**Purchase Orders**

- **FR-026**: System MUST allow PO creation from: approved RFQ quotes, bulk order drawdown, material
  request conversion, manual entry, or copy of existing PO. **Release 1: each PO MUST target a
  single vendor and a single project.** Multi-vendor/multi-project POs with auto-split on issuance
  are deferred to US-5.11 (post-Release 1).
- **FR-027**: System MUST assign a unique system-generated number to every PO.
- **FR-028**: When a PO is created manually or from an RFQ, the system MUST check for available bulk
  agreements and suggest applying bulk pricing to covered items.
- **FR-029**: System MUST support hold-for-release POs with a mandatory earliest delivery date.
- **FR-030**: System MUST support marking a PO as a pick-up order; delivery information fields MUST
  be disabled for pick-up POs.
- **FR-031**: System MUST support PO change requests (commercial and internal); all changes MUST be
  logged in a versioned history with user name, timestamp, previous values, and new values.
- **FR-032**: Commercial change requests MUST require approval from the other party; internal
  changes MUST be applied immediately without requiring counter-party approval.
- **FR-033**: When creating a PO, the system MUST check each line item against: available warehouse
  inventory, existing bulk orders, and approved RFQs, and inform the user of available actions.
- **FR-034**: System MUST support line-level delivery locations and warehouse locations as optional
  fields on PO line items.
- **FR-035**: When a vendor is selected during PO creation, the system MUST auto-populate vendor
  details (company name, legal information, address).
- **FR-036**: System MUST support creating POs from material requests (conversion), with data
  auto-populated and user review before submission.

**Bulk Orders**

- **FR-037**: Bulk orders MUST only be created from approved RFQ responses.
- **FR-038**: System MUST track remaining available quantity per material under each bulk order and
  use it for auto-suggestions in RFQ and PO creation flows.
- **FR-039**: When a drawdown is initiated, the system MUST validate that the requested quantities
  do not exceed the remaining available bulk quantity.
- **FR-040**: Bulk order expiry extension proposals MUST require vendor approval before taking
  effect.
- **FR-037**: Company Admin MUST be able to restrict a bulk order to specific projects; when
  restricted, only users assigned to those projects can use it for drawdowns.

**Vendor Management**

- **FR-038**: System MUST allow Procurement Officers and Company Admins to invite vendors; if the
  vendor already exists on the platform, they MUST be added directly to the contractor's vendor list
  without a new invitation.
- **FR-039**: System MUST display sales representatives per vendor wherever a vendor list is shown,
  without triggering vendor selection.
- **FR-040**: System MUST support in-app messaging threads scoped to specific documents (RFQ, PO,
  bulk order, material request, warehouse release request); messages MUST be timestamped and support
  file attachments up to 10 MB.

**Invoice Reconciliation**

- **FR-041**: System MUST support invoice upload via file picker or drag-and-drop; supported
  formats: PDF, PNG, JPG, JPEG, XLS/XLSX, DOC/DOCX, CSV; maximum size 10 MB.
- **FR-042**: System MUST extract structured data (header and line items) from uploaded invoices and
  allow users to review, edit, and confirm the extracted data before reconciliation.
- **FR-043**: System MUST align extracted invoice line items with PO line items and present a
  reconciliation table showing ordered, delivered (if delivery reports are available), and invoiced
  quantities.
- **FR-044**: System MUST allow one invoice to be linked to multiple POs; aggregated reconciliation
  data MUST cover all linked POs.
- **FR-045**: System MUST support line-item level and document-level approval and rejection of
  invoices; if any line item is rejected, document-level approval MUST be blocked until the issue is
  resolved.
- **FR-046**: System MUST create a dispute when an invoice or any part of it is rejected, enabling a
  communication and change-proposal thread between vendor and contractor.
- **FR-047**: System MUST send payment due date notifications to Finance Officers and Company Admins
  at a user-configurable lead time before the due date and again when the date has passed.
- **FR-048**: All invoice events MUST be recorded in an immutable history (upload, edit,
  reconciliation actions, approvals, rejections, disputes, status changes).
- **FR-049b**: System MUST support optional financial reports (price per item, total spend, spend vs
  committed, spend by date range) filtered by project, vendor, material code, cost code; reports
  MUST respect user project access.
- **FR-070**: System MUST use AUD as default currency for all price fields; users MUST be able to
  select a different currency per document from a predefined list.
- **FR-071**: System MUST generate notifications for relevant events, delivered in-app and by email;
  users MUST be able to configure which notifications they receive and through which channel.
- **FR-072**: System MUST maintain immutable logs of all significant actions on business documents,
  including who, what changed, and when; logs MUST be visible in document context and cannot be
  edited or deleted.

**Delivery (Optional)**

- **FR-049**: System MUST allow delivery reports to be initiated from a PO detail page or dashboard
  quick action; the form MUST be pre-populated with PO line items.
- **FR-050**: System MUST support tokenized access (via QR code or email link) for non-registered
  delivery persons to submit delivery reports; OTP verification (15-min validity) is required before
  accessing the form.
- **FR-051**: Externally submitted delivery reports MUST receive "Pending approval" status; Company
  Admins MUST review and approve or reject them before they affect PO delivery status or invoice
  reconciliation.

**Dashboards & Management Views (Epic 2)**

- **FR-074**: System MUST render role-specific home dashboards based on the logged-in user's role
  (PO/CA, Vendor, Finance Officer). Super Admin dashboard is already implemented (US-10.SA).
- **FR-074a**: PO/CA dashboard MUST display four KPI summary cards at the top showing pending and
  overdue counts for: RFQs, POs, Quotes, and Invoices.
- **FR-075**: PO/CA dashboard MUST display four quick action buttons in a single row (Create PO,
  Create RFQ, Add vendor, Upload invoice) that navigate to their respective pages.
- **FR-076**: PO/CA dashboard MUST show a "Quote responses" section with vendor quote cards
  filterable by All/Pending/Acknowledged tabs, with inline Decline and Approve actions shown only
  for quotes in Pending status.
- **FR-077**: PO/CA dashboard MUST show a "Recent Orders" section aggregating the latest RFQs, POs,
  and Bulk Orders with status badges and key details.
- **FR-078**: PO/CA dashboard MUST show a "Purchase orders" section with pending PO cards supporting
  inline Decline/Approve actions, filterable by All/Pending/Acknowledged tabs.
- **FR-079**: PO/CA dashboard MUST show an "Invoices pending approval" section with invoice cards
  supporting inline Reject/Approve actions.
- **FR-080**: Vendor dashboard MUST display "RFQs waiting for quote" with a "Response" action per
  card, "Invoices" with status badges, and an "Active POs" sortable table.
- **FR-081**: Finance Officer dashboard MUST display an "Upload invoice" button, three KPI cards
  (Total Pending Invoice Amount, Invoices Due This Week, Disputed Invoices), "Invoices pending
  approval" with Reject/Approve, and "Disputed Invoices" sections.
- **FR-082**: RFQ Management page MUST display a paginated, sortable, filterable data table with all
  RFQ columns as shown in Figma (US 2.06), with quick filter tabs (My RFQs, Open RFQs, Awaiting
  Responses, No Quotes, Awarded RFQs, Closed RFQs).
- **FR-083**: RFQ Management page MUST support search, advanced filters, column sorting, view toggle
  (Default/List), grouping, and CSV/Excel export.
- **FR-084**: PO Management page MUST display a paginated, sortable, filterable data table with PO
  columns (US 2.07), with role-specific column sets for internal users vs vendors.
- **FR-085**: Bulk Order page MUST display a list view with project/vendor (or contractor) filters,
  "+ Create new" button, context menu actions (Drawdown, Change), and a detail view with Bulk
  Details metadata and Line Items table (US 2.11).
- **FR-086**: Bulk Order detail MUST support "+ Create drawdown" action for creating partial
  fulfillment records against the bulk order.
- **FR-087**: Invoice Management page MUST display a paginated table with checkbox selection,
  supporting individual row actions (Approve, Export) and bulk actions (Approve all, Export as) (US
  8.07).
- **FR-088**: All management tables MUST support configurable rows per page (default 25), page
  navigation (Back, numbered pages, Next), and display "Showing X to Y of Z" record count.
- **FR-089**: All dashboard and management views MUST source 100% of text from i18n and use CSS
  variables for all colors (zero hardcoded strings or hex values).

**Cross-Cutting Requirements**

- **FR-052**: System MUST generate in-app and email notifications for all relevant business events;
  users MUST be able to configure which notifications they receive and through which channels.
- **FR-053**: System MUST maintain immutable audit logs for all significant actions on business
  documents, including who performed the action, what changed, and when; logs MUST NOT be editable
  or deletable.
- **FR-054**: System MUST use AUD as the default currency; users MUST be able to select a different
  currency per document from a predefined list.
- **FR-055**: Super Admin MUST have access to an administration panel showing the health status of
  all integrations, background jobs, and notification services, with the ability to view error logs
  and retry failed jobs.

**Warehouse Operations**

- **FR-056**: System MUST allow Warehouse Officers to view incoming warehouse requests in a task
  queue, grouped by urgency (new requests, items to pick, pending deliveries, confirmations).
- **FR-057**: System MUST allow Warehouse Officers to confirm item availability (in-stock / out-of-
  stock) per line item in a warehouse request, and mark the request as "Ready for pickup" or "Sent
  to jobsite" once items are prepared.
- **FR-058**: System MUST provide barcode scanning (live camera) for inventory lookup; scanning a
  barcode MUST display current stock level, incoming/outgoing logs, and associated project usage.
- **FR-059**: System MUST maintain inventory stock levels with incoming and outgoing transaction
  logs; stock adjustments MUST be audited with user, timestamp, and reason.

**Field Worker Operations**

- **FR-060**: System MUST allow Field Workers (Foremen) to create material requests with items,
  quantities, and photo attachments (handwriting board, defect photos, receipts).
- **FR-061**: System MUST support offline mode for material request creation; drafts MUST be saved
  locally and synced automatically when network connectivity is restored.
- **FR-062**: System MUST allow Field Workers to confirm deliveries by recording received
  quantities, taking photos, and reporting defects per line item; delivery confirmation MUST link to
  the associated PO comment thread.
- **FR-063**: System MUST provide a multi-project switcher for Field Workers assigned to multiple
  projects, showing pending deliveries and draft requests per project.

**Change Orders for Purchase Orders**

- **FR-064**: System MUST allow users with appropriate permissions to initiate a Change Order on an
  Approved or Active PO; Change Orders MUST NOT be created for POs in terminal statuses (Cancelled,
  Closed).
- **FR-065**: Change Orders MUST support modifying: line item quantities, line items (add / remove /
  substitute), unit prices and discounts, delivery dates and terms, and other commercial terms (as
  free-text note).
- **FR-066**: System MUST classify each Change Order as Minor or Major based on configurable rules
  (value change percentage, date shift, item type); the classification MUST be visible to the
  requester before submission.
- **FR-067**: Minor Change Orders MUST be auto-approved upon successful validation; the system MUST
  update the PO with revised values, generate a new PO version, and log the change in Change
  History.
- **FR-068**: Major Change Orders MUST enter "Pending Approval" status and be routed to configured
  approver(s) via the Approval Engine; approvers MUST be able to Approve or Reject with a comment.
- **FR-069**: System MUST maintain a full audit trail for each Change Order: initiator, approver(s),
  timestamps, before/after values for all changed fields, change reason, and approval/rejection
  comments.
- **FR-070**: Each PO MUST display a "Change History" / "Change Orders" section listing all change
  orders with status, date, and initiator; users can open each for full before/after comparison.

**Documents & Notifications**

- **FR-071**: System MUST support delivery docket upload (file picker, drag-and-drop, or scan) with
  automatic matching to the corresponding PO based on extracted reference numbers.
- **FR-072**: System MUST support mobile push notifications for: delivery arrived, change order
  status update, RFQ response received, PO approved, and warehouse request ready.
- **FR-073**: Super Admin MUST be able to view and manage company subscription status (active,
  trial, expired) from the company management panel.

### Key Entities

- **User**: A person with access to the platform; has one role, belongs to one company, can be
  assigned to multiple projects; statuses: Invited, Active, Inactive.
- **Company**: Either a Contractor (the platform's client organisation) or a Vendor (a supplier);
  Contractors have multiple users across multiple roles; Vendors have one or more users with the
  Vendor role.
- **Project**: The organisational unit for procurement activity; belongs to a Contractor company;
  has locations, storage locations, a budget, assigned users, and a BOM.
- **Material**: An item in the material catalogue; has name, category, unit of measure, manufacturer
  (optional), UPC (optional); belongs to the public catalogue or a company's private catalogue
  pending approval.
- **BOM (Bill of Materials)**: A list of materials required for a project; versioned; used as a
  starting point for RFQ creation.
- **RFQ (Request for Quotation)**: A request sent to one or more vendors asking for pricing and
  availability; has a deadline, line items, and a lifecycle status (Draft, Open, Closed, Cancelled).
- **Quote (Vendor Response)**: A vendor's response to an RFQ; contains pricing, quantities, delivery
  dates, and discounts per line item.
- **Purchase Order**: A formal commitment to purchase from a vendor; can be Standard, Bulk Drawdown,
  or Hold-for-Release; links to a project, vendor, and optionally a quote or bulk order.
- **Bulk Order**: A pre-committed supply agreement with a vendor covering quantity and price for a
  defined period; subject to drawdown by purchase orders.
- **Invoice**: A payment request from a vendor; uploaded as a file; matched to one or more POs;
  reconciled against delivered quantities and agreed pricing.
- **Delivery Report**: A record of goods received against a PO; can be submitted by a registered
  user or an external delivery person via tokenized access.
- **Notification**: A system-generated message delivered in-app and/or by email; linked to a
  specific document or event; configurable per user.
- **Audit Log**: An immutable record of every significant action on a business document; includes
  actor, action type, timestamp, and changed values.
- **Warehouse Request**: A request from an office or field user to the warehouse for materials; has
  line items, priority, project reference, and status (New, Confirmed, Ready for Pickup, Dispatched,
  Completed).
- **Change Order**: A versioned change to an approved PO; classified as Minor (auto-approved) or
  Major (requires approval); records before/after values, change reason, initiator, and approver(s).
- **Material Request**: A field worker's request for project materials; may include photos and
  notes; supports offline drafting and automatic sync.
- **Delivery Docket**: A scanned or uploaded delivery document; auto-matched to a PO via reference
  number extraction; used in three-way matching (PO → delivery → invoice).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new user can complete registration (receive invitation, activate account, and log in
  successfully) in under 3 minutes.
- **SC-002**: A Procurement Officer can create a complete RFQ (project selected, materials added
  from catalogue, vendors selected, RFQ sent) in under 5 minutes.
- **SC-003**: A Finance Officer can upload an invoice, review extracted data, and complete the
  reconciliation process in under 10 minutes for a standard 10-line-item invoice.
- **SC-004**: All document list views (RFQ dashboard, PO dashboard, invoice list) load with correct
  data within 3 seconds for a dataset of 1,000 documents.
- **SC-005**: Vendor quote submission via invitation link (without account activation) is possible
  within 5 minutes of receiving the email notification.
- **SC-006**: The full procurement cycle — from RFQ creation to approved invoice — is auditable
  end-to-end; every state change is traceable with actor and timestamp.
- **SC-007**: 95% of users assigned to a project can locate their pending documents and take action
  (approve, create, reply) without requiring support assistance.
- **SC-008**: The platform correctly applies bulk order pricing for all PO line items covered by an
  active bulk agreement; no manual re-entry of agreed prices is required.
- **SC-009**: An external delivery person can submit a delivery report via QR code scan, complete
  OTP verification, and submit the form in under 7 minutes.
- **SC-010**: Invoice data extraction correctly identifies vendor name, invoice number, date,
  totals, and line item descriptions in 80% of uploaded structured PDF invoices without manual
  correction.
- **SC-011**: A Warehouse Officer can process a warehouse request (confirm stock, pick items, mark
  ready) in under 5 minutes for a standard 10-item request.
- **SC-012**: A Field Worker can create a material request with photos while offline and have it
  sync within 30 seconds of network restoration.
- **SC-013**: A Change Order on a PO can be created, classified, and submitted in under 3 minutes;
  the full before/after comparison is viewable in the PO Change History.
- **SC-014**: Barcode scanning correctly identifies a stocked material and displays its current
  stock level in under 2 seconds.

### Assumptions

- The platform is a web-based application accessible from desktop browsers; the Warehouse Officer
  app is optimised for tablet use; the Foreman app is a native mobile application (separate app, not
  part of this specification scope).
- ERP integration (cost codes, material codes) is provided via an external integration layer; this
  specification does not define the integration protocol.
- OCR / invoice data extraction is provided by a background processing service; the specification
  defines the user-facing review workflow, not the extraction engine.
- Email delivery (invitations, OTP, notifications) is provided by an external email service; the
  specification defines triggers and content requirements, not delivery infrastructure.
- All prices default to AUD; multi-currency support allows per-document currency selection but does
  not include real-time exchange rate conversion.
- Approval scenarios (US 1.06) are optional for Release 1; if not implemented, no approval gates are
  required and US 5.10 (approval request management) is not in scope.
- Delivery reports (Epic 5) are optional for Release 1; if not implemented, invoice reconciliation
  operates without the "delivered" column in the reconciliation table.

---

## Shared UI Component: RadioButton

**Figma**:
[Radio button states](https://www.figma.com/design/4DRZfmvvDQJfgsFCffaceD/Ayo?node-id=3614-75129)

A reusable `RadioButton` and `RadioGroup` component in the shared `packages/ui-components` package.
Follows the same architectural pattern as the existing `Checkbox` component (hidden native input +
custom visual span). States from Figma: unchecked/checked × default/hover/focused/disabled.

### Functional Requirements

- **FR-RADIO-001**: RadioButton MUST render a circular indicator — empty circle (unchecked) or
  circle with filled inner dot (checked).
- **FR-RADIO-002**: RadioButton MUST accept `checked`, `onChange`, `label`, `disabled`, `value`,
  `name`, and `className` props.
- **FR-RADIO-003**: RadioButton MUST display four visual states matching Figma: default, hover
  (darker border), focused (blue focus ring), disabled (muted opacity).
- **FR-RADIO-004**: RadioButton MUST use a hidden native `<input type="radio">` with custom visual
  overlay, following the Checkbox pattern (`peer sr-only` + styled span).
- **FR-RADIO-005**: RadioButton MUST be keyboard accessible — focusable via Tab, selectable via
  Space/Enter.
- **FR-RADIO-006**: RadioGroup MUST manage selected value via `value` and `onChange` props,
  rendering multiple RadioButton options.
- **FR-RADIO-007**: RadioGroup MUST support `disabled` prop to disable all child radio buttons.
- **FR-RADIO-008**: RadioGroup MUST support horizontal (default) and vertical layout via
  `orientation` prop.
- **FR-RADIO-009**: Both components MUST be exported from `packages/ui-components/src/index.ts`.

### Acceptance Scenarios

1. **Given** a RadioButton with `checked={false}`, **When** clicked, **Then** `onChange` fires.
2. **Given** a RadioButton with `disabled={true}`, **When** clicked, **Then** nothing happens.
3. **Given** a RadioButton focused via keyboard, **Then** a blue ring appears matching Figma.
4. **Given** a RadioGroup with 3 options, **When** option B is clicked, **Then** only option B is
   checked.
5. **Given** the super-admin Create User modal, **When** rendered, **Then** Contractor/Vendor radios
   use the shared RadioButton and match Figma design.

---

## Global Navigation Architecture (Designer Reference)

_Source: Designer wireframe documentation (sections 0, 1–8). Defines the sidebar/navigation
structure per role._

### Desktop (Office / Procurement / Finance / Admin)

**Sidebar Navigation Items**:

- Dashboard
- RFQs
- Purchase Orders
- Material Requests (from field)
- Inventory
- Warehouse Requests
- Vendors
- Projects
- Documents (invoices, delivery dockets, receipts)
- Settings
- Profile

### Mobile (Field / Warehouse)

**Bottom Navigation / Home Screen**:

- Home (task list + statuses)
- Material Request
- Delivery Tracking
- Inventory Scanner
- Notifications
- Profile

### Navigation Per App (Current → Target)

| App                         | Current Sidebar                | Target Sidebar (from designer)                                                             |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| **super-admin-app**         | Dashboard, Companies, Settings | Dashboard, Companies, Settings (+ Analytics button)                                        |
| **company-admin-app**       | Dashboard, Projects, Settings  | Dashboard, Projects, RFQs, Purchase Orders, Vendors, Documents, Settings                   |
| **procurement-officer-app** | Dashboard, Settings            | Dashboard, Material Catalog, RFQs, Purchase Orders, Vendors, Projects, Documents, Settings |
| **financial-officer-app**   | Dashboard, Settings            | Dashboard, Purchase Orders, Documents (Invoices), Settings                                 |
| **warehouse-officer-app**   | Dashboard, Settings            | Home (task queue), Warehouse Requests, Inventory, Settings                                 |
| **vendor-app**              | Dashboard, Settings            | Dashboard, RFQs, Purchase Orders, Documents, Settings                                      |

### Role-Specific Dashboard KPIs (from designer)

**Company Admin (2.1)**:

- Filters: period, project, vendor, status
- KPI cards: Total spend, Cost-to-complete, Inventory value, Pending RFQs, Pending POs, Change
  Orders
- Static widgets (not draggable)

**Procurement Officer (3.1)**:

- Filters: date range, vendor, project
- KPI cards: RFQs sent, Awaiting vendor quote, Winning quote value, Approved POs, Delayed deliveries

**Super Admin (1.2)**:

- Minimal — "Open Analytics Dashboard" button (Google Analytics integration)

### PO Status Lifecycle (from designer 3.4)

```
Draft → Sent → Acknowledged → Pending Delivery → Delivered → Closed
```

### Vendor Tokenized Pages (from designer section 6)

**6.1 RFQ Link Page** (no login required):

- Company logo
- RFQ number
- Table of items with quantities
- Input fields for price per item
- Upload quote (PDF or Excel)
- Submit button

**6.2 PO Link Page** (no login required):

- PO details header
- Items list with quantities and prices
- "Acknowledge" button
- Upload delivery receipt
- Upload docket/invoice

---

## Designer Cross-Reference Matrix

_Maps designer wireframe sections to spec User Stories, FRs, and implementation status._

| Designer Section       | Spec Reference                  | FRs                | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Global Navigation   | Navigation Architecture (above) | —                  | Not implemented (sidebar stubs only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1.1 Login              | US-1 (AS-3)                     | FR-004             | Done (all 6 apps)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.2 SA Dashboard       | US-12 / US-10                   | FR-055             | Done (T232–T240, T583–T584, T587, T590)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.3 Company Management | US-1                            | FR-001, FR-073     | Backend done, subscription missing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2.1 CA Dashboard       | US-10                           | FR-074–079         | Done (T500–T507, T580, T588, T604, T607, T610)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2.2 Users Management   | US-1.07/1.08                    | FR-007             | Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2.3 Projects           | US-2                            | FR-011–014         | Done (T214: custom components polish)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3.1 PO Dashboard       | US-10                           | FR-084             | ✅ List page complete (CA/PO/Vendor), shared `po-shared` + ui toolbar components; ✅ Detail page + comms page (T776, T780-T785); ✅ Create PO wizard DONE (T770-T807)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3.2 Material Catalog   | US-7                            | FR-015–019         | ✅ Schema only (Material + MaterialCategory Prisma models, T710-T711); ✅ Backend CRUD module (T812-T813); ⬜ Frontend not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3.3 RFQ                | US-3                            | FR-020–025         | ✅ Schema aligned to FRD (T715-T718); ✅ Backend list/detail/copy (T732); ✅ Backend create/update/send/cancel (T808-T811); ⬜ Frontend create page not started (T752)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3.4 Purchase Order     | US-5                            | FR-026–036         | ✅ Schema aligned (T712-T714, T749); ✅ Backend CRUD + confirm + validate-items (T725-T728, T755, T756); ✅ Frontend: Create PO wizard DONE (T770-T807); ✅ 3 creation modes: Manual/RFQ/BulkOrder (T814-T826); ✅ Select/Deselect + partial item selection in all PO creation modals (T846); ✅ Vendor decline email (T898); ✅ Change request emails wired (T899); ✅ Frontend PO receiving actions UI (T364, T673, T674) — acknowledge, approve (payment terms + warehouse), decline (reason modal), change request (propose + history), action log tab; ⬜ Vendor tokenized page, ⬜ Messages API integration |
| 3.4 Change Orders      | **US-15 (NEW)**                 | **FR-064–070**     | ✅ PoChangeRequest model + CRUD endpoints (T891); ✅ Email notifications wired — propose/approve/reject (T899); ✅ Vendor-side change request UI — propose modal + history list (T364); ⬜ Contractor-side review/approve/reject UI                                                                                                                                                                                                                                                                                                                                                                               |
| 4.1 Warehouse Home     | **US-13 (NEW)**                 | **FR-056**         | Not started (app shell only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4.2 Warehouse Request  | **US-13 (NEW)**                 | **FR-057**         | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4.3 Inventory          | **US-13 (NEW)**                 | **FR-058–059**     | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.1 Foreman Home       | **US-14 (NEW)**                 | **FR-063**         | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.2 Material Request   | **US-14 (NEW)**                 | **FR-060–061**     | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5.3 Delivery Confirm   | **US-14 (NEW)** / US-11         | **FR-062**         | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6.1 RFQ Vendor Page    | US-3                            | FR-022             | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6.2 PO Vendor Page     | US-5                            | FR-026             | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7.1 Invoice Mgmt       | US-9                            | FR-041–048         | UI stub only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7.2 Delivery Dockets   | US-9 / US-11                    | **FR-071**         | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8. Notifications       | Cross-cutting                   | FR-052, **FR-072** | Email done, in-app/push missing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| US22 Change Orders     | **US-15 (NEW)**                 | **FR-064–070**     | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
