# Demo Runbook — The Full Procurement + Delivery Loop

A continuous, end-to-end demo of the whole procurement loop: material requisitions, quote
comparison, the PO approval workflow, the full PO state machine, **delivery capture & approval
(Epic 6)**, the audit trail, and email notifications — across all the roles.

> **Run it locally.** Staging/prod still need `migrate deploy` and staging is on the legacy host, so
> the local stack with seed data is the reliable surface for a demo.

---

## What this demo proves

- **Material Requisition** as a first-class object — raised by an internal user, routed to the
  Procurement Officer, approved/declined with a reason, converted to an RFQ **or** a PO, fully
  audited.
- **Quote comparison & RFQ polish** — side-by-side vendor quotes, award the winner, spin up a PO.
- **PO approval workflow** — RBAC threshold routing, approver inbox, decline-with-reason.
- **Full PO state machine** + an **audit trail on every order**.
- **Delivery capture & approval (Epic 6)** — a delivery report as its own object, recorded either
  internally or via a **no-login mobile QR portal**, with per-line outcomes, damage + photos; a
  buyer-side reviewer approves it, which advances the PO and pushes stock into inventory.
  Segregation of duties throughout.
- **Email notifications** throughout (OTP, pending-approval, issued, delivery access code).
- **Role-based routing** across foreman / procurement / company-admin / vendor / warehouse.

> **One honest note on the PO lifecycle**
>
> The original brief's PO state names (Ordered / Confirmed / Shipped…) were superseded. The shipped
> lifecycle is: **Draft → (Pending approval) → Sent → Acknowledged → Accepted → Partially delivered
> → Delivered → Closed** (plus Cancelled / Declined). Those are the labels on screen. Inventory
> push-in (descoped at Week 3) is now wired up — approving a delivery report increments stock
> balances.

---

## Pre-demo setup (do this ~15 min before)

### A. Boot the stack

```bash
pnpm install
docker-compose -f docker-compose.dev.yml up -d     # Postgres:5433, Redis, Mailhog:8025, MinIO:9001
cd apps/backend && pnpm db:migrate && pnpm db:seed
cd ../.. && pnpm dev                                # backend :3000, web :5179
```

Open the app at **http://localhost:5179**.

### B. ⚠️ CRITICAL — route email to Mailhog, or you cannot log in

Login is **two-step**: password → a **6-digit OTP emailed to the user**. The seed accounts are fake
`*.local` addresses. `apps/backend/.env` currently has a **live `RESEND_API_KEY`**, so OTP emails go
out via Resend and never arrive — you get locked out at the verify screen.

1. Edit `apps/backend/.env` and blank/comment the key:
   ```
   # RESEND_API_KEY=...
   ```
2. **Restart the backend** (re-run `pnpm dev`, or just the backend process).
3. All email now routes to Mailhog. Open **http://localhost:8025** and keep it on a second screen —
   every OTP, approval, and PO email lands there.

### C. Set the approval threshold (so the approval gate actually fires)

By default every role's `po.approve` threshold is **unlimited (null)**, so POs send straight to the
vendor with no approval step. To demo the routing:

1. Log in as **Super Admin** (`superadmin@forethread.local` / `Dev@123456`).
2. **Settings → Roles** (`/settings/roles`) → open **Procurement Officer**.
3. Find **"Approve a purchase order"** (`po.approve`). Ensure it's ticked, then set the
   **Threshold** field to **1000**. **Save.**
4. Leave **Company Admin**'s `po.approve` threshold **blank (unlimited)** — they're the approver.

Net effect: any PO over **$1,000** raised by the Procurement Officer shows **"Submit for Approval"**
and routes to the Company Admin's inbox.

### D. Browser windows — one profile per role (not just one window per role)

You'll switch between ~5 users. The deployed session is a **host-only `jwt` cookie**, and that
cookie is **shared across every window of the same Chrome profile** — so two ordinary windows are
_not_ isolated, and logging in as a second user silently clobbers the first user's session. Give
**each role its own Chrome profile** (or a single incognito window per role) so each has its own
cookie jar. Keep **Mailhog (8025)** visible the whole time.

> Skip this and you'll hit FOR-244: a correct OTP appears to fail with "Invalid code" (or an instant
> logout) because the shared cookie was overwritten by another role's session.

---

## Cast (every password is `Dev@123456`)

| Role                 | Email                               | Plays                                                         |
| -------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Foreman              | `foreman@testcontractor.local`      | raises the requisition                                        |
| Procurement Officer  | `procurement@testcontractor.local`  | reviews/converts, builds the RFQ & PO, can approve deliveries |
| Company Admin        | `companyadmin@testcontractor.local` | approves over-threshold POs **and** delivery reports          |
| Vendor — Test Vendor | `vendor@testvendor.local`           | quotes the RFQ, acknowledges the PO                           |
| Vendor — Acme        | `admin@acmebs.local`                | second competing quote                                        |
| Warehouse Officer    | `warehouse@testcontractor.local`    | **submits** a delivery report (cannot approve)                |
| Super Admin          | `superadmin@forethread.local`       | one-time threshold setup only                                 |

**To log in each:** enter email + password → read the 6-digit code from **Mailhog (8025)** → enter
it on the Verify screen.

> **No account needed for the mobile portal.** The delivery-driver path (Act 6, Path B) opens from a
> QR link with no login — the driver just enters a name + email and a one-time code (which also
> lands in Mailhog locally).

---

## The demo — one continuous story

> Frame it: _"A foreman on site needs materials. Watch it flow from a request on the ground all the
> way to a delivered, fully-audited purchase order."_

### Act 1 — Raise a Material Requisition · **Foreman**

1. Log in as **Foreman** → lands on **My Requests** (`/material-requests`).
2. **New Request** → pick a job (e.g. **Alpha Construction**) → start a new request.
3. **Step 1 – Select materials:** Catalog tab → add _Steel Rebar 12mm_ and _Concrete Mix Grade 40_ →
   **Next**.
4. **Step 2 – Details:** set quantities, **Priority: High**, a needed-by date, delivery location
   (Site A) → **Next**.
5. **Step 3 – Review:** **Submit Request**.
6. Confirmation shows the MR number (e.g. **MR-00001**).
   > _"Any internal user can raise a requisition — it's a first-class object with its own number and
   > lifecycle."_

### Act 2 — Review & approve the requisition · **Procurement Officer**

1. Log in as **Procurement Officer** → **Material requests** dashboard.
2. Filter **Requests awaiting approval** → open **MR-00001**. Show requester, project, line items,
   priority.
3. _(Optional)_ **Decline** → the modal **forces a reason**, which then shows on the timeline. For
   the main flow, click **Approve**.
   > _"Routes to the processing user — typically the Procurement Officer — who approves or declines
   > with a reason."_
4. Scroll to **Activity**: _Request created → Submitted for approval → Approved_, each stamped with
   who & when.
   > _"Full audit trail on the requisition itself."_

### Act 3 — Convert to RFQ & gather quotes · **Procurement Officer + Vendors**

1. On the approved MR, **Convert to RFQ** → lands on a **draft RFQ** with the line items carried
   across.
   > _"When you need vendor quotes, convert to an RFQ. Line items copy over and the requisition
   > stays linked."_
2. In the RFQ: add vendors (**Test Vendor** + **Acme Building Supplies**), set a due date, **Send**.
3. **Switch to Vendor — Test Vendor** → open the incoming RFQ → enter unit prices / availability →
   **Submit quote**. Make the total clearly **over $1,000**.
4. **Switch to Vendor — Acme** → submit a competing quote at different prices.

### Act 4 — Compare quotes & award · **Procurement Officer**

1. Back as **Procurement Officer** → RFQ → **Responses** tab → **Table** view: the **quote
   comparison table**, both vendors side by side, **lowest price tagged green**.
2. Approve the winning lines (or **Approve** the whole quote).
3. On the **Approved** tab, set order quantities → select lines → **Create PO**.
   > _"Award the best quote and spin up a PO directly from the comparison."_

### Act 5 — PO approval + state machine · **PO → Company Admin → Vendor**

1. The new PO opens as **Draft** with real prices from the quote. Because the total exceeds the
   $1,000 threshold, the action button reads **"Submit for Approval"** (not "Send"). Click it → PO
   moves to **Pending approval**.
   > _"Anything over the configured threshold routes to the right approver based on role +
   > permissions."_
2. Show **Mailhog**: a **"PO Pending Approval"** email to the Company Admin.
3. **Switch to Company Admin** → dashboard → **"Awaiting your approval"** card shows the PO.
   - _(Optional)_ **Decline** → modal **requires a reason**, recorded on the order.
   - For the main flow, **Approve**.
4. PO transitions **Pending approval → Sent**; Mailhog shows the **"PO Issued"** email to the
   vendor.
5. **Switch to Vendor** → open the PO → **Acknowledge** (→ Acknowledged) → **Accept** (→ Accepted).
   The PO is now ready to receive against.

### Act 6 — Record the delivery · **Warehouse Officer (or a delivery driver)**

> Delivery is its own object now (**`DR-000001`**), with a **Submitted → Approved / Rejected**
> lifecycle separate from the PO. There are two ways to raise one — show **Path A**, and demo or
> describe **Path B** for the mobile wow-factor. Either way the report lands in **Submitted** and
> changes nothing on the PO until a reviewer approves it (Act 7).

**Path A — internal report · Warehouse Officer**

1. Log in as **Warehouse Officer** → sidebar **Deliveries** (`/deliveries`) → **New delivery
   report** (`/deliveries/new`).
2. **Select PO** → pick the Accepted PO. The line-item table seeds from the PO, with **Qty
   received** pre-filled to the ordered quantity.
3. Make it interesting:
   - Drop one line's **Qty received** below ordered (this is what makes the PO **Partially
     delivered**).
   - Set another line's **Outcome → Damaged** — the inline **damage sub-form** opens: damaged qty,
     damage type, disposition, and a **photo upload**.
   - Outcome options are Delivered / Partially delivered / Not delivered / Damaged / Rejected.
4. _(Optional)_ add an overall report note and/or an attachment.
5. **Submit.** Report **DR-000001** is created in **Submitted** and you land on its detail page.
   > _"The person on the dock records exactly what arrived — including damage with photos. Note
   > there's no Approve button here: the warehouse can submit, but not self-approve."_

**Path B — no-login mobile QR portal · delivery driver** _(optional, the wow-factor)_

1. As the **buyer** (Procurement Officer or Company Admin), open the **PO detail** page → the
   **Generate delivery QR** card → click it. A QR + a copyable `/delivery/<token>` link appear.
2. Open that link on a phone (or paste it into a fresh window). A 4-step mobile flow runs:
   **Identify** (name + email) → a **6-digit access code is emailed** (read it from **Mailhog**) →
   **Verify** → fill the per-line **delivery cards** (same outcomes + damage/photos) → **Submit**.
3. This produces the same **Submitted** `DR-000001` report — just sourced externally, with no
   account.
   > _"A driver with only a phone and the QR on the paperwork can file a delivery report — no login,
   > one-time code, fully captured."_

### Act 7 — Approve the delivery & close the loop · **Company Admin (or Procurement Officer)**

1. **Switch to Company Admin** → **Deliveries** (`/deliveries`) → open **DR-000001**. Show the
   received quantities, the damaged line + its photo, and the submitter's details.
2. _(Optional)_ **Reject** → forces a reason; the PO is left untouched. For the main flow,
   **Approve**.
3. On **Approve**, the received quantities flow onto the PO lines and **stock is pushed into
   inventory** (stock balances increment). The PO transitions to **Partially delivered** (if any
   line is short) or **Delivered** (all lines full).
   > _"It only becomes real when a buyer-side reviewer approves — that's what advances the PO and
   > updates stock. Segregation of duties, end to end."_
4. Open the PO **Action Log** tab: the entire chain — created, submitted, approved, sent,
   acknowledged, accepted, delivered — each stamped with actor + time.
   > _"Every order carries a complete audit trail, and the state machine blocks illegal jumps."_

### Act 8 — The shortcut: requisition straight to PO · **optional, ~1 min**

- Raise a second quick requisition as **Foreman** → approve as **Procurement Officer** → this time
  click **Convert to PO** → pick a vendor → **Create purchase order**.
  > _"When the vendor and pricing are already known, skip the RFQ and convert the requisition
  > directly into a PO. The requisition stays linked either way."_
- Note: prices come in as **0** on this path — you'd fill them in PO edit before issuing.

---

## Wrap-up — what you just showed

- ✅ Material Requisition: first-class object, own state + approval flow, raised by an internal
  user, routed to the PO, convertible to RFQ **or** PO, fully audited.
- ✅ Quote comparison & RFQ polish.
- ✅ PO approval via RBAC threshold routing, approver inbox, decline-with-reason.
- ✅ Full PO state machine + audit trail on every order.
- ✅ Delivery capture & approval: a delivery report as its own object — recorded internally or via
  the no-login mobile QR portal, with damage + photos — approved by a buyer-side reviewer, which
  advances the PO (Partially delivered / Delivered) and pushes stock into inventory.
- ✅ Email notifications throughout (Mailhog).
- ✅ Role-based routing across foreman / procurement / company-admin / vendor / warehouse.

---

## Reset between runs

- Re-run `pnpm db:seed` to wipe back to a clean slate (clears the MRs/RFQs/POs/delivery reports you
  created and resets MR/PO/DR numbering). Do this before a fresh run.
- If OTP emails stop appearing, re-confirm `RESEND_API_KEY` is still blank and the backend was
  restarted after the change.

## Common gotchas

- **No OTP arrives** → `RESEND_API_KEY` still set, or backend not restarted. Blank it, restart,
  retry; the OTP is in **Mailhog (8025)**, not a real inbox.
- **"Invalid code" right after a correct OTP, or an instant logout** → multiple accounts sharing one
  Chrome profile's cookie jar (see §D). Use a separate profile/incognito per role. (FOR-244 — the
  message is also being fixed to name the real cause.)
- **PO sends with no approval step** → threshold still unlimited; set Procurement Officer
  `po.approve` to 1000 and make sure the PO total exceeds it.
- **Vendor sees no RFQ/PO** → that vendor company wasn't added to the RFQ, or you're on the wrong
  vendor login. Seeded vendors assigned to Test Contractor: Test Vendor, Acme, Delta, Summit, Rexel.
- **Convert-to-PO shows $0 total** → expected on the direct path; fill prices in PO edit before
  issuing.
- **Warehouse Officer has no Approve button on a delivery report** → expected; only Company Admin /
  Procurement Officer hold `delivery.approve`. Switch to one of them to approve.
- **PO state doesn't change after submitting a delivery** → the report is only **Submitted**; the PO
  advances **on approval** (Act 7), not on submit.
- **Mobile portal code never arrives** → same Mailhog rule as OTP — the 6-digit delivery access code
  lands in **Mailhog (8025)**, not a real inbox; codes expire after ~15 min and lock after 3 bad
  tries.
- **No "Generate delivery QR" on the PO** → it only renders on the **buyer** PO detail view;
  generate it as Procurement Officer or Company Admin.
- **vitest stalls** → if you also run tests, stop `turbo dev` first (known fork-pool contention).
