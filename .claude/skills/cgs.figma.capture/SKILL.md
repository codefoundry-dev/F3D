---
name: cgs.figma.capture
description:
  Capture the app's screen states and push them to Figma as design frames. Use when the user wants
  to capture screens or push to Figma.
disable-model-invocation: true
argument-hint: '<figma-url> [screen-filter] [--new] [--viewport=D,M]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Supported arguments:

- **Figma URL** (required, e.g., `https://figma.com/design/abc123/file-name`) -> capture and push to
  Figma
- **Screen filter** (optional) -> capture only matching screens (e.g., `US1`, `US1,US3`,
  `"Empty State"`)
- **`--new`** -> only capture screens not yet present in the Figma file
- **`--viewport=D,M`** -> limit captures to specific viewports (D=desktop, T=tablet, M=mobile)

If no Figma URL is provided, abort with:
`"ERROR: Figma URL is required. Usage: /cgs.figma.capture <figma-url> [options]"`

Multiple arguments can be combined:

```
/cgs.figma.capture https://figma.com/design/abc123/file-name --new
/cgs.figma.capture https://figma.com/design/abc123/file-name "Add Task Modal" --viewport=D,M
```

## Goal

Capture the working app's screen states and push them into a target Figma file as design frames. The
Figma file is the source of truth for existing captures.

The source of truth for screen states is the project's **existing e2e test files**. The skill
discovers helpers, fixtures, and patterns by reading the project's actual test files rather than
hardcoding any project-specific names.

**Pipeline position:**

```
spec.md -> e2e tests -> /cgs.figma.capture -> /cgs.figma.link -> /cgs.figma.visual
```

## Prerequisites

Before generating the `figmaCapture()` helper, **read
[capture-constraints.md](capture-constraints.md)** in this skill's directory. It documents all CSS
workarounds, dimension stamping, and timing constraints. The generated helper MUST implement every
constraint listed there.

## Operating Constraints

1. **ANALYSIS PHASE IS READ-ONLY**: Do not create or modify any files until the user explicitly
   approves the capture plan.
2. **E2E TESTS REQUIRED**: If no e2e tests exist, abort with a clear error directing the user to
   create e2e tests first.
3. **PROJECT-AGNOSTIC**: Discover helpers, fixtures, and patterns from the project's own test files.
4. **FIGMA IS SOURCE OF TRUTH**: Existing captures are determined by querying the Figma file, not
   local files.
5. **NO SPEC.MD WRITES**: This skill never modifies spec.md.
6. **REUSE EXISTING INFRASTRUCTURE**: Same imports, helpers, fixtures as the project's e2e tests.
7. **NO MANUAL DEV SERVER**: Never start the dev server manually (`npm run dev`, `lsof`, etc.).
   Playwright's `webServer` config handles it automatically.

## Execution Steps

### 1. Determine Feature Scope

Determine the current feature context:

1. **Repo root**: `git rev-parse --show-toplevel`
2. **Feature ID**: Derive from the current git branch name (e.g., branch `feature/auth-flow` ->
   feature ID `auth-flow`). Strip common prefixes like `feature/`, `feat/`.
3. **Feature spec**: Look for `specs/{feature-id}/spec.md` relative to repo root
4. **E2e test dir**: `tests/e2e/{feature-id}/`

If the branch name doesn't map to a feature directory, ask the user to specify the feature ID.

### 2. Parse Arguments

Extract from `$ARGUMENTS`:

**Figma URL** (required): Extract `fileKey` and optional `nodeId`.

| URL Pattern                                                | fileKey       | nodeId             |
| ---------------------------------------------------------- | ------------- | ------------------ |
| `figma.com/design/{fileKey}/{fileName}`                    | `{fileKey}`   | --                 |
| `figma.com/design/{fileKey}/{fileName}?node-id={nodeId}`   | `{fileKey}`   | convert `-` to `:` |
| `figma.com/file/{fileKey}/...`                             | `{fileKey}`   | --                 |
| `figma.com/design/{fileKey}/branch/{branchKey}/{fileName}` | `{branchKey}` | --                 |

If no Figma URL found, abort with error.

**Screen filter** (optional): user story or test name substring. Use to recapture specific screens.
**`--new`** (optional): only capture screens without existing Figma frames. **Viewport filter**
(optional): `--viewport=D,M`.

### 3. Discover Screens from E2E Tests

#### 3a. Find test files

Find `*.spec.ts` in `tests/e2e/{feature-id}/`. Exclude `visual-regression.spec.ts`,
`capture-screens.spec.ts`, `figma-visual.spec.ts`.

#### 3b. Analyze test files

For each `test()` block: identify the screen state from setup code before the first `expect()`.

#### 3c. Deduplicate

Group tests sharing the same `beforeEach` + same setup code into one screen. Assign a screen name
from the describe block title + descriptive suffix.

#### 3d. Assign viewports

| Screen Type                      | Viewports | Heuristic                                              |
| -------------------------------- | --------- | ------------------------------------------------------ |
| Fundamental states (empty, list) | D/T/M     | Only app-reset or `seed` preconditions                 |
| Modals/forms                     | D/M       | Setup includes a `click` that opens a modal            |
| Filter/search states             | D         | Setup includes `selectOption`, `fill` on filter inputs |

#### 3e. Apply filters

Match by user story or test name substring. If `--viewport=...` provided, override defaults.

### 4. Scan Existing Figma Frames

Call `get_metadata` with the `fileKey` (and `nodeId` if provided) to retrieve the Figma file's node
tree. Extract all top-level frame names from the response. Frame names follow the convention
`"{Screen Name} - {Viewport}"` (e.g., `"Empty State - Desktop"`, `"Add Task Modal - Mobile"`). Parse
each frame name back to screen name + viewport.

#### 4a. Classify each discovered screen x viewport

Cross-reference discovered screens (from Step 3) against existing Figma frames:

| Status     | Meaning                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| **NEW**    | Discovered from e2e tests but no matching Figma frame                              |
| **EXISTS** | Already present as a frame in the Figma file                                       |
| **STALE**  | Figma frame exists but no matching screen was discovered from e2e tests (orphaned) |

#### 4b. Also check the existing capture script

If `tests/e2e/{feature-id}/capture-screens.spec.ts` exists, read it to understand what screens it
currently generates. This helps detect screens that were previously captured but whose e2e tests
have changed.

#### 4c. Apply `--new` filter

If `$ARGUMENTS` contains `--new`:

- Include only screen x viewport combinations with status **NEW**
- Exclude all **EXISTS** combinations
- If no NEW screens found, report:
  `"All screens already captured. N frames in Figma file. Use a screen filter to recapture specific screens, or run without --new to recapture all."`

### 5. Read Test Infrastructure

Follow imports from e2e test files to discover:

- Playwright config (viewports, base URL)
- Helper functions and their signatures
- Fixture/test data files

### 6. Output Capture Plan (Read-Only)

```
## Screen Capture Plan

**Feature**: {feature-id}
**Figma File**: {fileKey}
**Existing frames**: N frames in Figma file
**Filter**: {--new | screen filter | all}

### Capture Status

| # | Screen | Viewport | Status | Source Test | Preconditions |
|---|--------|----------|--------|------------|---------------|
| 1 | {Screen A} | Desktop | NEW | {test}.spec.ts | {setup} |
| 2 | {Screen A} | Tablet | NEW | {test}.spec.ts | {setup} |
| 3 | {Screen A} | Mobile | NEW | {test}.spec.ts | {setup} |
| 4 | {Screen B} | Desktop | EXISTS | {test}.spec.ts | {setup} |
| 5 | {Screen B} | Mobile | EXISTS | {test}.spec.ts | {setup} |

### Will Capture: M of N total (X new, Y recapture)
### Skipping: K (already in Figma, use filter or remove --new to include)

### Stale Frames (if any)
These exist in Figma but don't match any discovered screen:
- {frame name}
```

Ask user to confirm:

- **"Capture"** -> capture all listed screens (respecting --new filter)
- **"Capture all"** -> ignore --new, capture everything
- **"Adjust"** -> modify the plan
- **"Cancel"** -> abort

### 7. Generate Playwright Capture Script

Generate `tests/e2e/{feature-id}/capture-screens.spec.ts` containing **only the screens to be
captured** (after --new and filter are applied):

- Copy imports from original test files
- Copy setup code from each screen that will be captured
- Replace assertions with `figmaCapture()` calls
- Add viewport-specific `test.describe` blocks with `test.use()`
- If a previous `capture-screens.spec.ts` exists, overwrite it with the new set of screens

### 8. Initialize Figma Captures

For each screen x viewport:

1. Call `generate_figma_design` with `outputMode: "existingFile"` and `fileKey` -> get `captureId`
2. Inject `captureId` values into the capture script
3. The script uses `figmaCapture()` which **MUST implement all constraints from
   [capture-constraints.md](capture-constraints.md)**:

```typescript
async function figmaCapture(page: Page, captureId: string, frameName: string) {
  const endpoint = `https://mcp.figma.com/mcp/capture/${captureId}/submit`;
  try {
    await page.evaluate((name) => {
      document.title = name;
    }, frameName);

    // Resolve CSS variables in <style> tags
    await page.evaluate(() => {
      const rootStyles = getComputedStyle(document.documentElement);
      document.querySelectorAll('style').forEach((styleEl) => {
        styleEl.textContent = styleEl.textContent!.replace(
          /var\(--([^)]+)\)/g,
          (_match, varName) => rootStyles.getPropertyValue('--' + varName).trim() || _match,
        );
      });
    });

    // Resolve CSS variables in inline styles
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        const computed = getComputedStyle(el);
        const inline = (el as HTMLElement).style;
        for (let i = 0; i < inline.length; i++) {
          const prop = inline[i];
          if (inline.getPropertyValue(prop).includes('var(')) {
            inline.setProperty(prop, computed.getPropertyValue(prop));
          }
        }
      });
    });

    // Stamp BOTH width AND height on root containers
    await page.evaluate(() => {
      const vw = window.innerWidth + 'px';
      const vh = window.innerHeight + 'px';
      document.documentElement.style.width = vw;
      document.documentElement.style.maxWidth = vw;
      document.documentElement.style.height = vh;
      document.documentElement.style.maxHeight = vh;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.width = vw;
      document.body.style.maxWidth = vw;
      document.body.style.minWidth = vw;
      document.body.style.height = vh;
      document.body.style.maxHeight = vh;
      document.body.style.overflow = 'hidden';
    });

    // Inline dimensions on flex/grid + convert position:fixed
    await page.evaluate(() => {
      const vw = window.innerWidth + 'px';
      const fullH = Math.max(document.documentElement.scrollHeight, window.innerHeight) + 'px';
      document.querySelectorAll('*').forEach((el) => {
        const computed = getComputedStyle(el);
        const htmlEl = el as HTMLElement;
        if (computed.position === 'fixed') {
          htmlEl.style.width = vw;
          htmlEl.style.height = fullH;
          htmlEl.style.position = 'absolute';
          htmlEl.style.left = '0';
          htmlEl.style.top = '0';
        } else if (
          computed.display === 'flex' ||
          computed.display === 'grid' ||
          computed.maxWidth !== 'none'
        ) {
          htmlEl.style.width = computed.width;
          htmlEl.style.height = computed.height;
        }
      });
    });

    // Inject capture script and trigger
    const response = await page
      .context()
      .request.get('https://mcp.figma.com/mcp/html-to-design/capture.js');
    await page.evaluate(
      (s) => {
        const el = document.createElement('script');
        el.textContent = s;
        document.head.appendChild(el);
      },
      await response.text(),
    );
    await page.waitForTimeout(1000);

    await page.evaluate(
      ({ cId, ep }) => {
        (window as any).figma.captureForDesign({ captureId: cId, endpoint: ep, selector: 'body' });
      },
      { cId: captureId, ep: endpoint },
    );
    await page.waitForTimeout(10_000);
  } catch (e) {
    console.warn(`Figma capture failed for ${captureId}:`, e);
  }
}
```

4. After Playwright run, poll each `captureId` via `generate_figma_design` every 5s up to 10 times.

**Important**: Set `test.describe.configure({ timeout: 60_000 })`.

### 9. Run Playwright Capture Script

**Do NOT manually start the dev server.** Playwright's `webServer` config in `playwright.config.ts`
automatically starts and manages the dev server when running tests. Starting it manually causes
duplicate processes and port conflicts.

```bash
npx playwright test tests/e2e/{feature-id}/capture-screens.spec.ts --project=desktop
```

If tests fail: read error output, fix, retry. After 2 failures per screen, mark FAILED and continue.

### 10. Output Capture Report

```
## Capture Report

**Feature**: {feature-id} | **Figma File**: {fileKey} | **Date**: YYYY-MM-DD

### Captured This Run

| # | Screen | Viewport | Figma | Was |
|---|--------|----------|-------|-----|
| 1 | {Screen} | Desktop | CAPTURED (node-id) | NEW |
| 2 | {Screen} | Mobile | CAPTURED (node-id) | RECAPTURE |

### Previously Captured (unchanged)

| # | Screen | Viewport |
|---|--------|----------|
| 1 | {Screen} | Desktop |

### Stale Frames (orphaned — no matching e2e test screen)

| Frame Name | Suggested Action |
|------------|-----------------|
| {name} | Delete from Figma (screen removed from tests) |

### Summary

**Total screens**: N discovered from e2e tests
**Captured this run**: M (X new + Y recaptured)
**Previously captured (skipped)**: K
**Stale frames**: S

### Next Steps
- To capture remaining screens: `/cgs.figma.capture <figma-url>` (without --new)
- To recapture a specific screen: `/cgs.figma.capture <figma-url> "{Screen Name}"`
- To compare against Figma designs: `/cgs.figma.visual`
- To link screens in spec.md: `/cgs.figma.link <figma-url>`
```

## Reference

### Viewport Dimensions

| Viewport | Shorthand | Width | Height |
| -------- | --------- | ----- | ------ |
| Desktop  | D         | 1440  | 900    |
| Tablet   | T         | 768   | 1024   |
| Mobile   | M         | 375   | 812    |

### Screen Deduplication Heuristics

Same screen if: same `beforeEach` + identical code before first `expect()`. Different screen if:
different routes, different seed data, or different UI interactions.

### Error Handling

| Error                     | Message                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| No Figma URL              | `"ERROR: Figma URL is required. Usage: /cgs.figma.capture <figma-url> [options]"` |
| Feature ID not resolved   | `"ERROR: Could not determine feature ID from branch. Please specify."`            |
| No e2e test files         | `"ERROR: No e2e test files found. Create e2e tests first."`                       |
| No screens match filter   | `"ERROR: No screens match filter '{filter}'."`                                    |
| Playwright config missing | `"WARNING: Using default viewport dimensions."`                                   |
