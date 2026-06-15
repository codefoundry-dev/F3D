---
name: po-change-request-flow-us-flow3
description: PO Change Request flow (FLOW 3, node 6725:97614) — change-mode CreatePoWizard + diff engine + Changes-request tab + Action-log CR entries; how change-mode + action-log sourcing work
metadata:
  type: project
---

PO Change Request UI (FLOW 3, Figma node 6725:97614, file CFA6k0XCvImOmWXbBgdWYZ). Built on the
SHARED `CreatePoWizard` (create + from-rfq + drawdown already there). Screens: `.tmp/figma-flows/`
pc1 (list kebab), pc4 (step1), pc2 (step2), pc3 (step3 DIFF), pc5 (Changes-request tab), pc6
(Action log). Harness: `.tmp/figma-flows/shot_change.mjs` (CR_MODE=none|pending|resolved|list).

**Why:** Buyer/vendor propose edits to a SENT/ACKNOWLEDGED/ACCEPTED PO as a `PoChangeRequest`
(changedFields diff + COMMERCIAL/INTERNAL type); approver Applies-all (apply to PO + revision bump)
or Rejects. Backend fully implemented (`apps/backend/.../po-change.service.ts`); UI binds to it.

**How to apply (key mechanisms):**

- **Wizard change mode** = `CreatePoWizard mode='change' existingPo={po} onProposeChange={...}
  isSubmittingChange`. usePoWizardForm gained `mode/existingPo/onProposeChange/noChangesMsg`. In
  change mode it: locks `documentName` (wizard adds it to lockedFields), swaps step-3 to
  `PoChangeReviewStep` (diff + Note + "Submit PO changes"), hides "Save as draft", computes a LIVE
  `changedFields` from `form.watch()` vs existingPo, and `submitChange()` calls onProposeChange.
  Create/from-rfq/drawdown modes untouched (all their tests pass).
- **Diff engine** `packages/po-shared/src/utils/change-diff.ts`: `computePoChangedFields(form, po)` →
  the exact `{fields, lineItems:[{lineItemId,name,changes}]}` shape. Lines matched by a NEW optional
  `lineItemId` field on the lineItem schema (seeded from PO line `id` via `poToFormDefaults`). Only
  the backend-allowlisted fields are diffed (PO: paymentTermsDays, pickUp*, plannedDeliveryDate,
  deliveryLocationId, deliveryNotes, costCode, message, deliveryResponsible*; line: unitPrice,
  quantityOrdered, costCode, expectedDeliveryDate, description, unitOfMeasure, notes). Dates compared
  as yyyy-MM-dd slices; null/''/undefined collapse to equal (no spurious diffs).
- **changeType derivation** `deriveChangeType()`: COMMERCIAL if any of {paymentTermsDays,
  plannedDeliveryDate, deliveryLocationId} (PO) or {unitPrice, quantityOrdered, expectedDeliveryDate}
  (line) moved; else INTERNAL (note/cost-code/cosmetic).
- **Shared diff renderer** `PoChangeDiff.tsx`: "Suggested changes:" band (3-col, old struck →new) +
  line-item changes (4-col; `lineItemsAsCards` for the tab/pc5, flat for step3/pc3). formats currency
  for unitPrice, `formatDate` for date fields, resolves deliveryLocationId via `locationOptions`.
  Reused by step3, the tab, the action-log, AND the vendor `ChangeRequestModal`.
- **Action-log CR sourcing**: there is NO PO-scoped audit feed in api-client (the audit
  PO_CHANGE_APPROVED/REJECTED entries are written but not exposed). So the Action log sources resolved
  (APPROVED/REJECTED) CRs from `listPoChangeRequests` (the `usePoChangeRequests` hook), rendered as
  timeline entries with a Commercial/Internal badge + diff AHEAD of the generic placeholder entries.
  `PoActionLogTab` gained `changeRequests` + `locationOptions` props (existing `logs` kept).
- **Changes-request tab** `PoChangeRequestTab.tsx`: shown ONLY when a PENDING CR exists (buyer
  detail page computes `validTabs` to insert `'changeRequest'`). Apply all → `approvePoChange`, Reject
  → reason modal → `rejectPoChange`. Apply/Reject HIDDEN when `currentUserName === requestedByName`
  (UX self-approve guard; backend forbids self-approve via requestedById). Buyer detail page resolves
  `locationOptions` from `useProjectDetail(po.projectId)`.
- **Entry**: PO list kebab "Change PO" (2nd item, after Copy PO) gated to status ∈ {SENT,
  ACKNOWLEDGED, ACCEPTED}; PO detail "Change" button gated to same + `has('po.proposeChange')`. Route
  `purchaseOrderChange='/purchase-orders/:id/change'` gated BUYER_SIDE + PermissionRoute
  `po.proposeChange` (a REAL backend permission). `ChangePurchaseOrderPage.tsx` is the buyer wrapper.
- Fixed the 3 pre-existing typecheck errors in vendor `ChangeRequestModal.tsx` (`.requestedBy.name`
  /`.resolvedBy` → flat `requestedByName`/`resolvedByName`) + reused `PoChangeDiff` there.

See [[shared-types-client-boundary]] and the harness note in MEMORY.md (MSYS_NO_PATHCONV + DatePicker).
