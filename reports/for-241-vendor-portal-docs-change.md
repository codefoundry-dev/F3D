# FOR-241 — Vendor Portal guide reframe (prepared change)

**Date:** 2026-06-10
**Status:** PREPARED — not applied (editable Mintlify source not on this machine; see
`reports/for-232-rfq-docs-change.md`). **Docs only — no app/code changes** (except the linked UI bug
noted at the end, which is a *separate* ticket, not part of this docs change).

**Target page:** `guides/vendor-portal/vendor-portal-guide` ("Vendor Portal: Manage Orders and Submit
Quotes").

**Ground truth:** there is no standalone Vendor Portal app/domain. Vendors use the same `apps/web` via
(a) a **VENDOR-role login** in the main app, or (b) a **tokenized guest link for a single RFQ**
(`/invitation/:token`; `AccessTokenPurpose` = RFQ_VIEW / QUOTE_SUBMIT).

---

## Change 1 — reframe "standalone portal" → actual access model

Fix the access framing (intro line 8, "Receiving your invitation" §, "Logging in" §):

- Current: *"a dedicated web interface… you access it through a standalone login"*, *"Create a password
  for your Vendor Portal login"*, *"Visit the Vendor Portal URL"*.
- Replace with: vendor access is **either** a **VENDOR-role login to the Forethread web app** (invited
  by your customer; you set a password and sign in to the same app, in a vendor view), **or** a
  **single-use guest link** emailed for one RFQ (no account needed — opens just that request to view and
  quote). There is **no separate portal application or login domain.**

## Change 2 — keep (accurate today), just align vocabulary

These are real and stay — only align PO wording with the canonical model (FOR-230/231):

- View POs; **acknowledge / accept / decline** (the doc's "Confirm Order → Confirmed" should read as
  **Acknowledge** → status **Acknowledged**, then **Accept** → **Accepted**; "Confirmed" is not a
  `PoStatus`). Vendor-triggered shared statuses: Accepted, Declined, Change pending, Cancelled by vendor.
- Submit quotes (line-item form **or** PDF upload); buyer↔vendor messaging; "cannot modify a PO directly
  — buyer must issue a change" (correct — maps to Change pending).
- Manage vendor users / multiple customer connections.

## Change 3 — flag as not-yet-available (coming soon)

- **"Updating delivery status" / "Mark as Shipped"** with Shipping date / Carrier / Tracking number
  (§ line 60–64) — not built. Mark coming-soon; remove the implication that the vendor advances a
  shipping status. (Ties to FOR-230/235: no per-delivery state machine, no shipping step.)
- **Portal dashboard → "Upcoming Deliveries"** section (line 24) — not built; mark coming-soon.

## Change 4 — document the upload caveat + file a bug

- Vendor **document upload** (delivery tickets / packing slips / certifications — line 12) is **allowed
  by the backend but currently hidden in the vendor UI** (`hideUpload=true`). Add a brief caveat in the
  docs, and **file a separate UI bug** to surface the upload control. *(Quote PDF upload — "Upload Quote"
  — is a different, working control; leave it.)*

---

## Out of scope

- Docs-only here. The `hideUpload` fix is a separate app bug ticket (link it from FOR-241).
- PO status label definitions are owned by FOR-230/231 — this page just uses them.

## Acceptance criteria coverage

- [x] Clarify no separate portal app/login; access = VENDOR-role login OR tokenized guest link — Change 1
- [x] Keep documented & accurate: view/confirm(ack)/accept/decline, quotes (form/PDF), messaging, manage users — Change 2
- [x] Flag not-yet-available: Mark as Shipped + carrier/tracking, vendor Upcoming Deliveries — Change 3
- [x] Note backend-permitted-but-hidden document upload (`hideUpload`) + linked bug — Change 4
