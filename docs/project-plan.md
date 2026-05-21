**Engagement:** The Codefoundry

**Start date:** TBC (pending kickoff confirmation)

**Duration:** 3 weeks

**Team:** 2 developers, AI-assisted

**Approach:** Refactor existing codebase, not rebuild

---

## Summary

After auditing the existing codebase, the foundations are stronger than the symptoms suggest. The
data model, backend modules, auth system, and test infrastructure are solid. What's needed is
consolidation of the six role-specific frontends into a single platform, a proper flexible
permissions system, working document intelligence (OCR), and polish on the specific workflows that
aren't behaving correctly.

This 3-week sprint delivers a working end-to-end procurement loop — sourcing, RFQ, quote comparison,
award to PO, invoice reconciliation with three-way match — on a consolidated platform ready for
pilot testing.

---

## What Ayo flagged on the call

Listing the specific issues called out so they're tracked, scoped, and visible. Each one is
addressed in the plan below.

### Architecture and platform

- The platform feels like six disconnected apps (Company Admin, Financial Officer, Procurement
  Officer, Super Admin, Vendor, Warehouse). Maintaining them requires updates across all six
  whenever the backend changes.
- A single change to the backend creates ripple effects across every frontend.
- The product needs to be consolidated into a single, unified platform.

### Vendor model

- The current vendor-to-contractor relationship behaves as if it's 1:1. Suppliers like Rexel can't
  serve multiple contractors without creating duplicate vendor records, which corrupts the data.
- The intended model is for one vendor record to be usable by many contractors.

### Permissions and RBAC

- The current role system is hard-coded. There's no way for a Company Admin to assign granular
  permissions to roles.
- Approval limits (e.g. "a junior officer cannot approve a PO over $25k") can't be configured.
- Delegation of authority is missing.

### Document intelligence (OCR)

- OCR for Bill of Materials documents isn't extracting description, quantity, or unit of measure
  correctly.
- This blocks RFQ creation because the BOM is the starting point of the procurement loop.
- Invoice OCR would also feed the three-way match against POs and deliveries.

### Vendor access

- Vendors shouldn't have to sign up for an account to respond to an RFQ or upload an invoice.
- The intended pattern is a tokenized link that gives them a secure, time-limited page to do what
  they need to do, then expires.

### RFQ form and email flow

- The RFQ form needs to be a scrollable, multi-step layout.
- There's no CC option when emailing RFQs to vendors.

### Infrastructure

- A new AWS account is needed for clean deployment and testing — the previous setup is tangled.
- The `forethread.com` landing page is currently broken due to a missing CNAME record in GoDaddy
  DNS, and the landing page code is missing from the current repository.

---

## What we're delivering

A consolidated single-app procurement platform with:

- One unified frontend with role-based views replacing the six separate apps
- Flexible permissions system with configurable approval limits
- Proper many-to-many vendor model (verified and made correct end-to-end)
- Working multimodal LLM document intelligence for BOMs and invoices
- Tokenized vendor portal for quotes and invoice uploads (no vendor account required)
- Full RFQ → Quote → Comparison → Award → PO flow with multi-step scrollable form, CC support,
  attachments
- Invoice reconciliation with three-way match (PO ↔ delivery ↔ invoice)
- Deployed to Ayo's new AWS account, ready for pilot testing

---

## Week 1 — Foundations and Investigation

The first week is about getting the platform deployable, the new RBAC system in place, the vendor
model working correctly, and the document intelligence pipeline scaffolded. We also nail down the
architectural moves that everything else builds on.

### Day 1 housekeeping

- Codebase fully booted locally, full test suite run to verify "completed" claims hold
- New AWS account provisioned and access verified
- Resend sender domain configured with SPF / DKIM / DMARC (DNS propagation takes time — kicked off
  day 1)
- Gemini API key provisioned (free tier expected to cover development and early launch)
- Prisma migrations baseline created (the current repo has no migration history)
- Architecture decisions locked: which of the six frontend apps becomes the consolidation shell, PDF
  library
- `forethread.com` DNS fix attempted once the landing page code is located

### Dev A — Permissions, Vendor Model, Consolidation Foundation

- New Permission table and RolePermission join introduced into the schema
- Migration of existing enum-based role checks to permission-based middleware
- Company Admin UI for creating roles and assigning permissions
- Approval threshold configuration tied to permissions (e.g. "approve PO up to $X")
- Vendor-contractor relationship audited end-to-end: identify where the 1:1 behaviour is happening
  (UI, query, or service layer) and fix it
- Test data: one vendor serving multiple contractors, confirming the schema's intended behaviour now
  flows through the entire app
- Consolidation work begins: pick the target frontend shell, set up role-based routing, start
  lifting features from the other five apps

### Dev B — Document Intelligence + Comms

- Gemini multimodal LLM integration wired into a clean pipeline
- Upload flow: PDF lands in S3, Gemini extracts structured line items, results surface in a review
  UI for the user to confirm or edit before saving
- BOM parsing as the first use case: extract description, quantity, unit of measure, optional target
  price
- Resend API confirmed end-to-end with a real test send
- Tokenized link infrastructure verified and hardened: token entropy, single-use enforcement,
  expiry, rate limiting

### End of Week 1 — what's demo-able

A Company Admin can create custom roles with granular permissions, configure approval thresholds,
set up a vendor that serves multiple contractors, and upload a real BOM PDF that gets parsed into
structured line items. The platform is running on the new AWS account.

---

## Week 2 — Procurement Loop End to End

Week 2 is the heaviest week. By Friday, a real RFQ goes out to a real vendor, gets a real quote
back, and converts to a real PO with a PDF emailed via Resend.

### Dev A — RFQ, Quotes, PO

- RFQ form rebuilt as a multi-step scrollable layout (project → materials → vendors → delivery &
  specs → review)
- CC field added to the RFQ email flow
- Material selection works from both the catalog and from parsed BOM line items
- Multi-vendor send with one tokenized link generated per vendor
- File attachments on the RFQ travel through to the vendor email
- Quote comparison view: side-by-side, highlights lowest price per line, shows extended cost, lead
  times, payment terms
- Award flow: pick winning vendor → auto-creates a pre-filled PO
- PO form with multi-delivery support, attachments, approval-gated sending
- PO PDF template polished, sent via Resend

### Dev B — Vendor Portal (Tokenized) + Frontend Consolidation

- Tokenized vendor landing page (no signup required): vendor opens link, sees RFQ scope, submits
  quote
- Quote submission supports both form entry and PDF upload (PDF goes through the Gemini OCR
  pipeline, vendor confirms extraction)
- Quote stored against the RFQ with audit trail
- Continued consolidation of the six frontends into the single shell
- Role-based routing finalized: Super Admin, Company Admin, Procurement Officer, Financial Officer,
  Warehouse Officer, Vendor all served by one app with appropriate views
- Email log on every RFQ and PO showing send status, opens, bounces

### End of Week 2 — what's demo-able

This is the milestone moment. A contractor logs in, uploads a real BOM PDF from one of Ayo's actual
projects, builds an RFQ from the parsed line items, sends it to three real vendors via tokenized
links, gets real quotes back, compares them side-by-side, awards the winner, and a real PO email
lands in the winning vendor's inbox.

If anything is going to need extra time, it's this week. Week 3 has buffer for it.

---

## Week 3 — Invoice Reconciliation, Polish, Handoff

The procurement loop is closed. Week 3 adds the invoice side and prepares for pilot.

### Dev A — Approvals, States, Comparison polish

- Approval workflow fully wired through the new RBAC: any PO over the configured threshold routes to
  the right approver based on role and permissions
- Approver inbox view with approve/reject actions and required reason on rejection
- Email notifications via Resend
- State machine enforcement across all PO states (Draft → Pending Approval → Approved → Sent →
  Acknowledged → Delivered, etc.)
- Audit trail visible on every order
- Cancel actions with reason capture

### Dev B — Invoice Reconciliation + Three-Way Match

- Tokenized invoice upload page for vendors (same pattern as quote upload)
- Invoice OCR through Gemini: extract vendor, PO reference, line items, quantities, prices, totals
- Three-way match engine: invoice ↔ PO ↔ delivery confirmation
- Mismatch flagging: price variance, quantity variance, missing PO reference
- Invoice review UI for the contractor: see match status, approve, reject, or dispute
- Invoice states: Received → Under Review → Approved → Disputed → Paid
- Vendor notification when invoice is approved or disputed

### Last two days — converge for handoff

- Full end-to-end testing using real BOMs, real vendor emails, real invoice PDFs supplied by Ayo
- Tokenized link security pass: token entropy, expiry, single-use enforcement reviewed
- Email deliverability check across Gmail, Outlook, and Yahoo
- Bug bash across the full flow
- Client walkthrough document
- Loom demo video recorded as a backup
- Pilot-ready deployment to Ayo's AWS account

### End of Week 3 — what ships

The full Forethread procurement platform on a single consolidated app: flexible RBAC, many-to-many
vendor model, tokenized vendor access, BOM intelligence, RFQ to PO flow with approvals, invoice
reconciliation with three-way match. Pilot-ready.

---

## What we need from Ayo

These are dependencies. Each one has a date because if they slip, the timeline slips with them.

| Dependency                                                                                    | Needed by         |
| --------------------------------------------------------------------------------------------- | ----------------- |
| New AWS account with admin access                                                             | Day 1             |
| Gemini API key                                                                                | Day 1             |
| Sample BOMs (real PDFs from current contractors)                                              | Day 2             |
| Decision on PO numbering format and default approval threshold                                | Day 2             |
| Sample vendor quotes (real PDFs)                                                              | Day 5             |
| Sample invoices (real PDFs)                                                                   | Day 10            |
| Two or three real vendors willing to test the tokenized flow                                  | Day 14            |
| Sender domain confirmed for outbound email ([forethread.com](http://forethread.com))          | Day 1             |
| Landing page code (the [forethread.com](http://forethread.com) page that's currently missing) | Anytime in Week 1 |

---

## Things we're keeping flexible

A few items came up on the call that aren't critical for the 3-week pilot delivery, and would be
better delivered once the core loop is live and in real use. We can fold these into subsequent
months as the engagement continues:

- Mobile app for field teams
- Warehouse module (stock levels, internal material requests, transfers)
- Multi-step approval hierarchies and delegation of authority (the configurable-threshold version is
  delivered; the multi-step delegation chains come later)
- ERP integrations
- A polished public-facing landing page rebuild (DNS fix is in scope, full rebuild is a separate
  piece of work)

The thinking: get the procurement loop working end-to-end first, get it into Ayo's hands and his
pilot vendors' hands, learn from real usage, then layer the above on with confidence rather than
guessing at requirements.

---

## Risks worth naming up front

1. **OCR accuracy on real BOMs.** Multimodal LLMs are strong, but real-world construction BOMs are
   messy. If extraction lands below 80% accuracy on Ayo's samples, the review UI becomes a re-typing
   exercise. Mitigation: sample BOMs requested by Day 2 so we can test extraction immediately and
   adjust prompts or fallback strategies before Week 2 builds depend on it.
2. **AWS access timing.** If the new AWS account doesn't come through by Day 1, we deploy to interim
   infrastructure and migrate during Week 1. Migration mid-build costs roughly a day, so worth
   getting access early.
3. **Resend DNS propagation.** Hard cap on when outbound emails work properly. DNS is submitted on
   Day 1 so propagation completes before Week 2's email flows are live.
4. **Tokenized link security.** Anyone who can intercept or guess a token can submit a fake quote or
   fake invoice. Cryptographically strong tokens, single-use enforcement, expiry — all hardened in
   Week 1, with a security pass in Week 3.
5. **Verifying the existing codebase claims.** The current repo claims many modules are "complete"
   with high test coverage. Day 1 includes running the full test suite locally to verify those
   claims before we depend on them. If significant portions are overclaimed, we'll flag it within
   the first 48 hours and adjust.

---

## Phase 2 preview

After Week 3, with the platform in pilot and real usage data coming in, the natural next pieces are:

- Field PWA / mobile app for site teams
- Warehouse module with stock levels and material requests
- Multi-step approval chains and delegation of authority
- Reporting and dashboards across all roles
- Landing page rebuild (`forethread.com`)
- ERP integration starting with the most-requested target

Timeline for Phase 2 to be agreed once Phase 1 is in pilot — driven by what the real usage surfaces.

---

## How we work

- **Weekly written update every Friday** — what shipped, what's coming next week, any blockers, and
  any decisions needed from Ayo.
- **Weekly progress meeting** — short, focused, decisions only. Time and cadence to be agreed at
  kickoff.
- **Mid-week check-ins** if anything needs unblocking.

---

## Next step

Confirm the start date to lock in team allocation and kick off Day 1 housekeeping.
