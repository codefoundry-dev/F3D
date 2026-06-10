# Doc-Intelligence Extraction vs Figma Wireframes — Field-by-Field Comparison

**Date:** 2026-06-10 **Branch:** `claude/ocr-bom-vendor-extraction-r8org3` **Figma file:**
`CFA6k0XCvImOmWXbBgdWYZ` (Forethread) — wireframes decoded from the local `Forethread.fig` export
(node IDs verified identical to the hosted file; the MCP page listing only exposes the _Cover_ and
_Components_ pages, but the file has 13 pages incl. `⚙️ Wireframes` where all screens below live).
**Compared against:**

- `apps/backend/src/modules/doc-intelligence/doc-intelligence.schemas.ts` (Gemini response schemas)
- `packages/shared-types/src/dtos/` — `bom.dto.ts`, `quote-extraction.dto.ts`,
  `invoice-extraction.dto.ts`, `catalogue-extraction.dto.ts`, `doc-extraction.dto.ts`
- `specs/001-procurement-platform/spec.md` — US16 Document Extraction (lines 1636–1653)

Screenshots exported to `.tmp/figma-verify/` (BOM review, invoice upload, invoice match, quote
submission, catalogue mapping, catalogue review).

---

## 1. BOM extraction (`DocExtractionType.BOM`)

**Design:** section `5879:130623` "US 5.01 – Create a BOM (CA+PO)" — 3-step wizard _Upload File →
Review items → Assign to Project_. Review screen `6244:154079`.

**Upload step (design):** drop zone "Supported formats: XLS, XLSX, CSV, or PDF"; multi-file list;
note "Required columns: Material name / Category / Material type / Unit of measure / Quantity /
Description — the system will attempt to auto-map columns and flag unrecognised values"; processing
state; partial-extraction error card.

**Review table columns (design):** `Material name *` | `Matched mat. cat. item *` |
`Original item description *` | `UoM *` | `Quantity *` | `Category` | `Material type` | `Confidence`
| `Actions` — plus a manual "Enter" row, unmatched rows highlighted, alert "All BOM line items must
be matched … before proceeding", and a disabled **Match items first** CTA. Confidence renders as
banded badge: `No match`, `Low 16%`, `Medium 61%`, `High 86%`. Category / Material type show `—`
until a catalogue item is matched (i.e. they are _derived from the matched material_, not
extracted).

**Implemented (`BOM_SCHEMA` + `BomLineItem`):** doc-level `title, projectName, currency, notes`;
items `description, quantity, unit, targetPrice, notes` + matcher fields
`matchedMaterialId, matchedMaterialName, matchConfidence, matchCandidates[{materialId, name, confidence}]`
(threshold 0.85, floor 0.4, max 3 candidates).

| Design field                                              | Implementation                                                                    | Verdict                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Material name (cleaned, editable)                         | — (only `description`)                                                            | **Missing** — design separates _Material name_ from _Original item description_; schema/DTO have a single `description`                                                                                                                            |
| Matched mat. cat. item                                    | `matchedMaterialId/Name` ✓                                                        | OK                                                                                                                                                                                                                                                 |
| Original item description                                 | `description` ✓                                                                   | OK                                                                                                                                                                                                                                                 |
| UoM                                                       | `unit` ✓                                                                          | OK                                                                                                                                                                                                                                                 |
| Quantity                                                  | `quantity` ✓                                                                      | OK                                                                                                                                                                                                                                                 |
| Category (from matched material)                          | —                                                                                 | **Missing** — `BomCatalogueCandidate` carries only `{materialId, name, confidence}`; the row (and the match-picker popup, which shows name / UoM / description / category) cannot be rendered without the material's category/type/UoM/description |
| Material type (from matched material)                     | —                                                                                 | **Missing** (same root cause as Category)                                                                                                                                                                                                          |
| Confidence badge (No match / Low / Medium / High + %)     | `matchConfidence` only set when auto-matched ≥ 0.85; below threshold it is `null` | **Partial** — UI must fall back to `matchCandidates[0].confidence`; Low/Medium/High band cut-offs undefined in shared-types                                                                                                                        |
| —                                                         | `targetPrice`                                                                     | Implementation-only; no price column anywhere in the BOM design flow                                                                                                                                                                               |
| —                                                         | `title`, `projectName`, `currency` (doc level)                                    | Implementation-only; design picks the project manually in step 3 and shows no title/currency                                                                                                                                                       |
| Upload formats XLS, XLSX, CSV, PDF                        | `ACCEPTED_MIME_TYPES` = PDF, PNG, JPEG, WEBP, XLSX                                | **Mismatch** — XLS and CSV rejected by backend; backend additionally accepts images the design doesn't list                                                                                                                                        |
| Multi-file upload queue                                   | One file per extraction record                                                    | **Mismatch** (flow)                                                                                                                                                                                                                                |
| "Match items first" — cannot proceed with unmatched lines | `dropUnmatchedBomLines()` silently **drops** unmatched lines at confirm           | **Behavioural conflict** — design (and US16: "the user must resolve the unmatched item to a catalogue ID before submission") blocks; implementation discards                                                                                       |

Design-side note: the review flow includes "Create private material item" screens (`6245:157440`,
`6245:158248`) for resolving unmatched lines by creating a private catalogue item — no extraction
schema involvement, but the flow is absent from the module's confirm path.

---

## 2. Vendor quote submission (`DocExtractionType.QUOTE`)

**Design:** section `5156:107922` / `5899:146966` "US 3.06 – RFQ response (Vendor)". Main form
`5237:93546`.

**The wireframes contain no quote-PDF upload/extraction step at all** (searched the whole file for
upload-quote / prefill / extract frame names: 0 matches). The vendor fills the quote **manually**:

- _Bulk-Level Defaults:_ Bulk Availability (qty), Bulk Discount (%), General Sales Tax GST (%),
  Shipment, Warehouse Location, Bulk Delivery date & time
- _Line items:_ `Incl.` toggle | `Material Name` | `UoM` | `Req Qty` | `Avail Qty *` | `Unit Price`
  | `Discount` | `GST` | `Tax Incl.` | `Delivery Date *` | `Line Total` | `Actions` (add note /
  back-order / suggest substitute)
- _Back-order details:_ Back-order Qty, Expected Delivery Date \*
- _Summary:_ Total Items Quoted, Subtotal, Discounts, GST, Total Quote
- _Additional Quote Details:_ Validity period of the offer, Additional Notes (optional), Attachments
  (optional; PDF, XLSX, DOCX, JPG, CSV, ≤ 10 MB — supporting documents, not parsed)

**Implemented (`QUOTE_SCHEMA` + `QuoteExtractionResult`, FOR-206 prefill):**
`vendorName, quoteNumber, rfqReference, currency, totalAmount, validUntil, notes`; items
`description, quantity, unit, unitPrice, lineTotal, leadTime`. A tokenized guest-vendor upload path
exists in the service.

| Design field                                     | Implementation                                          | Verdict                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Avail Qty                                        | `items.quantity`                                        | OK (as prefill source)                                                                                            |
| Unit Price                                       | `items.unitPrice`                                       | OK                                                                                                                |
| Line Total                                       | `items.lineTotal`                                       | OK                                                                                                                |
| Delivery Date \* (per line, a date)              | `items.leadTime` (free-text string)                     | **Type mismatch** — form needs a date; "2 weeks" style lead time can't prefill it                                 |
| Discount (%) per line                            | —                                                       | **Missing** from extraction                                                                                       |
| GST (%) / Tax Incl. per line                     | —                                                       | **Missing** from extraction                                                                                       |
| Back-order Qty / Expected Delivery Date          | —                                                       | **Missing** (design treats back-order as part of the response)                                                    |
| Bulk-Level Defaults (6 fields)                   | —                                                       | **Missing** (no bulk/default block in extraction)                                                                 |
| Validity period of the offer                     | `validUntil`                                            | OK                                                                                                                |
| Additional Notes                                 | `notes`                                                 | OK                                                                                                                |
| Total Quote / Subtotal / Discounts / GST summary | `totalAmount` only                                      | **Partial** — no subtotal/discount/tax totals in QUOTE schema (INVOICE has `subTotal`/`taxAmount`; QUOTE doesn't) |
| —                                                | `vendorName`, `quoteNumber`, `rfqReference`, `currency` | Implementation-only (context-implicit on the form; useful for validation, never rendered)                         |

**Spec US16 conflict:** US16 requires vendor-quote review to be **Tier C** (mandatory side-by-side
original + form, incl. the tokenized no-login path). The wireframe quote form has no side-by-side —
because it has no extraction step. Implementation has the extraction; the design has neither the
upload nor the Tier-C review surface. This is a design-vs-spec gap, with the implementation siding
with the spec.

---

## 3. Invoice upload & review (`DocExtractionType.INVOICE`)

**Design:** section `6317:163141` "US 8.01 – Upload the invoice + US 8.10 – Link one invoice to
multiple POs" (modal `6317:177143`) and section `6767:210356` "US 8.04 – Matching invoice with PO"
(screen `6789:180451`, Tier-C side-by-side ✓).

**Upload modal (design):** `Link to Purchase Order(s)` select (plural, per US 8.10), drop zone
"Supported formats: PDF, PNG, JPG, JPEG, XLS/XLSX, DOC/DOCX, CSV", multi-file list, success /
failure modals.

**Match screen (design):** left pane = original invoice document; right pane:

- _Invoice header data:_ `Invoice Number` | `Vendor` (dropdown) | `Invoice Date` | `Payment Terms` |
  `Tax` (e.g. "GST 10%") | `Total (incl. GST)`
- _Line Items:_ `Line Item ID` | `Invoice Line Item` | `PO Line Item` | `Description` | `UoM` |
  `Inv Qty` | `PO Qty` | `PO Price` | `Inv Price` | `PO Total` | `Total` | `Actions` — banner "3
  discrepancies found between invoice and purchase order"; unmatched invoice line shows empty PO
  cells.

**Implemented (`INVOICE_SCHEMA` + `InvoiceExtractionResult`):**
`vendorName, invoiceNumber, poReference, issuedDate, dueDate, currency, subTotal, taxAmount, totalAmount, notes`;
items `description, quantity, unit, unitPrice, lineTotal`.

| Design field                                 | Implementation                                  | Verdict                                                                                                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice Number                               | `invoiceNumber`                                 | OK                                                                                                                                                                                                                                           |
| Vendor                                       | `vendorName`                                    | OK                                                                                                                                                                                                                                           |
| Invoice Date                                 | `issuedDate`                                    | OK                                                                                                                                                                                                                                           |
| Payment Terms                                | —                                               | **Missing** from schema + DTO                                                                                                                                                                                                                |
| Tax ("GST 10%" — rate + label)               | `taxAmount` (absolute number)                   | **Representation mismatch** — design shows a tax _rate/label_; extraction stores only an amount                                                                                                                                              |
| Total (incl. GST)                            | `totalAmount`                                   | OK                                                                                                                                                                                                                                           |
| Link to Purchase Order(s) — multiple         | `poReference` (single string)                   | **Mismatch** — US 8.10 one-invoice-to-many-POs cannot round-trip through a single `poReference`                                                                                                                                              |
| Invoice Line Item + Description (two fields) | single `description`                            | **Missing** name/description split (same pattern as BOM)                                                                                                                                                                                     |
| Line Item ID                                 | —                                               | **Missing** (no per-line identifier in extraction)                                                                                                                                                                                           |
| PO Line Item pairing per line                | —                                               | **Missing** — no match fields on invoice lines (BOM got `matchedMaterialId/matchCandidates`; invoice lines have nothing), despite US16 requiring `item_match_candidates[]` in the standard shape and below-threshold matches held for review |
| Inv Qty / UoM / Inv Price / Total            | `quantity` / `unit` / `unitPrice` / `lineTotal` | OK                                                                                                                                                                                                                                           |
| —                                            | `dueDate`, `subTotal`, `currency`               | Implementation-superset (due date appears only in the document preview; subtotal only in the US 8.05 reconcile summary) — harmless                                                                                                           |
| Upload formats incl. XLS, DOC/DOCX, CSV      | PDF, PNG, JPEG, WEBP, XLSX only                 | **Mismatch** — XLS, CSV, DOC/DOCX rejected; HEIC (spec US17 allowlist) also unsupported                                                                                                                                                      |
| Multi-file upload                            | one file per extraction                         | **Mismatch** (flow)                                                                                                                                                                                                                          |

Design-side caveat: the US 8.04 frame carries open annotation widgets ("What data should be entered
here?", "Only invoice data editable?") — the design itself is not settled on edit semantics.

---

## 4. Material catalogue import (`DocExtractionType.CATALOGUE`)

**Design:** section `6625:151979` "4.02 – Contribute to material catalogue" — wizard _Step 1/3
Upload your material file → Step 2/3 Map and validate columns → Step 3/3 Review and import
materials_ (screens `6610:220454`, `6614:228060` / `6614:235364`).

**Column-mapping table (design):** `Material name *` | `UoM *` | `Category *` | `Mat. type *` |
`Manufacturer` | `UPC *` | `Description` | `Actions`; "5 columns detected · 3 auto-matched";
per-column mapping dropdowns; row states **Filled / Not filled (warning) / Duplicate
(destructive)**; alert "Duplicate materials detected. Some entries match existing records…".

**Review cards (design):** material name + `Category` | `Material type` | `Manufacturer / Brand` |
`UoM` | `UPC` + Edit.

**Implemented (`CATALOGUE_SCHEMA` + `CatalogueLineItem`):** `sourceName, notes`; items
`name, sku, brand, manufacturerPartNumber, upc, uom, description, mainCategory, subCategory, imageUrl, confidence`.

| Design field                                                              | Implementation                    | Verdict                                                                                                                                                           |
| ------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Material name                                                             | `name`                            | OK                                                                                                                                                                |
| UoM                                                                       | `uom`                             | OK                                                                                                                                                                |
| Category                                                                  | `mainCategory`                    | OK                                                                                                                                                                |
| Mat. type                                                                 | `subCategory`                     | OK (naming differs; material catalogue uses categoryId/subCategory)                                                                                               |
| Manufacturer / Brand                                                      | `brand`                           | OK                                                                                                                                                                |
| UPC                                                                       | `upc`                             | OK                                                                                                                                                                |
| Description                                                               | `description`                     | OK                                                                                                                                                                |
| Duplicate state per row (vs existing records & within file)               | —                                 | **Missing** — no duplicate flag in the extraction shape; spec edge case (spec.md ~line 1738) requires explicit duplicate resolution before save                   |
| "Not filled" required-field validation states                             | —                                 | UI-derivable (nullable fields), but required-ness (`*` on name/UoM/category/type/UPC) is not encoded — only `name` is required in the schema                      |
| Column-mapping step ("N columns detected · M auto-matched", manual remap) | —                                 | **Missing as a contract** — Gemini/`spreadsheetToCatalogue` auto-map internally; no DTO exposes detected columns or mapping for the step-2 UI                     |
| —                                                                         | `sku`, `manufacturerPartNumber`   | Implementation-only — design shows neither (sample UPC value "CB-ROOF-0.42-SURF" looks like an internal part number, suggesting the design conflates UPC/MPN/SKU) |
| —                                                                         | `imageUrl`, per-item `confidence` | Implementation-only — design shows no image and no confidence anywhere in the catalogue flow (validation states are rule-based, not confidence-based)             |

Related design inconsistency: a stray note frame (`6317:164338`, parked in the US 8.01 section)
lists catalogue required columns as "Material name / Category / Material type / Unit of measure /
**Manufacturer / Country of origin** / Description" — _Country of origin_ appears nowhere in the
mapping table or the extraction schema.

---

## 5. Cross-cutting — US16 "standard shape" vs both sides

| US16 requirement                                                                                           | Design                                                                                                               | Implementation                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| One standard shape: `source_file`, `extracted_fields[]`, `per_field_confidence`, `item_match_candidates[]` | n/a (UI)                                                                                                             | **Diverges** — four per-type shapes; no generic `extracted_fields[]`                                                                        |
| `per_field_confidence`                                                                                     | BOM review shows per-**line** (match) confidence only; nothing on quote/invoice/catalogue screens                    | Only `CatalogueLineItem.confidence` (per item) and BOM `matchConfidence` (match similarity, not extraction confidence). Quote/invoice: none |
| `item_match_candidates[]` on every extraction                                                              | BOM ✓ (picker popup), invoice ✓ (PO-line pairing)                                                                    | **BOM only** (`matchCandidates`); invoice/quote/catalogue have none                                                                         |
| Tier B review (BOM / catalogue / MR photo) — prefilled form, low-confidence highlight, source 1 click away | ✓ (BOM table + eye icon; catalogue mapping) — though catalogue highlights are validation-based, not confidence-based | Backend provides data; highlight thresholds/bands not in shared contract                                                                    |
| Tier C review (quote / invoice) — mandatory side-by-side                                                   | Invoice ✓ (US 8.04). **Quote ✗ — no extraction/side-by-side at all in the wireframes**                               | Extraction + tokenized guest QUOTE path exist; review surface is frontend's job                                                             |
| Contractor-configurable confidence threshold (default 0.85)                                                | No settings surface in these wireframes                                                                              | Constant `BOM_MATCH_CONFIDENCE_THRESHOLD = 0.85`, explicitly "not yet Contractor-configurable"                                              |
| Unmatched item must be resolved before submission                                                          | ✓ "Match items first" blocked CTA                                                                                    | **Conflict** — `dropUnmatchedBomLines()` discards unmatched lines at confirm instead of blocking                                            |
| Telemetry (doc type, per-field confidence, corrections per field)                                          | n/a                                                                                                                  | Only token usage (`DocExtractionUsageDto`); no per-field telemetry                                                                          |

---

## Key takeaways (ranked)

1. **BOM confirm drops unmatched lines instead of blocking** — contradicts both the wireframe and
   US16. Highest behavioural risk.
2. **`BomCatalogueCandidate` is too thin for the designed UI** — review table and match-picker need
   the candidate material's category, material type, UoM and description, not just
   `{id, name, confidence}`.
3. **Invoice extraction lacks `paymentTerms`, multi-PO linkage (`poReference` is a single string vs
   US 8.10), per-line IDs and any invoice-line→PO-line match fields** — the entire US 8.04
   right-hand pane cannot be populated from the extraction contract alone.
4. **Quote extraction can't prefill the designed quote form** — no per-line discount/GST/tax-incl.,
   no back-order fields, no bulk defaults, and `leadTime` (string) vs `Delivery Date` (date).
   Conversely, the wireframes have no quote-upload flow at all — design must add it (or FOR-206 has
   no design home), and US16's Tier-C quote review is unsatisfied by the current design.
5. **Accepted file formats disagree everywhere** — backend: PDF/PNG/JPEG/WEBP/XLSX; BOM design adds
   XLS+CSV; invoice design adds XLS/CSV/DOC/DOCX; both designs allow multi-file, backend is
   one-file-per-record.
6. **Name vs description split** — BOM and invoice designs both display a cleaned _name_ column
   separate from _original description_; all schemas have a single `description`.
7. **Catalogue flow** aligns best field-wise; gaps are the duplicate-detection flag, the
   column-mapping contract for step 2, and implementation-only `sku`/`manufacturerPartNumber`/
   `imageUrl`/`confidence`.
