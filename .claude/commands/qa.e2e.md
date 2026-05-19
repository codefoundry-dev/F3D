---
description:
  Generate functional Playwright e2e tests from spec acceptance criteria and edge cases. Functional
  testing only — no visual/screenshot assertions.
---

## User Input

```text
$ARGUMENTS
```

## Argument Parsing

- If user input is empty → generate tests for **all user stories** + all edge cases
- If user input matches `US\d+` pattern (e.g., `US1`) → generate for that story only (+ edge cases
  mapped to it)
- If user input is comma-separated (e.g., `US1,US3`) → generate for listed stories

## Execution

### Step 1: Discover feature

Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` to get `FEATURE_DIR` and
`FEATURE_SPEC`. If the script fails, fall back to auto-detecting:

```bash
FEATURE_DIR=$(ls specs/ | grep -E '^[0-9]{3}-' | head -1)
```

### Step 2: Parse spec.md

Extract:

- User stories with acceptance criteria (GWT format)
- Edge cases
- Filter to requested stories if argument provided

### Step 3: Read app source code

Discover real selectors, validation messages, button names, routes from the application source.

### Step 4: Scan existing tests

Check `tests/e2e/{feature}/` for existing test files. Detect reusable helpers and fixtures:

- `tests/e2e/helpers/` — shared helper functions
- `tests/e2e/fixtures/` — shared test data

### Step 5: Generate test plan

Present the plan for user approval:

```markdown
## E2E Test Generation Plan

**Feature**: {feature-id} **Source**: specs/{feature-id}/spec.md **Filter**: [All stories | US1,
US3]

### Test Files

| File                | Story | ACs | Edges | Status |
| ------------------- | ----- | --- | ----- | ------ |
| us01-{slug}.spec.ts | US1   | 4   | 4     | NEW    |
| us02-{slug}.spec.ts | US2   | 2   | 1     | EXISTS |

### Shared Infrastructure

| Item        | Path                                   | Action       |
| ----------- | -------------------------------------- | ------------ |
| resetApp()  | tests/e2e/helpers/{feature}-helpers.ts | CREATE/REUSE |
| seedTasks() | tests/e2e/helpers/{feature}-helpers.ts | CREATE/REUSE |
```

Wait for user approval.

### Step 6: Write test files

One file per user story: `tests/e2e/{feature}/us{NN}-{slug}.spec.ts`

#### Test Naming Convention

| Pattern                            | Meaning                   | Example                           |
| ---------------------------------- | ------------------------- | --------------------------------- |
| `us{NN}-{slug}.spec.ts`            | File per user story       | `us01-create-task.spec.ts`        |
| `test.describe('US{N} - {Title}')` | Describe block            | `'US1 - Create Task'`             |
| `test('AC{N}: {desc}')`            | Acceptance criterion test | `'AC1: Add task opens modal'`     |
| `test('Edge: {desc}')`             | Edge case test            | `'Edge: Empty title shows error'` |

#### Selector Priority

Prefer selectors in this order:

1. `getByRole('button', { name: 'Add Task' })` — semantic role
2. `getByLabel('Delete task')` — aria-label
3. `getByText('Submit', { exact: true })` — visible text
4. `locator('#task-title')` — element ID
5. `locator('[class*="pattern"]')` — CSS class (last resort)

#### GWT Mapping

| Spec (Given/When/Then)               | Test (Arrange/Act/Assert)                                         |
| ------------------------------------ | ----------------------------------------------------------------- |
| Given I am on the task board         | `await page.goto('/')`                                            |
| Given there are tasks                | `await seedTasks(page, DEFAULT_TASKS)`                            |
| When I click "Add Task"              | `await page.getByRole('button', { name: 'Add Task' }).click()`    |
| When I fill in the title             | `await page.fill('#task-title', 'My Task')`                       |
| Then the task is added               | `await expect(page.getByText('My Task')).toBeVisible()`           |
| Then I see error "Title is required" | `await expect(page.getByText('Title is required')).toBeVisible()` |

### Step 7: Run tests and report

Run the generated tests via Playwright. If failures occur, offer to fix them interactively.

## Forbidden Patterns

The following are **never** generated (enforced strictly):

- `toHaveScreenshot()` — visual regression belongs in `/qa.visual`
- `toMatchSnapshot()` — same
- `page.screenshot()` — same

## Rules

- Always present test plan for user approval before writing files.
- One test file per user story.
- Use real selectors discovered from app source, not guessed ones.
- Include edge cases mapped to the relevant user story's test file.
- Create shared helpers/fixtures if patterns repeat across stories.
