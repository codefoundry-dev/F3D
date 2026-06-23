---
name: modal-grid-conversion-recipes
description:
  Applying the canonical orange-grid Forethread modal design (GridModal / ModalGridBackground)
  across modals — gotchas for Recipe A & B
metadata:
  type: feedback
---

Project-wide effort: convert modals to the canonical orange perspective-grid design. Guide lives at
`.tmp/modal-grid-guide.md`; canonical example
`apps/web/src/features/rfqs/vendor/components/AddWarehouseModal.tsx`.

**Why:** consistent Forethread modal chrome (the angled orange grid bled to the card top, same as
the auth/registration cards).

**How to apply:**

- Recipe A (narrow ≤~560px confirm/form/success): replace `Modal`+`ModalHeader`/`ModalBody`/
  `ModalFooter` with `GridModal` (from `@forethread/ui-components`). Header icon→`icon`,
  title→`title`, subtitle→`description`, footer buttons→`actions` (`className="w-full"`, primary
  first then outline cancel). Pick a sensible icon: send→`paper-plane.svg?react`. GridModal closes
  via Esc/overlay/buttons — drop the header's top-right close.
- Recipe B (wide pickers/tables/`max-w-*xl`+): KEEP width/layout; just add
  `decoration={<ModalGridBackground />}` to the existing `<Modal>` and add `relative` to the
  immediate content wrapper so it paints ABOVE the absolutely-positioned grid (grid is
  `absolute top-0 h-[180px]`).

**GOTCHA — Recipe B with `scrollBody`:** when a Modal renders `ModalHeader`/`ModalBody`/
`ModalFooter` as DIRECT children (no single wrapper) AND uses `scrollBody`, you CANNOT wrap them in
one `relative` div — that breaks the pinned-scroll flex layout (`ModalBody` is the `flex-1` scroll
child). Instead add `className="relative"` per-element. `ModalBody`/ `ModalFooter` already accept
`className`; `ModalHeader` did NOT until I added an optional `className` prop to it in
`packages/ui-components/src/components/Modal.tsx` (backward-compatible, merged via `cn`). Only the
header + body overlap the 180px grid top; footer can skip `relative`.

**Test gotchas:**

- Recipe A: the colocated test usually `vi.mock`s `@forethread/ui-components`. Swap the
  `Modal`/`ModalHeader`/... mocks for a `GridModal` mock that renders `icon`/`title`/
  `description`/`children`/`actions` (mirror AddWarehouseModal.test.tsx). ALSO add
  `vi.mock('.../assets/icons/<icon>.svg?react', () => ({ default: () => <span /> }))`. Watch copy
  that moved header→`description` (e.g. SendRfqDialog "N vendors will be emailed" is now in
  `description`, so the mock MUST render `description`).
- Recipe B: add a `ModalGridBackground: () => <div data-testid="modal-grid-bg" />` entry to the
  `@forethread/ui-components` mock so the real component's `<ModalGridBackground />` resolves. If
  the test mocks the whole modal component (e.g. picker mocked in `source-modals.test.tsx`), no
  change needed.

Done in the RFQ BUYER batch (`apps/web/src/features/rfqs/buyer`): SourcePickerModal=Recipe B,
SendRfqDialog=Recipe A, ManageVendorsDialog=Recipe B (scrollBody → per-element `relative`);
RfqDetailPage + RfqLineItemsTab SKIPPED (no raw inline Modal; EditLineItemModal already GridModal,
ConfirmDialog is a ui-components primitive). See [[figma-fidelity-workflow]].
