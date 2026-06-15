---
name: po-bulk-drawdown-flows
description: Backend contract for Bulk Order US5.08 + Drawdown US5.09 + PO Change Request apply — changedFields shape, approveChange used to be a no-op stub, drawdown-from-PO, approved-responses endpoint
metadata:
  type: project
---

Three procurement flows wired on the backend (branch work mid-June 2026, driver `.tmp/figma-flows/PLAN.md` "BACKEND CONTRACT"). Owns `apps/backend`, `packages/shared-types`, `packages/api-client`; the `packages/bulk-order-shared`/`po-shared`/`apps/web` halves are other agents'.

**PO Change Request apply (the load-bearing fix).** `po-change.service.ts approveChange` previously ONLY set a non-existent `approvedById` (cast `as never`) — it never applied anything to the PO. Now it applies `changedFields` in a transaction: PO-level `fields` + per-line `lineItems[].changes` (recompute `lineTotal` = unitPrice×qty, then recompute PO subtotal/total/counts), bump `revision`, set CR `status=APPROVED`+`resolvedById`+`resolvedAt`, audit `PO_CHANGE_APPROVED` with `{reference,changeType,changedFields,requestedByName,resolvedByName}`.
**Why:** the PO-detail "Changes request" tab (Apply all) + Action-log timeline need the diff applied and a resolved-CR audit entry.
**How to apply:** field application is an ALLOWLIST (`PO_FIELD_APPLIERS` / `PO_LINE_FIELD_APPLIERS`) — a CR can never write an arbitrary column; object/invalid values coerce to null. PO-level updates use `Prisma.PurchaseOrderUncheckedUpdateInput` (scalar FK `deliveryLocationId`, not the `deliveryLocation` relation).

**Canonical `changedFields` JSON shape** (both FE agents + backend use it verbatim):
`{ fields?: Record<string,{from,to}>, lineItems?: Array<{lineItemId, name, changes: Record<string,{from,to}>}> }`.
PO fields: paymentTermsDays, pickUpLocation, pickUpTimeExpectation, pickUpPersonName/Phone, plannedDeliveryDate, deliveryLocationId, deliveryNotes, costCode, message, deliveryResponsible*. Line changes: unitPrice, quantityOrdered, costCode, expectedDeliveryDate, description, unitOfMeasure, notes.

**`PoChangeRequest.reference`** ("CR-001", sequential-per-PO by count) added — migration `20260613150000_po_change_reference` (hand-written + idempotent, backfills per-PO by created_at). `listChangeRequests` now returns a SHAPED dto: `{id,reference,changeType,status,message,changedFields,reason,requestedByName,requestedByCompanyName,resolvedByName?,resolvedAt?,createdAt}` — NOT the raw row.

**Drawdown-from-PO (US5.09).** `CreatePurchaseOrderDto.bulkOrderId?` + `CreatePoLineItemDto.bulkOrderLineItemId?` (NOT a PoLineItem column — extracted before nested create). `createPurchaseOrder` now wraps create+drawdown in ONE `$transaction`: when `sourceOfCreation==='BULK_DRAWDOWN'` && `bulkOrderId`, forces `poType=DRAWDOWN`, and per line with a `bulkOrderLineItemId` validates `qty<=qtyRemaining` (400 `drawdownExceedsRemaining`), writes a `Drawdown`, decrements `qtyRemaining`/increments `ordered`/recomputes `deliveriesPercent`. All-lines-zero ⇒ `BulkOrder.status=COMPLETED`. Existing single-item `POST /bulk-orders/:id/drawdowns` kept (reuses `bulk-orders.service createDrawdown`).

**Bulk-order "create from approved RFQ" (US5.08).** Added `GET /v1/rfqs/approved-responses?projectId=` (perm `rfq.read`, static route declared BEFORE `:id`) → `rfqs.service listApprovedResponses` returns awarded quotes (QuoteResponse `status=APPROVED`, dropping NO_QUOTE lines) as `[{rfqId,responseId,rfqReference,vendorId,vendorName,discountPercent,lineItems:[{materialId,itemReference,description,unitPrice,uom,quantity,discount}]}]`. api-client fn `getApprovedRfqResponses`. `createBulkOrder` already takes `rfqId`+`vendorId`+`lineItems`. Bulk-order `consumptionPercent` + endDate-only extension change-request approve→`BulkOrder.endDate` already worked — no change.

**Test gotcha (cost me time):** wrapping a `prisma.create` in `$transaction(async tx => …)` breaks specs that mock `prisma.x.create` directly — the callback's `tx.x.create` is a different mock. Fix: make the `$transaction` mock invoke its callback with the same `mockPrisma`: `mockImplementation((arg)=> typeof arg==='function' ? arg(mockPrisma) : arg)` (no `async` — lint flags await-less async). Repo enforces a 90% GLOBAL branch gate (`jest.config.ts coverageThreshold.global`); baseline sits at ~90.0%, so new allowlist/error-helper branches must be covered or the whole gate goes red.

Files: `apps/backend/src/modules/purchase-orders/{po-change.service.ts,purchase-orders.service.ts}`, `apps/backend/src/modules/rfqs/{rfqs.service.ts,rfqs.controller.ts}`, `packages/shared-types/src/dtos/purchase-order.dto.ts`, `packages/api-client/src/endpoints/{purchase-orders.ts,rfqs.ts,paths.ts}`. See [[prisma-migrate-headless]], [[shared-types-runtime-dist-rebuild]].
