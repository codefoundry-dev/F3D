# BOM Extraction Accuracy Benchmark (FOR-200)

**Ticket:** FOR-200 **Date:** 2026-05-22 **Branch:** main **Author:** ohenekwabena

## Goal

FOR-200 risk #1 caps the AI extractor at ≥80% line-item accuracy on contractor BOMs
("Ayo's sample BOMs"). This doc defines what we mean by accuracy, how to measure it,
and where to record the result before the ticket is closed.

## Scoring rules

Each BOM is evaluated row-by-row against a hand-curated ground truth (the same PDF,
transcribed manually).

| Field | Match rule |
| --- | --- |
| `description` | Exact (case-insensitive, whitespace-collapsed) after manual normalization. |
| `quantity` | Numeric equality. Both sides go through `parseNumber()` first. |
| `unit` | Canonical form match — both sides go through `canonicalizeUnit()` first. |
| `targetPrice` | Numeric equality (when ground truth has a price). |

A row scores 1.0 if **description AND quantity** match. Unit and price are tracked as
secondary signals but don't gate the row. Extra rows (Gemini hallucinations) and
missing rows count against the score symmetrically:

```
accuracy = matched_rows / max(ai_rows, truth_rows)
```

Aggregate accuracy = mean across all benchmark BOMs.

## Reproducing the benchmark

1. Drop PDFs into `apps/backend/__tests__/fixtures/boms/` (gitignored by default — they
   are not in the repo because contractor BOMs are sensitive).
2. Add a JSON sidecar with the same basename containing the ground-truth shape from
   `BomExtractionResult` (`packages/shared-types/src/dtos/bom.dto.ts`).
3. Run `pnpm --filter @forethread/backend test:bench-bom` (placeholder; the bench
   harness is not yet checked in — it's a `tsx` script that calls
   `DocIntelligenceService.runExtraction` against real Gemini and writes a CSV
   summary to `.tmp/bom-bench/`).
4. Record the result in the table below.

## Current results

| Run date | BOM count | Avg accuracy | Notes |
| --- | --- | --- | --- |
| _TBD — pending Ayo's sample PDFs_ | — | — | Code & prompt are ready; awaiting fixtures. |

Once a benchmark run lands, capture:

- The model version (`gemini-2.5-flash` today; this changes when we upgrade).
- The exact prompt revision (`doc-intelligence.prompts.ts` git SHA).
- Any per-BOM accuracy < 0.6 — those are candidates for prompt iteration.

## What we changed in FOR-200 to make this measurable

- The BOM prompt was tightened so Gemini returns a fixed shape with `targetPrice`
  (`doc-intelligence.prompts.ts`) instead of free-form JSON.
- `normalizeBomResult()` (`doc-intelligence.bom.ts`) coerces qty strings to numbers,
  canonicalises units, strips currency symbols, and drops header/blank rows — so
  scoring is deterministic and not noise from formatting differences.
- `editedResult` always carries the normalized shape, while `rawResult` keeps Gemini's
  literal output for forensics if a score is suspect.

## Out of scope here

- Vendor-side BOM uploads (covered by quote extraction in FOR-201).
- Multi-page or scanned-image BOMs (Gemini can ingest them, but our test fixtures
  should stay PDF-native until we measure photo OCR separately).
- An accuracy CI gate. We'll wire that in once we have a stable corpus.
