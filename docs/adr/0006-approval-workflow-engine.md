# ADR-0006: Approval workflow engine — staged, quorum-capable, no branching, closed action list

**Status:** Accepted
**Date:** 2026-05-12

## Context

US 1.06 and 5.10 require per-company configurable approvals. The design space is wide — from a single boolean toggle per action to a full BPMN engine — and the wrong point on that spectrum is a serious product hazard:

- Too simple → every customer demands custom dev, every "approval" feature ticket is a special case.
- Too rich → the configuration UI becomes a programming environment, customers misconfigure and lose data, the engine grows into its own product.

A second hazard: an *open* approvable-action set (anything can be made approvable) means every developer working on a new feature must wire it into the engine, the audit trail must handle arbitrary action types, and the config UI must auto-discover them. This is the road to "approvals as the de-facto framework," which is a tar pit.

## Decision

**Engine model.** For each Approvable action, the Company Admin configures:
- an **entry condition** — typically a threshold on the action's principal amount (PO value, invoice total, etc.). If the condition is unmet, the action proceeds without approval.
- an **ordered list of stages**. Each stage names a role and a quorum: `N of M users with role R must approve`. Stages execute sequentially; the next stage starts only when the previous reaches quorum. Any rejection in any stage rejects the whole action.
- **Out-of-Office delegation** (see below) is automatic, not per-request.

Out of scope for the engine:
- Mid-chain conditional branching (if X then approver A else approver B). If needed, configure two separate workflows on two separate entry conditions.
- Time-based escalation. Out-of-Office covers the realistic absence case; arbitrary "if no response in 24h, escalate" is deferred.
- Per-user-pick approvers ("send this to whoever I choose"). Role-based only.

**Approvable actions are a closed v1 list** (see CONTEXT.md). Anything not on the list is governed by RBAC alone. Adding a new approvable action is a code change, not a config change. This bounds the engine's surface area, keeps audit-log schemas knowable, and protects the config UI from becoming a programming environment.

**Out-of-Office delegation.** Each user can set an absence with a date range and a named delegate. While the absence is active, any approval routed to that user is silently re-routed to the delegate. No per-request prompts, no opt-in. If the delegate is also OOO, the chain continues to *their* delegate, up to a fixed depth of 3; beyond that, the request escalates to the Company Admin.

## Consequences

- The audit trail records every approval state transition with `(actor, original_target, effective_target, reason)`. `effective_target` differs from `original_target` when delegation fired — this is necessary for compliance.
- Quorum support means an action can be in "partially approved" state (e.g. 1 of 2 needed). The UI must show this clearly; the action remains pending until quorum is reached.
- Closed action list means: PR review must enforce that any new "approve this" feature ticket either (a) reuses one of the 10 listed actions, or (b) extends the list via this ADR + a CONTEXT.md update.
- Threshold conditions are the only entry-condition primitive in v1. Comparing values across entities (e.g. "PO > 50% of remaining project budget") is not supported.
- Approval lives independently of document state — a PO can be "drafted" while approval is "pending stage 2." Both must reach terminal states before the PO is active. This bicycle-with-two-wheels design is intentional to keep approval reusable across entities.

## Alternatives considered

- **Per-action boolean toggle + single approver pool.** Rejected: misses quorum and staged approval, both common in real contractor org charts.
- **Full BPMN / Camunda-style engine.** Rejected: 10× build cost, indefensible v1 surface area, configuration UI is unteachable.
- **Per-request approver picking.** Rejected: defeats the point of pre-configured workflows; reintroduces the "who do I send this to?" cognitive load the system is supposed to remove.
- **Open approvable-action set.** Rejected: tar pit. The cost is bounded by keeping the list closed.
- **Manual delegation per request.** Rejected: forgets to fire when officers are unexpectedly unreachable, which is the exact failure mode delegation should solve.

## Amendment — Release 1 scope (2026-05-19)

The full engine described above is **narrowed for Release 1** to reduce build cost while preserving the data model:

### What's in Release 1

- **Single-stage, single-role approval only.** For each approvable action, the Company Admin configures one stage naming one role. Quorum (`N of M`) is deferred to v2 — Release 1 effectively treats every stage as quorum 1-of-N (any user with the role can approve).
- **Closed approvable-action list (Release 1):**
  1. **PO above threshold** — POs whose total exceeds the Contractor's configured PO-approval threshold.
  2. **Invoice above threshold** — Invoices whose total exceeds the Contractor's configured Invoice-approval threshold.
  3. **Major Change Order on PO** — per US-15 classification rules.
  4. **Bulk Order amend** — price change or ceiling bump (does not retroactively change historical drawdowns).
- **Threshold configuration.** Company Admin sets PO and Invoice thresholds per Contractor. No platform default — every Contractor must set values during onboarding before any PO or Invoice can be created.
- **Out-of-Office:** date range + single delegate. If the delegate is also OOO, the request escalates directly to the Company Admin (no 3-deep chain in Release 1).

### What's deferred to v2

- Quorum support (`N of M users with role R must approve`).
- Multi-stage chains (stages execute sequentially).
- 3-deep OOO delegation chains.
- Threshold-based entry conditions on actions beyond the four listed above.
- Adding new approvable actions to the closed list.

### Consequences of the amendment

- The audit-log schema for approvals is built to the full ADR (records `actor`, `original_target`, `effective_target`, `reason`) so v2 can light up multi-stage / quorum without a migration. Release 1 simply never writes more than one stage row per action.
- The configuration UI ships with a "single approver role" picker per action — no stage builder, no quorum input. v2 expands this in place.
- Threshold comparison primitive is implemented but only used by the four listed actions. New approvable actions in v2 reuse the same primitive.
- The OOO chain is a code constant (`MAX_DELEGATION_DEPTH = 1` in Release 1, `= 3` in v2). No data migration required when raised.

The full closed-list engine remains the post-v1 target; the amendment is a build-cost cut, not a design pivot.
