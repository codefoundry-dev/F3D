---
name: cgs.figma.visual
description:
  Run pixelmatch-based visual comparison of rendered UI against Figma designs. Use when comparing
  implementation to Figma, running visual audits, or checking design fidelity.
disable-model-invocation: true
argument-hint: '[screen-filter] [--threshold=0.05]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Supported arguments:

- **Empty** -> compare all screens with Figma Node values in spec.md
- **Screen filter** -> screen name substring or user story filter (e.g., `US1`, `"Empty State"`)
- **`--threshold=0.05`** -> override default 2% diff threshold (value is a ratio 0-1)

## Goal

Generate and run a Playwright test suite that compares live rendered pages against Figma design
frames using pixel-level comparison (pixelmatch). Each screen in `spec.md` with a `Figma Node` value
gets a visual comparison test.

**Pipeline position:**

```
spec.md -> /cgs.figma.capture -> /cgs.figma.link -> /cgs.figma.visual
```

## Operating Constraints

1. **ANALYSIS PHASE IS READ-ONLY**: Output a test plan before creating files.
2. **SPEC.MD IS THE SOURCE OF TRUTH**: Screen names, Figma Nodes, viewports, and preconditions from
   `## Screens`.
3. **FIGMA_TOKEN REQUIRED**: Tests use `test.skip(!process.env.FIGMA_TOKEN)` to gracefully skip.
4. **2% DEFAULT THRESHOLD**: `maxDiffRatio` is `0.02`, NOT the 15% helper default. Stricter for
   design fidelity.
5. **PER-VIEWPORT NODE IDS**: Each screen may have different Figma nodes per viewport. Discover via
   `get_metadata`.
6. **REUSE EXISTING INFRASTRUCTURE**: Same helpers, fixtures, and patterns as the project's e2e
   tests.

## Execution Steps

### 1. Determine Feature Scope

Determine the current feature context:

1. **Repo root**: `git rev-parse --show-toplevel`
2. **Feature ID**: Derive from the current git branch name. Strip prefixes like `feature/`.
3. **Feature spec** (`FEATURE_SPEC`): Look for `specs/{feature-id}/spec.md` relative to repo root

If the branch name doesn't map to a feature directory, ask the user to specify the feature ID.

### 2. Parse Arguments

- **Screen filter** (optional): story or screen name substring
- **Threshold** (optional): `--threshold=0.05` overrides 2% default

### 3. Read Screens from spec.md

#### 3a. Parse Screens table

Extract: `Screen`, `Story`, `Route`, `Figma Node`, `Viewports`. Filter to screens with non-empty
`Figma Node`.

No Figma nodes: `"ERROR: No screens have Figma Node values. Run /cgs.figma.link first."`

#### 3b. Parse preconditions

From `### Screen Preconditions`: `seed`, `click`, `select`, `type` actions.

#### 3c. Apply filters

Match by story or screen name substring.

#### 3d. Extract Design References

Parse `## Design References` for `figmaFileKey`.

### 4. Discover Per-Viewport Figma Node IDs

Call `get_metadata(figmaFileKey, nodeId: "0:1")` to discover all top-level frames.

For each screen:

1. Look for frames named `"{Screen Name} - Desktop"`, `"{Screen Name} - Tablet"`,
   `"{Screen Name} - Mobile"`
2. If per-viewport frames exist, map each viewport to its specific node ID
3. If not, use the base `Figma Node` from spec.md for all viewports

Build `NODE_IDS` mapping:

```typescript
const NODE_IDS = {
  screenKey: { desktop: 'X:Y', tablet: 'X:Y', mobile: 'X:Y' },
} as Record<string, Record<string, string>>;
```

### 5. Check Dependencies

#### 5a. Check for `figma-compare.ts`

Look for `tests/e2e/helpers/figma-compare.ts`. If missing, generate it with:

- `compareFigmaToPage()` function
- File-based caching (12h TTL) shared across Playwright workers
- File-based locking to prevent duplicate Figma API calls
- Rate limit retry (429 with exponential backoff up to 6 retries)
- `pixelmatch` comparison with configurable thresholds
- Nearest-neighbor resize for dimension mismatches
- `FigmaCompareResult` and `FigmaCompareOptions` interfaces

Full implementation template:

```typescript
import type { Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIGMA_API = 'https://api.figma.com/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '.figma-cache');

export interface FigmaCompareResult {
  pass: boolean;
  diffRatio: number;
  diffPixels: number;
  totalPixels: number;
  diffPng: PNG | null;
}

export interface FigmaCompareOptions {
  /** Max ratio of differing pixels (0-1). Default: 0.15 (15%) */
  maxDiffRatio?: number;
  /** Per-pixel color distance threshold (0-1). Default: 0.3 */
  pixelThreshold?: number;
  /** Figma export scale. Default: 1 */
  scale?: number;
}

function getCachePath(cacheKey: string): string {
  return path.join(CACHE_DIR, `${cacheKey.replace(/[:/]/g, '_')}.json`);
}

function readCache(cacheKey: string): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(getCachePath(cacheKey), 'utf-8'));
    if (Date.now() - data.timestamp < 12 * 60 * 60 * 1000) return data.url;
  } catch {
    /* miss */
  }
  return null;
}

function writeCache(cacheKey: string, url: string): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(getCachePath(cacheKey), JSON.stringify({ url, timestamp: Date.now() }));
}

function getLockPath(cacheKey: string): string {
  return path.join(CACHE_DIR, `${cacheKey.replace(/[:/]/g, '_')}.lock`);
}

async function acquireLock(cacheKey: string, timeoutMs = 50000): Promise<boolean> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const lockPath = getLockPath(cacheKey);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return true;
    } catch {
      await sleep(500);
      if (readCache(cacheKey)) return false;
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 45000) fs.unlinkSync(lockPath);
      } catch {
        /* removed */
      }
    }
  }
  return false;
}

function releaseLock(cacheKey: string): void {
  try {
    fs.unlinkSync(getLockPath(cacheKey));
  } catch {
    /* gone */
  }
}

async function getFigmaImageUrl(fileKey: string, nodeId: string, scale: number): Promise<string> {
  const cacheKey = `${fileKey}:${nodeId}:${scale}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;
  const gotLock = await acquireLock(cacheKey);
  const cachedAfterLock = readCache(cacheKey);
  if (cachedAfterLock) {
    if (gotLock) releaseLock(cacheKey);
    return cachedAfterLock;
  }

  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new Error('FIGMA_TOKEN env variable is required');
  const ids = encodeURIComponent(nodeId);
  const endpoint = `${FIGMA_API}/images/${fileKey}?ids=${ids}&format=png&scale=${scale}`;

  try {
    let res: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) {
        const url = readCache(cacheKey);
        if (url) return url;
        await sleep(Math.min(1000 * 2 ** attempt, 15000));
      }
      res = await fetch(endpoint, { headers: { 'X-Figma-Token': token } });
      if (res.status !== 429) break;
    }
    if (!res!.ok) throw new Error(`Figma API ${res!.status}: ${await res!.text()}`);
    const body = (await res!.json()) as { images: Record<string, string | null> };
    const url = body.images[nodeId];
    if (!url) throw new Error(`Figma returned no image for node ${nodeId}`);
    writeCache(cacheKey, url);
    return url;
  } finally {
    if (gotLock) releaseLock(cacheKey);
  }
}

async function fetchPng(url: string): Promise<PNG> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
}

function resizePng(src: PNG, width: number, height: number): PNG {
  if (src.width === width && src.height === height) return src;
  const dst = new PNG({ width, height });
  const xR = src.width / width,
    yR = src.height / height;
  for (let y = 0; y < height; y++) {
    const srcY = Math.floor(y * yR);
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor(x * xR);
      const si = (srcY * src.width + srcX) * 4,
        di = (y * width + x) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return dst;
}

export async function compareFigmaToPage(
  page: Page,
  fileKey: string,
  nodeId: string,
  options: FigmaCompareOptions = {},
): Promise<FigmaCompareResult> {
  const { maxDiffRatio = 0.15, pixelThreshold = 0.3, scale = 1 } = options;
  const [screenshotBuf, figmaUrl] = await Promise.all([
    page.screenshot({ scale: 'css' }),
    getFigmaImageUrl(fileKey, nodeId, scale),
  ]);
  const actual = PNG.sync.read(screenshotBuf);
  let expected = await fetchPng(figmaUrl);
  if (expected.width !== actual.width || expected.height !== actual.height)
    expected = resizePng(expected, actual.width, actual.height);
  const { width, height } = actual;
  const diff = new PNG({ width, height });
  const totalPixels = width * height;
  const diffPixels = pixelmatch(actual.data, expected.data, diff.data, width, height, {
    threshold: pixelThreshold,
  });
  const diffRatio = diffPixels / totalPixels;
  return {
    pass: diffRatio <= maxDiffRatio,
    diffRatio,
    diffPixels,
    totalPixels,
    diffPng: diffRatio > 0 ? diff : null,
  };
}
```

#### 5b. Check npm dependencies

Verify `pixelmatch` and `pngjs` in devDependencies. If missing:

```bash
npm install --save-dev pixelmatch pngjs @types/pngjs
```

### 6. Read Test Infrastructure

Follow imports from existing e2e tests: helpers, fixtures, patterns.

### 7. Output Test Plan (Read-Only)

```
## Visual Comparison Plan

**Feature**: {feature-id} | **Figma File**: {fileKey} | **Threshold**: {N}%

### Comparison Matrix

| # | Screen | Viewport | Figma Node | Preconditions |
|---|--------|----------|------------|---------------|

### Dependencies
- figma-compare.ts: {EXISTS | WILL GENERATE}
- pixelmatch/pngjs: {INSTALLED | WILL INSTALL}
- FIGMA_TOKEN: {SET | NOT SET}
```

Ask user: **"Run"**, **"Adjust"**, or **"Cancel"**.

### 8. Generate Visual Comparison Test

Generate `tests/e2e/{feature-id}/figma-visual.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { compareFigmaToPage } from "../helpers/figma-compare";
// ... project-specific helper/fixture imports ...

const FILE_KEY = "{figmaFileKey}";
const THRESHOLD = 0.02; // 2% default, override with --threshold

const NODE_IDS = {
  screenKey: { desktop: "X:Y", tablet: "X:Y", mobile: "X:Y" },
} as Record<string, Record<string, string>>;

test.skip(!process.env.FIGMA_TOKEN, "FIGMA_TOKEN not set");

test.describe("Figma Visual Comparison - {Feature Title}", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // ... common setup ...
  });

  function assertFigmaMatch(result: Awaited<ReturnType<typeof compareFigmaToPage>>) {
    const pct = (result.diffRatio * 100).toFixed(2);
    console.log(`  Figma diff: ${pct}% (${result.diffPixels}/${result.totalPixels} pixels)`);
    test.info().annotations.push({ type: "figma-diff", description: `${pct}% (${result.diffPixels}/${result.totalPixels}px)` });
    expect(result.diffRatio, `${pct}% pixels differ`).toBeLessThanOrEqual(THRESHOLD);
  }

  test("{Screen Name} matches Figma", async ({ page }, testInfo) => {
    const nodeId = NODE_IDS.{screenKey}[testInfo.project.name];
    test.skip(!nodeId, `No Figma node for ${testInfo.project.name}`);
    // ... screen-specific preconditions ...
    assertFigmaMatch(await compareFigmaToPage(page, FILE_KEY, nodeId, { maxDiffRatio: THRESHOLD }));
  });
});
```

**Key design decisions:**

- **2% threshold** (`0.02`) passed to both `expect` and `compareFigmaToPage`
- **Per-viewport NODE_IDS**: `testInfo.project.name` resolves to "desktop", "tablet", "mobile"
- **`test.skip`** for missing viewports and missing `FIGMA_TOKEN`
- **Serial mode** prevents Figma API rate limits
- **60s timeout** for API calls + image downloads

### 9. Run Tests

```bash
FIGMA_TOKEN=$FIGMA_TOKEN npx playwright test tests/e2e/{feature-id}/figma-visual.spec.ts
```

For API failures: clear cache (`rm -rf tests/e2e/.figma-cache/`) and retry.

### 10. Output Report

```
## Visual Comparison Report

**Feature**: {feature-id} | **Threshold**: {N}% | **Date**: YYYY-MM-DD

| # | Screen | Viewport | Diff % | Status |
|---|--------|----------|--------|--------|

**Passed**: M/N | **Failed**: K | **Skipped**: J

### Next Steps
- Adjust threshold: `/cgs.figma.visual --threshold=0.05`
- Re-capture: `/cgs.figma.capture {Figma URL}`
```

## Reference

### Viewport Dimensions

| Viewport | Shorthand | Width | Height | Playwright Project |
| -------- | --------- | ----- | ------ | ------------------ |
| Desktop  | D         | 1440  | 900    | desktop            |
| Tablet   | T         | 768   | 1024   | tablet             |
| Mobile   | M         | 375   | 812    | mobile             |

### Precondition-to-Code Mapping

| Precondition                        | Code                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `seed: "{dataset}"`                 | `await seedData(page, FIXTURE_DATA);` (use project's seed helper)       |
| `click: "{button-label}"`           | `await page.getByRole('button', { name: '{button-label}' }).click();`   |
| `select: "{selector}" -> "{value}"` | `await page.selectOption('{selector}', '{value}');` (or project helper) |
| `type: "{selector}" -> "{value}"`   | `await page.fill('{selector}', '{value}');`                             |

Always prefer project helper functions over raw Playwright commands.

### Error Handling

| Error                    | Message                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| Feature ID not resolved  | `"ERROR: Could not determine feature ID from branch. Please specify."` |
| No Screens section       | `"ERROR: No ## Screens section. Run /cgs.figma.link first."`           |
| No Figma nodes           | `"ERROR: No Figma Node values. Run /cgs.figma.link first."`            |
| FIGMA_TOKEN not set      | `"WARNING: Tests will be skipped."`                                    |
| figma-compare.ts missing | Generate automatically (Step 5a)                                       |
| pixelmatch not installed | Install automatically (Step 5b)                                        |
