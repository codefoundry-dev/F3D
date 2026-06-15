---
name: alert-component-no-prop-spread
description: ui-components Alert/Badge don't spread extra props (data-testid is dropped) — wrap in a div to attach a testid
metadata:
  type: feedback
---

The `Alert` component in `packages/ui-components/src/components/Alert.tsx` only accepts
`{ variant, icon, children, className }` and does NOT spread `...rest` onto its root div. So
`<Alert data-testid="x">` renders the alert text but silently DROPS the `data-testid`.

**Why:** cost ~30 min debugging a wizard test where the duplicate banner text rendered fine but
`findByTestId('...-banner')` timed out — the testid never made it to the DOM. Render diagnostics
showed the component state was correct; the prop was just being discarded by Alert.

**How to apply:** when you need a `data-testid` (or any non-listed prop) on an `Alert` — and likely
`Badge`, which has the same minimal prop surface — wrap it:
`<div data-testid="x"><Alert variant="destructive">…</Alert></div>`. Don't pass arbitrary props to
these shared display components and assume they forward. Confirmed against the catalogue upload
wizard (US 4.01 Phase 3).
