# FOR-237 — Roles taxonomy docs correction (prepared change)

**Date:** 2026-06-10
**Status:** PREPARED — not applied (editable Mintlify source not on this machine; see
`reports/for-232-rfq-docs-change.md`). **No app/code changes.** Design + code = source of truth.

**Ground truth**
- `packages/shared-types/src/enums/index.ts` → `UserRole` = SUPER_ADMIN, COMPANY_ADMIN,
  PROCUREMENT_OFFICER, FINANCIAL_OFFICER, WAREHOUSE_OFFICER, FOREMAN, VENDOR.
- Display names (`packages/i18n/.../roles.json` → `roleNames`): Super Admin, Company Admin, Procurement
  Officer, Financial Officer, Warehouse Officer, **Foreman**, Vendor.
- The app's Roles & permissions settings use a **role + approval threshold** model
  ("Documents above this amount route to a higher-tier approver") — this is the real approval mechanism,
  not job titles like Project Manager / Director / VP.

**Where the problem is:** there's no dedicated roles page. The invented roles live in
**`guides/setup/order-flows.mdx`** (approver examples), and **`introduction.mdx`** "Core roles" only
describes two generic roles without the real per-user taxonomy.

---

## Change 1 — `introduction.mdx` "Core roles": add the real UserRole taxonomy

Keep the existing Subcontractor (Buyer) vs Vendor (Supplier) framing — that's the real **company-type**
split (`CompanyType` = CONTRACTOR / VENDOR). Then add the per-user roles table:

> Within a Subcontractor company, each user is assigned one of these roles, which controls what they can
> do:
>
> | Role | Typical responsibilities |
> |---|---|
> | Company Admin | Full administrative access — manages users, roles, settings, and all procurement. |
> | Procurement Officer | Creates and sends purchase orders and RFQs; manages vendors and materials. |
> | Financial Officer | Reviews and approves invoices and spend; handles payment-side workflows. |
> | Warehouse Officer | Manages inventory, warehouses, and fulfils inventory requests. |
> | Foreman | Field user — submits material requests and draft requests from the job site. |
> | Vendor | Supplier user — responds to orders/RFQs through the Vendor Portal (no Forethread account needed). |
>
> *(Super Admin is a platform-level role and isn't assigned within a customer company.)*

This also satisfies "add FINANCIAL_OFFICER / WAREHOUSE_OFFICER if missing" and replaces the generic
"Field users / purchasing staff" wording with the real role names (Foreman, Procurement Officer).

## Change 2 — `guides/setup/order-flows.mdx`: fix the invented approver roles

**Line ~52, "Assign approval rights by user role":**

Current: *Field Users — can submit, cannot approve; Project Managers — approve up to a threshold;
Directors — approve higher-value; Admins — approve any amount.*

Replace with the real roles + the real threshold model:

> Approvers are assigned by **role**, and each role can carry an **approval threshold** — orders above a
> role's threshold route to a higher-tier approver:
>
> - **Foreman** — submits material/draft requests; cannot approve.
> - **Procurement Officer** — creates and sends orders; approves up to its configured threshold.
> - **Financial Officer** — approves spend/invoices up to its configured threshold.
> - **Company Admin** — can approve at any amount.

**Lines ~48 & ~56 (example tiers + approver assignment methods):** the "$1k–$10k → Project Manager",
"$10k–$50k → Director", "Over $50k → VP and Director", and "all Project Managers" / "Requester's
Manager" examples use job titles that are **not** Forethread roles. Either (a) re-cast the examples with
the real roles above and threshold amounts, or (b) clearly label them as illustrative org titles you map
onto real roles. Recommend (a) for consistency with the role + threshold model.

---

## Out of scope / hand-off

- **PO lifecycle wording in `order-flows.mdx`** ("Draft → Ordered → Delivered" default; "Common stage
  types" Draft/Pending Approval/Approved/Ordered/Confirmed/Delivered/Rejected) uses the old PO vocab →
  **FOR-231 / FOR-236**, not this ticket.
- No app/code changes (AC). Earlier `FOREMAN`→"Field User" display relabel was git-reverted (97c4b74).

## Acceptance criteria coverage

- [x] Docs list the real `UserRole` values with actual names (Foreman, not "Field User") — Change 1 + 2
- [x] "Project Manager" / "Director" removed from the Release-1 taxonomy — Change 2
- [x] FINANCIAL_OFFICER / WAREHOUSE_OFFICER added — Change 1
- [x] No app/code changes
