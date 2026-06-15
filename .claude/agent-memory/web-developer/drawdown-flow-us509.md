---
name: drawdown-flow-us509
description: US 5.09 Drawdown PO flow — how drawdown mode is threaded through the SHARED CreatePoWizard, the getBulkOrder detail-response gap, and the Available-qty/banner deltas
metadata:
  type: project
---

# Drawdown from bulk order (US 5.09) — Flow 2

Implemented 2026-06-13. "Create drawdown" on a bulk order opens the existing PO wizard
pre-sourced from the bulk order; submit creates a DRAWDOWN PO that decrements the bulk
order's `qtyRemaining`. Backend + api-client already done (do not touch).

**Why:** part of the FLOW 1/2/3 set (specs in `.tmp/figma-flows/SPEC.md` + `PLAN.md`,
node 6317:159782, file CFA6k0XCvImOmWXbBgdWYZ). Flow 1 (bulk order) and Flow 3 (PO change)
extend the SAME `CreatePoWizard` — make every mode-specific behavior conditional.

**How to apply (the wizard is shared — props I added, the Flow 3 agent extends the same):**

- Drawdown is detected by `creationMode === 'from-bulk-order' && Boolean(bulkOrderId)`. New
  props on `CreatePoWizard`: `bulkOrderId?`, `bulkOrderNumber?`. New option on
  `usePoWizardForm`: `bulkOrderId?` + `drawdownExceedsMsg?`.
- The create-payload contract: `createPurchaseOrder` accepts top-level `bulkOrderId?` and per
  line `bulkOrderLineItemId?`. `usePoWizardForm.buildPayload` forces `poType=DRAWDOWN`, sets
  `bulkOrderId`, and maps each line's `bulkOrderLineItemId` ONLY in drawdown mode. (It also
  fixed the latent `buildPayload` dep array which had only `[projectDetail]`.)
- Per-line drawdown data rides in the FORM line item (so it survives edits): added optional
  `bulkOrderLineItemId` + `availableQty` to `lineItemSchema` + `EMPTY_LINE_ITEM` (optional ⇒
  no regression to manual/from-rfq). `bulkOrderToFormDefaults` now also takes an optional 2nd
  arg `{ projectId?, vendorId? }` and, when given, prefills+locks projectId (vendorId always
  locked) and stamps each line's `bulkOrderLineItemId` + `availableQty (= qtyRemaining)`.
- Step 2 deltas (`PoCreateLineItemsStep` / `LineItemsTableHeader` / `LineItemRow`): in drawdown
  mode an "Available qty" column REPLACES the "Appr. RFQ" + "Bulk orders" columns (matches dd3),
  the two from-source select buttons are hidden, a blue `Alert variant="info"` banner shows
  "This drawdown will reduce remaining quantities in {bulkOrderNumber} accordingly." Over-limit
  (`quantityOrdered > availableQty`) flags the row red + inline error AND disables Continue
  (gate in `usePoWizardForm.canContinue` + a guard in `handleContinue` mirroring the backend
  DRAWDOWN_EXCEEDS_REMAINING 400). Notes-row `colSpan` is dynamic (10 in drawdown, 11 otherwise).
- Success modal: drawdown swaps to button "Back to Bulk orders" + drawdown message + generic
  redirect text; `BulkOrderDrawdownPage` navigates back to `/bulk-orders/:id`.

**CRITICAL GAP — `getBulkOrder(id)` detail response has NO `projectId`/`vendorId` (and `bulkId`
is the human number, not the UUID).** It only carries `projectName`/`vendorName`. So
`BulkOrderDrawdownPage` resolves the UUIDs by **name-matching** `projectName` → `useProjectsList`
items (`.name`) and `vendorName` → `useCompanyVendors` (`.legalName`/`.tradeName`), then passes
them into `bulkOrderToFormDefaults(detail, {projectId, vendorId})`. If a name doesn't match, the
field stays editable (graceful). `useBulkOrder` is imported from `@forethread/bulk-order-shared`
(reading/using is fine; I only must not EDIT bulk-order-shared files). The page reuses the buyer
`purchase-orders.service` hooks (`useProjectsList/useProjectDetail/useCompanyVendors/useCreatePurchaseOrder`).

**Files I own/changed:** `packages/po-shared/{schemas/create-po.schema.ts, utils/source-to-form.ts
(+test), hooks/usePoWizardForm.ts (+new test), components/{CreatePoWizard,PoCreateLineItemsStep,
LineItemsTableHeader (+new test),LineItemRow}.tsx, index.ts}`,
`apps/web/src/features/bulk-orders/buyer/pages/BulkOrderDrawdownPage.tsx (+test)`,
i18n `packages/i18n/src/locales/en/purchaseOrders.json` (create.availableQty,
drawdownReductionBanner, drawdownExceedsRemaining, drawdownSuccessMessage, backToBulkOrders,
redirectingGeneric). Exported `BulkOrderFormSourceIds` type from po-shared.

Visual harness: `.tmp/figma-flows/shot_drawdown.mjs` (shots in `shots/dd_*.png`) — verified
step1(locked project+vendor) → step2(Available qty + banner + over-limit red/disabled) →
step3 review → success(Back to Bulk orders). All 5 screens match dd2–dd5.

NOTE: the dashboard `QuickActions` "From Bulk order" path also calls `bulkOrderToFormDefaults`
but does NOT pass `bulkOrderId`, so it stays a normal (non-drawdown) PO — unchanged behavior.

Pre-existing typecheck error to LEAVE ALONE: `purchase-orders/vendor/components/ChangeRequestModal.tsx`
(`PoChangeRequest.requestedBy/resolvedBy` missing) is Flow 3's, not this flow's.
