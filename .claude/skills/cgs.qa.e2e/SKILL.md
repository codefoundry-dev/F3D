---
name: cgs.qa.e2e
description:
  Generate E2E test coverage from speckit specifications. Use when the user wants to create e2e
  tests, generate test coverage, or scaffold Playwright tests from spec.md.
disable-model-invocation: true
argument-hint: '[story-filter] [--update] [--dry-run]'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Supported arguments:

- **Story filter** (optional) -> generate tests for specific stories only (e.g., `US1`, `US1,US3`)
- **`--update`** -> regenerate tests for stories that already have test files (overwrites)
- **`--dry-run`** -> output the test plan without creating any files

## Goal

Generate comprehensive E2E test suites from speckit specification artifacts (`spec.md`, `plan.md`,
`tasks.md`). Each user story's acceptance scenarios become Playwright test cases following best
practices from the project's playwright guide skills.

**Pipeline position:**

```
/speckit.specify -> spec.md -> /cgs.qa.e2e -> e2e tests -> /cgs.figma.capture -> /cgs.figma.link -> /cgs.figma.visual
```

## Prerequisites

Before generating tests, **read the following guide skills** in `.claude/skills/` (if they exist) to
align with best practices:

1. **`_guides.playwright-core/`** -> golden rules, locator strategy, assertions, fixtures, test
   organization
2. **`_guides.playwright-pom/`** -> when to use Page Object Model vs fixtures vs helpers
3. **`_guides.playwright-cli/`** -> CLI-driven workflows for debugging generated tests

Skim the guide index (`SKILL.md`) in each, then read specific guides relevant to the feature being
tested (e.g., `authentication.md` for auth flows, `forms-and-validation.md` for form-heavy
features).

## Operating Constraints

1. **ANALYSIS PHASE IS READ-ONLY**: Do not create or modify any files until the user explicitly
   approves the test plan.
2. **SPEC.MD REQUIRED**: If no spec.md exists, abort with:
   `"ERROR: No spec.md found. Run /speckit.specify first."`
3. **PROJECT-AGNOSTIC**: Discover existing test infrastructure (helpers, fixtures, config) from the
   project's own files.
4. **REUSE EXISTING INFRASTRUCTURE**: Same imports, helpers, fixtures, base URL, and patterns as the
   project's existing tests.
5. **NO MANUAL DEV SERVER**: Never start the dev server manually. Playwright's `webServer` config
   handles it.
6. **ONE FILE PER USER STORY**: Each user story gets its own `{story-slug}.spec.ts` file.
7. **NO SPEC.MD WRITES**: This skill never modifies spec.md.
8. **GUIDE SKILLS ARE REFERENCE ONLY**: Read guide skills for patterns, do NOT modify them.

## Execution Steps

### 1. Determine Feature Scope

1. **Repo root**: `git rev-parse --show-toplevel`
2. **Feature ID**: Derive from the current git branch name. Strip prefixes like `feature/`, `feat/`.
3. **Feature spec**: Look for `specs/{feature-id}/spec.md` relative to repo root
4. **Plan** (optional): `specs/{feature-id}/plan.md`
5. **Tasks** (optional): `specs/{feature-id}/tasks.md`
6. **Data model** (optional): `specs/{feature-id}/data-model.md`
7. **Contracts** (optional): `specs/{feature-id}/contracts/`
8. **E2e test dir**: `tests/e2e/{feature-id}/`

If the branch name doesn't map to a feature directory, ask the user to specify the feature ID.

### 2. Parse Specification Artifacts

#### 2a. Parse spec.md (required)

Extract:

- **Feature title**: from `# Feature Specification: {Title}`
- **User stories**: headings matching `### US{N}` or
  `### User Story N -- {Title} (Priority: {Level})`
- **Acceptance scenarios**: `Given/When/Then` blocks under each story
- **Edge cases**: from `## Edge Cases`
- **Screens** (if exists): from `## Screens` table — routes, viewports, preconditions
- **Functional requirements**: `FR-###` entries
- **Success criteria**: `SC-###` entries

#### 2b. Parse plan.md (optional, enriches tests)

Extract:

- **Tech stack**: framework, language, testing tools
- **Routes/endpoints**: from contracts or project structure
- **Auth strategy**: login flow, token management
- **Data model**: entities and relationships

#### 2c. Parse tasks.md (optional, enriches tests)

Extract:

- **Test tasks**: any `[US{N}]` tasks mentioning tests
- **Implementation files**: file paths for the feature code

#### 2d. Apply story filter

If `$ARGUMENTS` contains a story filter (e.g., `US1`, `US1,US3`), include only matching stories. If
filter matches nothing: `"ERROR: No stories match filter '{filter}'. Available: US1, US2, ..."`

### 3. Read Existing Test Infrastructure

#### 3a. Discover Playwright config

Find `playwright.config.ts` (or `.js`). Extract:

- `baseURL`
- Viewport definitions (projects)
- `webServer` configuration
- Global setup/teardown
- Test directory patterns

#### 3b. Discover existing helpers and fixtures

Scan `tests/` directory for:

- Helper functions (`tests/e2e/helpers/`, `tests/helpers/`, `tests/utils/`)
- Fixtures (`tests/e2e/fixtures/`, `tests/fixtures/`)
- Custom test extensions (`test.extend()`)
- Seed data utilities
- Auth utilities (login helpers, storage state)
- Common page objects (if POM is used)

#### 3c. Discover existing tests (if any)

Check `tests/e2e/{feature-id}/` for existing test files:

- Map existing files to user stories
- Identify patterns: describe block naming, assertion style, setup conventions

#### 3d. Assess POM applicability

Read `_guides.playwright-pom/pom-vs-fixtures-vs-helpers.md` guide. Decide:

| Condition                                       | Pattern                           |
| ----------------------------------------------- | --------------------------------- |
| Feature has 3+ pages with repeated interactions | Use Page Objects                  |
| Feature is a single page with varied states     | Use helper functions              |
| Feature shares auth/data setup across stories   | Use fixtures via `test.extend()`  |
| Feature is simple CRUD                          | Use inline test code with helpers |

Document the decision in the test plan.

### 4. Map Acceptance Scenarios to Test Cases

For each user story, transform acceptance scenarios into test cases:

#### 4a. Scenario-to-test mapping

Each `Given/When/Then` scenario becomes one `test()` block:

| Scenario Part               | Test Equivalent                                           |
| --------------------------- | --------------------------------------------------------- |
| **Given** (initial state)   | `beforeEach` or test setup (seed data, navigation, auth)  |
| **When** (user action)      | Playwright interactions (`click`, `fill`, `select`, etc.) |
| **Then** (expected outcome) | Assertions (`expect()`)                                   |

#### 4b. Derive additional test cases

Beyond explicit acceptance scenarios, generate tests for:

- **Edge cases** from `## Edge Cases` that map to this story
- **Validation errors** for form inputs (empty, invalid, boundary values)
- **Empty states** where applicable
- **Loading states** if the feature involves async operations
- **Error handling** for network failures or API errors (use route mocking)

#### 4c. Classify test priority

| Source                            | Priority | Approach                      |
| --------------------------------- | -------- | ----------------------------- |
| Acceptance scenario (P1 story)    | Critical | Always generate               |
| Acceptance scenario (P2/P3 story) | High     | Always generate               |
| Edge case from spec               | Medium   | Generate if clear test path   |
| Derived validation test           | Medium   | Generate for forms and inputs |
| Derived error handling            | Low      | Generate with network mocking |

### 5. Check for Existing Coverage

Cross-reference mapped test cases against existing test files in `tests/e2e/{feature-id}/`:

| Status     | Meaning                                | Action         |
| ---------- | -------------------------------------- | -------------- |
| **NEW**    | No existing test file for this story   | Will generate  |
| **EXISTS** | Test file exists, not using `--update` | Skip (report)  |
| **UPDATE** | Test file exists, `--update` flag set  | Will overwrite |

### 6. Output Test Plan (Read-Only)

```
## E2E Test Plan

**Feature**: {feature-id}
**Spec**: specs/{feature-id}/spec.md
**Test Dir**: tests/e2e/{feature-id}/
**Pattern**: {POM | Helpers | Fixtures | Inline} (reason)

### Infrastructure

- Playwright config: {path} (baseURL: {url})
- Helpers: {list of discovered helpers}
- Fixtures: {list of discovered fixtures}
- Auth: {auth strategy from plan or existing tests}
- Dependencies to install: {if any}

### Test Coverage Matrix

| # | Story | File | Tests | Status | Notes |
|---|-------|------|-------|--------|-------|
| 1 | US1 — {Title} | {slug}.spec.ts | N tests | NEW | {notes} |
| 2 | US2 — {Title} | {slug}.spec.ts | N tests | EXISTS | skipping |

### Test Case Details

#### US1 — {Title} ({slug}.spec.ts)

| # | Test Name | Source | Scenario | Priority |
|---|-----------|--------|----------|----------|
| 1 | should {behavior} | Acceptance #1 | Given..When..Then | Critical |
| 2 | should {behavior} | Acceptance #2 | Given..When..Then | Critical |
| 3 | should {behavior} | Edge case | {edge case text} | Medium |

### Shared Setup

- {description of shared beforeEach, fixtures, or helpers to generate}

### Summary

**Total test files**: N (X new, Y existing)
**Total test cases**: M
**Stories covered**: K / L
```

Ask user to confirm:

- **"Generate"** -> create test files
- **"Adjust"** -> modify the plan
- **"Cancel"** -> abort

### 7. Generate Shared Infrastructure (if needed)

Before generating test files, create any shared code that doesn't already exist:

#### 7a. Page Objects (if POM pattern chosen)

Generate in `tests/e2e/{feature-id}/pages/` or project's existing POM directory:

```typescript
// Follow patterns from playwright-pom guide
export class {PageName}Page {
  constructor(private page: Page) {}

  // Locators as getters (playwright-core: getByRole over CSS)
  get submitButton() {
    return this.page.getByRole('button', { name: 'Submit' });
  }

  // Actions as methods
  async fillForm(data: FormData) { ... }

  // No assertions in page objects
}
```

#### 7b. Test fixtures (if fixture pattern chosen)

Generate in project's fixture directory:

```typescript
// Follow patterns from playwright-core fixtures guide
import { test as base } from '@playwright/test';

export const test = base.extend<{ featureFixture: FixtureType }>({
  featureFixture: async ({ page }, use) => {
    // Setup
    await use(fixture);
    // Teardown
  },
});
```

#### 7c. Helper functions (if helper pattern chosen)

Generate in project's helper directory:

```typescript
// Reusable setup functions
export async function seedFeatureData(page: Page, dataset: string) { ... }
export async function loginAsRole(page: Page, role: string) { ... }
```

### 8. Generate Test Files

For each user story (status NEW or UPDATE), generate `tests/e2e/{feature-id}/{story-slug}.spec.ts`:

#### Test file structure

```typescript
import { test, expect } from '@playwright/test';
// Import project helpers, fixtures, page objects as discovered

test.describe('{Feature Title} — US{N}: {Story Title}', () => {
  // Shared setup from Given clauses
  test.beforeEach(async ({ page }) => {
    // Common preconditions (auth, navigation, seed data)
  });

  // One test per acceptance scenario
  test('should {behavior from Then clause}', async ({ page }) => {
    // When: user actions
    // Then: assertions
  });

  // Edge case tests
  test('should handle {edge case}', async ({ page }) => {
    // Setup edge condition
    // Assert correct behavior
  });
});
```

#### Code generation rules

Follow these rules from the playwright guide skills:

**Locators** (from `_guides.playwright-core/locators.md`):

- Prefer `getByRole()` over CSS selectors
- Use `getByLabel()` for form inputs with labels
- Use `getByPlaceholder()` for inputs without labels
- Use `getByText()` for static text content
- Use `getByTestId()` only as last resort
- Never use fragile selectors (`#id`, `.class`, `xpath`)

**Assertions** (from `_guides.playwright-core/assertions-and-waiting.md`):

- Use web-first assertions: `await expect(locator).toBeVisible()`
- Never `page.waitForTimeout()` — use `expect(locator)` auto-retry
- Assert user-visible outcomes, not implementation details
- Use `toHaveURL()` after navigation
- Use `toHaveText()` / `toContainText()` for content verification

**Test organization** (from `_guides.playwright-core/test-organization.md`):

- One behavior per test
- Descriptive test names starting with "should"
- Group related tests in `test.describe()`
- Independent tests — no shared state between tests

**Network mocking** (from `_guides.playwright-core/network-mocking.md`):

- Mock external services only, never mock your own app
- Use `page.route()` for API error simulation
- Use realistic response shapes from contracts/

**Auth** (from `_guides.playwright-core/authentication.md`):

- Use storage state for auth reuse across tests
- Login once in global setup, reuse via `storageState`
- If project has auth helpers, use those

**Forms** (from `_guides.playwright-core/forms-and-validation.md`):

- Test happy path first, then validation errors
- Fill all fields before submitting
- Assert both success and error feedback

### 9. Verify Generated Tests

After generating, do a basic validation:

1. **TypeScript check**: Ensure imports resolve and types are correct
2. **No hardcoded URLs**: All routes relative to `baseURL`
3. **No `waitForTimeout`**: All waits are assertion-based
4. **Locator quality**: No raw CSS selectors where role-based works
5. **Test isolation**: No shared mutable state between tests

### 10. Output Generation Report

```
## E2E Test Generation Report

**Feature**: {feature-id} | **Date**: YYYY-MM-DD

### Generated Files

| # | File | Story | Tests | Status |
|---|------|-------|-------|--------|
| 1 | {slug}.spec.ts | US1 — {Title} | N | CREATED |
| 2 | {slug}.spec.ts | US2 — {Title} | N | CREATED |

### Shared Infrastructure

| File | Type | Status |
|------|------|--------|
| pages/{name}.page.ts | Page Object | CREATED |
| helpers/{name}.ts | Helper | CREATED |

### Skipped (already exist)

| File | Story | Reason |
|------|-------|--------|
| {slug}.spec.ts | US3 | EXISTS (use --update to overwrite) |

### Summary

**Files created**: N
**Total test cases**: M
**Stories covered**: K / L
**Pattern used**: {POM | Helpers | Fixtures | Inline}

### Next Steps
- Run tests: `npx playwright test tests/e2e/{feature-id}/`
- Debug failures: use `playwright-cli` skill for interactive browser debugging
- Capture screens: `/cgs.figma.capture <figma-url>`
- To regenerate: `/cgs.qa.e2e --update`
- To add tests for specific story: `/cgs.qa.e2e US{N}`
```

## Reference

### File Naming Convention

| Source                  | File Name                   |
| ----------------------- | --------------------------- |
| US1 — User Registration | `user-registration.spec.ts` |
| US2 — Task Management   | `task-management.spec.ts`   |
| US3 — Search & Filter   | `search-and-filter.spec.ts` |

Derive slug from story title: lowercase, spaces to hyphens, strip special characters.

### Test Name Convention

| Acceptance Scenario                                                              | Test Name                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Given user on login, When enters valid credentials, Then redirected to dashboard | `should redirect to dashboard after valid login`               |
| Given empty task list, When user clicks add, Then modal appears                  | `should show add modal when clicking add button on empty list` |

Derive from the **Then** clause, prefixed with "should".

### Precondition-to-Code Mapping

| Spec Precondition     | Test Code                     |
| --------------------- | ----------------------------- |
| User is logged in     | `storageState` or auth helper |
| Empty state (no data) | Default state or reset helper |
| Data exists           | Seed helper or API setup      |
| User on {page}        | `await page.goto('{route}')`  |
| Modal is open         | Navigate + click trigger      |

### Viewport Handling

Tests run across all Playwright projects defined in config. If spec.md `## Screens` defines
viewport-specific behavior, add viewport-aware tests:

```typescript
test.describe('mobile-specific behavior', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('should show hamburger menu', async ({ page }) => { ... });
});
```

### Error Handling

| Error                        | Message                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| No spec.md                   | `"ERROR: No spec.md found at specs/{feature-id}/spec.md. Run /speckit.specify first."`                |
| No user stories in spec      | `"ERROR: No user stories found in spec.md. Ensure stories use ### US{N} or ### User Story N format."` |
| No acceptance scenarios      | `"WARNING: Story US{N} has no acceptance scenarios. Generating skeleton test only."`                  |
| Story filter matches nothing | `"ERROR: No stories match filter '{filter}'. Available: US1, US2, ..."`                               |
| Playwright config missing    | `"WARNING: No playwright.config found. Using default configuration."`                                 |
| Feature ID not resolved      | `"ERROR: Could not determine feature ID from branch. Please specify."`                                |
