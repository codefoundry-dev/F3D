---
name: cgs.qa.visual
description:
  Deep visual analysis of Figma-vs-implementation mismatches. Runs after /cgs.figma.visual and uses
  LLM vision to describe exactly what differs between the Figma design and the rendered UI. Use when
  the user wants to analyze visual differences, investigate design mismatches, audit design
  fidelity, or understand why a visual comparison failed.
disable-model-invocation: true
argument-hint: '[screen-filter] [--threshold=0.02] [--save-report]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Supported arguments:

- **Screen filter** (optional) -> analyze only matching screens (e.g., `US1`, `"Empty State"`)
- **`--threshold=0.02`** -> override the diff threshold that triggers investigation (default: 2%)
- **`--save-report`** -> save the analysis report to `specs/{feature-id}/visual-analysis.md`

## Goal

Perform deep LLM-powered visual analysis on screens where the rendered UI diverges from the Figma
design beyond an acceptable threshold. While `/cgs.figma.visual` tells you **how much** differs
(pixel percentage), this skill tells you **what exactly** differs — colors, spacing, typography,
missing elements, layout shifts, alignment issues.

**Pipeline position:**

```
/cgs.figma.capture -> /cgs.figma.link -> /cgs.figma.visual (pixel diff) -> /cgs.qa.visual (LLM investigation)
```

## Operating Constraints

1. **DEPENDS ON cgs.figma.visual**: This skill reads the output from `/cgs.figma.visual` or runs the
   comparison itself. It does not replace pixel comparison — it enriches it.
2. **FIGMA_TOKEN REQUIRED**: Needs access to the Figma API to export design frames as images.
3. **LLM VISION ANALYSIS**: Uses your own multimodal capabilities to compare screenshots side by
   side. You will read the actual image files.
4. **ANALYSIS PHASE IS READ-ONLY**: Output a scan plan before running comparisons.
5. **ACTIONABLE OUTPUT**: Every finding must include what's wrong, where, and what the expected
   value should be (from Figma).
6. **NO CODE CHANGES**: This skill investigates and reports. It does not fix the code.

## Execution Steps

### 1. Determine Feature Scope

1. **Repo root**: `git rev-parse --show-toplevel`
2. **Feature ID**: Derive from git branch name. Strip prefixes like `feature/`, `feat/`.
3. **Feature spec**: `specs/{feature-id}/spec.md`
4. **Test dir**: `tests/e2e/{feature-id}/`

If the branch name doesn't map to a feature directory, ask the user to specify the feature ID.

### 2. Parse Arguments

- **Screen filter** (optional): story or screen name substring
- **Threshold** (optional): `--threshold=0.05` overrides 2% default
- **Save report** (optional): `--save-report` writes markdown report to specs dir

### 3. Check for Existing Visual Comparison Results

#### 3a. Look for previous figma-visual test results

Check for Playwright test results from `cgs.figma.visual`:

- `tests/e2e/{feature-id}/figma-visual.spec.ts` — the test file
- Playwright HTML report or JSON results
- Console output annotations with `figma-diff` type

#### 3b. If no previous results, run the comparison

If `figma-visual.spec.ts` doesn't exist or hasn't been run recently:

1. Inform the user:
   `"No recent visual comparison results found. Running /cgs.figma.visual first..."`
2. Execute the `cgs.figma.visual` workflow (Steps 1-9 from that skill) to generate pixel diff
   results
3. Collect the results before proceeding

### 4. Identify Mismatched Screens

From the visual comparison results, identify screens that **exceed the threshold**:

| Diff % vs Threshold                    | Action                                |
| -------------------------------------- | ------------------------------------- |
| `diffRatio <= threshold`               | PASS — skip (no investigation needed) |
| `diffRatio > threshold`                | FAIL — queue for LLM investigation    |
| Test skipped (no FIGMA_TOKEN, no node) | SKIP — report as not analyzed         |

Build a list of failed screens with their:

- Screen name and viewport
- Diff ratio (percentage)
- Figma node ID
- Route and preconditions (from spec.md)

### 5. Output Scan Plan

```
## Visual Analysis Plan

**Feature**: {feature-id}
**Threshold**: {N}% (screens above this get investigated)
**Figma File**: {fileKey}

### Screens to Investigate

| # | Screen | Viewport | Diff % | Figma Node | Status |
|---|--------|----------|--------|------------|--------|
| 1 | {Screen A} | Desktop | 4.2% | 12:34 | WILL ANALYZE |
| 2 | {Screen A} | Mobile | 8.1% | 12:56 | WILL ANALYZE |

### Screens Passing (skipped)

| # | Screen | Viewport | Diff % |
|---|--------|----------|--------|
| 1 | {Screen B} | Desktop | 0.3% |

### Total: N screens to analyze, M passing, K skipped
```

Ask user:

- **"Analyze"** -> proceed with investigation
- **"Analyze all"** -> investigate all screens, including passing ones
- **"Cancel"** -> abort

### 6. Capture Comparison Images

For each screen to investigate, collect three images:

#### 6a. Rendered UI screenshot

Take a fresh screenshot of the rendered page at the correct viewport:

```typescript
// Navigate to screen with preconditions
await page.goto(route);
// Apply preconditions (seed, click, etc.)
// Screenshot
const screenshot = await page.screenshot({ scale: 'css', path: screenshotPath });
```

Save to: `tests/e2e/{feature-id}/.visual-analysis/{screen-slug}-{viewport}-actual.png`

#### 6b. Figma design export

Fetch the Figma frame as a PNG via the Figma API:

```typescript
const figmaUrl = await getFigmaImageUrl(fileKey, nodeId, scale);
// Download and save
```

Save to: `tests/e2e/{feature-id}/.visual-analysis/{screen-slug}-{viewport}-figma.png`

#### 6c. Diff image

Generate the pixelmatch diff image highlighting the differing pixels:

```typescript
const diffPng = result.diffPng; // from compareFigmaToPage()
// Save diff PNG
```

Save to: `tests/e2e/{feature-id}/.visual-analysis/{screen-slug}-{viewport}-diff.png`

### 7. LLM Visual Investigation

For each mismatched screen, perform a deep visual analysis by reading the images. This is the core
value of this skill — you are the investigator.

#### 7a. Read and compare images

Read all three images (actual, figma, diff) for the screen using the Read tool. The diff image
highlights exactly where pixels differ in red/magenta, which helps focus your investigation.

#### 7b. Systematic comparison checklist

For each screen, analyze these categories:

**Layout & Structure:**

- Overall page structure and section arrangement
- Missing or extra elements
- Element ordering differences
- Container boundaries and nesting

**Spacing & Alignment:**

- Margins between sections
- Padding within containers
- Vertical/horizontal alignment of elements
- Grid or flex layout discrepancies

**Typography:**

- Font size differences
- Font weight (bold vs regular)
- Line height / letter spacing
- Text content mismatches (typos, truncation)
- Text color differences

**Colors & Backgrounds:**

- Background colors of sections, cards, buttons
- Text colors
- Border colors
- Hover/active state colors (if captured)
- Gradient or shadow differences

**Components:**

- Button styles (size, border-radius, padding)
- Input field styles
- Icon presence, size, and positioning
- Badge/tag/chip styling
- Card/panel borders and shadows

**Responsive (viewport-specific):**

- Elements that should hide/show at this viewport
- Column count changes
- Navigation mode (hamburger vs full)
- Stack vs horizontal layout

#### 7c. Generate findings

For each difference found, document:

```
**Finding {N}**: {Category} — {Brief description}
- **Location**: {Where on the page — e.g., "Header navigation, right side"}
- **Expected (Figma)**: {What the Figma design shows — specific values when possible}
- **Actual (Rendered)**: {What the rendered UI shows}
- **Severity**: {Critical | Major | Minor | Cosmetic}
- **Likely Cause**: {Best guess — e.g., "Missing CSS class", "Wrong color variable", "Padding override"}
```

Severity guide: | Severity | Description | |----------|-------------| | **Critical** | Missing
elements, broken layout, completely wrong colors | | **Major** | Noticeable spacing/size
differences, wrong font weight, misaligned elements | | **Minor** | Slight color variations, 1-2px
spacing differences, subtle font differences | | **Cosmetic** | Sub-pixel rendering, anti-aliasing,
browser-specific rendering |

### 8. Output Analysis Report

```
## Visual Analysis Report

**Feature**: {feature-id} | **Date**: YYYY-MM-DD | **Threshold**: {N}%

---

### {Screen Name} — {Viewport} ({diff}% pixel difference)

**Images**: [actual](.visual-analysis/{slug}-actual.png) | [figma](.visual-analysis/{slug}-figma.png) | [diff](.visual-analysis/{slug}-diff.png)

#### Findings

**Finding 1**: Typography — Heading font size mismatch
- **Location**: Hero section, main heading
- **Expected (Figma)**: 32px, font-weight: 700, color: #1A1A1A
- **Actual (Rendered)**: 28px, font-weight: 600, color: #333333
- **Severity**: Major
- **Likely Cause**: Heading style override in component CSS, possibly using wrong design token

**Finding 2**: Spacing — Card grid gap too narrow
- **Location**: Product cards section, gap between cards
- **Expected (Figma)**: 24px gap between cards
- **Actual (Rendered)**: 16px gap
- **Severity**: Major
- **Likely Cause**: Grid gap using `gap-4` (16px) instead of `gap-6` (24px)

**Finding 3**: Colors — Button background color
- **Location**: CTA button in hero section
- **Expected (Figma)**: #2563EB (blue-600)
- **Actual (Rendered)**: #3B82F6 (blue-500)
- **Severity**: Minor
- **Likely Cause**: Using `bg-blue-500` instead of `bg-blue-600`, or wrong design token mapping

---

### Summary

| Screen | Viewport | Diff % | Critical | Major | Minor | Cosmetic |
|--------|----------|--------|----------|-------|-------|----------|
| {Screen A} | Desktop | 4.2% | 0 | 2 | 1 | 0 |
| {Screen A} | Mobile | 8.1% | 1 | 3 | 2 | 1 |

**Total findings**: N (X critical, Y major, Z minor, W cosmetic)

### Recommended Fix Priority

1. **[Critical]** {Screen} — {Finding summary}
2. **[Major]** {Screen} — {Finding summary}
3. **[Major]** {Screen} — {Finding summary}
...

### Next Steps
- Fix critical and major findings in application code
- Re-run visual comparison: `/cgs.figma.visual`
- Re-analyze after fixes: `/cgs.qa.visual`
- Re-capture if Figma designs changed: `/cgs.figma.capture <figma-url>`
```

### 9. Save Report (if --save-report)

If `--save-report` flag is set, write the report to: `specs/{feature-id}/visual-analysis.md`

Also save comparison images to the `.visual-analysis/` directory for future reference.

## Reference

### Image File Organization

```
tests/e2e/{feature-id}/
├── .visual-analysis/
│   ├── {screen-slug}-desktop-actual.png
│   ├── {screen-slug}-desktop-figma.png
│   ├── {screen-slug}-desktop-diff.png
│   ├── {screen-slug}-mobile-actual.png
│   ├── {screen-slug}-mobile-figma.png
│   └── {screen-slug}-mobile-diff.png
├── figma-visual.spec.ts
└── ...
```

### Viewport Dimensions

| Viewport | Width | Height |
| -------- | ----- | ------ |
| Desktop  | 1440  | 900    |
| Tablet   | 768   | 1024   |
| Mobile   | 375   | 812    |

### Severity Decision Tree

```
Is the element missing or layout broken?
  → Yes: Critical

Is the difference noticeable at a glance without zooming?
  → Yes: Is it spacing/sizing or color/typography?
    → Spacing/sizing ≥ 4px off: Major
    → Color noticeably different: Major
    → Font weight/size visibly different: Major
  → No: Is it detectable when comparing side-by-side?
    → Yes: Minor (1-3px spacing, subtle color shade)
    → No: Cosmetic (sub-pixel, anti-aliasing, rendering engine)
```

### Error Handling

| Error                        | Message                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| No spec.md                   | `"ERROR: No spec.md found. Run /speckit.specify first."`               |
| No Screens section           | `"ERROR: No ## Screens section. Run /cgs.figma.link first."`           |
| No Figma nodes               | `"ERROR: No Figma Node values. Run /cgs.figma.link first."`            |
| FIGMA_TOKEN not set          | `"ERROR: FIGMA_TOKEN is required for this skill."`                     |
| No mismatches found          | `"All screens within threshold ({N}%). No investigation needed."`      |
| Feature ID not resolved      | `"ERROR: Could not determine feature ID from branch. Please specify."` |
| figma-visual.spec.ts missing | Run /cgs.figma.visual first, then proceed                              |
