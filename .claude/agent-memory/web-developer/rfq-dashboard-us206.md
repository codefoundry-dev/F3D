---
name: rfq-dashboard-us206
description: US 2.06 RFQ Dashboard (PO+CA) Figma-fidelity pass on the buyer RfqListPage — new columns, table-mgmt long labels, quick-look panel, advanced-filter relabels
metadata:
  type: project
---

US 2.06 "RFQ dashboard (PO + CA)" Figma-fidelity pass on the EXISTING buyer RFQ Management list
(`apps/web/src/features/rfqs/buyer/pages/RfqListPage.tsx`, shared by COMPANY_ADMIN +
PROCUREMENT_OFFICER). Figma file `CFA6k0XCvImOmWXbBgdWYZ`, board `2934:12123`, primary table
`2934:9153`. The page was already ~90% faithful; this was tuning + wiring new backend columns.

**Why:** backend + api-client `RfqListItem` already had new count fields (`invitedVendors`,
`approvedItems`, `declinedItems`, `avgQuoteCost`); the frontend column set still used the old
dead keys.

**How to apply (key gotchas for future RFQ-list work):**

- `PO_CA_COLUMNS` (in `packages/rfq-shared/src/constants/columns.ts`) `key`s are ALSO the values
  sent to the export endpoint (`columns` param via `useRfqExport`). Keep them identical across the
  column list, i18n `columns.*`, AND the table-mgmt modal options or export breaks. REMOVED dead
  keys `recVendors`/`applIssues`/`arcBlocksDist`; ADDED `invitedVendors`/`declinedItems`/
  `approvedItems`/`avgQuoteCost`.
- The table-management modal needs DIFFERENT, long-form labels ("Number of invited vendors",
  "Average quoted cost") than the short table headers ("Inv.Vendors", "Avr. Quote Cost"). Both come
  from i18n: headers use `columns.*`, modal uses a NEW separate `columnLabels.*` key set. The page
  maps the modal's `columns` prop to `t(columnLabels.<key>)`.
- Column header casing is exact-from-Figma and inconsistent on purpose: "Inv.Vendors" / "Rec.Quotes"
  (no space after dot) but "Appr. Vendors" / "Appr. items" (space); "Decline items" (NOT
  "Declined"); "Created by" / "Approval status" / "Last modify by" (lowercase 2nd word);
  "Total requested Qty"; "Avr. Quote Cost".
- `avgQuoteCost` cell renders as `$ ${value}` (literal "$ " + raw integer, NO locale
  separators/decimals) to match the design's "$ 10000000" — do NOT use shared `formatCurrency`
  (it gives "$10,000,000.00"). null → "-".
- Count columns (`invitedVendors`/`recQuotes`/`applVendors`/`lineItems`/`declinedItems`/
  `approvedItems`/`totalRequestedQty`) — 0 is a REAL value (renders "0"), only null/undefined → "-".
- `resDeadline` maps to the `deadlineRange` field which the backend sends as null or a
  `"YYYY-MM-DD - YYYY-MM-DD"` string (rfqs.service.ts requires BOTH deadlineStart+End else null).
  Cell parses+formats each end to "MMM d, yyyy" and collapses identical start/end. Was rendering the
  raw range before.
- Pick-up cell = gray `Badge` ("Yes"/"No"), not plain text (matches design pills).
- Quick-look panel (`RfqDetailPanel.tsx`) title is the RFQ NUMBER (`rfq.rfqNumber ?? rfq.id`), NOT
  projectName (design shows "RFQ-2024-008"); bumped to `text-xl font-semibold`. Updated its test
  assertion. The panel body (`RfqDetailsTab` panel layout) was ALREADY a faithful match (Basic Info
  / Items & Quantities / Vendors + eye-toggle→VendorList compact / Quote Information / Metadata).
- Page sets header via `usePageTitleStore` (title "RFQ Management" / subtitle "View and manage all
  requests for quotation") — the app shell owns the header.
- ACTION ICONS were ALREADY correct: message-badge (red dot) + eye + 3-dot DotActionsMenu. The
  task's "share/forward glyph" was a misread of the MessageBadgeIcon.
- `ViewSelectorDropdown` got a NEW optional `defaultViewItemLabel` prop (defaults to
  `defaultViewLabel`) so the dropdown row says "Default view" while the trigger button says
  "Default" (per design). Non-breaking; the 2 PO list pages still pass only the old prop.
- Advanced-filter labels realigned to design: section labels "Issue Date" / "Response deadline"
  (span both From/To), fields "Number of approves quotes" / "Approved vendors" with "Enter number"
  placeholder. Structure (single min-input per, not min/max pairs) was already correct.

**Intentional deviations (flagged, NOT fixed):**
- Table-mgmt + Create-view modal subtitles: design shows placeholder lorem
  ("text explains why we ask for this information"); kept the existing meaningful copy.
- Table-mgmt modal lists all 21 columns incl. Pick-up + Pick-up location (design omits those 2 from
  the toggle list though the table HAS them) — more functional to keep them toggleable.
- Full RFQ detail PAGE (RfqDetailPage) was explicitly out of scope; not touched.

**Verification:** web typecheck + ui-components typecheck clean; web lint + ui-components lint clean;
471 rfqs tests pass (`vitest run src/features/rfqs --pool=threads`). Harness =
`.tmp/figma-us206/shot_us206.mjs` (13 states) + `shot_scroll.mjs` (horizontal-scroll to see new
cols). HARNESS GOTCHA: mock vendors must use the real `RfqVendor` shape
(`name`/`avatarUrl`/`category`/`location`/`approved`/`contacts`) — `VendorList` reads
`vendor.contacts.length` and crashes (Error Boundary "Something went wrong") if you mock
`salesContacts`/`legalName`. Also `getViews()` returns `{data: [...]}` (flat array) NOT the
paginated `{data:{items}}` shape — mock it with `obj([...])` or the saved-views dropdown shows the
empty hint. See [[figma-fidelity-workflow-note]] patterns in MEMORY.md verification section.
