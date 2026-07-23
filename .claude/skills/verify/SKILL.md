---
name: verify
description: Runtime verification recipe for apps/web — launch the frontend without a backend and drive flows with Playwright route-mocks. Use when verifying frontend changes end-to-end (screenshots, payload capture).
---

# Verify apps/web changes (no backend needed)

## Launch

```bash
cd apps/web && npx vite --port 5179 --strictPort   # run in background
```

Default API baseURL is `/v1` (`VITE_API_URL ?? '/v1'`) — no env needed. If you do set
`VITE_API_URL` from Git Bash, prefix `MSYS_NO_PATHCONV=1` or MSYS mangles `/v1` into a
Windows path.

## Drive (Playwright script, run with `node` from repo ROOT)

Working examples: `.tmp/figma-rfqcreate/shot_for274.mjs` (current 2-step RFQ wizard),
`.tmp/figma-flows/shot_drawdown.mjs`, `.tmp/figma-po/shot_po.mjs`.

Essentials:
- Auth: `ctx.addInitScript` → `localStorage['forethread-web-auth'] = {state:{currentUser: USER},version:0}`
  AND route-mock `GET /v1/users/me` → `{data: USER}`. `USER.permissions` gates buttons; `role` drives buyer/vendor UI.
- Mock everything: `page.route('**/v1/**', ...)`. List endpoints return
  `{data:{items,meta:{page,limit,total,totalPages}}}`; detail/object endpoints `{data:{...}}`.
  Put specific routes (e.g. `/v1/materials/suggestions` → `{data:{results,frequentlyUsed,recentlyUsed}}`)
  BEFORE generic catch-alls.
- Capture request payloads inside the route handler (`route.request().postDataJSON()`) —
  that's your evidence that data flows to the API.

## Gotchas (learned the hard way)

- Create-RFQ wizard is **2 steps** now: Step 1 = Basic Info + Select Vendors + Add Line Items
  (availability is a column in the table); Step 2 = Review & Send. No per-step navigation to
  reach line items — just select a project first (`manual-name-<projectId>` rows render per
  selected project group).
- Clicking the "Add Line Items" / "Select Vendors" **section headings collapses the section**
  (unmounts the table). To blur an input, click another input (e.g. `getByPlaceholder('Reference')`),
  never "neutral" page areas. Clicking near (10,10) hits the sidebar logo and navigates away.
- "Save as draft" only requires a project → cheapest way to trigger a draft POST for payload capture.
- DatePicker is a custom sectioned mask (not `type=date`): click the `mm/dd/yyyy` text, then click
  a day cell in `[data-datepicker-portal]`.
- PO wizard step 2 (manual/change mode) POSTs `/v1/purchase-orders/validate-items` — must mock
  `{data:{suggestions:[]}}` or the page crashes.
- PO wizard step-1 placeholders (manual create at `/purchase-orders/new`): project = "Search projects",
  vendor = "Choose vendor", location = "Choose location", date = "DD/MM/YYYY". Avoid `getByText(/Select the project/)` —
  it matches the helper text below the field, not the dropdown.
- Working PO manual-flow example: `.tmp/figma-po/shot_po_manual_cell.mjs` (walks step 1 → 2 → 3 → submit,
  captures the created-PO payload).
