# Capture Skill — Edge Case Test Matrix

Test cases for `/cgs.figma.capture`. Organized by skill step and cross-cutting concerns.

---

## 1. Argument Parsing

### 1.1 Figma URL (required)

- [ ] `https://figma.com/design/abc123/My-File` -> `fileKey=abc123`, no nodeId
- [ ] `https://www.figma.com/design/abc123/My-File` -> same (www prefix)
- [ ] `https://figma.com/design/abc123/My-File?node-id=12-34` -> `nodeId=12:34` (dash to colon)
- [ ] `https://figma.com/file/abc123/My-File` -> legacy `/file/` URL still extracts fileKey
- [ ] `https://figma.com/design/abc123/branch/xyz789/My-File` -> uses `branchKey=xyz789` as fileKey
- [ ] URL with trailing tracking params `?node-id=1-2&t=abc&p=def` -> strips `&t=`, `&p=`
- [ ] No URL provided -> abort with `"ERROR: Figma URL is required."`
- [ ] Invalid URL (not figma.com) -> abort with error
- [ ] Malformed Figma URL (`figma.com/design/` with no fileKey) -> abort with error

### 1.2 Screen filter

- [ ] Single story filter: `US1` -> only screens from US1 describe block
- [ ] Multi-story filter: `US1,US3` -> screens from both stories
- [ ] Screen name substring: `"Empty State"` -> matches screen names containing that text
- [ ] Case-insensitive filter: `empty state` matches "Empty State"
- [ ] Filter matches zero screens -> abort with error listing available screen names
- [ ] Filter is a partial word: `modal` matches "Add Task Modal", "Edit Task Modal"

### 1.3 `--new` flag

- [ ] `--new` with Figma URL -> only screens without Figma frames
- [ ] `--new` combined with screen filter -> filter applied first, then --new filters within results
- [ ] `--new` when all screens already have Figma frames -> reports "all captured" message
- [ ] `--new` when Figma file is empty -> all screens are NEW

### 1.4 `--viewport` filter

- [ ] `--viewport=D` -> desktop only for all screens
- [ ] `--viewport=D,M` -> desktop and mobile
- [ ] `--viewport=T` -> tablet only
- [ ] `--viewport=D,T,M` -> all three (same as no filter)
- [ ] `--viewport` overrides per-screen defaults (modal that would be D/M becomes D only)

### 1.5 Argument combinations

- [ ] Figma URL + screen filter + `--viewport=D` -> all three applied together
- [ ] Figma URL + `--new` -> only new screens pushed to Figma
- [ ] Figma URL + `--new` + `--viewport=M` -> only new + mobile-only
- [ ] Screen filter + `--new` -> filter first, then only uncaptured matches
- [ ] All flags at once: `https://figma.com/design/abc/f US1 --new --viewport=D,M`

---

## 2. Feature Scope Detection

### 2.1 Branch name parsing

- [ ] Branch `feature/auth-flow` -> feature ID `auth-flow`
- [ ] Branch `feat/auth-flow` -> feature ID `auth-flow`
- [ ] Branch `auth-flow` (no prefix) -> feature ID `auth-flow`
- [ ] Branch `feature/001-task-board` -> feature ID `001-task-board`
- [ ] Branch `main` or `master` -> no feature ID derivable, asks user
- [ ] Branch `bugfix/fix-login` -> should strip `bugfix/` or ask user?
- [ ] Branch with nested prefix `feature/team/auth-flow` -> ambiguous, asks user

### 2.2 Directory resolution

- [ ] `tests/e2e/{feature-id}/` exists with test files -> proceed
- [ ] `tests/e2e/{feature-id}/` doesn't exist -> abort (no e2e tests)
- [ ] `tests/e2e/` doesn't exist at all -> abort

### 2.3 Repo root

- [ ] Not in a git repo -> error
- [ ] Invoked from a subdirectory -> still finds repo root via `git rev-parse`

---

## 3. Screen Discovery from E2E Tests

### 3.1 Test file discovery

- [ ] Single test file in `tests/e2e/{feature-id}/` -> discovered
- [ ] Multiple test files -> all read
- [ ] `capture-screens.spec.ts` in the directory -> excluded
- [ ] `figma-visual.spec.ts` in the directory -> excluded
- [ ] `visual-regression.spec.ts` in the directory -> excluded
- [ ] Only excluded files present (no functional test files) -> abort "no e2e tests"
- [ ] Test file with zero `test()` blocks -> skipped gracefully

### 3.2 Screen state extraction

- [ ] Test with `beforeEach` + setup in test body -> combines both for screen state
- [ ] Test with only `beforeEach` (no body setup before expect) -> `beforeEach` IS the screen
- [ ] Test with no `beforeEach` -> test body setup before first `expect()` is the screen
- [ ] Test with `expect()` as the very first line -> empty setup (app default state)
- [ ] Nested `test.describe` blocks -> inner describe's setup appended to outer

### 3.3 Deduplication

- [ ] Two tests with identical `beforeEach` + identical setup -> merged into one screen
- [ ] Two tests with same navigation but different seed data -> two separate screens
- [ ] Two tests with same seed but one has an extra click -> two separate screens
- [ ] Three tests that all just navigate to `/` with no setup -> one screen

### 3.4 Viewport assignment heuristics

- [ ] Test setup: only `page.goto('/')` -> fundamental state -> D/T/M
- [ ] Test setup: `seedData()` + `page.goto('/')` -> data-populated state -> D/T/M
- [ ] Test setup: `page.click('button')` opening a modal -> modal -> D/M
- [ ] Test setup: `page.selectOption('#filter')` -> filter state -> D
- [ ] Test setup: `page.fill('#search', 'term')` -> search state -> D

---

## 4. Existing Figma Frames Scan

### 4.1 Figma file states

- [ ] Figma file has no frames (empty page) -> all screens are NEW
- [ ] Figma file has all expected frames -> all EXISTS
- [ ] Figma file has some frames -> mix of NEW and EXISTS

### 4.2 Frame name parsing

- [ ] Standard name: `"Empty State - Desktop"` -> screen "Empty State", viewport Desktop
- [ ] Multi-word: `"Task List with Items - Tablet"` -> correct parsing
- [ ] Frame name without viewport suffix -> unrecognized, treated as non-capture frame

### 4.3 Classification

- [ ] Frame matches discovered screen + viewport exactly -> EXISTS
- [ ] Frame name close but not exact -> STALE (no fuzzy match)
- [ ] Frame for a viewport the screen doesn't need -> STALE
- [ ] e2e test removed but Figma frame remains -> STALE
- [ ] New e2e test added, no Figma frame yet -> NEW

### 4.4 `--new` filter edge cases

- [ ] All screens are NEW -> `--new` has no effect, captures everything
- [ ] All screens are EXISTS -> `--new` results in zero screens, reports "all captured"
- [ ] Mix of NEW and EXISTS -> only NEW captured
- [ ] Screen has some viewports NEW and some EXISTS -> only NEW viewports for that screen
- [ ] `--new` + screen filter that matches only EXISTS screens -> zero screens, reports message

---

## 5. Capture Plan Output

### 5.1 Plan content

- [ ] Plan shows correct total counts (new, exists, stale)
- [ ] Plan lists stale Figma frames by name
- [ ] Plan shows "Will Capture" vs "Skipping" summary

### 5.2 User responses

- [ ] User says "Capture" -> proceeds with filtered set
- [ ] User says "Capture all" -> overrides `--new`, captures everything
- [ ] User says "Adjust" -> allows modifying plan
- [ ] User says "Cancel" -> aborts cleanly with no file changes

---

## 6. Capture Script Generation

### 6.1 Import discovery

- [ ] Test files import from `../helpers/` -> same imports in capture script
- [ ] Test files import from `../fixtures/` -> same imports in capture script
- [ ] Multiple test files with overlapping imports -> deduplicated in capture script

### 6.2 Script structure

- [ ] One screen, one viewport -> single `test.describe` with `test.use()`
- [ ] One screen, three viewports -> three `test.describe` blocks
- [ ] Each describe block has correct `test.use({ viewport: { width, height } })`
- [ ] `test.describe.configure({ timeout: 60_000 })` set at top level

### 6.3 Setup code copying

- [ ] Simple setup (`page.goto('/')`) -> copied verbatim
- [ ] Multi-step setup (seed + click + fill) -> all steps in order
- [ ] Setup references imported helpers -> helpers are imported

---

## 7. Figma Capture (DOM Manipulation)

### 7.1 CSS variable resolution - style tags

- [ ] App uses CSS custom properties in `<style>` tags -> all resolved
- [ ] No `<style>` tags (external CSS only) -> no-op, no error
- [ ] `var()` with fallback: `var(--color, red)` -> resolved to computed value
- [ ] CSS variable not defined on `:root` -> fallback returns original `var()` string

### 7.2 CSS variable resolution - inline styles

- [ ] Element with `style="color: var(--text)"` -> resolved
- [ ] Element with no inline styles -> skipped
- [ ] Thousands of elements -> performance (completes within timeout)

### 7.3 Viewport dimension stamping

- [ ] Desktop viewport (1440x900) -> correct width/height stamped
- [ ] Mobile viewport (375x812) -> correct dimensions
- [ ] App body taller than viewport (scrollable) -> viewport height + `overflow: hidden`

### 7.4 Flex/grid inlining

- [ ] `display: flex` container -> width + height inlined
- [ ] `display: grid` container -> width + height inlined
- [ ] `max-width` container (not flex/grid) -> width + height inlined
- [ ] `display: block` element -> not touched

### 7.5 position:fixed conversion

- [ ] Modal overlay with `position: fixed` -> converted to absolute
- [ ] No fixed elements -> no-op
- [ ] Multiple fixed elements -> all converted

### 7.6 capture.js injection

- [ ] `capture.js` URL returns 200 -> script injected
- [ ] `capture.js` URL fails -> caught, logged, capture fails gracefully
- [ ] `captureForDesign` throws -> caught by try/catch, logged as warning

---

## 8. Figma MCP Integration

### 8.1 captureId generation

- [ ] `generate_figma_design` returns captureId -> stored
- [ ] `generate_figma_design` fails -> screen marked as FAILED in report

### 8.2 captureId polling

- [ ] Poll returns `completed` on first try -> success
- [ ] Poll returns `pending` then `completed` on 3rd try -> success after retries
- [ ] Poll never returns `completed` (10 retries exhausted) -> marked as failed in report

### 8.3 Figma file access

- [ ] Valid fileKey with write access -> captures land in file
- [ ] Valid fileKey but read-only access -> capture submission rejected
- [ ] Invalid fileKey -> `generate_figma_design` fails

### 8.4 Frame naming

- [ ] `document.title = "Empty State - Desktop"` -> Figma frame named correctly
- [ ] Screen name with special characters -> frame name has special chars

---

## 9. Playwright Execution

### 9.1 Test run

- [ ] All tests pass -> all captures submitted
- [ ] One test fails (bad selector) -> that screen marked FAILED, others continue
- [ ] Test fails on retry (2nd attempt) -> marked FAILED permanently
- [ ] Dev server not running (baseURL unreachable) -> all tests fail

### 9.2 Viewport projects

- [ ] Running with `--project=desktop` and internal `test.use()` -> correct viewports applied

---

## 10. Report Output

### 10.1 Report accuracy

- [ ] Report "Captured This Run" count matches actual successful captures
- [ ] Report "Previously Captured" lists correct skipped screens
- [ ] Report "Stale" lists correct orphaned Figma frames
- [ ] Summary numbers add up

### 10.2 Report sections

- [ ] No stale frames -> "Stale Frames" section omitted
- [ ] No previously captured (first run) -> "Previously Captured" section omitted
- [ ] All screens failed -> "Captured This Run" shows all FAILED

---

## 11. Cross-Cutting Concerns

### 11.1 Read-only analysis phase

- [ ] No files created before user approves plan
- [ ] No Figma MCP capture calls before user approves plan
- [ ] User cancels -> zero file changes in working directory

### 11.2 Idempotency

- [ ] Running twice with no changes -> same Figma frames (re-pushed)
- [ ] Running after adding a new e2e test -> detects new screen as NEW
- [ ] Running after removing an e2e test -> old Figma frame detected as STALE

### 11.3 Error recovery

- [ ] Partial capture (some succeed, some fail) -> report shows mixed results
- [ ] User re-runs after partial failure -> `--new` skips already-captured, retries failed

---

## 12. Specific Scenario Walkthroughs

### 12.1 First-time capture (empty Figma file)

- [ ] Figma file has no frames, no `capture-screens.spec.ts`
- [ ] Expected: all screens NEW, full capture plan, all pushed to Figma

### 12.2 Incremental capture (new screens added)

- [ ] 5 frames in Figma, 2 new e2e tests added
- [ ] Run with `--new` -> only 2 new screens captured and pushed
- [ ] Previous 5 Figma frames untouched

### 12.3 Selective recapture

- [ ] 7 frames in Figma, user changed CSS for one screen
- [ ] Run with `"Screen Name"` filter -> only that screen recaptured
- [ ] Other 6 Figma frames untouched

### 12.4 Full recapture

- [ ] 7 frames in Figma, UI overhaul
- [ ] Run without `--new` -> all 7 recaptured (new frames added)

### 12.5 Screen removed from tests

- [ ] 7 frames in Figma, one e2e test deleted
- [ ] Run -> 6 screens discovered, 1 Figma frame STALE
- [ ] Report suggests deleting stale frame

### 12.6 Screen renamed in tests

- [ ] "Task List" renamed to "Task Board" in e2e describe block
- [ ] Old Figma frame "Task List - Desktop" detected as STALE
- [ ] New screen "Task Board" detected as NEW
