---
description:
  Link Figma design frames to figma-screens.json so visual tests can compare implementation against
  intended designs.
---

## User Input

```text
$ARGUMENTS
```

## Argument Parsing

- User input **must** contain a Figma URL: `https://(www\.)?figma\.com/(design|file|board|make)/...`
- Optional flag `--force` → overwrite screens that already have Figma keys
- If no URL provided, abort with: "ERROR: Please provide a Figma URL."

## URL Parsing

Extract `fileKey` and optional `nodeId` from the URL:

| URL Format                                         | Parsed Values                                    |
| -------------------------------------------------- | ------------------------------------------------ |
| `figma.com/design/{key}/{name}`                    | fileKey = key                                    |
| `figma.com/design/{key}/{name}?node-id=1-2`        | fileKey = key, nodeId = 1:2 (convert `-` to `:`) |
| `figma.com/design/{key}/branch/{branchKey}/{name}` | fileKey = branchKey                              |
| `figma.com/file/{key}/...`                         | fileKey = key                                    |

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

Identify which screens need linking:

- **Empty keys** → needs linking
- **Populated keys** → skip (unless `--force`)

If all screens already have keys and `--force` is not set: "All screens already have Figma keys. Use
`--force` to re-link."

### Step 3: Call Figma MCP get_metadata

Use the Figma MCP `get_metadata` tool with the parsed `fileKey` to discover all top-level frames in
the Figma file.

### Step 4: Auto-match frames to screens

Match Figma frames to screen entries by name similarity:

| Priority | Match Type                                      | Confidence | Example                                              |
| -------- | ----------------------------------------------- | ---------- | ---------------------------------------------------- |
| 1st      | Exact match (case-insensitive)                  | Exact      | Frame "Empty State" ↔ Screen "Empty State"           |
| 2nd      | Normalized (stripped suffixes like "- Desktop") | High       | Frame "Add Task - Desktop" ↔ Screen "Add Task Modal" |
| 3rd      | Keyword overlap                                 | Medium     | Frame "New Task Form" ↔ Screen "Add Task Modal"      |
| —        | No match                                        | None       | Unlinked                                             |

### Step 5: Present match plan

Show the matching results for user approval:

```markdown
## Figma Link Plan

| Screen         | Figma Frame                      | Confidence | Action |
| -------------- | -------------------------------- | ---------- | ------ |
| Empty State    | "Empty State" (node 10:1)        | Exact      | LINK   |
| Add Task Modal | "Add Task - Desktop" (node 10:2) | High       | LINK   |
| Task List      | (no match)                       | None       | SKIP   |
```

Wait for user approval before updating.

### Step 6: Update figma-screens.json

For each approved match, set `figmaFileKey` and `figmaNodeId` on the screen entry.

## Rules

- Uses `get_metadata` only (not `get_screenshot` or `get_design_context`) — fast and lightweight.
- Never remove or modify screen entries beyond setting Figma keys.
- Requires `figma-screens.json` to exist — run `/qa.screens` first if missing.
- Screens with existing Figma keys are skipped unless `--force` is used.
