---
name: po-week3-approvals-states-delivery
description: Week-3 PO Approvals/States/Delivery frontend — real audit-trail timeline hook (usePoActionLog + humanizeAuditAction), AwaitingApprovalSection approver inbox, ReceiveDeliveryModal; contract + placement decisions
metadata:
  type: project
---

Week-3 "Approvals, States, Delivery" PO frontend, built on the api-client contract added on branch
`feat/week3-po-approvals-states-audit` (getPurchaseOrderAuditTrail, listPendingApproval,
receivePurchaseOrder). 3 pieces, all green (typecheck + lint clean; web 38 tests / po-shared 14).

**Why:** the PO activity timeline was a hardcoded placeholder (synthesized created/issued from PO
fields, "no PO-scoped audit feed in api-client"); the dashboard had no entitled-approver queue; and
there was no way to record a delivery. Week-3 backend + api-client landed first and are done — do NOT
touch them.

**How to apply (key mechanisms):**

- **Real audit timeline** = `usePoActionLog(poId)` hook in `packages/po-shared/src/hooks/` +
  `humanizeAuditAction(entry, t?)` pure mapper in `packages/po-shared/src/utils/po-audit-log.ts`.
  Hook calls `getPurchaseOrderAuditTrail` (queryKey `['po-action-log', poId]`, `enabled: !!poId`),
  maps `PoAuditEntry[]` → `PoActionLogEntry[]`, filters nulls. The humanizer takes an OPTIONAL
  2-arg `t: (key, fallback) => string` (react-i18next inline-fallback shape) so it stays pure/unit-
  testable; the hook passes `(k,f) => t(k,f)` from `useTranslation('purchaseOrders')`. It RETURNS
  null for PO_CHANGE_* and unknown actions (CRs are surfaced via PoActionLogTab's separate
  `changeRequests` prop — see [[po-change-request-flow-us-flow3]]). PO_ISSUED→"Submitted for
  approval" when `metadata.to==='PENDING_APPROVAL'`. Description = "Performed by {name}" (+ "— {reason}"
  for declines); `{id:'',name:'System'}` when performedBy is null. i18n keys under `actionLog.*` in
  `purchaseOrders.json`. Both buyer + vendor `PurchaseOrderDetailPage` now use the hook (replaced
  their placeholder `actionLogs` useMemos) and pass `logs` + `isLoading` to `PoActionLogTab`.
  PoActionLogTab itself was UNCHANGED.
  - GOTCHA: the humanizer's `t(key,'Performed by {{name}}')` 2-arg call does NOT interpolate (no
    values object), so it manually `.replace('{{name}}', name)` after translating. Keep that.
  - NOTE: the PO *List* side panel `PoDetailPanel.tsx` (buyer + vendor) STILL has its own placeholder
    action log — out of scope for the detail-page task; a follow-up candidate to migrate to the hook.

- **Approver inbox** = `AwaitingApprovalSection` (`apps/web/src/features/dashboard/ui/buyer/`) +
  `useAwaitingApproval` hook (`listPendingApproval`, queryKey `['dashboard','awaiting-approval']`).
  Sources the REAL PENDING_APPROVAL queue (threshold-scoped server-side) — distinct from the existing
  DRAFT/SENT `PendingPurchaseOrders` widget. Reuses the same `DashboardItemCard` + Badge + approve/
  decline-button UX; maps `PoDetail` → card (vendor.name, poNumber, projectName, formatDate(createdAt),
  formatCurrency(totalAmount,currency), lineItemCount, pickUp?Pick-up:Delivery). Approve →
  `approvePurchaseOrder`, decline → `DeclinePoReasonModal`; both invalidate BOTH
  `['dashboard','awaiting-approval']` AND `['dashboard','po-ca']`. PLACEMENT DECISION: rendered
  full-width ABOVE the two-col grids on the buyer `DashboardPage`, gated by
  `usePermissions().has('po.approve')` (most actionable queue first).

- **Record delivery** = `ReceiveDeliveryModal` (`.../purchase-orders/buyer/components/`). Props
  `{ po: PoDetail; onClose; onReceived? }`. One row per `po.lineItems` line; numeric `Input`
  pre-filled with current `quantityDelivered`, validated integer in `[alreadyDelivered, quantityOrdered]`;
  submit disabled until ALL rows valid. Submits CUMULATIVE `receivePurchaseOrder(po.id, {lines:[{lineItemId,
  quantityDelivered}]})`; invalidates `['purchase-orders', po.id]` + `['po-action-log', po.id]`.
  Surfaced as a "Record delivery" button (package icon) in the buyer detail-page tabs `rightSlot`,
  gated by `has('po.receive')` AND status ∈ `RECEIVABLE_STATUSES` = `ACKNOWLEDGED, ACCEPTED,
  SCHEDULED_FOR_DELIVERY, PARTIALLY_DELIVERED, LATE_FOR_DELIVERY` (const next to CHANGEABLE_STATUSES).
  `po.receive` + `po.approve` are REAL granted permissions (apps/backend permissions.catalog.ts).

- **PoDetail detail gotchas**: `getBulkOrder`-style; `PoDetail` has `vendor.name`, `lineItemCount`,
  and per-line `quantityOrdered`/`quantityDelivered` on `lineItems[]` (PoLineItemDetail). `Input` from
  ui-components DOES spread `...props` (forwards type/min/max/aria-*) — unlike Alert/Badge
  (see [[alert-component-no-prop-spread]]).

**Test-mock gotchas hit (this task):** (1) hoisted `vi.fn(()=>...)` mocks called with args must be
typed `vi.fn((_id: string)=>...)` or tsc errors "Expected 0 arguments". (2) When a component drives a
real `useMutation`, the mutationFn runs on next tick — assert the api spy via `await waitFor(...)`,
not synchronously. (3) Mocked `DashboardItemCard`/`Input` must forward `type` for `getByRole('spinbutton')`
to work. (4) `getByLabelText<HTMLInputElement>(...)` generic, NOT `as HTMLInputElement` (lint:
no-unnecessary-type-assertion). (5) po-shared has NO eslint config/script — lint its files by pointing
`apps/web` eslint at them (`--no-eslintrc --config .eslintrc.cjs --resolve-plugins-relative-to .`);
its `import/order` wants type-import-before-value-import, no blank line within a group.

See MEMORY.md "shared-types/client Boundary" + "Verification Commands" + [[shared-types-client-boundary]].
