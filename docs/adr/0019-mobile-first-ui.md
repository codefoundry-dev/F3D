# ADR-0019: Every view is designed for phones, through shared components

**Status:** Accepted **Date:** 2026-10-21

## Context

FOR-358 made the app fit 13–14" laptops. The client then asked for every view and table to work on
phones too. An audit at 390×844 with real data found no page-level overflow, because the shell
already swaps the sidebar for a bottom bar and modals go full-screen. It did find a lot that's
unusable on a phone:

- Tables show about 2 of about 12 columns, with no hint that more exist.
- Tab bars hide most of their tabs.
- Wizard steppers overflow their box.
- The bottom bar is 10 unlabelled, undersized icons.
- List toolbars take about 400px before the first row.

The cheap option was to make everything merely usable, and to design only the real phone jobs for
phones (vendor guest replies, approvals, delivery receiving and Foreman MRs). We chose the expensive
option: **design every view for phones.**

## Decision

1. **One phone breakpoint: below 768px (`md`).** The 900px `toolbar` breakpoint, used only by
   modals, is retired.
2. **Phone rules live in shared components, not in pages.**
   - The shell: a phone top bar, and a bottom nav with 4 labelled sections plus More.
   - `Tabs`: an edge fade.
   - Table wrappers: sideways scroll, a pinned first column and an edge fade.
   - `Modal`: no wider than 560px becomes a bottom sheet, wider stays full-screen.
   - `MobileActionBar`: the screen's main action, or wizard Back/Next.
   - The wizard stepper: one compact line.
   - The list toolbar: compact, with a floating Create button.
   - `LineItemSheet`.
3. **Read-only tables scroll sideways on phones. They are not turned into cards.** We keep one table
   implementation, and users keep every column. The pinned first column keeps each row identifiable
   while scrolling.
4. **Tables with input cells become cards with an edit sheet on phones.** That's RFQ create, the PO
   wizard, vendor quote response, invoice review and BOM edit. Typing into a sideways-scrolling grid
   fights the swipe gesture and the on-screen keyboard.
5. **One main action per screen,** in a fixed footer bar within thumb reach. Everything else goes in
   a ⋯ menu.

The full spec, per-role nav and per-page main actions are in
[`docs/mobile-first-ui.md`](../mobile-first-ui.md).

## Consequences

- Pages that hand-roll a table, toolbar, stepper or modal miss these rules until they're moved onto
  the shared component. That move is part of each screen's Phase 3 ticket.
- A new page gets the phone layout by default only if it uses the shared components. Reviewers
  should reject new hand-rolled tables, tab bars and modals.
- Desktop layouts must not change. Each shared-component change is checked at 1280px and 1920px.
- FOR-360 (horizontal table scroll) is delivered by the table building block. FOR-359 (sticky
  headers) builds on the same scroll container.
