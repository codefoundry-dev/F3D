---
name: cgs.figma.link
description:
  Generate the Screens section in spec.md and link Figma frames for visual testing. Use when linking
  Figma designs to spec screens or generating the Screens table.
disable-model-invocation: true
argument-hint: '<figma-url> [story-filter] [--force]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

**Required**: A Figma design URL (e.g., `https://figma.com/design/abc123/feature-name`)
**Optional**:

- **Story filter** (e.g., `US1`, `US1,US3`) -- generate/link screens for specific stories only
- **`--force`** flag -- overwrite screens that already have Figma Node values

## Goal

Generate the `## Screens` section in `spec.md` AND link Figma design frames to each screen in a
single pass. Reads acceptance criteria from `spec.md`, cross-references app source code to identify
visual states, discovers Figma frames via MCP, auto-matches by name similarity, and writes the table
with `Figma Node` values.

**Pipeline position:**

```
spec.md -> /cgs.figma.link -> /cgs.figma.visual
```

## Operating Constraints

1. **READ-ONLY ANALYSIS FIRST**: Do not write any files until the user approves the plan.
2. **MARKDOWN TABLE FORMAT**: `## Screens` with columns: Screen, Story, Route, Figma Node,
   Viewports. Preconditions under `### Screen Preconditions`.
3. **APP SOURCE GROUNDING**: Read actual app source for button names, IDs, selectors. Do NOT guess
   from spec text alone.
4. **MERGE, NOT OVERWRITE**: Preserve existing populated `Figma Node` values (unless `--force`).
5. **USE get_metadata ONLY**: For frame discovery. Do NOT use `get_screenshot` or
   `get_design_context`.
6. **PRECISION OVER RECALL**: Only match with clear name similarity. Better to leave unlinked than
   wrong.

## Execution Steps

### 1. Determine Feature Scope

Determine the current feature context:

1. **Repo root**: `git rev-parse --show-toplevel`
2. **Feature ID**: Derive from the current git branch name (e.g., branch `feature/auth-flow` ->
   feature ID `auth-flow`). Strip common prefixes like `feature/`, `feat/`.
3. **Feature spec** (`FEATURE_SPEC`): Look for `specs/{feature-id}/spec.md` relative to repo root

If the branch name doesn't map to a feature directory, ask the user to specify the feature ID.

### 2. Parse Arguments

**Figma URL** (required): Extract `fileKey` and optional `nodeId`.

| URL Pattern                                                | fileKey       | nodeId             |
| ---------------------------------------------------------- | ------------- | ------------------ |
| `figma.com/design/{fileKey}/{fileName}`                    | `{fileKey}`   | --                 |
| `figma.com/design/{fileKey}/{fileName}?node-id={nodeId}`   | `{fileKey}`   | convert `-` to `:` |
| `figma.com/file/{fileKey}/...`                             | `{fileKey}`   | --                 |
| `figma.com/design/{fileKey}/branch/{branchKey}/{fileName}` | `{branchKey}` | --                 |

No valid URL:
`"ERROR: No valid Figma URL provided. Usage: /cgs.figma.link https://figma.com/design/{fileKey}/{fileName}"`

### 3. Parse Specification

Read `FEATURE_SPEC`. Extract:

- **User Stories**: headings matching `### US{N}` or `### User Story N`
- **Edge Cases**: bullet points from `## Edge Cases`
- Apply story filter if specified

### 4. Read App Source Code

Read the feature's source to understand real UI structure:

- Routes/navigation, modal/dialog triggers, form components
- List components (empty vs populated), filter components
- Key selectors: button names, aria-labels, element IDs

### 5. Apply Screen Detection Heuristics

Process each scenario through these rules (priority order):

1. **Modal/Dialog Overlay**: When clause has action words + Then confirms modal opens -> `click`
   precondition
2. **Empty/Initial State**: Given implies no data -> no preconditions
3. **Data-Populated State**: Given implies data exists -> `seed` precondition
4. **Filtered/Searched State**: When mentions filtering/searching -> `seed` + `select`/`type`
5. **Form Mode Variants**: Both add and edit forms -> two screens
6. **Validation/Error States**: Only if visually distinct enough for separate capture

### 6. Deduplicate and Assign Viewports

Merge candidates with same route + same preconditions + same visible component.

| Screen Type             | Viewports | Rationale                    |
| ----------------------- | --------- | ---------------------------- |
| Fundamental states      | D/T/M     | Layout matters at all sizes  |
| Modals/forms            | D/M       | Tablet modals match desktop  |
| Filter/dashboard states | D         | Desktop-primary interactions |

### 7. Discover Figma Frames

Call `get_metadata(fileKey, nodeId: "0:1")` to get top-level structure.

- Extract pages and child frame elements (name, nodeId, pageName)
- If only page nodes returned, make additional calls per page
- If `nodeId` in URL, use as starting point
- Skip nested frames, components, groups, and generic names ("Frame 1", "Untitled")

### 8. Auto-Match Figma Frames to Screens

Match by (priority order):

1. **Exact match** (case-insensitive) -> Confidence: `Exact`
2. **Normalized match** (strip "- Desktop", "- Mobile", "v2") -> Confidence: `High`
3. **Keyword overlap** (shared words, excluding stop words) -> Confidence: `Medium`
4. **No match** -> Confidence: `None`, screen unlinked

Constraints: 1:1 matching. Ties broken by shorter frame name. Minimum 1 shared keyword for `Medium`.

### 9. Output Combined Plan

```
## Screen Generation & Figma Link Plan

**Feature**: {feature-id} | **Figma File**: {fileKey}

### Detected Screens with Figma Matches

| # | Screen Name | Story | Route | Figma Frame | Node ID | Confidence | Viewports |
|---|-------------|-------|-------|-------------|---------|------------|-----------|

### Precondition Details
### Unmatched Figma Frames
### Unlinked Screens
### Merge Analysis (if ## Screens exists)
```

### 10. User Confirmation

- **"Generate"** -- write to spec.md
- **"Adjust"** -- modify screens or reassign matches
- **"Cancel"** -- abort

### 11. Write Changes to spec.md

Three updates:

#### 11a. Update ## Design References

Replace or insert the Figma URL (cleaned of tracking params `&t=...`, `&p=...`).

#### 11b. Add Figma Links to User Stories

For each story with linked screens, insert/update `**Design**:` line after the heading:

```markdown
**Design**: [Screen Name](https://www.figma.com/design/{fileKey}/{fileName}?node-id={nodeId with :
-> -})
```

#### 11c. Write ## Screens Table

Place before `## Edge Cases` if it exists, otherwise append.

```markdown
## Screens

| Screen | Story | Route | Figma Node | Viewports |
| ------ | ----- | ----- | ---------- | --------- |

### Screen Preconditions

**Screen Name**:

- type: "target"
- type: "target" -> "value"
```

**Merge rules**: Preserve populated Figma Nodes (unless `--force`). Add new screens. Keep
manually-added screens.

**Post-write output**:

```
Updated spec.md:
  - Design References: updated Figma URL
  - User Stories: added design links to N stories
  - Screens: N total, M linked to Figma

Next steps:
  - Run /cgs.figma.visual to compare against Figma designs
  - To link remaining screens, re-run with --force or edit Figma Node column
```

## Reference

### Spec Parsing

- User story heading: `### US{N} -- {Title} (Priority: {Level})`
- Acceptance criteria: `- **Given** ... **When** ... **Then** ...`
- Edge case: `^-\s*(.+)$`

### Screen Table Parsing

1. Find `## Screens` heading, read until next `##` (not `###`)
2. Parse `|`-delimited rows, map columns
3. Parse `### Screen Preconditions` for `**Name**:` + bullet lines

### Figma URL Formats

- API calls: nodeId in colon format (`1:234`)
- Clickable links: `?node-id={nodeId with : -> -}` (e.g., `8:2` -> `?node-id=8-2`)
- Clean input URL: remove `&t=...`, `&p=...`, `&mode=...`

### Error Handling

| Error                           | Message                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| No URL in arguments             | `"ERROR: No valid Figma URL provided."`                                 |
| Feature ID not resolved         | `"ERROR: Could not determine feature ID from branch. Please specify."`  |
| get_metadata fails              | `"ERROR: Could not access Figma file."`                                 |
| Zero frames found               | `"ERROR: No screens found in Figma file."`                              |
| All screens linked (no --force) | `"All screens already have Figma Node values. Use --force to re-link."` |
