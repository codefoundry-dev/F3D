# Timeline: Procurement Platform — Release 1

**Generated**: 2026-03-02 **Last Updated**: 2026-03-02

## Project Metadata

| Parameter             | Value                               |
| --------------------- | ----------------------------------- |
| Start Date            | 2026-02-23                          |
| Hard Deadline         | 2026-07-13 (101 working days)       |
| Sprint Duration       | 2 weeks (10 working days)           |
| Team Size             | 1 engineer                          |
| Required Velocity     | 27 tasks/sprint/engineer            |
| Total Estimated Tasks | 374 (131 completed + 243 remaining) |
| Total Sprints         | 10 full + 1 buffer day              |
| Estimated Completion  | 2026-07-13                          |

### Velocity Note

The original timeline assumed 15 tasks/sprint/engineer (32 sprints, completion May 2027). This
compressed timeline requires 27 tasks/sprint (~80% increase) to deliver all 12 stories within 101
working days. The observed Sprint 1 velocity of 131 tasks in 5 working days supports the feasibility
of this pace, though later stories involve more complex business logic and velocity is expected to
normalise.

## User Story Timeline

| US   | Name                                        | Priority       | Tasks | Working Days | Planned Start | Planned End | Status      |
| ---- | ------------------------------------------- | -------------- | ----- | ------------ | ------------- | ----------- | ----------- |
| US1  | User Registration & Access Management       | P1             | 92/92 | 5 (actual)   | 2026-02-23    | 2026-03-06  | Completed   |
| US2  | Project Creation & Management               | P2             | 39/39 | 5 (actual)   | 2026-02-23    | 2026-03-06  | Completed   |
| US3  | RFQ Creation & Vendor Quote Collection      | P3             | 0/~39 | 15           | 2026-03-09    | 2026-03-27  | Not Started |
| US4  | Quote Review & Approval                     | P4             | 0/~21 | 8            | 2026-03-30    | 2026-04-08  | Not Started |
| US5  | Purchase Order Creation & Issuance          | P5             | 0/~21 | 8            | 2026-04-09    | 2026-04-20  | Not Started |
| US6  | Vendor & Supplier Management                | P6             | 0/~24 | 9            | 2026-04-21    | 2026-05-01  | Not Started |
| US7  | Material Catalogue Management               | P7             | 0/~24 | 9            | 2026-05-04    | 2026-05-14  | Not Started |
| US8  | Bulk Order Management                       | P8             | 0/~24 | 9            | 2026-05-15    | 2026-05-27  | Not Started |
| US9  | Invoice Reconciliation & Dispute Resolution | P9             | 0/~26 | 10           | 2026-05-28    | 2026-06-10  | Not Started |
| US10 | Dashboards & Document Views                 | P10            | 0/~32 | 12           | 2026-06-11    | 2026-06-26  | Not Started |
| US11 | Delivery Report Submission                  | P11 (Optional) | 0/~16 | 6            | 2026-06-29    | 2026-07-06  | Not Started |
| US12 | System Administration & Observability       | P12            | 0/~16 | 5            | 2026-07-07    | 2026-07-13  | Not Started |

### Allocation Method

Remaining stories (US3-US12) are proportionally distributed across 91 remaining working days based
on estimated task count. Each story receives `floor(tasks / 243 * 91)` working days, with residual
days allocated to the largest stories first. US1 and US2 consumed 10 working days (Sprint 1) but
completed all 131 tasks within the first 5 working days.

| Story     | Est. Tasks | Share of 243 | Raw Days | Allocated Days |
| --------- | ---------- | ------------ | -------- | -------------- |
| US3       | 39         | 16.0%        | 14.6     | 15             |
| US4       | 21         | 8.6%         | 7.9      | 8              |
| US5       | 21         | 8.6%         | 7.9      | 8              |
| US6       | 24         | 9.9%         | 9.0      | 9              |
| US7       | 24         | 9.9%         | 9.0      | 9              |
| US8       | 24         | 9.9%         | 9.0      | 9              |
| US9       | 26         | 10.7%        | 9.7      | 10             |
| US10      | 32         | 13.2%        | 12.0     | 12             |
| US11      | 16         | 6.6%         | 6.0      | 6              |
| US12      | 16         | 6.6%         | 6.0      | 5              |
| **Total** | **243**    | **100%**     |          | **91**         |

## Sprint-to-Story Mapping

| Sprint    | Dates           | Stories Active                          | Notes                          |
| --------- | --------------- | --------------------------------------- | ------------------------------ |
| Sprint 1  | Feb 23 - Mar 6  | US1, US2                                | Both completed (131/131 tasks) |
| Sprint 2  | Mar 9 - Mar 20  | US3                                     | RFQ backend + shared types     |
| Sprint 3  | Mar 23 - Apr 3  | US3 (ends Mar 27), US4 (starts Mar 30)  | Handoff mid-sprint             |
| Sprint 4  | Apr 6 - Apr 17  | US4 (ends Apr 8), US5 (starts Apr 9)    | Handoff mid-sprint             |
| Sprint 5  | Apr 20 - May 1  | US5 (ends Apr 20), US6 (starts Apr 21)  | Handoff at sprint start        |
| Sprint 6  | May 4 - May 15  | US7 (ends May 14), US8 (starts May 15)  | Tight transition               |
| Sprint 7  | May 18 - May 29 | US8 (ends May 27), US9 (starts May 28)  | Handoff late in sprint         |
| Sprint 8  | Jun 1 - Jun 12  | US9 (ends Jun 10), US10 (starts Jun 11) | Handoff late in sprint         |
| Sprint 9  | Jun 15 - Jun 26 | US10                                    | Dashboards across all roles    |
| Sprint 10 | Jun 29 - Jul 10 | US11 (ends Jul 6), US12 (starts Jul 7)  | Final sprint                   |
| Buffer    | Jul 13          | US12 (ends)                             | 1 buffer day for overrun       |

## Phase Breakdown

### US1 — User Registration & Access Management (COMPLETED)

| Phase                                                | Tasks (done/total) | Status    |
| ---------------------------------------------------- | ------------------ | --------- |
| Epic 1 (Monorepo + Backend + Auth + Super Admin App) | 92/92              | Completed |

All 92 tasks (T001-T092) completed. Includes monorepo setup, NestJS backend core, Prisma schema,
auth module, user management, company management, super-admin-app scaffold, and full auth UI.

### US2 — Project Creation & Management (COMPLETED)

| Phase                                          | Tasks (done/total) | Status    |
| ---------------------------------------------- | ------------------ | --------- |
| Phase 1: Shared Types & API Client             | 5/5 (T093-T097)    | Completed |
| Phase 2: Backend — Prisma Schema & Migration   | 6/6 (T098-T103)    | Completed |
| Phase 3: Backend — Projects Module             | 5/5 (T104-T108)    | Completed |
| Phase 4: Frontend — company-admin-app Scaffold | 13/13 (T109-T121)  | Completed |
| Phase 5: Frontend — Projects Feature           | 6/6 (T122-T127)    | Completed |
| Phase 6: Polish & Cross-Cutting                | 4/4 (T128-T131)    | Completed |

All 39 tasks (T093-T131) completed.

### US3 — RFQ Creation & Vendor Quote Collection (15 working days)

_Tasks not yet generated. Estimated: ~39 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 3 Figma screens, ~5 entities (RFQ, RFQLineItem, RFQVendor,
Quote, QuoteLineItem). Entity-driven estimate (30) with 1.3x buffer = 39.

Compressed velocity required: 39 tasks / 15 days = 2.6 tasks/day (vs. original plan of 1.5
tasks/day).

### US4 — Quote Review & Approval (8 working days)

_Tasks not yet generated. Estimated: ~21 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 1 Figma screen, ~2 entities (Quote review, approval
workflow). Scenario-driven estimate (16) with 1.3x buffer = 21.

Compressed velocity required: 21 tasks / 8 days = 2.6 tasks/day.

### US5 — Purchase Order Creation & Issuance (8 working days)

_Tasks not yet generated. Estimated: ~21 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 3 Figma screens, ~2 entities (PurchaseOrder, POLineItem).
Scenario-driven estimate (16) with 1.3x buffer = 21.

Compressed velocity required: 21 tasks / 8 days = 2.6 tasks/day.

### US6 — Vendor & Supplier Management (9 working days)

_Tasks not yet generated. Estimated: ~24 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 4 Figma screens, ~3 entities (ContractorVendor, SalesRep,
Message). Entity-driven estimate (18) with 1.3x buffer = 24.

Compressed velocity required: 24 tasks / 9 days = 2.7 tasks/day.

### US7 — Material Catalogue Management (9 working days)

_Tasks not yet generated. Estimated: ~24 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 1 Figma screen, ~3 entities (Material, BOM, BOMLineItem).
Entity-driven estimate (18) with 1.3x buffer = 24.

Compressed velocity required: 24 tasks / 9 days = 2.7 tasks/day.

### US8 — Bulk Order Management (9 working days)

_Tasks not yet generated. Estimated: ~24 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 2 Figma screens, ~3 entities (BulkOrder,
BulkOrderLineItem, BulkDrawdown). Entity-driven estimate (18) with 1.3x buffer = 24.

Compressed velocity required: 24 tasks / 9 days = 2.7 tasks/day.

### US9 — Invoice Reconciliation & Dispute Resolution (10 working days)

_Tasks not yet generated. Estimated: ~26 tasks based on spec complexity._

Estimation basis: 5 acceptance scenarios, 1 Figma screen, ~3 entities (Invoice, InvoiceLineItem,
InvoicePO). Scenario-driven estimate (20) with 1.3x buffer = 26.

Compressed velocity required: 26 tasks / 10 days = 2.6 tasks/day.

### US10 — Dashboards & Document Views (12 working days)

_Tasks not yet generated. Estimated: ~32 tasks based on spec complexity._

Estimation basis: 4 acceptance scenarios, 8 Figma screens, no new entities (view layer only).
Figma-driven estimate (24) with 1.3x buffer = 32.

Compressed velocity required: 32 tasks / 12 days = 2.7 tasks/day.

### US11 — Delivery Report Submission (6 working days)

_Tasks not yet generated. Estimated: ~16 tasks based on spec complexity._

Estimation basis: 3 acceptance scenarios, 0 Figma screens, ~2 entities (DeliveryReport,
DeliveryReportLineItem). Scenario/entity-driven estimate (12) with 1.3x buffer = 16.

Compressed velocity required: 16 tasks / 6 days = 2.7 tasks/day.

### US12 — System Administration & Observability (5 working days)

_Tasks not yet generated. Estimated: ~16 tasks based on spec complexity._

Estimation basis: 3 acceptance scenarios, 1 Figma screen, ~2 entities (AuditLog views, job
monitoring). Scenario/entity-driven estimate (12) with 1.3x buffer = 16.

Compressed velocity required: 16 tasks / 5 days = 3.2 tasks/day. This is the tightest allocation in
the plan.

## Dependencies

```text
US1 (Auth) --> US2 (Projects) --> US3 (RFQ) --> US4 (Quotes) --> US5 (PO) --> US9 (Invoices)
                                                                 |
                                                                 +--> US8 (Bulk)
                                                  US5 (PO) --> US11 (Delivery)
US1 --> US6 (Vendors)    [parallel track]
US1 --> US7 (Materials)  [parallel track]
US1 --> US12 (Admin)     [parallel track]
US3 + US4 + US5 --> US10 (Dashboards)
```

### Critical Path (Compressed)

```text
US1+US2 (done) --> US3 (15d) --> US4 (8d) --> US5 (8d) --> US9 (10d) --> US10 (12d)
                                                                         = 53 working days on critical path
```

The critical path through US3 -> US4 -> US5 -> US9 -> US10 requires 53 working days. Since 91 days
are available for remaining stories, the off-critical-path stories (US6, US7, US8, US11, US12)
consume the other 38 days sequentially. With a single engineer, all stories are sequential
regardless of dependency structure.

### Ordering Rationale

Stories are ordered by priority (P3-P12) which also respects the dependency chain:

- US3 -> US4 -> US5 (core procurement flow, sequential dependency)
- US6, US7 (independent after US1, scheduled by priority between US5 and US8)
- US8 (depends on US4, scheduled after US7 by priority)
- US9 (depends on US5, scheduled after US8 by priority)
- US10 (depends on US3+US4+US5, all complete by the time it starts)
- US11 (depends on US5, complete by the time it starts)
- US12 (independent after US1, lowest priority, final slot)

## Milestones

| Milestone                    | Target Date | Stories  | Status                                |
| ---------------------------- | ----------- | -------- | ------------------------------------- |
| Auth & Access Ready          | 2026-03-06  | US1      | Completed                             |
| Core Project Management      | 2026-03-06  | US1, US2 | Completed                             |
| Core Procurement Flow        | 2026-04-20  | US1-US5  | Not Started (target: end of Sprint 5) |
| Vendor & Material Foundation | 2026-05-14  | US1-US7  | Not Started (target: end of Sprint 6) |
| Full Procurement Cycle       | 2026-06-10  | US1-US9  | Not Started (target: end of Sprint 8) |
| Platform with Dashboards     | 2026-06-26  | US1-US10 | Not Started (target: end of Sprint 9) |
| Complete Release 1           | 2026-07-13  | US1-US12 | Not Started (hard deadline)           |

## Current Sprint

**Sprint 1** (2026-02-23 to 2026-03-06) — IN PROGRESS

- Active stories: US1, US2 (both already completed)
- Status: Both US1 (92 tasks) and US2 (39 tasks) were completed within Sprint 1, totalling 131/374
  tasks (35% of scope).
- Remaining Sprint 1 days (Mar 2-6) can be used to generate tasks for US3 and begin implementation
  early.
- Next planned story: US3 (RFQ Creation) starts formally on Mar 9 (Sprint 2).

### Schedule Health

**ON TRACK (COMPRESSED)** — The compressed 101-day timeline is achievable based on observed Sprint 1
velocity, but carries elevated risk compared to the original 32-sprint plan.

**Comparison to original timeline:**

| Metric            | Original Plan    | Compressed Plan  | Compression        |
| ----------------- | ---------------- | ---------------- | ------------------ |
| Total duration    | 320 working days | 101 working days | 3.2x shorter       |
| Sprints           | 32               | 10 + buffer      | 3.1x fewer         |
| Required velocity | 15 tasks/sprint  | 27 tasks/sprint  | 1.8x higher        |
| Daily rate        | 1.5 tasks/day    | 2.7 tasks/day    | 1.8x higher        |
| Completion date   | 2027-05-14       | 2026-07-13       | ~10 months earlier |

## Risk Assessment (Compressed Schedule)

### HIGH RISK

1. **No margin for estimation error.** Stories US3-US12 have no generated tasks. Actual task counts
   may exceed estimates. A single story coming in 50% over estimate would cascade delays across all
   subsequent stories and breach the Jul 13 deadline.

2. **US12 allocation is dangerously tight.** 16 estimated tasks in 5 working days (3.2 tasks/day) is
   the highest daily rate in the plan. System administration and observability features (health
   dashboards, job retry, alert configuration) involve cross-cutting integration that may resist
   compression.

3. **No time for testing debt.** The Constitution mandates 90% code coverage (Principle V). The
   current test debt from Epic 1 is carried forward. The compressed timeline leaves no buffer for
   writing tests, which means either the quality target is unmet or the schedule slips.

### MEDIUM RISK

4. **Velocity normalisation.** Sprint 1's 131-task velocity was inflated by boilerplate/scaffold
   tasks (Prisma schemas, config files, app scaffolding). Business-logic-heavy stories like US9
   (invoice reconciliation with OCR matching) and US8 (bulk order drawdown workflows) may resist the
   required 2.7 tasks/day pace.

5. **Mid-sprint story handoffs.** In the compressed plan, most sprints contain the end of one story
   and the start of another. Context switching mid-sprint reduces effective velocity. The original
   plan had clean sprint boundaries per story.

6. **US11 (Delivery) is optional.** If the schedule slips, US11 is the primary candidate for
   deferral. Removing it frees 6 working days as a buffer, extending the deadline for US12 to Jul 13
   with more breathing room.

### LOW RISK

7. **US6 and US7 reuse established patterns.** Both vendor management and material catalogue follow
   the same NestJS module + React feature pattern established in US1 and US2. The learning curve
   benefit should help maintain velocity for these stories.

8. **US10 (Dashboards) is view-layer only.** No new backend entities. Primarily frontend table
   components, filters, and data fetching. Likely to hit the 2.7 tasks/day target.

### Mitigation Recommendations

- **Generate tasks for US3 immediately** (during remaining Sprint 1 days, Mar 2-6) to validate the
  ~39 task estimate before the Sprint 2 start.
- **Track daily velocity from Sprint 2 onward.** If daily completion falls below 2.5 tasks/day for
  3+ consecutive days, trigger a scope review.
- **Identify US11 as the deferral candidate.** If the team reaches Sprint 8 (Jun 1) with any story
  behind schedule, defer US11 to reclaim 6 working days of buffer.
- **Front-load complex stories.** US3 and US4 (RFQ + quote review) are the most uncertain. Hitting
  their targets confirms the feasibility of the rest of the plan.
- **Consider testing strategy.** Plan a dedicated testing sprint post-Jul 13, or integrate minimal
  happy-path tests per story within the allocated days. The Constitution's 90% coverage target is
  unlikely to be met within 101 days without a parallel testing effort.

## Sprint Calendar Reference

| Sprint    | Start      | End        | Working Days |
| --------- | ---------- | ---------- | ------------ |
| Sprint 1  | 2026-02-23 | 2026-03-06 | 10           |
| Sprint 2  | 2026-03-09 | 2026-03-20 | 10           |
| Sprint 3  | 2026-03-23 | 2026-04-03 | 10           |
| Sprint 4  | 2026-04-06 | 2026-04-17 | 10           |
| Sprint 5  | 2026-04-20 | 2026-05-01 | 10           |
| Sprint 6  | 2026-05-04 | 2026-05-15 | 10           |
| Sprint 7  | 2026-05-18 | 2026-05-29 | 10           |
| Sprint 8  | 2026-06-01 | 2026-06-12 | 10           |
| Sprint 9  | 2026-06-15 | 2026-06-26 | 10           |
| Sprint 10 | 2026-06-29 | 2026-07-10 | 10           |
| Buffer    | 2026-07-13 | 2026-07-13 | 1            |
| **Total** |            |            | **101**      |

## Notes

(This section is preserved across re-runs. Add manual annotations here.)

- 2026-03-02: Timeline compressed from 32 sprints (320 working days, May 2027) to 101 working days
  (Jul 13, 2026) per project constraint. Required velocity increased from 15 to 27 tasks/sprint.
  US11 (Delivery, optional) identified as primary deferral candidate if schedule slips.
