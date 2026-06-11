# Doc-Intelligence Extraction vs Figma Wireframes — Field-by-Field Comparison

**Date:** 2026-06-11 **Branch:** `claude/ocr-bom-vendor-extraction-r8org3` **Figma file:**
`CFA6k0XCvImOmWXbBgdWYZ` (https://www.figma.com/design/CFA6k0XCvImOmWXbBgdWYZ/Forethread)

**Verification method (this revision):** screens pulled **live from the hosted Figma file via the
Figma MCP** (`get_screenshot` + `get_metadata`), not the local `Forethread.fig` decode. This
supersedes the 2026-06-10 revision, which was decoded offline; the live renders **confirm most of
the earlier findings** but **correct the catalogue section and the accepted-formats claim** (see §0
_Corrections_). Screenshots saved to `.tmp/figma-docintel/`.

**User-supplied entry nodes → screen mapping (live `get_metadata`):**

| Node (URL `node-id`) | Section (live name)                     | Extraction surface                                     |
| -------------------- | --------------------------------------- | ------------------------------------------------------ |
| `5879-130623`        | US 5.01 – Create a BOM (CA+PO)          | **BOM** review `6244:154079`                           |
| `6317-163140`        | Epic 7 – Invoice Reconciliation         | **Invoice** upload `6317:177143` + match `6789:180451` |
| `5879-132163`        | Material catalogue (All usrs) — US 4.01 | **Catalogue** master detail `6130:140219`              |
| `5156-107922`        | US 3.06 – RFQ response (Vendor)         | **Quote** form `5237:93546`                            |
| `5220-74134`         | US 3.08 – PO receiving & reply (Vendor) | _Not an extraction surface_ (context only)             |

**Compared against:**

- `apps/backend/src/modules/doc-intelligence/doc-intelligence.schemas.ts` (Gemini `responseSchema`s)
- `apps/backend/src/modules/doc-intelligence/doc-intelligence.service.ts` (`ACCEPTED_MIME_TYPES`,
  `dropUnmatchedBomLines` at confirm)
- `packages/shared-types/src/dtos/` — `bom.dto.ts`, `quote-extraction.dto.ts`,
  `invoice-extraction.dto.ts`, `catalogue-extraction.dto.ts`, `doc-extraction.dto.ts`
- `specs/001-procurement-platform/spec.md` — US16 Document Extraction (lines 1636–1652)

---

## 0. Corrections to the 2026-06-10 (local-decode) revision

The live MCP renders overturned three claims from the previous revision:

1. **Catalogue identifiers are NOT conflated.** The previous report claimed `sku` /
   `manufacturerPartNumber` were "implementation-only — design shows neither" and that the design
   "conflates UPC/MPN/SKU". The live **Material Details** screen (`6130:140219`, US 4.01) shows
   **four distinct identifier fields**: `Material code: 1234567`, `UPC: CB-ROOF-0.42-SURF`,
   `SKU: ROOF-007`, `Manufacturer Part Number (MPN): 12345`. So `sku` and `manufacturerPartNumber`
   **map correctly to real design fields** — they are not implementation-only.
2. **"Country of origin" is a first-class catalogue field**, not a stray-note artifact. It appears
   in the Core-identification block of the Material Details screen (`Country of origin: Australia`).
   It is genuinely **missing** from the extraction schema.
3. **CSV is accepted by the backend.** `ACCEPTED_MIME_TYPES` includes `text/csv` (and the upload
   path keys CSVs off the filename extension to dodge the Windows `application/vnd.ms-excel`
   mis-report). The earlier "XLS and CSV rejected" line is wrong on CSV; only legacy **XLS**
   (`.xls`, exceljs can't read it) and **DOC/DOCX** are actually rejected.

Everything else in the earlier revision is **confirmed** against the live renders.

---

## 1. BOM extraction (`DocExtractionType.BOM`) — node `5879-130623`

**Design (live, review screen `6244:154079`):** 3-step wizard _Upload File → Review items → Assign
to Project_. Step 2 "Review Extracted Items" table columns: `Material name *` |
`Matched mat. cat. item *` | `Original item description *` | `UoM *` | `Quantity *` | `Category` |
`Material type` | `Confidence` | `Actions`. A trailing manual **Enter** row; unmatched rows tinted
red/amber; alert _"Unmatched items detected. All BOM line items must be matched to materials in the
catalogue before proceeding. Review and resolve unmatched entries to continue."_; CTA is **"Match
items first"** and **disabled**. Confidence is a banded badge — `No match`, `Low 16%`, `Medium 61%`,
`High 86/92/97%`. `Category` and `Material type` render `—` until a catalogue item is matched
(derived from the matched material, not extracted).

**Implemented (`BOM_SCHEMA` + `BomLineItem`):** doc-level `title, projectName, currency, notes`;
items `description, quantity, unit, targetPrice, notes` + matcher fields
`matchedMaterialId, matchedMaterialName, matchConfidence, matchCandidates[{materialId, name, confidence}]`
(threshold 0.85, floor 0.4, max 3 candidates).

| Design field                                          | Implementation                                                 | Verdict                                                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Material name (cleaned, editable)                     | — (only `description`)                                         | **Missing** — design separates _Material name_ from _Original item description_; schema has one `description`                                                      |
| Matched mat. cat. item                                | `matchedMaterialId` / `matchedMaterialName` ✓                  | OK                                                                                                                                                                 |
| Original item description                             | `description` ✓                                                | OK                                                                                                                                                                 |
| UoM                                                   | `unit` ✓                                                       | OK                                                                                                                                                                 |
| Quantity                                              | `quantity` ✓                                                   | OK                                                                                                                                                                 |
| Category (from matched material)                      | —                                                              | **Missing** — `BomCatalogueCandidate` is only `{materialId, name, confidence}`; the row + match-picker need the candidate's category/type/UoM/description          |
| Material type (from matched material)                 | —                                                              | **Missing** (same root cause as Category)                                                                                                                          |
| Confidence badge (No match / Low / Medium / High + %) | `matchConfidence` (null below 0.85 threshold)                  | **Partial** — UI must fall back to `matchCandidates[0].confidence`; Low/Med/High band cut-offs not in shared-types                                                 |
| — (no price column in BOM design)                     | `targetPrice`                                                  | Implementation-only — harmless                                                                                                                                     |
| — (project picked in step 3; no title/currency shown) | `title`, `projectName`, `currency`                             | Implementation-only — harmless                                                                                                                                     |
| Upload formats: XLS, XLSX, CSV, PDF                   | `ACCEPTED_MIME_TYPES` = PDF, PNG, JPEG, WEBP, XLSX, CSV        | **Partial mismatch** — CSV ✓ now; **XLS rejected**; backend also accepts PNG/JPEG/WEBP (relevant to the MR-photo flow, not listed on the BOM drop-zone)            |
| Multi-file upload queue                               | one file per extraction record                                 | **Mismatch (flow)**                                                                                                                                                |
| "Match items first" — cannot proceed while unmatched  | `dropUnmatchedBomLines()` **drops** unmatched lines at confirm | **Behavioural conflict** ⚠ — design (and US16: "the user must resolve the unmatched item to a catalogue ID before submission") _blocks_; implementation _discards_ |

Design-side note: the review flow also has "Create private material item" screens (`6245:157440`,
`6245:158248`) for resolving unmatched lines by creating a private catalogue item — no
extraction-schema involvement, but absent from the module's confirm path.

---

## 2. Vendor quote submission (`DocExtractionType.QUOTE`) — node `5156-107922`

**Design (live, US 3.06 "RFQ response (Vendor)", form `5237:93546`):** the wireframe has **no
quote-PDF upload / extraction / prefill step** — the vendor fills the quote **manually**. Confirmed
field labels from the live metadata:

- _Bulk-Level Defaults_ (applied to all line items): Bulk Availability, Bulk Discount %, GST %,
  Shipment, Warehouse Location, Bulk Delivery date & time
- _Line items:_ `Incl.` toggle | `Material Name` | `UoM` | `Req Qty` | `Avail Qty *` | `Unit Price`
  | `Discount` | `GST` | `Tax Incl.` | `Delivery Date *` | `Line Total` | `Actions`
- _Back-order:_ Back-order Qty, Expected Delivery Date \* ("additional qty, supplied later … in
  addition to immediate availability")
- _Summary:_ Total Items Quoted, Subtotal, Discounts, GST, Total Quote
- _Additional Quote Details:_ Validity period of the offer, Additional Notes, Attachments
  (`vendor_quote.pdf`, `specs.docx` — **supporting documents, not parsed**)

**Implemented (`QUOTE_SCHEMA` + `QuoteExtractionResult`, FOR-206 prefill):**
`vendorName, quoteNumber, rfqReference, currency, totalAmount, validUntil, notes`; items
`description, quantity, unit, unitPrice, lineTotal, leadTime`. A tokenized guest-vendor upload path
exists in the service.

| Design field                                     | Implementation                                          | Verdict                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Avail Qty                                        | `items.quantity`                                        | OK (as prefill source)                                                                                   |
| Unit Price                                       | `items.unitPrice`                                       | OK                                                                                                       |
| Line Total                                       | `items.lineTotal`                                       | OK                                                                                                       |
| Delivery Date \* (per line, a date)              | `items.leadTime` (free-text string)                     | **Type mismatch** — form needs a date; "2 weeks"-style lead time can't prefill                           |
| Discount (%) per line                            | —                                                       | **Missing** from extraction                                                                              |
| GST (%) / Tax Incl. per line                     | —                                                       | **Missing** from extraction                                                                              |
| Back-order Qty / Expected Delivery Date          | —                                                       | **Missing**                                                                                              |
| Bulk-Level Defaults (6 fields)                   | —                                                       | **Missing**                                                                                              |
| Validity period of the offer                     | `validUntil`                                            | OK                                                                                                       |
| Additional Notes                                 | `notes`                                                 | OK                                                                                                       |
| Total Quote / Subtotal / Discounts / GST summary | `totalAmount` only                                      | **Partial** — no subtotal/discount/tax totals (INVOICE schema has `subTotal`/`taxAmount`; QUOTE doesn't) |
| —                                                | `vendorName`, `quoteNumber`, `rfqReference`, `currency` | Implementation-only (context-implicit on the form; useful for validation)                                |

**Spec US16 conflict:** US16 mandates **Tier C** for vendor quote review (side-by-side original +
form, incl. the tokenized no-login path). The wireframe quote form has no side-by-side **because it
has no extraction step at all.** The implementation has the extraction; the design has neither the
upload nor the Tier-C review surface. Net: a design-vs-spec gap, with the implementation siding with
the spec. Either the design must add a quote-upload/Tier-C flow, or FOR-206 has no design home.

---

## 3. Invoice upload & review (`DocExtractionType.INVOICE`) — node `6317-163140`

**Upload modal (live `6317:177143`, US 8.01 + US 8.10):** `Link to Purchase Order(s)` select
(**plural**), drop zone _"Supported formats: PDF, PNG, JPG, JPEG, XLS/XLSX, DOC/DOCX, CSV"_,
multi-file list (eye + delete per file), `Proceed file` CTA.

**Match screen (live `6789:180451`, US 8.04 — Tier-C side-by-side ✓):** left pane = original invoice
document; right pane:

- _Invoice header data:_ `Invoice Number` | `Vendor` (dropdown) | `Invoice Date` (date picker) |
  `Payment Terms` | `Tax` (value shown as **"GST 10%"**) | `Total (incl. GST)`
- _Line Items:_ `Line Item ID` | `Invoice Line Item` | `PO Line Item` | `Description` | `UoM` |
  `Inv Qty` | `PO Qty` | `PO Price` | `Inv Price` | `PO Total` | `Total` | `Actions`. Banner _"N
  discrepancies found between invoice and purchase order"_; an unmatched invoice line shows **empty
  PO cells** (no `PO Line Item` / `PO Qty` / `PO Price` / `PO Total`).

**Implemented (`INVOICE_SCHEMA` + `InvoiceExtractionResult`):**
`vendorName, invoiceNumber, poReference, issuedDate, dueDate, currency, subTotal, taxAmount, totalAmount, notes`;
items `description, quantity, unit, unitPrice, lineTotal`.

| Design field                                 | Implementation                                  | Verdict                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice Number                               | `invoiceNumber`                                 | OK                                                                                                                                                                                                |
| Vendor                                       | `vendorName`                                    | OK                                                                                                                                                                                                |
| Invoice Date                                 | `issuedDate`                                    | OK                                                                                                                                                                                                |
| Payment Terms                                | —                                               | **Missing** from schema + DTO                                                                                                                                                                     |
| Tax (rendered "GST 10%" — rate + label)      | `taxAmount` (absolute number)                   | **Representation mismatch** — design shows a tax _rate/label_; extraction stores only an amount                                                                                                   |
| Total (incl. GST)                            | `totalAmount`                                   | OK                                                                                                                                                                                                |
| Link to Purchase Order(s) — **multiple**     | `poReference` (single string)                   | **Mismatch** — US 8.10 one-invoice-to-many-POs can't round-trip a single `poReference`                                                                                                            |
| Invoice Line Item + Description (two fields) | single `description`                            | **Missing** name/description split (same pattern as BOM)                                                                                                                                          |
| Line Item ID                                 | —                                               | **Missing** (no per-line identifier)                                                                                                                                                              |
| PO Line Item pairing per line                | —                                               | **Missing** — invoice lines carry **no** match fields (BOM got `matchCandidates`; invoice has none), despite US16 requiring `item_match_candidates[]` and below-threshold matches held for review |
| Inv Qty / UoM / Inv Price / Total            | `quantity` / `unit` / `unitPrice` / `lineTotal` | OK                                                                                                                                                                                                |
| —                                            | `dueDate`, `subTotal`, `currency`               | Implementation-superset (due date in doc preview; subtotal in the US 8.05 reconcile summary) — harmless                                                                                           |
| Upload formats incl. XLS, DOC/DOCX           | PDF, PNG, JPEG, WEBP, XLSX, CSV                 | **Mismatch** — **XLS, DOC/DOCX rejected**; CSV ✓; HEIC (US17 allowlist) also unsupported                                                                                                          |
| Multi-file upload                            | one file per extraction                         | **Mismatch (flow)**                                                                                                                                                                               |

Design-side caveat: the US 8.04 frame carries open annotation widgets ("What data should be entered
here?", "Only invoice data editable?") — the design itself is not fully settled on edit semantics.

---

## 4. Material catalogue (`DocExtractionType.CATALOGUE`) — node `5879-132163`

This node is the catalogue **master detail / management** view (US 4.01), which defines the full
material field set. The catalogue **import** that the extraction actually feeds is the separate US
4.02 "Contribute to material catalogue" wizard (column-map → review). Both are compared below.

**Material Details (live `6130:140219`) — Core identification fields:** `Internal ID`,
`Material code`, `Material Name`, `Status`, `Categories`, `Material type`, `Unit of Measure`,
`Item type`, `Country of origin`, `Manufacturer / Brand`, `Manufacturer Part Number (MPN)`,
`Manufacturer series / model`, `UPC`, `SKU`, `Grade / class`, `Colour / finish`, `Size`,
`Price per Unit`, `Last modified`, `Description`. **Additional Properties:** Dimensions
(Length/Width/Height/Diameter/Thickness/Weight per unit), Packaging & handling (Units per package /
Packaging unit / Weight per package), Specific data (Compressive strength / Tensile strength / Fire
rating / Density). The **Import** dropdown offers CSV / XLS / XLSX.

**Implemented (`CATALOGUE_SCHEMA` + `CatalogueLineItem`):** `sourceName, notes`; items
`name, sku, brand, manufacturerPartNumber, upc, uom, description, mainCategory, subCategory, imageUrl, confidence`.
Spreadsheet importer header synonyms exist for
name/sku/brand/MPN/upc/uom/mainCategory/subCategory/description only.

| Design field (Material Details)                            | Implementation                    | Verdict                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Material Name                                              | `name`                            | OK                                                                                                                             |
| Unit of Measure                                            | `uom`                             | OK                                                                                                                             |
| Categories                                                 | `mainCategory`                    | OK                                                                                                                             |
| Material type                                              | `subCategory`                     | OK (naming differs; importer only matches a literal "sub category" column, not "material type")                                |
| Manufacturer / Brand                                       | `brand`                           | OK                                                                                                                             |
| Manufacturer Part Number (MPN)                             | `manufacturerPartNumber`          | **OK** (corrects 06-10: MPN is a real, distinct design field)                                                                  |
| UPC                                                        | `upc`                             | OK                                                                                                                             |
| SKU                                                        | `sku`                             | **OK** (corrects 06-10: SKU is a real, distinct design field)                                                                  |
| Description                                                | `description`                     | OK                                                                                                                             |
| Material code                                              | —                                 | **Missing** — a 4th identifier distinct from SKU/MPN/UPC                                                                       |
| Country of origin                                          | —                                 | **Missing** (corrects 06-10: it is first-class, not a stray note)                                                              |
| Price per Unit                                             | —                                 | **Missing** — the field most likely to appear on a real supplier price list / catalogue                                        |
| Manufacturer series / model                                | —                                 | **Missing**                                                                                                                    |
| Grade / class, Colour / finish, Size, Item type            | —                                 | **Missing** (Core-identification fields)                                                                                       |
| Dimensions / Packaging / Specific-data blocks              | —                                 | **Missing** — Additional-Properties master fields (typically entered/edited manually, not in a generic price list)             |
| Duplicate state per row (vs existing & in-file)            | —                                 | **Missing** — no duplicate flag; spec edge case (spec.md ~line 1738) requires explicit duplicate resolution before save        |
| Required-field (`*`) validation states                     | —                                 | UI-derivable, but required-ness not encoded — only `name` is required in the schema                                            |
| Column-mapping step ("N detected · M auto-matched", remap) | —                                 | **Missing as a contract** — importer auto-maps internally; no DTO exposes detected columns / mapping for the US 4.02 step-2 UI |
| —                                                          | `imageUrl`, per-item `confidence` | Implementation-only — design shows an image _placeholder_ in the detail view; no per-row confidence in the catalogue flow      |

**Net:** field-wise the catalogue maps better than 06-10 implied (SKU/MPN/UPC all line up). The real
gaps are: **`Material code`, `Country of origin`, `Price per Unit`** (likely-present catalogue
columns that aren't extracted), the **duplicate-detection flag**, and the **column-mapping
contract** for the US 4.02 step-2 UI. The remaining master fields (series/model, grade, colour,
size, dimensions, packaging, specific data) are mostly manual-entry properties, not typical
price-list columns — lower priority for extraction.

---

## 5. Cross-cutting — US16 "standard shape" vs both sides

| US16 requirement                                                                                           | Design                                                                                          | Implementation                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| One standard shape: `source_file`, `extracted_fields[]`, `per_field_confidence`, `item_match_candidates[]` | n/a (UI)                                                                                        | **Diverges** — four per-type shapes; no generic `extracted_fields[]`                                                                |
| `per_field_confidence`                                                                                     | BOM review shows per-**line** match confidence only; nothing on quote/invoice/catalogue screens | Only `CatalogueLineItem.confidence` (per item) + BOM `matchConfidence` (match similarity, not extraction conf). Quote/invoice: none |
| `item_match_candidates[]` on every extraction                                                              | BOM ✓ (picker popup), invoice ✓ (PO-line pairing)                                               | **BOM only** (`matchCandidates`); invoice / quote / catalogue have none                                                             |
| Tier B (BOM / catalogue / MR photo) — prefilled form, low-confidence highlight, source one click away      | ✓ (BOM table + eye icon; catalogue mapping is validation-based, not confidence-based)           | Backend provides data; highlight thresholds/bands not in the shared contract                                                        |
| Tier C (quote / invoice) — mandatory side-by-side                                                          | Invoice ✓ (US 8.04). **Quote ✗ — no extraction / side-by-side at all in the wireframes**        | Extraction + tokenized guest QUOTE path exist; the review surface is the frontend's job                                             |
| Contractor-configurable confidence threshold (default 0.85)                                                | No settings surface in these wireframes                                                         | `BOM_MATCH_CONFIDENCE_THRESHOLD = 0.85` constant, explicitly "not yet Contractor-configurable"                                      |
| Unmatched item must be resolved before submission                                                          | ✓ "Match items first" blocked CTA                                                               | **Conflict** — `dropUnmatchedBomLines()` discards unmatched lines at confirm instead of blocking                                    |
| Telemetry (doc type, per-field confidence, corrections per field)                                          | n/a                                                                                             | Only token usage (`DocExtractionUsageDto`); no per-field telemetry                                                                  |

---

## Key takeaways (ranked)

1. **BOM confirm drops unmatched lines instead of blocking** (`dropUnmatchedBomLines` at confirm) —
   contradicts both the wireframe ("Match items first") and US16 ("must resolve … before
   submission"). Highest behavioural risk.
2. **`BomCatalogueCandidate` is too thin for the designed UI** — the review table + match-picker
   need the candidate material's category, material type, UoM and description, not just
   `{id, name, confidence}`.
3. **Invoice extraction lacks `paymentTerms`, multi-PO linkage (`poReference` is a single string vs
   US 8.10), per-line IDs, and any invoice-line→PO-line match fields** — the US 8.04 right pane
   cannot be populated from the extraction contract alone, and US16's `item_match_candidates[]` is
   unmet for invoices.
4. **Quote extraction can't prefill the designed quote form** — no per-line discount/GST/tax-incl.,
   no back-order fields, no bulk defaults, and `leadTime` (string) vs `Delivery Date` (date).
   Conversely the wireframes have **no quote-upload flow at all**, so US16's Tier-C quote review is
   unsatisfied on the design side too.
5. **Tax representation** — invoice design shows a tax **rate/label** ("GST 10%"); `taxAmount` holds
   only a number. A `taxLabel`/`taxRate` field (or structured tax) is needed to round-trip.
6. **Name vs description split** — BOM and invoice designs both show a cleaned _name_ column
   separate from the _original description_; all schemas have a single `description`.
7. **Catalogue gaps** (revised): `Material code`, `Country of origin`, `Price per Unit`, the
   duplicate-detection flag, and the US 4.02 column-mapping contract. (SKU / MPN / UPC are correct —
   they line up with the four distinct design identifiers.)
8. **Accepted formats** (revised): backend takes PDF / PNG / JPEG / WEBP / XLSX / **CSV**. Designs
   additionally list **XLS** (BOM + invoice) and **DOC/DOCX** (invoice), which the backend rejects
   (exceljs can't read legacy `.xls`; no doc parser). All designs allow **multi-file**; backend is
   one-file-per-record.

---

## 6. Remediation status (this branch)

The low-ambiguity, spec-aligned gaps were closed in this branch (extraction contract + normalizers

- importer + tests). The remaining items need a product/design decision and are intentionally left.

**Fixed (schema + DTO + prompt + normalizer/importer + tests):**

- **Invoice** — added `paymentTerms`; added `taxLabel` ("GST 10%") + `taxRate` (10, also derived
  from the label) alongside `taxAmount`; `poReference` (single) → **`poReferences: string[]`** (US
  8.10); added per-line `lineId`; added optional invoice-line→PO-line match fields
  (`matchedPoLineItemId`, `matchConfidence`) as the reconciler contract (US16
  `item_match_candidates[]`). → takeaways #3, #5.
- **BOM candidate** — `BomCatalogueCandidate` now carries `uom` / `category` / `subCategory` /
  `description`; the service selects them (+ `category.name`) and the matcher attaches them. →
  takeaway #2.
- **Catalogue** — added `materialCode`, `countryOfOrigin`, `pricePerUnit` to the schema, prompt, LLM
  normalizer **and** the spreadsheet importer (new header synonyms incl. "material type" →
  `subCategory`). → takeaway #7 (the three extracted fields).

**Deferred (need a product/design decision — not code-only):**

- **BOM drops unmatched lines vs blocks** (takeaway #1) — changing `dropUnmatchedBomLines` to a hard
  block changes the confirm UX and the RFQ-builder handoff; needs product sign-off.
- **Quote upload / Tier-C review** (takeaway #4) — the wireframes have no quote-extraction surface
  at all; this is a design gap, not an implementation one.
- **Name vs description split** (takeaway #6), the catalogue **duplicate-detection flag** and
  **column-mapping contract**, **per-field confidence / telemetry**, and the
  **Contractor-configurable threshold** — each is a larger cross-cutting change (UI +
  storage/telemetry) beyond the extraction contract.
