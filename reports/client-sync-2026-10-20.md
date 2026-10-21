# Client Sync — 20 Oct 2026: Ticketed Asks

Action items from the Forethread project sync on **20 Oct 2026**, tracked under epic
[FOR-357](https://codefoundry.atlassian.net/browse/FOR-357). Owner: Jesse. Target: end of week (JD
overseeing).

Not ticketed here: staging vs production sync investigation, and Excel/CSV bulk import of suppliers
and cost codes.

**Status key:** ⬜ To do · 🔄 In progress · ✅ Done

## Summary

| Ticket                                                      | Area          | Ask                                                     | Status |
| ----------------------------------------------------------- | ------------- | ------------------------------------------------------- | ------ |
| [FOR-358](https://codefoundry.atlassian.net/browse/FOR-358) | Layout        | Responsive layout for 13–14" laptop screens             | ⬜     |
| [FOR-359](https://codefoundry.atlassian.net/browse/FOR-359) | Layout        | Freeze table header row on scroll                       | ⬜     |
| [FOR-360](https://codefoundry.atlassian.net/browse/FOR-360) | Layout        | Horizontal scrollbar on wide tables                     | ⬜     |
| [FOR-361](https://codefoundry.atlassian.net/browse/FOR-361) | Catalogue     | Material images carry over from catalogue to RFQ        | ⬜     |
| [FOR-362](https://codefoundry.atlassian.net/browse/FOR-362) | Catalogue     | Editable material categories                            | ⬜     |
| [FOR-363](https://codefoundry.atlassian.net/browse/FOR-363) | Catalogue     | Rename "Public" tab to "Global Materials"               | ✅     |
| [FOR-364](https://codefoundry.atlassian.net/browse/FOR-364) | RFQ           | One "needed by" date/time that fills in every line item | ⬜     |
| [FOR-365](https://codefoundry.atlassian.net/browse/FOR-365) | Cost codes    | Click-to-edit cost codes directly in the table          | ⬜     |
| [FOR-366](https://codefoundry.atlassian.net/browse/FOR-366) | Notifications | Standardise sender format in in-app notifications       | ⬜     |

## 1. Layout and responsiveness

### FOR-358 — Responsive layout for 13–14" laptop screens

- **Client ask:** The UI breaks on 13–14" laptops. The designs were made for large monitors.
- **Expected:** Core flows are usable at 1280px wide and up. Nothing overlaps or clips, and modals
  and wizards fit the screen.
- **Resolution:** _TBD_

### FOR-359 — Freeze table header row on scroll

- **Client ask:** The table header row (for example on Material Request) should stay in place on
  scroll, like Excel.
- **Expected:** Sticky headers in the shared table component, aligned with their columns.
- **Resolution:** _TBD_

### FOR-360 — Horizontal scrollbar on wide tables

- **Client ask:** Add a horizontal scrollbar so extra columns stay reachable on smaller screens.
- **Expected:** Tables scroll sideways inside their container, the page doesn't, and columns keep a
  readable minimum width.
- **Resolution:** _TBD_

## 2. Material catalogue

### FOR-361 — Material images carry over from catalogue to RFQ

- **Client ask:** Images on catalogue materials don't show up on the RFQ, so suppliers lose context.
- **Expected:** RFQ lines show the material image on both the buyer and vendor views.
- **Resolution:** _TBD_

### FOR-362 — Editable material categories

- **Client ask:** The category list looks hard-coded. Confirm whether it can be edited, and if not,
  make it editable.
- **Expected:** Admins can create, rename and deactivate categories without a deploy.
- **Resolution:** _TBD_

### FOR-363 — Rename "Public" tab to "Global Materials"

- **Client ask:** "Public" is unclear. Rename it to "Global Materials".
- **Expected:** Every user-facing label says "Global Materials". Underlying values are unchanged.
- **Resolution:** Labels only. The catalogue tab now reads "Global Materials" and the row status
  badge reads "Global". The Super Admin dashboard quick action is now "Global Material Catalogue".
  User-facing "public catalogue" text is now "global catalogue" in the upload destination note,
  duplicate warning, submit/review modals and the read-only error. The `PUBLIC` status, the `public`
  tab key and URLs are unchanged.
  (`packages/i18n/src/locales/en/{materialCatalogue,dashboard,errors}.json`)

## 3. RFQ workflow

### FOR-364 — One "needed by" date/time for the whole RFQ

- **Client ask:** Setting "needed by" on each line one at a time is too slow.
- **Expected:** An RFQ-level date/time fills in every line, and individual lines can still be
  overridden.
- **Resolution:** _TBD_

## 4. Cost codes

### FOR-365 — Click-to-edit cost codes directly in the table

- **Client ask:** Editing a cost code takes about 5 clicks.
- **Expected:** Edit in place in the table. Enter or blur saves, Esc cancels.
- **Resolution:** _TBD_

## 5. Notifications

### FOR-366 — Standardise sender format in in-app notifications

- **Client ask:** Senders show up in different formats ("I", "idea", "I, company name").
- **Expected:** One sender format across every notification type, with clean fallbacks.
- **Resolution:** _TBD_
