# Mobile-first UI

Follow-up to [FOR-358](https://codefoundry.atlassian.net/browse/FOR-358) (13–14" laptops). Every
view in `apps/web`, including the guest vendor and delivery pages, is **designed for phones**, not
just made to fit. Epic: [FOR-367](https://codefoundry.atlassian.net/browse/FOR-367). Decisions are
recorded in [ADR-0019](adr/0019-mobile-first-ui.md). This file is the working spec and progress
tracker.

**Status key:** ⬜ To do · 🔄 In progress · ✅ Done

## Baseline (21 Oct 2026, 390×844, real local data)

- No page scrolls sideways as a whole. The shell already swaps the sidebar for a bottom bar, and
  modals go full-screen.
- **Tables:** about 2 of about 12 columns are visible, cut off at the edge, with no hint that more
  exist.
- **Tab bars:** on PO, RFQ, invoice, user and company detail pages, 100–190px of tabs are hidden
  behind a scroll with no visible scrollbar.
- **Wizard steppers:** overflow their box on RFQ new and PO new ("Review & Send", "Add Line Items").
- **`/me`:** overflows the page by 275px.
- **Shell:** shows no page title (the breadcrumb is hidden), and the user menu sits on the left. The
  bottom bar has 10 unlabelled icons about 39px wide, under the 44px touch minimum.
- **List toolbars:** take about 400px of height before the first row.

## Principles

1. **One phone breakpoint: below 768px (`md`).** Tablets at 768px and up get the laptop layout, with
   the sidebar collapsed below 1280px (FOR-358). The old 900px `toolbar` breakpoint is retired.
2. **Shared components first.** Every rule below lives in one shared component, so screens get it by
   using that component, not by per-page CSS.
3. **Read-only tables scroll sideways.** Tables where users type into cells become cards on phones.
4. **One main action per screen,** always within thumb reach in the fixed footer bar.
5. **Touch and iOS basics:**
   - Tap targets are at least 44×44px.
   - Text inputs use at least a 16px font on phones, so iOS Safari doesn't zoom when a field is
     focused.
   - Fixed bars respect `env(safe-area-inset-bottom)`.
   - Use `dvh` units, not `vh`, so the address bar doesn't cover content.

## Building blocks (Phase 1)

| #   | Block                                | Where                                              | Status |
| --- | ------------------------------------ | -------------------------------------------------- | ------ |
| B1  | Phone breakpoint = `md` (FOR-368)    | `Modal`, `GridModal`, two local modals             | ✅     |
| B2  | Phone top bar (FOR-369)              | `AppLayout`                                        | ✅     |
| B3  | Bottom nav: 4 + More (FOR-369)       | `Sidebar` (mobile nav), `sidebarConfig`            | ✅     |
| B4  | Tab strip edge fade (FOR-370)        | `ui-components/Tabs`                               | ✅     |
| B5  | Table scroll + pin + fade (FOR-371)  | shared table styles and wrappers (closes FOR-360)  | ✅     |
| B6  | Bottom-sheet modals (FOR-372)        | `Modal` (no wider than 560px becomes a sheet)      | ✅     |
| B7  | Fixed footer bar (FOR-373)           | new `MobileActionBar` in ui-components             | ✅     |
| B8  | Compact wizard stepper (FOR-374)     | shared stepper + hide bottom nav during wizards    | ✅     |
| B9  | Compact list toolbar + FAB (FOR-375) | RFQ/PO list toolbar (shared), then the other lists | ✅     |
| B10 | Line-item edit sheet (FOR-376)       | new `LineItemSheet` in ui-components               | ✅     |

### B2 — Phone top bar

On phones, the left side shows the page title, with a back arrow on detail pages that goes to the
breadcrumb parent. The right side shows notifications and the avatar. The user-menu dropdown moves
into **More** (B3). Desktop is unchanged.

### B3 — Bottom nav

At most 5 slots: the role's 4 main sections, each with a label, plus **More** when the role has more
than 4 sections. More opens a bottom sheet listing every other section, plus Profile and Log out.

| Role                        | Main sections                          |
| --------------------------- | -------------------------------------- |
| Company Admin / Procurement | RFQs, POs, Invoices, Projects          |
| Financial Officer           | Invoices, Deliveries                   |
| Warehouse Officer           | Deliveries, Material Requests          |
| Foreman                     | Material Requests (their only section) |
| Vendor                      | RFQs, POs, Invoices, Bulk Orders       |
| Super Admin                 | Admin panel, Users, Material Catalogue |

Roles with 4 or fewer sections show them all and get no More tab. Profile and Log out are then
reached from the avatar in the top bar.

### B4 — Tabs

The tab strip keeps scrolling, but shows a fade on whichever edge has hidden tabs, and scrolls the
active tab into view. FOR-358's wrap-above rule for actions stays for laptops. On phones the actions
leave the tab bar entirely (see B7).

### B5 — Tables

- **Phones:** the table scrolls sideways inside its card, and the first column is pinned (capped at
  45vw, with a divider shadow once scrolled).
- **Edge fade:** a fade on the right edge while more columns are hidden, and on the left once
  scrolled.
- **Column drag handles:** hidden on phones.
- **Laptops:** the same pin and fade apply, which closes FOR-360. FOR-359's sticky header row reuses
  the same scroll container.

**As built:**

- **Component:** `ScrollTable` in ui-components, with `pinColumn` (default 1; 2 when column 1 is a
  checkbox or star; `false` for tables that pin themselves, like quote comparison). Layout classes
  go on `wrapperClassName`.
- **CSS:** the pinning lives in `apps/web/src/styles/globals.css` (`[data-scroll-table]`).
- **Tints:** pinned cells must be opaque, so translucent row and header tints in these tables are
  now opaque `color-mix(…)` equivalents. They look the same.
- **Coverage:** all 57 read-only tables use it.
- **Not migrated:**
  - `PoCreateLineItemsStep`: an input grid, so B10 handles it (cards + sheet on phones).
  - `VendorContactPopover`: a small desktop-only table.

### B6 — Modals

- **Bottom sheets:** below `md`, modals no wider than 560px (most confirm and short-form modals)
  open as bottom sheets. They have a rounded top and a grab handle, close on swipe down or a tap on
  the backdrop, and have a footer padded for the safe area.
- **Wider modals:** stay full-screen, with a fixed header and footer.
- **`ConfirmDialog` / `GridModal`:** inherit this from `Modal`.

### B7 — Fixed footer bar (`MobileActionBar`)

A bar fixed above the bottom nav (or at the very bottom when the nav is hidden) that holds the
screen's main action. Approve/Reject-style pairs split it 50/50. Secondary actions go to a **⋯**
menu in the top bar. Pages render their actions through one helper, which shows them inline on
desktop and in the bar or the ⋯ menu on phones.

Main action per detail page:

| Page                    | Main action (when shown)                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| RFQ (buyer)             | Send to vendors (draft) · Review quotes (open) · Create draft PO (awarded) |
| RFQ (vendor)            | Respond / Edit response                                                    |
| RFQ quote form (vendor) | Submit / Update quote                                                      |
| RFQ (guest)             | Submit quote                                                               |
| PO (buyer)              | Approve / Decline (pending) · Send (draft) · else Record delivery          |
| PO (vendor / guest)     | Acknowledge + Decline · then Accept + Decline                              |
| Invoice                 | Decline / Approve (pending)                                                |
| Material request        | Approve / Decline (submitted) · Convert to RFQ / PO (approved)             |
| Bulk order              | Review changes (change waiting on you) · else Create drawdown              |
| Delivery report         | Approve / Reject (submitted)                                               |
| Project                 | none (no page-level actions today)                                         |

**As built:**

- **Components (ui-components):** `PageActions` (`primary` node + `secondary: PageAction[]`) renders
  inline on desktop; on phones `primary` goes to `MobileActionBar` and `secondary` to
  `MobileHeaderActions` (the ⋯ in the top bar). The shell (`AppLayout`) mounts
  `MobileHeaderActionsSlot` and `MobileActionBarSlot`; both portal in.
- **Every tab:** on phones the actions show on every tab, not only Details (desktop is unchanged:
  Details tab only).
- **Guest pages** (guest RFQ, guest PO) have no shell: the actions render in place and the page
  calls `useHideMobileNav()` so the bar sits at the very bottom.
- **Vendor PO:** `PoVendorActions` owns the bar on phones (not in slide-over `compact` mode); the
  page's Export / Change request / Cancel go to ⋯.
- **Desktop deviations:** `PageActions` puts secondary buttons before the main one, so Export moved
  before the main action on RFQ (buyer) and PO (buyer). The vendor PO "Change request" button lost
  its chevron icon. Vendor RFQ detail, the quote form and bulk order keep their exact desktop markup
  (phone-only branch).
- **Tests** that fully mock `@forethread/ui-components` need `useIsPhone` (→ false), and
  `PageActions` / `MobileActionBar` / `useHideMobileNav` pass-throughs.

### B8 — Wizards

- **Stepper:** on phones it becomes one line, "Step 2 of 3 · Add line items", with a thin progress
  bar.
- **Buttons:** Back / Save draft / Next move into `MobileActionBar`.
- **Validation:** on Next, the page scrolls to the first invalid field.
- **Leaving:** the bottom nav is hidden while a wizard is open. The top-bar ✕/back exits, with an
  unsaved-changes confirm.

**As built:**

- **Stepper:** `CompactStepper` in ui-components. The po-shared `Stepper`, the catalogue
  `WizardStepper` and the MR `StepProgress` switch to it when `useIsPhone()` is true.
- **Chrome:** `useWizardChrome({ isDirty, onExit })` in po-shared. It hides the bottom nav, routes
  the top-bar back arrow through a `ConfirmDialog` when the wizard is dirty, and returns
  `exitConfirm` for the wizard to render. `scrollToFirstInvalid()` sits next to it and scrolls to
  the first `[aria-invalid]`, `.border-destructive` or `p.text-destructive`.
- **Footer:** each wizard defines its footer buttons once, then renders them inline on desktop or in
  `MobileActionBar` on phones, so they never mount twice.
- **Wizards covered:** RFQ, PO (create, change, drawdown and the guest change request), BOM,
  project, material create, catalogue upload, the MR wizard, and bulk-order create. Bulk-order
  create is a single form, so it uses the ui-components primitives directly.
- **Desktop page headers** with their own title/back arrow (RFQ, material create/upload, MR) are
  hidden on phones, because the top bar already shows the title and back arrow.
- **Phone Back:** the material-create and MR wizards get a Back button in the bar, because the
  compact stepper can't be tapped to go back. The MR review step drops its disabled "Raise PO"
  placeholder on phones.

### B9 — List toolbar

- **Row 1:** a full-width search box, a **Filters** button with a count of active filters, and a
  **⋯** menu.
- **Row 2:** the quick-filter pills on one line that swipes sideways.
- **Filters:** opens a full-screen sheet with the advanced filters and Group.
- **⋯ menu:** view presets, Save view, Export and Column settings.
- **Create new:** a floating action button at the bottom right, above the bottom nav.

**As built:**

- **Components:** `MobileListToolbar` and `FloatingActionButton` in ui-components. Pages switch on
  `useIsPhone()`; desktop toolbars are unchanged. The FAB portals into the shell's action-bar slot.
- **Helpers:** `apps/web/src/shared/layout/mobileListToolbar.ts` has `countActiveFilters` (the
  Filters badge) and `buildListMenuActions` (the ⋯ menu: view presets with ✓ on the active one, Save
  view, Export CSV/XLSX, Table settings).
- **Several create options:** RFQ (buyer) and PO (buyer) FABs open a bottom sheet listing them
  (manual / from BOM / from material list; manual / from RFQ / from bulk order).
- **Migrated:**
  - RFQ list (buyer + vendor) and PO list (buyer + vendor): full toolbar.
  - Invoices (buyer + finance, shared page): search, filter sheet, active chips swipe, FAB.
  - Users (company admin + super admin): search, filter sheet, chips, Invite as FAB.
  - Vendors: search, filter sheet, ⋯ (create vendor company), Invite as FAB.
  - Projects and deliveries (reports tab): search, filter sheet, FAB; deliveries Upload in ⋯.
  - Catalogue: keeps its autocomplete search, facets move to a Filters sheet, Create as FAB.
  - Bulk orders: already stacked on phones; Create became the FAB.
- **Not migrated:** MR lists (Foreman / officer) — no filter toolbar to compact.

### B10 — Line-item edit sheet

On phones, each line of an input grid becomes a card showing the material name, qty and key values.
Tapping a card opens `LineItemSheet`: the line's fields stacked full-width, with **Previous / Save /
Next** buttons so users can work through lines without closing it. The grid defines its fields once
and both views use that definition.

It applies to five grids:

- RFQ create line items
- PO wizard step 2
- Vendor quote response
- Invoice review lines
- BOM edit

Also used by the delivery report, the guest PO change request and MR step 2.

**Shared API:** a grid declares `LineItemField<T>[]` (`label`, `input(line, i)`, optional `value`
for the card, `hidden`, `hint`, `required`). `LineItemEditor` renders the cards and owns the open
sheet; `validateLine(i)` returning false keeps Save / Previous / Next on that line. Values stay in
the grid's own form state, so Save only closes the sheet. Tests:
`apps/web/src/shared/layout/LineItemSheet.test.tsx`.

**Shared phone fixes made alongside (ui-components):** `Input` / `Textarea` use 16px text below `md`
(no iOS focus zoom); `GridModal` cards keep the safe-area bottom padding as sheets;
`DashboardItemCard` actions wrap full-width below the title on phones; toasts sit above the bottom
nav and footer bar (`Toaster mobileOffset`).

**As built (RFQ create, PO wizard, BOM edit):**

- **Component:** `LineItemEditor` / `LineItemSheet` / `LineItemField<T>` in ui-components. Pages
  switch on `useIsPhone()` and don't mount the table on phones, so each input mounts once.
- **RFQ create** (`StepLineItems`): `lineFields` (qty, UoM, exp. delivery, availability, notes, plus
  phone-only name and move-to-project) over `{ item, index }` rows. `LineItemRow` renders its cells
  from them; the availability cell is its own `AvailabilityCell`. Phones show one card list per
  project group; **Add line** adds a blank manual line (name with the same catalogue autocomplete)
  and opens it; Save / Previous / Next stay on a line until it has a name, qty and UoM.
- **PO wizard step 2** (`PoCreateLineItemsStep`, used for create, change and drawdown):
  `buildPoLineFields` (`poLineFields.tsx`) is the single field list; `LineItemRow` renders every
  cell from it. Phones get the same shown rows (filled lines + one trailing empty line, which is the
  "add" card). The material search is the compact `MaterialSearchPanel`, already portaled, so it
  works full-width in the sheet. A unit missing from the presets (e.g. "M") is now added as an
  option, so it shows in the dropdown instead of the placeholder (desktop too).
- **BOM edit + upload review** (`BomReviewStep`): `bomFields` drives both the table cells and the
  phone cards/sheet. Unmatched lines are flagged on the card in the create wizard.

**As built (vendor quote + invoice review):**

- **Vendor quote response** (authenticated quote form and guest `/invitation/:token`, both via
  `ResponseLineItemsTable`): the line fields live in `useQuoteLineFields` (`quoteLineFields.tsx`).
  The desktop grid renders each field's `input` in its cell (`variant: 'cell'`); phones render
  `LineItemEditor` with the same fields (`variant: 'sheet'`), plus line notes, back-order qty/date
  and a substitute search (`MaterialSearchPopup` `inline`) that the desktop shows in its expanded
  row. FOR-273 is enforced in the sheet: while Avail Qty exceeds Req Qty the card is flagged and
  Save / Previous / Next stay on the line. Totals become a stacked summary card.
- **Invoice review lines** (`InvoiceReviewPanel`): one `lineFields` list drives both the desktop
  grid's header and cells and the phone cards/sheet; PO-match badges show under the card title.

## Phase 2: phone-first flows

| Flow                                  | Status |
| ------------------------------------- | ------ |
| Vendor guest quote response (FOR-377) | ✅     |
| Guest PO portal (FOR-378)             | ⬜     |
| Approvals (FOR-379)                   | ⬜     |
| Delivery + QR page (FOR-380)          | ⬜     |
| Foreman MR check (FOR-380)            | ⬜     |

## Phase 3: everything else

Tracked as FOR-381 (RFQ, PO, bulk order, invoices) and FOR-382 (everything else).

Screen by screen per area:

- Dashboards (single column; quick actions become a swipeable row)
- Projects and BOM
- Catalogue
- Vendors
- Users and roles
- Settings
- Company profile
- `/me` (currently overflows)
- Bulk orders
- Deliveries list

## Definition of done (each screen)

- **Widths:** checked at 360, 390 and 430px with real data.
- **Overflow:** no page-level sideways scroll. Nothing is clipped without a scroll hint.
- **Touch and inputs:** touch targets are at least 44px, and text inputs use at least a 16px font on
  phones.
- **Screenshots:** before/after screenshots attached to the ticket.
- **Real devices (Phase 2 flows):** checked on staging with iPhone Safari and Android Chrome.
- **Desktop:** no regression at 1280px and 1920px.

## How to audit

Run `node .tmp/for358/audit-real.mjs 390x844 --tag=<name>` from the repo root. It needs the local
backend on :3000, the web app on :5179, and `inject-otp.cjs` copied into `apps/backend` as
`.tmp-inject-otp.cjs`. It logs in for real and flags page overflow, clipped scroll containers and
text spilling out of cards.
