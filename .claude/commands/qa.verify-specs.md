---
description:
  Verify that feature specs are properly structured with Speckit conventions and contain valid Figma
  design references.
---

## User Input

```text
$ARGUMENTS
```

## Mode Detection

- If user input is `all` → **All Features mode**: scan every `specs/NNN-*` directory
- If user input is empty → **Single Feature mode**: check current feature branch's spec only

## Execution

### Step 1: Discover feature(s)

**Single Feature mode:** Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` to
get `FEATURE_DIR` and `FEATURE_SPEC`. If the script fails (e.g., not on a feature branch), fall back
to auto-detecting `specs/` directories:

```bash
FEATURE_DIR=$(ls specs/ | grep -E '^[0-9]{3}-' | head -1)
```

If no feature directory found, abort with: "ERROR: No feature directory found. Create one with
/speckit.specify or switch to a feature branch."

**All Features mode:** List all directories matching `specs/[0-9][0-9][0-9]-*`:

```bash
ls -d specs/[0-9][0-9][0-9]-*/ 2>/dev/null
```

### Step 2: Run checks per feature

For each feature directory, run these checks in order. Checks cascade — if an earlier check fails,
later checks are marked SKIP.

| #   | Check                          | Severity | Pass Condition                                  |
| --- | ------------------------------ | -------- | ----------------------------------------------- | ---- | ----- | ---------- |
| 1   | `spec.md` exists               | Critical | File present in feature directory               |
| 2   | `## Design References` heading | High     | Exact case-sensitive match in spec.md           |
| 3   | Valid Figma URL                | Medium   | URL matches `https://(www\.)?figma\.com/(design | file | board | make)/...` |

- If Check 1 fails → Checks 2-3 = SKIP
- If Check 2 fails → Check 3 = SKIP

### Step 3: Generate report

Output a markdown table:

```markdown
## Spec Verification Report

**Mode**: [Single Feature | All Features] **Date**: YYYY-MM-DD **Features Scanned**: N

| Feature | spec.md   | Design References | Figma URL      | Status                  |
| ------- | --------- | ----------------- | -------------- | ----------------------- |
| ...     | PASS/FAIL | PASS/FAIL/SKIP    | PASS/FAIL/SKIP | ALL PASS / ISSUES FOUND |

### Summary

- **Total Features**: N
- **Fully Passing**: N (%)
- **With Issues**: N (%)
```

### Step 4: Remediation (interactive)

If issues are found, offer to fix them:

- **Missing `spec.md`**: Direct user to run `/speckit.specify` (cannot auto-create)
- **Missing `## Design References`**: Ask for a Figma URL, then append the section to spec.md
- **Missing/invalid Figma URL**: Ask for a URL, validate format
  (`https://(www\.)?figma\.com/(design|file|board|make)/...`), add to existing section

User can type `skip` to skip any feature's fix.

## Rules

- Read-only during analysis. Files only modified after explicit user approval.
- `all` mode only scans directories matching `[0-9][0-9][0-9]-*` — other directory names are
  silently ignored.
- Never create spec.md files — that's `/speckit.specify`'s job.
