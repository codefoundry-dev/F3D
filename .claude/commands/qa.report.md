---
description:
  Generate a timestamped, human-readable markdown QA report with traceability back to spec
  acceptance criteria.
---

## User Input

```text
$ARGUMENTS
```

## Argument Parsing

| Argument | Behavior                                                              |
| -------- | --------------------------------------------------------------------- |
| (empty)  | Generate report from existing `playwright-results.json` (no test run) |
| `e2e`    | Run functional e2e tests first, then generate report                  |
| `visual` | Run visual regression tests first, then generate report               |
| `full`   | Run both e2e and visual tests, then generate combined report          |
| `unit`   | Run unit tests (Jest/Vitest) first, then generate report              |

## Execution

### Step 1: Discover feature

Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` to get `FEATURE_DIR`. If the
script fails, fall back to auto-detecting:

```bash
FEATURE_DIR=$(ls specs/ | grep -E '^[0-9]{3}-' | head -1)
```

### Step 2: Run tests (if requested)

Based on argument:

- `e2e` → run Playwright functional tests for `tests/e2e/{feature}/us*.spec.ts`
- `visual` → run Playwright visual tests for `tests/e2e/{feature}/visual-regression.spec.ts`
- `full` → run both e2e and visual
- `unit` → run unit tests: `pnpm turbo test:coverage --filter=@forethread/backend` for backend
  (Jest), `pnpm turbo test` for frontend apps (Vitest)
- (empty) → skip, use existing results

For e2e/visual/full: ensure Playwright JSON reporter outputs to
`reports/qa/playwright-results.json`.

For unit: parse Jest/Vitest console output for suite counts, test counts, and coverage percentages.

If no test results found and no run requested, abort with: "ERROR: No test results found. Run
`/qa.report e2e`, `/qa.report unit`, or `/qa.report full` to run tests first."

### Step 3: Parse results

- **e2e/visual/full**: Load `reports/qa/playwright-results.json` and parse test outcomes.
- **unit**: Parse Jest coverage summary (Stmts, Branch, Funcs, Lines per file) and Vitest suite
  pass/fail counts from console output.

### Step 4: Build traceability matrix

Map test names back to spec requirements:

| Test Name Pattern               | Maps To                                         |
| ------------------------------- | ----------------------------------------------- |
| `AC1: Add task opens modal`     | Acceptance criterion 1 of the parent user story |
| `Edge: Empty title shows error` | Best-matching edge case by keyword overlap      |
| Visual screen names             | Screen entry in `figma-screens.json`            |
| `describe('ServiceName')`       | Maps to the backend module/service under test   |
| `route-config.test.ts`          | Maps to app routing configuration               |
| Unmatched tests                 | Listed as "unmapped" in traceability matrix     |

Uncovered spec requirements (no matching test) are marked **NOT COVERED**.

### Step 5: Generate report

Write to `reports/qa/{feature-id}-{type}-{timestamp}.md`

Timestamp format: `YYYY-MM-DDTHHMMSS` (filesystem-safe, no colons) Example:
`reports/qa/001-task-board-full-2026-03-03T143000.md`

#### Report Sections (e2e / visual / full)

| Section                    | Contents                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| Header                     | Feature name, branch, date, report type                            |
| Executive Summary          | Total tests, passed, failed, skipped, pass rate, duration          |
| Test Results by User Story | Per-viewport status table (Desktop/Tablet/Mobile) for each US      |
| Visual Regression Results  | Per-viewport status table for each screen (if visual tests ran)    |
| Failures                   | Detailed Playwright error messages for failing tests               |
| Traceability Matrix        | Maps every test back to its spec acceptance criterion or edge case |
| Coverage Stats             | N of M acceptance criteria covered, N of M edge cases covered      |
| Environment                | Node.js version, Playwright version, browser, OS, viewports        |

#### Report Sections (unit)

| Section                     | Contents                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| Header                      | Feature name, branch, date, report type                          |
| Executive Summary           | Total suites, total tests, passed, failed, pass rate, coverage % |
| Backend Test Results        | Per-module table: file, test count, Stmts/Branch/Funcs/Lines %   |
| Frontend Test Results       | Per-app table: app name, test count, status                      |
| Traceability: Spec Coverage | Per-US table mapping test files to user story areas              |
| Infrastructure Coverage     | Table mapping test files to cross-cutting concerns               |
| Environment                 | Node.js version, Jest version, Vitest version, TypeScript, OS    |

## Rules

- Always create the `reports/qa/` directory if it doesn't exist.
- Timestamp must be filesystem-safe (no colons).
- Traceability matrix must include ALL spec requirements, marking uncovered ones as NOT COVERED.
- Report type in filename matches the argument: `e2e`, `visual`, `full`, `unit`, or `results` (for
  empty argument).
- For `unit` reports: coverage thresholds are defined in each app's test config (e.g.,
  `jest.config.ts` `coverageThreshold`). Flag any metric below threshold as FAILING.

## Status

### Done

- `unit` argument support: run Jest (backend) and Vitest (frontend) tests, parse coverage output,
  generate unit test report with per-module coverage tables and spec traceability.
- Unit report sections: Executive Summary, Backend Test Results (per-module), Frontend Test Results
  (per-app), Traceability (per-US mapping), Infrastructure Coverage, Environment.
- `e2e` argument support: run Playwright functional tests, parse `playwright-results.json`.
- `visual` argument support: run Playwright visual regression tests.
- `full` argument support: run both e2e + visual, generate combined report.
- Report generation from existing results (empty argument).
- Traceability matrix mapping test names to spec acceptance criteria.
- Filesystem-safe timestamp in report filenames.

### Not Done

- Automatic detection of which spec user stories lack ANY test coverage (currently manual mapping).
- Aggregated cross-report trending (compare pass rates across multiple report runs).
- Integration with CI pipeline (auto-run on PR and post report as PR comment).
- HTML report output format (currently markdown only).
- Per-file unit coverage drill-down for frontend apps (Vitest currently reports pass/fail only, no
  per-file coverage breakdown in report).
