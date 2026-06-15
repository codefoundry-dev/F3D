---
name: bulk-order-flow-us508
description: Bulk Order (US 5.08) Figma alignment — Create page from approved RFQ, propose-extension modal, inline extension review, consumptionPercent column; bulk-order-shared test infra
metadata:
  type: project
---

Bulk Order flow (US 5.08) Figma alignment, shipped on branch off main 2026-06-13. Files:
`packages/bulk-order-shared/src/components/{CreateBulkOrderPage,ProposeExtensionModal,InlineExtensionReview}.tsx`,
`apps/web/src/features/bulk-orders/buyer/pages/BulkOrderCreatePage.tsx`, route `bulkOrderNew = /bulk-orders/new`.

**Why:** convert the bulk-order create-modal to a full page matching Figma node 6273:160121, add
end-date extension propose/approve, and fix the list/detail "Utilization,%" column.

**How to apply (load-bearing facts for future bulk-order work):**
- **Utilization,% column reads `consumptionPercent`, NOT `deliveriesPercent`.** Both are OPTIONAL
  (`?`) on `BulkOrderListItem` + `BulkOrderLineItemDetail` (api-client) — render `?? 0`. The sort
  `field` in `constants/index.ts` COLUMNS was also flipped to `consumptionPercent`.
- **Approved-RFQ-response data source** (for "create from approved RFQ"): reuse api-client `getRfqs({
  minApprovedQuotes: 1, limit: 50 })` (list) + `getRfq(rfqId)` (detail). The approved responses live
  on `RfqDetail.quoteResponses[]` filtered to status `APPROVED`/`Approved`. po-shared's
  `deriveVendorGroups`/`deriveQuoteLineItems` do the same spread but DROP `vendorId`, and
  bulk-order-shared does NOT depend on po-shared — so I wrote a local
  `src/utils/approved-quotes.ts#deriveApprovedQuoteResponses` that also surfaces `vendorId`
  (createBulkOrder needs it). Per-line unitPrice = response.totalCost / lineItemCount / qty (same
  approximation the PO "from RFQ" flow uses; backend has no per-line quoted price yet). ASSUMPTION:
  the create page uses the FIRST approved response on the selected RFQ (single-dropdown design).
- **createBulkOrder** payload = `{ projectId, vendorId, rfqId?, endDate?, lineItems[] }`; line item =
  `{ itemReference, description, qty, unit, pricePerUnit }`. Returns `BulkOrderDetail` whose id field
  is `bulkId` (NOT `id`) — navigate to `/bulk-orders/${data.bulkId}`.
- **Extension = end-date-only change request.** `proposeChange({ endDate, message })` (no lineItems).
  The detail page branches: a pending CR where `changes.endDate` set AND no `changes.lineItems` is an
  EXTENSION; if the current user is the approver (non-proposer, i.e. vendor) it renders
  `InlineExtensionReview` INLINE (bo6 blue banner + Submit=approve / Cancel=reject via
  `useApproveChange`/`useRejectChange`) and HIDES the Create-drawdown/Change/Propose-extension trio.
  Line-item change requests keep the old separate review-page navigation. The CR "Note" is
  `changeRequest.message`; the new date is `changeRequest.changes.endDate`.
- **Detail action trio** (bo4): Create drawdown (navigate `/bulk-orders/:id/drawdown`) · Change
  (navigate `/bulk-orders/:id/change` — existing propose-change page) · Propose extension (opens
  `ProposeExtensionModal`). i18n keys `detail.change` / `detail.proposeExtension`.
- **bulk-order-shared had NO test runner before.** I added `vitest.config.ts` + `src/test/setup.ts`
  + a `test`/`test:watch` script + test devDeps (mirrored po-shared EXACT versions). The web build's
  `tsc --noEmit` only checks `apps/web/src`, so shared `.test.tsx` files are NOT typechecked by it —
  they only run under the package's own `vitest`. Run: `pnpm --filter @forethread/bulk-order-shared
  run test`. Shared package has NO `lint` script (not linted in CI, same as po-shared).
- **Route gating:** `/bulk-orders/new` registered in its OWN `RoleRoute allow={BUYER_SIDE}` >
  `PermissionRoute require={['bulkOrder.create']}` group, placed BEFORE the `BULK_ORDER_VIEWERS`
  group (static-before-dynamic so `/new` isn't swallowed by `/:id`). `bulkOrder.create` IS a real
  backend permission (permissions.catalog.ts), granted to buyer roles.
- Visual harness: `.tmp/figma-flows/shot_bulkorder.mjs` (SHOT_PORT, SHOT_ROLE=VENDOR + SHOT_EXTENSION=1
  for the bo6 inline-review screen). Mocks `**/v1/**` incl. rfqs(minApprovedQuotes)+rfq detail+bulk
  detail+change-requests. All 6 screens (bo1–bo6) verified matching.

**Out-of-scope deltas left as-is:** `BulkOrderLineItemsTable` Actions column shows `MessageBadgeIcon`
not the Figma edit-pencil; list "Active" badge renders green not Figma's neutral gray (both pre-existing
`BULK_ORDER_STATUS_COLORS` / component behavior, not in the alignment delta list). The retired
`CreateBulkOrderModal.tsx` was DELETED and removed from both barrels (no app imported it).
