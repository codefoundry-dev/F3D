---
name: cgs.claude.setup
description:
  Bootstrap a project with the CGS Claude Code toolchain. Copies cgs.* skills, _* guide skills,
  speckit.* commands, agents, MCP config, and constitution from the latest cgs-team-claude-setup
  repo. Use when setting up a new project or syncing to the latest CGS toolchain version.
argument-hint: '[--update]'
---

## Goal

Set up the current project with the full CGS Claude Code toolchain from the latest GitHub source.

## Step 1: Fetch Source

```bash
CGS_TMP=$(mktemp -d) && git clone --depth 1 https://github.com/CodeGeneration-2020/cgs-team-claude-setup.git "$CGS_TMP"
```

## Step 2: Copy Assets

```bash
mkdir -p .claude/skills .claude/commands .claude/agents .specify
cp -R "$CGS_TMP"/.claude/skills/cgs.* .claude/skills/
cp -R "$CGS_TMP"/.claude/skills/_* .claude/skills/
cp "$CGS_TMP"/.claude/commands/speckit.* .claude/commands/
cp "$CGS_TMP"/.claude/agents/*.md .claude/agents/
cp "$CGS_TMP"/.mcp.json .mcp.json
cp "$CGS_TMP"/skills-lock.json skills-lock.json 2>/dev/null || true
cp "$CGS_TMP"/.claude/settings.local.json .claude/settings.local.json
cp -R "$CGS_TMP"/.specify/templates .specify/ 2>/dev/null || true
cp -R "$CGS_TMP"/.specify/scripts .specify/ 2>/dev/null || true
```

## Step 3: Tech Stack — MANDATORY, CANNOT BE SKIPPED

Ask via AskUserQuestion:

> **Does your project use the same tech stack as the CGS default?**
>
> CGS default: NestJS + TypeScript + PostgreSQL/Prisma (backend), React + Tailwind +
> Zustand/TanStack Query (frontend), React Native + React Navigation (mobile), Turborepo + pnpm
> (monorepo), Jest + Playwright + Maestro (testing), Pino + Sentry + Prometheus (observability)
>
> **"Yes, same stack"** | **"No, different stack"**

**CRITICAL**: Must get an answer. If user tries to skip, re-ask. Hard gate — do NOT proceed without
yes/no.

## Step 4: Constitution

**If same stack**:
`mkdir -p .specify/memory && cp "$CGS_TMP"/.specify/memory/constitution.md .specify/memory/constitution.md`

**If different stack**:

1. Ask for their tech stack (**MANDATORY**, cannot skip): "Describe your tech stack — backend
   framework/language, frontend framework/styling, DB, state management, mobile (if any), monorepo
   tool (if any), testing tools." If vague, ask follow-ups until you have: primary language,
   framework, styling/state approach.
2. Invoke `/cgs.claude.constitution` with their tech stack description.

## Step 5: Cleanup & Report

```bash
rm -rf "$CGS_TMP"
```

Print: assets copied (skills, commands, agents, config), constitution status (as-is or generated),
reminder to review `.mcp.json` and `.claude/settings.local.json`.
