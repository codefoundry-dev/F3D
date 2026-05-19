# ADR-0007: Stock-and-Bulk Check fires at Procurement-Officer open, blocks by default, executes atomically

**Status:** Accepted
**Date:** 2026-05-12

## Context

The platform's core efficiency claim is "you never re-buy what you already have or have already negotiated." The Stock-and-Bulk Check is the mechanism. It sits between a Material Request and an RFQ, surfacing existing inventory and active Bulk Orders as alternatives to going out for a new quote.

Three design choices materially shape this feature:

1. **When does the check run?** On Foreman submission (mobile), on Procurement Officer open, or at the moment of RFQ creation? Each placement has UX consequences — Foreman-side runs in the field (frequently offline, no procurement context), Officer-side runs online with full context.
2. **Is the recommendation binding?** If the system finds enough stock, can a Procurement Officer override and RFQ anyway? Some Contractors have accounting-driven reasons to keep stock separate.
3. **Is execution one transaction or many manual steps?** Once the Officer picks a plan, the steps (release request, drawdown PO, residual RFQ) can be artefacts they manually create one-by-one, or a single atomic execution.

## Decision

**Fires on Procurement Officer open of the MR.** The check is computed server-side when the Officer first views the MR in their queue, and re-computed on demand if inventory or bulk state changes. The Foreman never sees stock data.

**Blocking by default; Contractor-configurable to advisory.** When stock + bulk fully covers the MR, the "issue full RFQ" affordance is disabled. Only "partial RFQ for uncovered remainder" is offered. The Company Admin can flip the Contractor to advisory mode, which preserves the suggestion but adds an explicit "ignore and RFQ anyway" button.

**Atomic one-click execution.** Once the Officer accepts a plan (any mix of release requests, drawdowns, and residual RFQ), the system creates all resulting artefacts in a single transaction. If any artefact fails to create, all are rolled back. The Officer never has to chase several half-created records.

## Consequences

- The Foreman's mobile MR flow stays simple and offline-tolerant — no inventory lookup at submission time. The trade-off: the Foreman doesn't get instant feedback that "we already have these on site." We accept that loss because it's the Procurement Officer's job to make that call.
- "Atomic" execution requires a real DB transaction across multiple aggregates (warehouse release, PO, RFQ). The persistence layer must support this — eventual-consistency designs (sagas across services) are explicitly disallowed for this path. The persistence ADR will need to honour this constraint.
- The "blocking" default needs a clear UX: it is not enough to grey out a button — the Officer needs to understand *why* it's disabled, what plan the system proposed, and what the override path is. Spec the empty-state and the disabled-state explicitly.
- Re-computation on inventory/bulk change introduces a race: Officer opens MR at T₀, plan computed; another release at T₁ depletes the warehouse; Officer clicks "execute" at T₂. The system must re-check at T₂ and either re-confirm with the Officer (if the plan changed materially) or proceed (if not). Spec this in the user story.
- Bulk Order project restriction must be checked at execution, not just at plan time, because Bulk Orders can be amended between open and execute.

## Alternatives considered

- **Foreman-side check at submission (A1).** Rejected: requires online inventory at the moment of submission, breaks offline UX, and pushes a procurement decision onto the field.
- **Officer-side check only at "Start RFQ" click (A3).** Rejected: the Officer wastes time building an RFQ that the system later refuses to issue. Showing the plan on open is a much shorter feedback loop.
- **Always advisory, never blocking (B1).** Rejected: defeats the value-prop. The platform should make the right behaviour the default.
- **Always blocking, no override config (B2).** Rejected: real Contractors have project-segregation rules. An escape hatch is necessary.
- **Manual multi-step execution.** Rejected: every additional click is a place to drop the ball. The whole point is replacing manual coordination.
