---
description:
  Run a 3-tier visual audit comparing rendered UI against Figma designs, using progressive cost
  escalation.
---

## User Input

```text
$ARGUMENTS
```

## Argument Parsing

- If user input is empty → test **all screens** from figma-screens.json
- If user input is a quoted string (e.g., `"Empty State"`) → filter by screen name (substring match)
- If user input matches `US\d+` pattern → filter by user story
- If user input is `update` → update Playwright snapshot baselines (`--update-snapshots`)

## Execution

### Step 1: Discover feature

Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` to get `FEATURE_DIR`. If the
script fails, fall back to auto-detecting:

```bash
FEATURE_DIR=$(ls specs/ | grep -E '^[0-9]{3}-' | head -1)
```

### Step 2: Load figma-screens.json

Load `specs/{feature-id}/figma-screens.json`. If the file doesn't exist, abort with: "ERROR: No
figma-screens.json found. Run `/qa.screens` first."

### Step 3: Auto-detect tier availability

| Condition                          | Tiers Enabled                          |
| ---------------------------------- | -------------------------------------- |
| Figma keys populated on any screen | Tiers 1 + 2 + 3                        |
| No Figma keys                      | Tier 1 only (pure snapshot regression) |

### Step 4: Generate or run visual-regression.spec.ts

If `visual-regression.spec.ts` doesn't exist in `tests/e2e/{feature}/`, generate it from
figma-screens.json.

Each screen becomes a test block with precondition translation:

| Precondition Type | Generated Playwright Code                                           |
| ----------------- | ------------------------------------------------------------------- |
| `seed`            | `await seedTasks(page, DEFAULT_TASKS)`                              |
| `click`           | `await page.getByRole('button', { name: '{target}' }).click()`      |
| `select`          | `await page.locator('{target}').selectOption({ label: '{value}' })` |
| `navigate`        | `await page.goto('{target}')`                                       |
| `type`            | `await page.locator('{target}').fill('{value}')`                    |

If it already exists, run it as-is (no regeneration).

### Step 5: Execute 3-tier testing

#### Tier 1 — Playwright pixel-diff (Always, Free)

Run `toHaveScreenshot()` for each screen at configured viewports.

- First run creates baseline screenshots (tests "fail" to establish baselines), then re-run to
  verify.

#### Tier 2 — Figma property comparison (If Figma keys exist, Low cost)

For screens with populated Figma keys, use `get_design_context` (text only) to extract design
properties and compare:

| Property             | Tolerance                             |
| -------------------- | ------------------------------------- |
| Colors               | Exact match (after hex normalization) |
| Font sizes           | ±1px                                  |
| Spacing / dimensions | ±2px                                  |
| Font weight          | Exact (400=regular, 700=bold)         |
| Font family          | Case-insensitive substring            |

**Tier 2 is never skipped** — you cannot jump directly to Tier 3.

#### Tier 3 — LLM screenshot comparison (Only for Tier 2 failures, High cost)

For screens that fail Tier 2, use `get_screenshot` to get the Figma screenshot and compare visually
with the live app screenshot.

- Batch 2-3 screens per LLM call to reduce token overhead.

### Step 6: Report results

Present tier-by-tier results for each screen.

## Viewport Reference

| Name    | Size       | Mobile |
| ------- | ---------- | ------ |
| Desktop | 1440 × 900 | No     |
| Tablet  | 768 × 1024 | No     |
| Mobile  | 375 × 812  | Yes    |

## Rules

- Requires `figma-screens.json` — run `/qa.screens` first.
- First run creates baseline screenshots; this is expected behavior, not a failure.
- Tier 2 must run before Tier 3 — never skip directly to Tier 3.
- Tier 3 batches screens to reduce cost.
- If `visual-regression.spec.ts` already exists, run it as-is without regeneration.
