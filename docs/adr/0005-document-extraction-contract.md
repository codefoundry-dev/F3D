# ADR-0005: Document Extraction is a uniform primitive; review surfaces are tiered

**Status:** Accepted
**Date:** 2026-05-12

## Context

The user-requirement makes "flexible parsing of unstructured documents" a non-negotiable — and explicitly names rigid OCR as the failure mode of the previous build. Eight user stories across four epics rely on this capability: BOM upload, private catalogue import, quote PDF, invoice email-in, invoice file upload, photo of a printed list, handwriting OCR, field-purchase receipt.

Two failure patterns we want to avoid:
1. **Inconsistent UX across upload flows** — every "upload a thing" screen invents its own confirmation step, every error message is different, every confidence display works differently. The previous build had this disease.
2. **Single review pattern that is too heavy for fast capture (photos in the field) or too light for money-moving documents (invoices).** Mobile field capture can't gate on a desktop-style side-by-side; an invoice must not be one-tap-confirmed.

## Decision

**One primitive, two review tiers.**

Internally there is a single `DocumentExtraction` record produced by the parsing layer, regardless of source: `{ source_file, extracted_fields[], per_field_confidence, item_match_candidates[] }`. All downstream code reads this shape. The choice of provider (multimodal LLM today, something else later) is hidden behind it.

The review *surface* is tiered by document risk:
- **Tier B** — pre-filled form with low-confidence fields highlighted, original source available on click. Used for catalogue imports, BOMs, photos of lists, handwritten lists, field-purchase receipts.
- **Tier C** — mandatory side-by-side original-source display alongside the extracted form. Used for quote PDFs (reviewed by the *vendor* before submission) and invoices (reviewed by the Finance Officer before three-way match entry).

**Unmatched items.** A line that the extraction layer cannot resolve to a catalogue ID at or above the Contractor's confidence threshold is an "unmatched item." On every document type that participates in commerce (BOM, RFQ, Quote, PO, Bulk Order, invoice, delivery) the user must resolve unmatched items to a catalogue ID before the document moves forward. Vendors can only pick from existing catalogue items — they cannot create new ones (catalogue authoring is a Contractor- or Super-Admin-only authority). Free-text lines are permitted *only* on Field Purchase Reports.

## Consequences

- A small, stable internal API around `DocumentExtraction` means the provider can be swapped, A/B tested, or fronted by a fallback pipeline (e.g. Textract + LLM) without touching any UI code.
- Tier B vs Tier C is a UX rule, not a flag on the data. The same `DocumentExtraction` can be reviewed under either tier — useful when, say, a Finance Officer wants a quick re-check of an already-approved invoice.
- The vendor flow for quote PDF upload — vendor uploads, vendor confirms side-by-side, vendor submits via OTP — must be possible *entirely through the tokenized-link path* (ADR-0001/0002). The side-by-side UI cannot require login.
- Catalogue write authority is centralised. Vendors never expand the catalogue; Contractors expand their private one or suggest additions to the public one. This keeps price history meaningful — same item ID across vendors = same row to compare prices against.
- Confidence threshold becomes a Contractor-configurable parameter, the same way 3-way-match tolerances are. Default 0.85, tunable via Company Admin settings.
- Telemetry on extraction quality (precision, recall, manual-correction rate per document type) needs to exist from day one — otherwise we can't tell whether a provider swap helped or hurt.

## Alternatives considered

- **Single uniform review screen across all document types.** Rejected: either too heavy for field capture or too light for invoices.
- **Per-screen bespoke extraction logic.** Rejected: this is what the previous build did. Brittle, inconsistent UX, impossible to swap providers.
- **Allow vendors to add to the catalogue.** Rejected: catalogue authority drift kills price history (the same item shows up under multiple IDs because each vendor added their own version).
- **Allow free-text lines on RFQs/POs/invoices.** Rejected: breaks three-way match and price history. Free-text is the escape hatch for Field Purchase Reports only, where neither matters.
