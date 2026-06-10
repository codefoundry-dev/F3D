# FOR-232 — RFQ docs correction (prepared change)

**Date:** 2026-06-10
**Status:** PREPARED — not applied. The editable Mintlify source could not be located on this machine
(only the read-only `f3d.mintlify.app/mcp` mirror is reachable). Apply by hand in the docs source, or
hand this to whoever owns the Mintlify repo / web editor.
**Direction:** design + code = source of truth (per the 2026-06-10 reversal). Docs change to match the
app; **no app/code changes**.

**Target page:** `guides/procurement/request-for-quote` (published title: *"Send an RFQ and Compare
Vendor Quotes in Forethread"*).

**Ground truth used**
- Design status model: `reports/figma-status-annotations.md` (RFQ badge = Draft / Open / Closed /
  Cancelled; Archived = separate stored state; Awarded = dashboard preset; internal Sent/Active grouped
  under Open; optional Approval Status field for 1.06 / 5.10 workflows).
- Code enum: `packages/shared-types/src/enums` → `RfqStatus` = DRAFT, OPEN, AWAITING_RESPONSE, QUOTED,
  AWARDED, CLOSED, CANCELLED.
- App vocabulary (confirms naming + Awarded-as-preset): `packages/i18n/src/locales/en/rfqs.json` —
  list title **"RFQ Management"**, **"Create your first RFQ"**, quick filter **"Awarded RFQs"**
  (`awardedRfqs`). The app calls the feature **RFQ**, never "Quotes".

---

## Change 1 — "RFQ states" section (the core of this ticket)

**Current (wrong — old reverted vocabulary):**

| State | What it means |
|---|---|
| Unreviewed | RFQ has been created but not yet reviewed or sent |
| Quote Requested | RFQ has been sent to vendors and you are waiting for responses |
| Quote Received | At least one vendor has submitted pricing |
| Ordered | The RFQ has been converted to a purchase order |
| Cancelled | The RFQ is no longer needed and has been closed |

**Replace with (design lifecycle):**

> Your RFQ moves through the following states during its lifecycle:
>
> | State | What it means |
> |---|---|
> | Draft | The RFQ is being created and has not been sent to vendors yet. |
> | Open | The RFQ is active with vendors — it has been sent and you are collecting and reviewing quotes. (Internal system states *Sent* and *Active* are grouped under **Open**.) |
> | Closed | The RFQ has been resolved — typically because a winning quote was awarded and converted to a purchase order, or because it was closed without an order. |
> | Cancelled | The RFQ is no longer needed. |
>
> **Archived** is a separate stored state (used to keep concluded RFQs out of the active list), not a
> step in the lifecycle badge.
>
> **Awarded** is a dashboard preset / business label highlighting RFQs that produced a purchase order
> (e.g. the *Awarded RFQs* quick filter) — it is **not** a primary RFQ status.
>
> If your company has approval workflows enabled (1.06 / 5.10), an RFQ also carries a separate
> **Approval Status** — *Pending*, *Approved*, or *Rejected* — independent of the lifecycle states above.

---

## Change 2 — inline status reference in "Step 3: Send to vendors"

**Current:** "Send the RFQ — Click *Send to Vendors* … The RFQ status changes to **Quote Requested** as
soon as it is sent."

**Replace with:** "… The RFQ status changes to **Open** as soon as it is sent."

---

## Change 3 — feature naming (AC: "RFQ feature keeps its name, not 'Quotes'")

The app names the feature **RFQ / RFQs**, not "Quotes". Fix the feature-name references; **leave**
references to the *quotes vendors submit* (Quote Inbox, Compare Quotes, "vendor quotes", "winning quote")
as-is — those are correct.

- **Step 1 heading + body:** "Navigate to Quotes — From the main navigation, click **Quotes** to open
  your RFQ list." → "Navigate to RFQs — From the main navigation, click **RFQs** to open your RFQ list."
- **Step 1 CTA:** "Click **New Quote** — Click **+ New Quote** to start a new Request for Quote." →
  "Click **New RFQ** — Click **+ New RFQ** to start a new Request for Quote."
  *(App i18n uses "Create new" / "Create your first RFQ" — match whichever label the live button shows;
  the point is it is not "New Quote".)*

---

## Out of scope (do NOT change here)

- No app/code changes (AC). The earlier buyer-UI relabel was git-reverted on this branch.
- PO / invoice / commitment lifecycles — those are FOR-230 / FOR-231 / FOR-234.
- The quote-collection sub-features (Quote Inbox, Compare Quotes) keep their names.

## Acceptance criteria coverage

- [x] RFQ docs present Draft / Open / Closed / Cancelled as the status badge — Change 1
- [x] Awarded documented as a dashboard preset, not a lifecycle status — Change 1
- [x] Internal states (Sent / Active) noted as grouped under Open — Change 1
- [x] RFQ feature keeps its name (not "Quotes") — Change 3
- [x] No app/code changes — nothing in `apps/` or `packages/` touched
