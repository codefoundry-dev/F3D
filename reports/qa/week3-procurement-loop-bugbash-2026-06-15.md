# Week-3 Procurement Loop — Bug Bash

**Date:** 2026-06-15 · **Branch:** `feat/week3-po-approvals-states-audit` · **Scope:** the Release-1
procurement loop, with emphasis on the freshly-built Material Request leg (Foreman raise → officer
review US 2.08 → approve/decline → convert → RFQ/PO → approve → receive).

This pass targets the **integration seams** the unit suites mock away — especially the MR → RFQ/PO
conversion, the newest and least-integrated part of the loop. Inventory (plan item 4) was
**descoped** before this pass (PRD §4.7 defers the whole Inventory epic to v2; confirmed with the
user), so the loop under test ends at PO receipt.

## Method & results

| #   | Check                                                                                   | Result                                                                                                       |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **Backend unit suite** (`pnpm --filter @forethread/backend test`) — regression baseline | ✅ 2008 passed / 1 skipped                                                                                   |
| 2   | **Web unit suite** (`pnpm --filter @forethread/web test`) — regression baseline         | ✅ 1964 passed / 1964                                                                                        |
| 3   | **MR-loop e2e** (new — `material-requests.e2e-spec.ts`, real DB)                        | ✅ 8 passed / 8                                                                                              |
| 4   | **PO + RFQ e2e** (`(purchase-orders\|rfq-)` specs, real DB)                             | ⚠️ 28 passed / 4 failed (2 suites) — **all 4 pre-existing on `main`, not Week-3 regressions** (proven below) |
| 5   | **US 2.08 UI** — typecheck + lint + visual vs Figma `5894:131661`                       | ✅ clean; shots in `.tmp/figma-mr/shots/`                                                                    |

### MR-loop e2e (new coverage — `cdc761b`)

Exercises the full lifecycle against the real persistence layer:

- Officer raises + submits an MR → it surfaces in the admin **"Requests awaiting approval"** queue,
  and the detail loads for the reviewer.
- Approve → **convert to draft RFQ**: free-text line items are copied, the RFQ persists as `DRAFT`
  on the right project, and the MR flips to `CONVERTED` with a back-link.
- Approve → **convert to draft PO**: persists as `DRAFT`, `sourceOfCreation = MATERIAL_REQUEST`,
  line prices default to 0 (filled in at PO edit), MR → `CONVERTED`.
- **Decline** with a reason → `DECLINED`, reason stored, reviewer recorded.
- **Audit trail** records `CREATED → SUBMITTED → APPROVED → CONVERTED` in order, with the convert
  metadata target + performer.
- **Guards:** convert-before-approve → 400; decline-without-reason → 400; a Financial Officer
  (list/read only) can read the queue but cannot create or approve (403).

No bugs found in the conversion seams.

## Findings

**No new defects introduced by US 2.08 / the MR loop.** The MR leg is green end-to-end. The other
findings are all pre-existing e2e test debt (the e2e config is not part of the gating `test` CI run,
so stale specs linger):

1. **`rfq-quote-award.e2e-spec.ts` — award PO `DRAFT` vs `SENT` (pre-existing on `main`; ⚠️ possible
   real product bug).** The spec (line 219) expects the award-created PO to be `DRAFT`, but
   `awardQuote` creates the draft then immediately calls `poStatusService.issuePurchaseOrder` →
   `SENT` (po-status.service.ts:85). Proven pre-existing: on `main` (`39bf50a`) the
   `issuePurchaseOrder` call (rfqs.service.ts:1191) and the `toBe('DRAFT')` assertion both already
   exist — i.e. red before Week-3. **The catch:** `awardQuote`'s own doc-comment says it should
   leave a _reviewable_ draft "so the contractor can review and issue it," yet the code auto-issues
   (auto-sends to the vendor). Code-vs-intent contradiction — the test may be asserting the
   _correct_ intent and the auto-send may be the bug. **Recommend the RFQ/PO owner confirm intent**:
   if auto-issue-on-award is intended, update the spec to `SENT`; if not, drop the
   `issuePurchaseOrder` call so award leaves a draft. **Update — RESOLVED (`598a712`):** confirmed a
   bug; removed the auto-send so award now leaves a `DRAFT` the contractor issues manually. The
   award e2e (asserting `DRAFT`) now passes; backend suite green, coverage 90.23% branch.
2. **`purchase-orders-threshold.e2e-spec.ts` — `PUT` vs `PATCH` (pre-existing, stale verb).** The
   spec calls `PUT /v1/purchase-orders/:id/approve`; the route is `@Patch(':id/approve')` — and was
   already `PATCH` on `main` (unchanged by Week-3). The mismatched verb fails before the threshold
   logic is even exercised. Trivial spec fix (`put` → `patch`), then re-verify the threshold/approve
   assertions.
3. **`auth.e2e-spec.ts` — 4 red (pre-existing, not procurement).** The refresh-token-rotation bug
   the spec itself documents
   (`// BUG: refresh token rotation breaks clients … the API does NOT return the new refresh token`).
   Unrelated to Week-3. Recommend filing/fixing separately.
4. **Low-severity robustness:** `MaterialRequestsService.convertToPo` uses `dto.vendorId` directly
   without verifying the vendor is assigned to the contractor — only the DB FK guarantees the
   company exists. The UI constrains the picker to `getCompanyVendors`, so this isn't reachable from
   the product, but a stray/cross-company `vendorId` would still create a PO addressed to it.
   Consider validating the assignment server-side.
5. **US 2.08 deferred columns/filters (need backend support), already noted at the call sites:**
   - "Request type" (Project/Warehouse) — no backend field (Epic-7 warehouse concept).
   - List-level "Delivery location" — only on `MrDetail`, not `MrListItem`.
   - MR **Export** — no `exportMaterialRequests` endpoint; the button is a disabled placeholder.
   - "Recently updated" quick filter uses a `createdAt` proxy (`MrListItem` exposes no `updatedAt`).

## Recommended follow-ups

- ~~**Confirm award-on-issue intent (finding 1)**~~ — DONE: confirmed a bug and fixed in `598a712`
  (award leaves a reviewable `DRAFT`; no auto-send to the vendor).
- **Refresh the stale e2e verbs/assertions** (findings 1–2): `purchase-orders-threshold`
  `PUT`→`PATCH`; award `DRAFT`/`SENT`. Consider adding the e2e suite to CI so this debt can't
  accumulate silently.
- **Fix the auth refresh-token rotation bug** (finding 3).
- **Browser e2e for the US 2.08 officer flow** (list filter → open → approve/convert → land on the
  new RFQ/PO) against the running stack — not added here because it needs backend :3000 + web
  :5179 + mailhog up; the UI glue is covered by the component unit tests + visual shots, and the
  integration is covered by the new backend e2e.
- The four US 2.08 backend gaps (finding 5) when their epics land.

## Verdict

The **Material Request leg + US 2.08 are green and integrated end-to-end** (MR → approve/decline →
RFQ/PO conversion), validated by 8 new real-DB e2e tests; both regression baselines hold (backend
2008, web 1964). The 4 PO/RFQ e2e failures are **pre-existing test debt on `main`, not Week-3
regressions** — none block US 2.08. One of them (finding 1, award auto-issue) was a real product bug
and has since been **fixed** (`598a712`); the rest remain pre-existing test debt to triage.
