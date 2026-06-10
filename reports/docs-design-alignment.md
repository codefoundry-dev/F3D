# Forethread — RFQ Designs vs. Docs Alignment (UI → docs)

**Date:** 2026-06-09
**Direction:** **Mintlify docs are the source of truth.** Any UI/design discrepancy is adapted to fit the docs (user directive, 2026-06-09).
**Figma file:** `Forethread (2)` — key `5JPNv2UQntVkDbXAsuvp3j`
**Nodes audited:**
- `6329:162123` — "US 2.06 RFQ dashboard" (RFQ list, filters, grouping, detail)
- `5711:104441` — "5.06 Review quotes (PO + CA)" (compare/review vendor responses)

**Docs source:** `guides/procurement/request-for-quote.mdx` (+ `creating-purchase-orders.mdx`) via the f3d Mintlify MCP.
**Method:** High-res screenshots of the RFQ list + status-grouped views; recovered text-layer copy from `get_metadata` for the rest. The Review-quotes screen is **not pixel-verified** (Figma View-seat rate limit).

Legend: ✅ aligns · ⚠️ exists but diverges · ❌ missing vs docs

---

## 0. Important context — the designs track the *code*, not the docs

The Figma status vocabulary (`Draft / Open / Awaiting Responses / Awarded / Closed`) is exactly the
implemented `RfqStatus` enum (`DRAFT, OPEN, AWAITING_RESPONSE, QUOTED, AWARDED, CLOSED, CANCELLED`)
documented in `reports/docs-implementation-gaps.md` §3.2. So the designs are consistent with the
shipped product but **diverge from the docs**.

Because docs are now the source of truth, the cleanest implementation is a **presentation-layer label
map** (enum → doc label) so the underlying enums/data don't have to churn:

| Code enum | Doc label to display |
|---|---|
| `DRAFT` | Unreviewed |
| `OPEN` / `AWAITING_RESPONSE` | Quote Requested |
| `QUOTED` | Quote Received |
| `AWARDED` | Ordered |
| `CANCELLED` / `CLOSED` | Cancelled |

> Ripple to flag: this makes the **UI** match the docs but leaves the **code enums** on the old
> vocabulary. If full consistency is wanted, either (a) keep enums + label map (recommended, low risk),
> or (b) rename enums too (schema migration + data backfill — higher risk).

---

## 1. Flow A — RFQ dashboard (`6329:162123`)

Screens: RFQ Management list (`6329:163251`), status-grouped (`6799:230284`), RFQ detail
(`6329:163605`, not pixel-verified). Grouping variants: `6799:226201/232355` (by project),
`6799:230284` (by status).

### 1.1 RFQ status labels — REPLACE ⚠️ (highest priority)

| Docs (target) | Figma now | Where it appears |
|---|---|---|
| **Unreviewed** | `Draft` | row status chip (all rows) |
| **Quote Requested** | `Open RFQs` / `Awaiting Responses` | quick filters |
| **Quote Received** | *(no chip; `No Quotes` filter is its inverse)* | quick filter |
| **Ordered** | `Awarded RFQs` | quick filter |
| **Cancelled** | `Closed RFQs` / `cancelled` | quick filter + grouped view |

Action: relabel every status chip and the quick-filter set to the five doc states. The design's
filters slice differently from the docs' states (e.g. `No Quotes` = a *Quote Requested* RFQ with zero
responses). Recommended quick filters mapped to doc states: **All · Unreviewed · Quote Requested ·
Quote Received · Ordered · Cancelled** (keep "My RFQs" as a personal filter).

### 1.2 Navigation / title / CTA ⚠️

| Docs | Figma now | Action |
|---|---|---|
| Nav entry **"Quotes"** | "RFQ Management" *and* "RFQs - Request For Quotes" | pick one, align to "Quotes" |
| Primary CTA **"+ New Quote"** | "+ Create new" *and* "Create RFQ" | use "+ New Quote" everywhere |
| Items called "RFQ" | "RFQ" | ✅ keep |

### 1.3 Internal inconsistencies to resolve (regardless of docs)
- Two different page titles across screens ("RFQ Management" vs "RFQs - Request For Quotes").
- Two different create-button labels ("Create new" vs "Create RFQ").

### 1.4 Columns
List columns (RFQ ID, Project Name, Project ID, RFQ Status, Res. Deadline, Pick-up, Delivery
Location, Pick-Up Location, …) are fine; only the **RFQ Status** values must use the doc labels (§1.1).

---

## 2. Flow B — Review quotes (`5711:104441`)

> Recovered layer text only; not pixel-verified (rate limit). Screens:
> `5711:104443` (review responses), `5765:136136` (…- approved), `5765:135019/135125`
> ("Review quotes - table full").

Recovered structure: tabs **Details · Line Items · Responses · Documents** (+ Message); response
sub-filters **All · Approved · Declined**; line-row variants **Header / Line / Substitution /
Best price**; **Total with Taxes**, **Shipment & Handling**, **Discount**; priority High/Medium/Low.

| Docs (Steps 5–6) | Figma now | Verdict |
|---|---|---|
| "Compare Quotes" → side-by-side table | "Responses" tab + "Review quotes - table full" | ✅ structure aligns; surface the label **"Compare Quotes"** |
| "highlights the lowest price per line item" | **Best price** highlight variant | ✅ aligns |
| "Select the winning vendor" | quote states **Approved / Declined** | ⚠️ reconcile language to "select winning vendor" |
| "Convert to Purchase Order" | section "Purchase order creation and approval" present | ⚠️ verify the button reads **"Convert to Purchase Order"** |
| RFQ becomes **Ordered** after convert | RFQ status "Awarded" | ⚠️ relabel to **Ordered** (§1.1) |
| "Send Order" (PO step) | not confirmed | ⚠️ verify present |

---

## 3. Gaps — documented RFQ steps not seen in these two nodes ❌/❓

These appear in `request-for-quote.mdx` but were **not present** in the two audited frames. Confirm
whether they exist elsewhere in the RFQ section before treating as missing:

- **Quote Inbox + AI extraction** — docs "Automatic extraction": PDF lands in Quote Inbox → AI
  extracts → matched to RFQ lines → review & confirm.
- **Quote deadline** — docs Step 3 "Set a quote deadline".
- **"Send to Vendors"** action + the resulting **Quote Requested** state — docs Step 3.

---

## 4. Coverage & caveats

- **Only 2 Figma nodes audited** (the two links provided). Other RFQ sub-flows (inbox, send, create)
  not yet reviewed.
- **Figma seat is View-tier** → read-only (screenshots/metadata/design-context OK; **cannot edit
  Figma**) and a low MCP tool-call rate limit (hit after ~6 calls this session).
- **Review-quotes screen (Flow B) is not pixel-verified** — based on recovered layer text + a low-res
  overview. Re-capture at high res when the rate limit resets to confirm button labels.

---

## 5. Suggested next actions

1. Re-capture Flow B at high res (rate-limit reset) and sweep the rest of the RFQ section for the §3
   gaps.
2. Apply §0 label map + §1.1/§1.2 relabels — in Figma (designer, since this seat can't edit) and/or in
   the live `apps/web` frontend display layer.
3. Repeat this docs-alignment pass for the PO, Invoice, and Commitments/Bulk-Order designs (their docs
   diverge even more — see `docs-implementation-gaps.md` §3, §6).

---

## 6. Implementation log — `apps/web` (2026-06-09)

Applied as a presentation-layer relabel; underlying `RfqStatus` enum/data unchanged. All buyer RFQ
surfaces (list, detail panel, detail tabs, dashboard widgets) pick these up automatically because they
render `t('status.<ENUM>')` from `packages/i18n/src/locales/en/rfqs.json`.

**Done (buyer-scoped, verified — typecheck + 396 RFQ tests + eslint + prettier all pass):**
- `status.DRAFT` Draft → **Unreviewed**
- `status.OPEN` Open → **Quote Requested**
- `status.AWAITING_RESPONSE` Awaiting Response → **Quote Requested**
- `status.QUOTED` Quoted → **Quote Received**
- `status.AWARDED` Awarded → **Ordered**
- `quickFilters.awardedRfqs` Awarded RFQs → **Ordered**
- Create button → **New Quote** (new buyer-only key `list.newQuote`; buyer `RfqListPage.tsx`)
- Group-by-status headers now render the translated status label instead of the raw enum
  (`AWARDED` → `Ordered`) — `RfqListPage.tsx` `GroupSection`

**Done (second pass — typecheck + 421 tests + eslint + prettier all green):**
- `status.CLOSED` → **"Cancelled"** for the buyer only, via a dependency-free `buyerRfqStatusKey`
  helper (`buyer/status-label.ts`) applied at the 3 buyer status render sites. The vendor view keeps
  its own "Closed" label (`VendorRfqStatus.CLOSED` untouched). Badge colour stays keyed to the real
  status; only the label follows the docs.
- `nav.rfqs` "RFQ Management" → **"Quotes"** (sidebar label; the docs' nav term). `list.title` aligned too.
- Comparison-tab `award*` copy → **"Convert to Purchase Order"** language (values only; the test
  asserts on i18n keys, so no test change needed).

Visual confirmation of the relabelled buyer list (Vite dev server + Playwright with mocked
`getMe`/`/rfqs`, auth bypassed): `.tmp/figma/relabelled_rfq_list.png` — chips render Unreviewed /
Quote Requested / Quote Received / Ordered / Cancelled, sidebar reads "Quotes", button "+ New Quote".

**Still deferred (out of scope here):**
- Vendor-side RFQ statuses (`INCOMING/RESPONDED/APPROVED/REJECTED/CLOSED`) — governed by the
  vendor-portal docs, not the buyer RFQ states.
