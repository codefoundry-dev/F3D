# ADR-0004: Three-way match — continuous, tolerance-based, asymmetric on over-delivery

**Status:** Accepted
**Date:** 2026-05-12

## Context

Three-way match is the central reconciliation logic for the platform: every PO line is tracked across Ordered → Delivered → Invoiced. The policy choice has product-shaping consequences:

- Too strict → every minor variance opens a dispute, Finance officers drown in noise, vendors disengage.
- Too loose → over-billing slips through, the platform's value-prop ("catch invoice errors before payment") collapses.
- Triggered only at closing → loses the "drift alarm" property that makes the dashboards useful.

The user-requirement summary specifies that match exists and is line-level, but says nothing about tolerances, OCR thresholds, or what triggers a run.

## Decision

**Continuous match.** Every change to PO, delivery report, or invoice triggers a re-run for affected lines. Dashboards and invoice-detail screens always show the current state; there is no "freeze and compare" event.

**Tolerance-based, Contractor-configurable, symmetric for price, asymmetric for quantity:**

- **Quantity:**
  - Under-delivery within tolerance (default ±2%): auto-match.
  - Exact match: auto-match.
  - Over-delivery in any amount: **never** auto-match. Always requires Finance Officer approval.
- **Unit price:** symmetric tolerance (default ±2%). Within tolerance: auto-match. Outside: flag for review.
- **Item identity:** OCR'd invoice/delivery line resolves to a catalogue item via confidence score; default threshold 0.85. Below threshold: manual review by a human, who picks the correct item.

Tolerances and the OCR threshold are configurable per Contractor (Company Admin). Per-vendor or per-category granularity is explicitly out of scope for v1.

**Line-level acceptance.** Finance Officer accepts or rejects each invoice line independently. A rejection automatically opens a Dispute thread on that line. Document-level "Approve invoice" is enabled only when all lines are clean (matched or explicitly accepted).

## Consequences

- The "Ordered / Delivered / Invoiced" display becomes a permanent feature of the PO and Invoice screens — not a wizard step.
- Over-delivery requiring explicit approval is the only asymmetry in the policy. This catches the common scam pattern (vendor over-ships, then bills for the extra) without manual reconciliation. It also catches the legitimate "vendor sent a bonus 5 bags" case — finance can approve it explicitly, which then *changes the Ordered side* (PO qty bumped) so subsequent matches stay clean.
- Dispute resolution requires bilateral approval of any proposed change — neither party can unilaterally edit committed values. This is the same pattern as commercial change requests on POs (US 5.12).
- The OCR confidence threshold needs telemetry from day one — too high produces manual-review burnout, too low produces wrong matches. Plan for an admin dashboard showing match quality metrics.
- "Over-delivery requires approval" must be enforced server-side; the UI can pre-fill an approval prompt but cannot bypass the rule.

## Alternatives considered

- **Exact match, no tolerance.** Rejected: dispute fatigue from rounding and miscounts.
- **Per-vendor tolerance.** Rejected for v1: real flexibility without a clear product win. Add later if a real customer asks.
- **Closing-event match (run only when PO closes).** Rejected: kills the "drift alarm" dashboards and delays detection of over-billing until payment is imminent.
- **Symmetric quantity tolerance (over- and under- treated the same).** Rejected: makes over-delivery economically silent, which is exactly the failure mode the platform should prevent.
