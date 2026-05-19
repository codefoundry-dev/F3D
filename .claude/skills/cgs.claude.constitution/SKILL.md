---
name: cgs.claude.constitution
description:
  Generate a project constitution tailored to a specific tech stack while preserving stack-agnostic
  code quality principles from the CGS reference. Requires explicit tech stack input — use when the
  project differs from the CGS default (NestJS/React/React Native). Delegates to
  speckit.constitution for the generation workflow.
argument-hint: '<tech-stack-description>'
---

## User Input

```text
$ARGUMENTS
```

## Goal

Generate a constitution preserving CGS stack-agnostic quality principles, adapting stack-specific
sections to the project's actual tech stack.

## Step 1: Fetch CGS Reference

```bash
CGS_TMP=$(mktemp -d) && git clone --depth 1 https://github.com/CodeGeneration-2020/cgs-team-claude-setup.git "$CGS_TMP"
```

Read `$CGS_TMP/.specify/memory/constitution.md` as the reference.

## Step 2: Require Tech Stack — MANDATORY

If `$ARGUMENTS` has a tech stack description, use it. Otherwise ask via AskUserQuestion:

> **What is your project's tech stack?** (Required — cannot skip) Specify: backend (framework,
> language, DB, ORM), frontend (framework, styling, state mgmt), mobile (if any), monorepo tool (if
> any), testing tools.

**Do NOT proceed without concrete details.** If vague, ask follow-ups ("Which framework?", "Which
styling?", "Desktop or web?"). Minimum needed: primary language, framework, styling/state approach.

## Step 3: Generate Constitution

Read the CGS reference. Generate a new constitution at `.specify/memory/constitution.md`:

**Stack-agnostic principles to PRESERVE** (adapt examples/tools, keep rules):

| Principle                  | Core Rule to Keep                                                |
| -------------------------- | ---------------------------------------------------------------- |
| Clean Architecture & SOLID | Dependency rule, SRP/OCP/LSP/ISP/DIP, separation of concerns     |
| Modular Architecture       | Domain-driven modules, barrel exports, no cross-module internals |
| Strict Type Safety         | Strict compiler, no `any`/equivalent, shared type defs           |
| Security by Design         | Auth, RBAC, rate limiting, input validation, secrets via env     |
| Testing Discipline         | Unit + integration required, 80%+ coverage, co-located tests     |
| Independent Deployability  | Containerization, stateless, env config, health checks, CI/CD    |
| Observability-First        | Structured logging, error monitoring, error boundaries           |
| Shared-Before-Custom       | Centralize reusable code, no cross-boundary duplication          |
| Code Quality               | DRY, DI, no biz logic in UI, linting, formatting                 |
| Naming Conventions         | Consistent file/class/variable/API/branch/commit naming          |
| Error Handling             | Typed exceptions, standard response envelope                     |
| Design Tokens              | Centralized visual tokens, no hardcoded values                   |
| PR & Review Workflow       | Squash merge, conventional commits, min approvals                |
| Governance                 | Amendment procedure, versioning, compliance gates                |

**Generation rules:**

- **Remove** inapplicable sections (mobile if none, monorepo if single app)
- **Adapt** tech stack tables, folder structures, behavioral contracts, tool refs
- **Add** sections for new concerns (SSR, edge functions, etc.)
- **Match** CGS markdown structure and heading hierarchy
- **Set** version `1.0.0`, dates to today

After writing, if `.specify/templates/` exists, run speckit.constitution consistency propagation
(template sync, validation).

## Step 4: Cleanup & Report

```bash
rm -rf "$CGS_TMP"
```

Verify: no placeholders, all principles have rationale, tech stack matches description.

Print: version, tech stack summary, principles preserved/adapted/removed, suggested commit
`docs(constitution): initialize constitution for [tech-stack] (v1.0.0)`.
