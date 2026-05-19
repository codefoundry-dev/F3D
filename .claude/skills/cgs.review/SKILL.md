---
name: cgs.review
description:
  Review and fix code. Use when the user asks to review code, find issues, or wants a code review of
  their changes.
---

# Code Review & Fix Skill

You are performing a multi-stage interactive code review. Follow all stages strictly and in order.

---

## Stage 1: Determine What to Review

If the user specified what to review via `$ARGUMENTS`, use that directly and skip to Stage 2.

Otherwise, analyze the current git state to determine what makes sense to review:

1. Run `git status` to check for uncommitted changes (staged + unstaged + untracked).
2. Run `git log -1 --oneline` to see the last commit.
3. Run `git branch --show-current` to get the current branch.
4. Try to determine if this branch is a feature/fix branch that will be merged into a base branch:
   - Check if a remote tracking branch exists: `git rev-parse --abbrev-ref @{upstream} 2>/dev/null`
   - Look at branch name prefixes (feature/, fix/, bugfix/, etc.) to guess the merge target.
   - Detect the default branch: first try `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`
     (strips the `refs/remotes/origin/` prefix), then fall back to checking if `main`, `master`, or
     `develop` exists: `git branch --list main master develop`
   - If a likely base branch is found, compute the diff: `git diff <base>...HEAD`

Based on findings, present the user with applicable options using AskUserQuestion:

- **Option 1: "Uncommitted changes"** — only if there are uncommitted changes (staged, unstaged, or
  untracked files).
- **Option 2: "Last commit"** — review only the last commit's diff.
- **Option 3: "Uncommitted changes + last commit"** — only if there are uncommitted changes.
- **Option 4: "Branch diff against `<base-branch>`"** — only if you detected a likely base branch.
  Show the actual base branch name. This reviews all commits on the current branch since it diverged
  from base.
- **Option 5: "Let me specify"** — always available. If chosen, ask the user what to review (a
  commit range, a file, a specific diff, etc.).

Wait for the user's choice before proceeding.

Once the scope is determined, gather the actual diff/code to review:

- For uncommitted changes: `git diff` (unstaged) + `git diff --cached` (staged) + list untracked
  files with `git ls-files --others --exclude-standard` and read them. Skip binary files (detect
  using `file --mime-type` or check if `git diff --numstat` shows `-` for the file) and files larger
  than 500 lines. If there are more than 20 untracked files, ask the user which ones to include.
- For uncommitted changes + last commit: combine `git show HEAD` with `git diff` (unstaged) +
  `git diff --cached` (staged) + untracked files (same as uncommitted changes gathering above).
- For last commit: `git show HEAD`
- For branch diff: `git diff <base>...HEAD`
- For user-specified: follow their instructions.

Store the chosen scope description — you will need it in Stage 4.

---

## Stage 2: Review Code

**Before launching the subagent**, estimate the size of the diff/code to review. If the total
content exceeds ~800 lines, split the review into multiple subagent calls — one per file or logical
batch of files. When splitting, ensure each chunk includes the full file path context so that line
numbers remain unambiguous when merged. Merge all issue lists into a single queue before proceeding
to Stage 3.

Launch a **foreground** subagent (using the Agent tool, subagent_type: "general-purpose") with the
following prompt. The subagent must NOT have prior context — pass ALL necessary information in the
prompt, including the full diff or code content.

**Subagent prompt must include:**

1. The full diff/code to review (inline it in the prompt). If the diff was split into chunks,
   include only the current chunk. Additionally, for each file in the diff, include the full current
   file content so the subagent can provide accurate file-absolute line numbers.
2. Instructions to review for:
   - Bugs and logic errors
   - Security vulnerabilities (injection, XSS, auth issues, etc.)
   - Performance problems
   - Error handling gaps
   - Race conditions or concurrency issues
   - Code style / readability problems (only significant ones)
   - Missing edge cases
   - API misuse or incorrect library usage
3. Instructions to return a **numbered list of issues**, each with:
   - **File** and **line number(s)** (use file-absolute line numbers, not diff-relative offsets)
   - **Severity**: critical / warning / suggestion
   - **Description**: what the issue is
   - **Suggested fix**: brief description of how to fix it
4. If no issues found, return exactly: "No issues found."

Parse the subagent's response into a structured issue queue.

---

## Stage 3: Interactive Issue Resolution

If there are no issues, print "No issues found. You're good!" and skip to Stage 4.

Otherwise, process issues one by one from the queue. For each issue:

1. Print the issue details clearly:

   ```
   Issue [N/total]: [severity]
   File: [file]:[line]
   [description]
   Suggested fix: [suggested fix]
   ```

2. Ask the user to choose one of these options using AskUserQuestion:
   - **"Auto fix"** — Immediately before making any changes for this specific issue, read and store
     the current content of each file you will modify (this is the rollback snapshot — take it fresh
     for each issue, not once at the start). Then attempt to fix the issue. After fixing:
     - Show what was changed.
     - Ask the user: is this resolved?
       - **"Yes"** → mark as resolved, proceed to next issue.
       - **"No, let me give guidance"** → get a prompt from the user on what to correct, then
         re-attempt the fix. After re-attempt, ask again if resolved.
       - **"No, I'll fix it myself"** → wait for user to confirm they're done, then proceed.
       - **"Rollback and skip"** → restore the affected files to the rollback snapshot (the content
         before this auto-fix was applied), NOT to the last git commit. Use the Write tool with the
         stored content. Move this issue to the end of the queue.
   - **"I'll fix it myself"** — User handles it. Ask the user to confirm when they're done using
     AskUserQuestion. Only mark as resolved and proceed to the next issue after the user confirms.
   - **"Reject (false positive)"** — Skip it, mark as rejected. Do not re-queue.
   - **"Skip for now"** — Move this issue to the end of the queue.

Continue until the queue is empty.

Track how many issues were actually fixed (auto-fixed or user-fixed) vs rejected vs skipped.

---

## Stage 4: Wrap Up

If all issues were rejected or there were no issues at all:

- Print "Review complete. No actionable issues." and end.

If there were actual fixes made (either by you or the user):

- Print a summary: how many fixed, how many rejected.
- Ask the user using AskUserQuestion:
  - **"Review new changes only"** — Go back to Stage 2, but only review the newly made changes (the
    diff since the review started). This means: uncommitted changes only.
  - **"Review all changes (new + original)"** — Go back to Stage 2, reviewing both the original
    scope AND the new fixes combined. Use the original scope description from Stage 1 combined with
    uncommitted changes.
  - **"Done, no more review"** — End the skill.

If this is the 3rd or subsequent review cycle, warn the user that multiple review rounds have
occurred and recommend choosing "Done, no more review" unless there are critical issues remaining.

---

## Important Rules

- Always use AskUserQuestion for user choices — never assume.
- When auto-fixing, make minimal, targeted changes. Do not refactor surrounding code.
- Keep track of the issue queue properly — issues sent to the back should eventually come up again.
- Be concise in your output. Don't over-explain.
- If a rollback is requested, make sure to fully revert only the changes you made for that specific
  issue.
