---
name: cgs.qa.report
description:
  Generate a comprehensive QA report by running all E2E and visual tests, then summarizing results
  into a timestamped markdown report. Use when the user wants to run a full QA pass, generate a test
  report, check feature readiness, create a QA summary, or verify the feature before release.
disable-model-invocation: true
argument-hint: '[--skip-visual] [--story-filter=US1]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Supported arguments:

- **`--skip-visual`** -> skip visual comparison tests (run E2E only)
- **`--story-filter=US1,US2`** -> run tests for specific stories only
- **`--threshold=0.02`** -> override visual diff threshold (default: 2%)

## Goal

Execute a full QA pass for the current feature: run all E2E tests, run visual comparison tests (if
they exist), perform LLM-based visual investigation on mismatches, and compile everything into a
single timestamped QA report saved to `reports/`.

The report follows QA best practices: test environment, scope, pass/fail summary, detailed results
per story, visual analysis findings, risk assessment, and release recommendation.

**Pipeline position:**

```
/cgs.qa.e2e (generate tests) -> /cgs.qa.report (run everything, produce report)
                                      ├── E2E tests
                                      ├── /cgs.figma.visual (pixel diff, no cache)
                                      └── /cgs.qa.visual (LLM investigation of mismatches)
```

## Operating Constraints

1. **RUN EVERYTHING, REPORT ONCE**: Execute all test suites in sequence, collect all results, then
   generate one report.
2. **FRESH VISUAL COMPARISON**: Clear Figma cache before running visual tests so designs are
   re-fetched. This catches Figma changes since last run.
3. **VISUAL TESTS ARE OPTIONAL**: Not all projects have `figma-visual.spec.ts` or Figma integration.
   If visual tests don't exist, skip gracefully and note it in the report.
4. **NO MANUAL DEV SERVER**: Playwright's `webServer` config handles it.
5. **REPORT IS THE DELIVERABLE**: The markdown report in `reports/` is the primary output.
6. **TIMESTAMPS USE ISO FORMAT**: `YYYY-MM-DD_HH-mm` for filenames, `YYYY-MM-DD HH:mm` in report
   body.

## Execution Steps

### 1. Determine Feature Scope

1. **Repo root**: `git rev-parse --show-toplevel`
2. **Feature ID**: Derive from git branch name. Strip prefixes like `feature/`, `feat/`.
3. **Feature spec**: `specs/{feature-id}/spec.md` (optional — report works without it, but enriches
   the report with story context)
4. **E2E test dir**: `tests/e2e/{feature-id}/`
5. **Reports dir**: `reports/` at repo root

If no E2E test directory exists, abort:
`"ERROR: No E2E tests found at tests/e2e/{feature-id}/. Run /cgs.qa.e2e first."`

### 2. Inventory Available Tests

#### 2a. E2E test files

Find all `*.spec.ts` files in `tests/e2e/{feature-id}/`. Categorize:

| Category              | Pattern                       | Purpose                           |
| --------------------- | ----------------------------- | --------------------------------- |
| **Functional E2E**    | `*.spec.ts` (excluding below) | User story acceptance tests       |
| **Visual comparison** | `figma-visual.spec.ts`        | Pixel diff against Figma          |
| **Screen capture**    | `capture-screens.spec.ts`     | Figma capture (not a test — skip) |

Apply `--story-filter` if provided: match test files by story slug.

#### 2b. Detect visual test availability

Check if visual testing is available:

- `tests/e2e/{feature-id}/figma-visual.spec.ts` exists?
- `tests/e2e/helpers/figma-compare.ts` exists?
- `FIGMA_TOKEN` env variable set?
- `--skip-visual` flag provided?

| Condition                                               | Action                      |
| ------------------------------------------------------- | --------------------------- |
| Visual test exists + FIGMA_TOKEN set + no --skip-visual | Run visual tests            |
| Visual test exists but no FIGMA_TOKEN                   | Skip visual, note in report |
| No visual test file                                     | Skip visual, note in report |
| --skip-visual flag                                      | Skip visual, note in report |

#### 2c. Parse spec.md for context (if exists)

Extract user stories, acceptance scenarios, and screens to enrich the report with coverage context.
If spec.md doesn't exist, the report still works — just without story-level context.

### 3. Output Scan Plan

```
## QA Run Plan

**Feature**: {feature-id}
**Branch**: {branch-name}
**Date**: YYYY-MM-DD HH:mm

### Test Inventory

| # | File | Type | Tests | Status |
|---|------|------|-------|--------|
| 1 | user-registration.spec.ts | E2E | ~N | WILL RUN |
| 2 | task-management.spec.ts | E2E | ~N | WILL RUN |
| 3 | figma-visual.spec.ts | Visual | ~N | WILL RUN (cache cleared) |

### Visual Testing
- Figma cache: WILL CLEAR (fresh comparison)
- FIGMA_TOKEN: {SET | NOT SET}
- Visual analysis: {WILL RUN on mismatches | SKIPPED}

### Estimated Run Time: ~{N} minutes
```

Ask user:

- **"Run"** -> execute full QA pass
- **"Cancel"** -> abort

### 4. Clear Figma Cache (if running visual tests)

Before running visual tests, clear the cached Figma image URLs to ensure fresh design exports:

```bash
rm -rf tests/e2e/.figma-cache/
```

This is important because designers may have updated the Figma file since the last comparison. Stale
cache would compare against old design exports and miss changes.

### 5. Run E2E Tests

Run functional E2E tests and capture full output:

```bash
npx playwright test tests/e2e/{feature-id}/ \
  --ignore-pattern="**/capture-screens.spec.ts" \
  --ignore-pattern="**/figma-visual.spec.ts" \
  --reporter=json \
  --output=tests/e2e/{feature-id}/.qa-results/
```

If `--story-filter` is set, run only matching test files.

Capture from the JSON reporter output:

- Per-test pass/fail status, duration, and error messages
- Per-file summary (tests passed, failed, skipped)
- Overall pass rate
- Retry information (flaky test detection)
- Full error output and stack traces for failures

If the JSON reporter is not available, parse the terminal output for pass/fail counts and error
messages.

### 6. Run Visual Comparison Tests (if available)

```bash
FIGMA_TOKEN=$FIGMA_TOKEN npx playwright test tests/e2e/{feature-id}/figma-visual.spec.ts \
  --reporter=json
```

Capture:

- Per-screen diff percentages (from `figma-diff` annotations)
- Pass/fail per screen per viewport
- Any API errors or skipped tests

### 7. Visual Investigation (if mismatches found)

For any visual test that **failed** (diff exceeded threshold):

1. Collect the three images (actual, figma, diff) — either from the test artifacts or by re-running
   `compareFigmaToPage()` with image saving
2. Read all three images using the Read tool
3. Perform the LLM visual investigation as defined in `cgs.qa.visual`:
   - Systematic comparison: layout, spacing, typography, colors, components
   - Generate findings with severity, location, expected vs actual, likely cause
4. Include findings in the report under the relevant screen section

### 8. Generate QA Report

Create the report at: `reports/{feature-id}-qa-{YYYY-MM-DD_HH-mm}.md`

Ensure the `reports/` directory exists first.

#### Report Structure

```markdown
# QA Report: {Feature Title}

**Feature**: {feature-id} **Branch**: {branch-name} **Date**: YYYY-MM-DD HH:mm **Tester**: Claude
(automated) **Spec**: specs/{feature-id}/spec.md

---

## Executive Summary

| Metric              | Value                            |
| ------------------- | -------------------------------- | ---- | -------- |
| **Overall Status**  | {PASS                            | FAIL | PARTIAL} |
| **E2E Tests**       | {X}/{Y} passed ({Z}%)            |
| **Visual Tests**    | {X}/{Y} passed ({Z}%) or N/A     |
| **Visual Findings** | {N} (X critical, Y major) or N/A |
| **Flaky Tests**     | {N} (passed on retry)            |
| **Duration**        | {total time}                     |

### Release Recommendation

{One of:}

- **READY**: All tests pass, no critical visual findings. Feature is ready for release.
- **CONDITIONAL**: All E2E tests pass but visual discrepancies exist. Review visual findings before
  release.
- **NOT READY**: {N} E2E test(s) failing. Must fix before release.
- **BLOCKED**: Tests could not run ({reason}).

---

## Test Environment

| Property    | Value                      |
| ----------- | -------------------------- |
| Node.js     | {version}                  |
| Playwright  | {version}                  |
| Browser     | {browser from config}      |
| Base URL    | {from playwright config}   |
| Viewports   | {list from config}         |
| OS          | {platform}                 |
| Figma Cache | Cleared (fresh comparison) |

---

## E2E Test Results

### Summary

| Status                  | Count |
| ----------------------- | ----- |
| Passed                  | {N}   |
| Failed                  | {N}   |
| Skipped                 | {N}   |
| Flaky (passed on retry) | {N}   |

### Results by User Story

#### US1 — {Story Title} ({user-registration.spec.ts})

| #   | Test                                           | Status | Duration | Notes             |
| --- | ---------------------------------------------- | ------ | -------- | ----------------- |
| 1   | should redirect to dashboard after valid login | PASS   | 1.2s     |                   |
| 2   | should show error for invalid credentials      | PASS   | 0.8s     |                   |
| 3   | should handle empty form submission            | FAIL   | 2.1s     | See details below |

{Repeat for each story}

### Failed Test Details

#### {Test Name}

- **File**: {file}:{line}
- **Story**: US{N} — {Title}
- **Error**:
```

{Error message and relevant stack trace}

````
- **Expected**: {what should have happened}
- **Actual**: {what happened}
- **Suggested Fix**: {brief analysis of likely cause}

{Repeat for each failed test}

### Flaky Tests

| # | Test | File | Retries | Notes |
|---|------|------|---------|-------|
{List tests that failed on first run but passed on retry}

---

## Visual Comparison Results

{If visual tests were not available or skipped:}
> Visual comparison was not performed. Reason: {no figma-visual.spec.ts | FIGMA_TOKEN not set | --skip-visual flag}

{If visual tests ran:}

### Summary

| Status | Count |
|--------|-------|
| Passed (within threshold) | {N} |
| Failed (above {threshold}% threshold) | {N} |
| Skipped | {N} |

### Results by Screen

| # | Screen | Viewport | Diff % | Threshold | Status |
|---|--------|----------|--------|-----------|--------|
| 1 | Empty State | Desktop | 0.3% | 2.0% | PASS |
| 2 | Task List | Desktop | 4.2% | 2.0% | FAIL |
| 3 | Task List | Mobile | 8.1% | 2.0% | FAIL |

### Visual Analysis — Mismatched Screens

{For each failed visual test, include the LLM investigation findings from Step 7}

#### {Screen Name} — {Viewport} ({diff}% pixel difference)

**Findings**:

| # | Category | Description | Severity | Expected (Figma) | Actual (Rendered) |
|---|----------|-------------|----------|-------------------|-------------------|
| 1 | Typography | Heading font size | Major | 32px, weight 700 | 28px, weight 600 |
| 2 | Spacing | Card grid gap | Major | 24px | 16px |
| 3 | Colors | CTA button background | Minor | #2563EB | #3B82F6 |

{Repeat for each mismatched screen}

---

## Coverage Analysis

{If spec.md exists:}

### Story Coverage

| Story | Priority | E2E Tests | Visual Tests | Status |
|-------|----------|-----------|--------------|--------|
| US1 — {Title} | P1 | {N} tests | {N} screens | {COVERED | PARTIAL | MISSING} |
| US2 — {Title} | P2 | {N} tests | {N} screens | {COVERED | PARTIAL | MISSING} |

### Acceptance Scenario Coverage

| Story | Total Scenarios | Tests Mapped | Coverage |
|-------|----------------|--------------|----------|
| US1 | {N} | {M} | {percentage}% |
| US2 | {N} | {M} | {percentage}% |

### Gaps

{List any acceptance scenarios without corresponding tests, or stories without test files}

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| {e.g., "Flaky test in auth flow"} | {High/Med/Low} | {High/Med/Low} | {e.g., "Add explicit wait for token refresh"} |
| {e.g., "Visual diff in mobile layout"} | {High/Med/Low} | {High/Med/Low} | {e.g., "Review with designer, may be intentional"} |

---

## Recommendations

{Prioritized list of actions based on test results}

1. **[Critical]** {Fix failing test / fix visual mismatch}
2. **[High]** {Address flaky test}
3. **[Medium]** {Review visual discrepancy with designer}
4. **[Low]** {Add missing test coverage}

---

## Appendix

### Test Files

| File | Tests | Passed | Failed | Skipped |
|------|-------|--------|--------|---------|
{Per-file breakdown}

### Run Command

```bash
# E2E
npx playwright test tests/e2e/{feature-id}/ --ignore-pattern="**/capture-screens.spec.ts" --ignore-pattern="**/figma-visual.spec.ts"

# Visual
FIGMA_TOKEN=$FIGMA_TOKEN npx playwright test tests/e2e/{feature-id}/figma-visual.spec.ts
````

```

### 9. Save Report

1. Ensure `reports/` directory exists: `mkdir -p reports/`
2. Write the report to `reports/{feature-id}-qa-{YYYY-MM-DD_HH-mm}.md`
3. Output the report path and executive summary to the user

```

## QA Report Generated

**Report**: reports/{feature-id}-qa-{YYYY-MM-DD_HH-mm}.md

### Executive Summary

- **Status**: {PASS | FAIL | PARTIAL}
- **E2E**: {X}/{Y} passed
- **Visual**: {X}/{Y} passed (or N/A)
- **Recommendation**: {READY | CONDITIONAL | NOT READY | BLOCKED}

### Next Steps

- Review full report: `cat reports/{feature-id}-qa-{YYYY-MM-DD_HH-mm}.md`
- Fix failures and re-run: `/cgs.qa.report`
- Generate tests for uncovered stories: `/cgs.qa.e2e US{N}`
- Re-capture Figma screens: `/cgs.figma.capture <figma-url>`

```

## Reference

### Report Filename Convention

`{feature-id}-qa-{YYYY-MM-DD_HH-mm}.md`

Examples:
- `auth-flow-qa-2026-03-12_15-30.md`
- `task-board-qa-2026-03-12_16-45.md`

### Overall Status Decision Tree

```

Any E2E test failed? → Yes: NOT READY → No: Any visual test failed? → Yes: Any critical visual
finding? → Yes: NOT READY → No: CONDITIONAL → No visual tests or all passed: PASS Tests couldn't
run? → BLOCKED

```

### Release Recommendation Guide

| Status | Meaning | Action |
|--------|---------|--------|
| **READY** | All tests pass, visuals match | Ship it |
| **CONDITIONAL** | E2E pass, visual discrepancies exist | Review visual findings with designer, may be intentional |
| **NOT READY** | E2E failures or critical visual issues | Fix and re-run `/cgs.qa.report` |
| **BLOCKED** | Tests can't execute | Fix environment / config issue |

### Error Handling

| Error | Message |
|-------|---------|
| No E2E test directory | `"ERROR: No E2E tests found at tests/e2e/{feature-id}/. Run /cgs.qa.e2e first."` |
| Feature ID not resolved | `"ERROR: Could not determine feature ID from branch. Please specify."` |
| Playwright not installed | `"ERROR: Playwright is not installed. Run npm install."` |
| All tests skipped | `"WARNING: All tests were skipped. Check test configuration."` |
| Reports dir write failure | `"ERROR: Cannot write to reports/. Check permissions."` |
```
