---
description:
  Create logical git commits — group by feature, include documentation updates with each commit.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Commit Workflow

### Step 0: Pre-flight checks — lint & build

Before analyzing changes, run lint and build to ensure a clean baseline:

```bash
pnpm lint
pnpm build
```

- If **lint errors** are found: fix them in the affected files first, then re-run `pnpm lint` until
  clean.
- If **build errors** are found: fix them in the affected files first, then re-run `pnpm build`
  until clean.
- Only proceed to Step 1 after both pass successfully.
- Fixes made during this step become part of the changes to commit (include in the relevant feature
  group, or as a separate `fix` commit if unrelated).

### Step 1: Analyze uncommitted changes

1. Run `git status -s` to see all modified/untracked files.
2. Run `git diff --stat` to understand the scope of changes.
3. Detect the active feature directory automatically:

   ```bash
   FEATURE_DIR=$(ls specs/ | grep -v timeline.md | head -1)
   ```

   Then read whichever documentation files exist under `specs/$FEATURE_DIR/`:
   - `spec.md` (gap tracker table) — if present
   - `plan.md` (architecture decisions, GAP sections) — if present
   - `tasks.md` (task status, epic status header) — if present

   If no `specs/` directory or feature directory exists, skip documentation steps entirely — commit
   code only.

### Step 2: Group changes into logical commits

Split all changes into **logical feature groups**. Each group should:

- Contain code changes that belong to **one User Story or feature** (e.g., US-1.05, US-1.09)
- Include the corresponding **documentation updates** for that feature
- Be self-contained — the codebase should compile after each commit

**Grouping rules:**

- Backend + frontend + API client for the same feature → one commit
- Shared files (paths.ts, index.ts, schema.prisma) → include with the most relevant feature commit
- i18n keys → include with the commit that uses them
- Pure formatting/prettier changes → separate `style()` commit at the end
- Documentation updates → **ALWAYS include with the code commit**, never separate

### Step 3: Create commits (iterate per group)

For each commit group, in dependency order, perform these sub-steps **sequentially**.

> **MANDATORY GATE**: Before EVERY `git add` or `git commit`, you MUST have already completed Step
> 3a (documentation update) for this group. If you find yourself about to stage files and you
> haven't touched any docs yet — STOP. Go back to 3a first. This is the #1 most common mistake.

#### 3a. UPDATE DOCUMENTATION FIRST (before ANY staging)

> Skip ONLY if no documentation files exist under `specs/$FEATURE_DIR/`.

**This step is NON-NEGOTIABLE.** You must update docs BEFORE staging code. Every commit group needs
its own incremental doc update. Do NOT batch all documentation updates into a single commit.

**Checklist — confirm each before proceeding to 3b:**

- [ ] **tasks.md**: Added new `T###` entries for tasks completed in THIS commit, marked `[x]` done.
      Update Epic Status header only in the **last** commit.
- [ ] **spec.md**: Updated the specific row(s) in the Gap Tracker table affected by this commit's
      code. Update status header only in the **last** commit.
- [ ] **plan.md**: Updated the relevant GAP-N section if new architecture was introduced.
- [ ] **QA reports** (only if this commit includes test files):
  - Unit tests (`.test.ts`, `.test.tsx`) → update `specs/$FEATURE_DIR/qa-unit-report.md`
  - E2E tests (`.e2e.ts`, `.spec.ts` in e2e/) → update `specs/$FEATURE_DIR/qa-e2e-report.md`
  - Add test count, coverage summary, or list of new/modified test suites as appropriate.

After editing the doc files, proceed immediately to 3b — stage them together with the code.

#### 3b. Stage files (code + docs together)

Stage ONLY the code files + documentation files for this group:

```bash
git add <specific code files> <specific doc files from 3a>
```

> Double-check: are docs included in the staging? If not, go back to 3a.

#### 3c. Commit

```bash
git commit -m "$(cat <<'EOF'
type(US-X.XX): short description (T### task IDs)

Optional longer description (2-3 lines max).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

#### 3d. Handle hook failures

If lint-staged hooks fail, fix the issue and create a NEW commit (never amend).

#### 3e. Repeat for next group

Move to the next commit group and repeat **from 3a** (docs first!).

### Commit Message Format

```
type(US-X.XX): short description (T### task IDs)

Optional longer description (2-3 lines max) explaining
what was done and why.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Type prefixes:**

- `feat` — new feature or functionality
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `style` — formatting, prettier, whitespace only
- `chore` — build, deps, config changes
- `docs` — documentation only (rare — prefer including docs with code)

**Rules:**

- Header max 100 characters (commitlint enforced)
- Always include `US-X.XX` scope (e.g., `US-1.05`, `US-1.09`)
- Always include task IDs in parentheses: `(T151b, T192)`
- Use HEREDOC for multi-line messages to preserve formatting
- Pass message via: `git commit -m "$(cat <<'EOF' ... EOF)"`

### Step 4: Final verification

After all commits:

1. Run `git status -s` — working tree should be clean (except ignored files like `.mcp.json`)
2. Run `git log --oneline -N` (where N = number of commits created) to show summary

### Step 5: Push (if requested)

Push to remote only when explicitly asked:

```
git push origin <branch-name>
```

## Example

Given changes across US-1.05 (CompanyDetailPage) and US-1.10 (UserDetailPage):

**Commit 1 (US-1.05):**

```
feat(US-1.05): super-admin CompanyDetailPage with tabs (T151b, T192)

CompanyDetailPage with Overview/CompanyUsers/Documents tabs.
Eye icon navigates to /companies/:id. ActionLogTab wired to API.
```

Files: `CompanyDetailPage.tsx`, `OverviewTab.tsx`, `route-config.ts`, `AppLayout.tsx` Docs updated:
spec.md row 1.05/7, plan.md GAP-5 T192 note, tasks.md T192 entry

**Commit 2 (US-1.10):**

```
feat(US-1.10): single-card user detail layout (T205)

Wrap all profile sections in single card. Extract constants.
```

Files: `UserDetailPage.tsx`, `ProfileSections.tsx`, `constants.ts` Docs updated: spec.md row 1.10,
plan.md GAP-6 note, tasks.md T205 entry + epic status header

## Key Rules

### DOCS-FIRST Rule (highest priority)

- **Step 3a (docs) MUST happen BEFORE Step 3b (staging) — EVERY time, for EVERY commit group**
- If you catch yourself about to `git add` without having updated docs → STOP and do 3a first
- Each commit = code changes + incremental doc updates staged and committed TOGETHER

### Other rules

- **NEVER** batch all doc updates into one commit — update docs incrementally per commit group
- **NEVER** use `git add -A` or `git add .` — always stage specific files
- **NEVER** amend previous commits — always create new ones
- **NEVER** skip hooks (`--no-verify`)
- **ALWAYS** run git hooks on every commit — let pre-commit and commit-msg hooks execute normally
- **ALWAYS** run `pnpm lint` and `pnpm build` before the first commit and verify they pass
- **ALWAYS** fix lint/build errors before committing — never commit broken code
- **ALWAYS** verify `git status -s` shows clean working tree after all commits
- **ALWAYS** use specific `US-X.XX` in scope, not generic `US-1`
- Group by feature, not by file type (don't separate "all backend" / "all frontend")
