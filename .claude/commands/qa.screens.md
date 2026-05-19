---
description:
  Auto-generate figma-screens.json — the screen definition file that drives visual testing and Figma
  linking.
---

## User Input

```text
$ARGUMENTS
```

## Argument Parsing

- If user input is empty → generate screens for **all user stories**
- If user input matches `US\d+` pattern (e.g., `US1`) → generate for that story only
- If user input is comma-separated (e.g., `US1,US3`) → generate for listed stories only

## Execution

### Step 1: Discover feature

Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` to get `FEATURE_DIR` and
`FEATURE_SPEC`. If the script fails, fall back to auto-detecting:

```bash
FEATURE_DIR=$(ls specs/ | grep -E '^[0-9]{3}-' | head -1)
```

If no feature directory found, abort with: "ERROR: No feature directory found."

### Step 2: Parse spec.md

Extract from the spec file:

- User stories (GWT format) — title, acceptance criteria, actor
- Edge cases
- Filter to only requested stories if argument provided

### Step 3: Read app source code

Discover real routes, button names, element IDs, form modes, and filter controls from the
application source.

### Step 4: Apply 6 detection heuristics

For each user story, identify distinct visual states:

| Rule               | Detects                           | Example Screen         | Example Precondition                                                       |
| ------------------ | --------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| 1. Modal/Dialog    | Click triggers opening an overlay | "Add Task Modal"       | `{ "type": "click", "target": "Add Task" }`                                |
| 2. Empty State     | No data exists, initial view      | "Empty State"          | (none)                                                                     |
| 3. Populated State | Data exists in list/table         | "Task List With Items" | `{ "type": "seed", "data": "default-tasks" }`                              |
| 4. Filtered State  | Active filters narrow results     | "Filtered By Status"   | seed + `{ "type": "select", "target": "#filter-status", "value": "Done" }` |
| 5. Form Variants   | Add vs edit mode of same form     | "Edit Task Modal"      | seed + `{ "type": "click", "target": "Edit" }`                             |
| 6. Error State     | Full-screen errors (not inline)   | (usually skipped)      | —                                                                          |

### Step 5: Deduplicate and assign viewports

- Merge scenarios that produce the same visual state
- Assign viewports:
  - Fundamental states (empty, populated) → D/T/M (desktop, tablet, mobile)
  - Modals → D/M
  - Filters → D only

### Step 6: Present plan for approval

Show the detected screens in a table:

```markdown
## Screen Generation Plan

**Feature**: {feature-id} **Source**: specs/{feature-id}/spec.md **Screens detected**: N **Filter**:
[All stories | US1, US3]

### Detected Screens

| #   | Screen Name | Story | Route | Preconditions | Viewports | Derived From |
| --- | ----------- | ----- | ----- | ------------- | --------- | ------------ |
| 1   | ...         | ...   | ...   | ...           | ...       | ...          |
```

Wait for user approval before writing.

### Step 7: Write figma-screens.json

Write to `specs/{feature-id}/figma-screens.json`:

```json
{
  "feature": "{feature-id}",
  "screens": [
    {
      "name": "Screen Name",
      "userStory": "US1",
      "route": "/",
      "preconditions": [],
      "figmaFileKey": "",
      "figmaNodeId": "",
      "viewports": ["desktop", "tablet", "mobile"]
    }
  ]
}
```

### Merge Behavior (Existing File)

If `figma-screens.json` already exists:

| Existing Screen State                                     | Action                                  |
| --------------------------------------------------------- | --------------------------------------- |
| Has populated Figma keys (`figmaFileKey` + `figmaNodeId`) | KEEP — preserves keys                   |
| Has empty Figma keys                                      | KEEP — can be updated by new definition |
| Not detected by heuristics (manually added)               | KEEP — never removed                    |
| New screen (not in existing file)                         | ADD — appended with empty keys          |

## Precondition Types

| Type       | Purpose                              | Fields                                          |
| ---------- | ------------------------------------ | ----------------------------------------------- |
| `click`    | Click a button/element               | `target` — button name or aria-label            |
| `seed`     | Populate localStorage with test data | `data` — fixture name                           |
| `navigate` | Go to a route                        | `target` — URL path                             |
| `select`   | Choose from dropdown                 | `target` — CSS selector, `value` — option text  |
| `type`     | Type into input                      | `target` — CSS selector, `value` — text to type |

## Rules

- Always present plan for user approval before writing files.
- Never remove manually added screens from existing files.
- Preserve populated Figma keys when merging.
