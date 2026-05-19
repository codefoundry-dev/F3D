---
name: cgs.ba.inscope
description:
  Validate whether new requirements are in scope of the current project. Use this skill whenever the
  user wants to check if a feature request, requirement, user story, or change request fits within
  the project's defined boundaries — even if they just say "is this in scope?", "can we do this?",
  "does this fit our project?", paste requirements text, or reference a requirements file. Also use
  when reviewing incoming tickets, backlog items, or stakeholder requests for scope alignment.
argument-hint: '<requirements-text-or-file-path>'
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

The input can be:

- **Plain text** describing a requirement, feature request, or user story
- **A file path** pointing to a document containing requirements (e.g., a spec draft, ticket
  description, email export)
- **Multiple requirements** separated by line breaks or numbered lists

If the input is a file path, read the file first to extract the requirements.

## Goal

Determine whether new requirements fit within the current project's defined scope by analyzing them
against all available Speckit artifacts. Produce a structured verdict with clear reasoning so the
team can make an informed go/no-go decision.

This skill is project-agnostic — it works with any project that uses Speckit, deriving scope
boundaries entirely from the project's own artifacts.

## Phase 1: Discover Project Scope

Read the following Speckit artifacts to build a picture of the project's defined boundaries. Not all
artifacts will exist in every project — use whatever is available.

### Primary scope authority (read first)

1. **Constitution** — `.specify/memory/constitution.md` The supreme authority on architecture, tech
   stack, principles, naming conventions, and governance. If it exists, it defines the hard
   boundaries of what the project can and cannot do.

2. **Existing feature specs** — find all `spec.md` files in the project These reveal the business
   domains the project already covers and the kinds of features that have been accepted before.

### Secondary scope context (read if available)

3. **Implementation plans** — find all `plan.md` files These show architectural decisions already
   made, API contracts, and data models.

4. **Task breakdowns** — find all `tasks.md` files These reveal implementation patterns and the
   granularity of work the project typically handles.

5. **Templates** — `.specify/templates/` These show the project's expected artifact structure and
   what kinds of work are anticipated.

### Tertiary context (skim if available)

6. **README** or project-level documentation
7. **Package structure** (monorepo layout, existing modules/features)
8. **Existing code structure** — a quick scan of `src/` or equivalent to understand established
   domains

Spend time understanding the project before evaluating. The quality of the scope verdict depends on
how well you understand the project's boundaries.

## Phase 2: Analyze Requirements

For each requirement (or group of related requirements), evaluate against these dimensions:

### Dimension 1: Architecture Alignment

Does the requirement fit within the project's defined architecture?

- Monorepo structure, module boundaries, dependency rules
- Clean Architecture layers (domain, application, infrastructure)
- Deployment model and infrastructure patterns

### Dimension 2: Tech Stack Compliance

Can the requirement be implemented using the project's defined technology choices?

- Languages, frameworks, libraries defined in the constitution
- Database, ORM, API patterns
- Frontend/mobile frameworks and state management
- If the requirement implies technologies outside the defined stack, flag it

### Dimension 3: Business Domain Fit

Does the requirement relate to existing business domains or represent a reasonable extension?

- Does it touch domains already defined in existing specs?
- Is it a natural extension of existing functionality?
- Does it introduce an entirely new domain — and if so, does the project's architecture support
  that?

### Dimension 4: Principle Compliance

Does the requirement align with the project's stated principles and conventions?

- Security requirements (auth, RBAC, data validation)
- Testing expectations (coverage thresholds, test types)
- Code quality standards (type safety, error handling patterns)
- Accessibility, performance, observability standards

### Dimension 5: Feasibility Within Constraints

Can the requirement be delivered within the project's operational constraints?

- Does it respect existing governance (PR workflow, review process)?
- Does it fit the project's deployment pipeline?
- Are there dependencies on external systems not currently integrated?

## Phase 3: Produce Verdict

Present the analysis using this structure:

---

### Scope Analysis Report

**Requirements analyzed**: [brief summary of what was evaluated]

**Overall Verdict**: **IN SCOPE** | **PARTIALLY IN SCOPE** | **OUT OF SCOPE**

**Confidence**: High | Medium | Low (Low confidence means the project's Speckit artifacts don't
provide enough information to make a definitive call — recommend the team discuss further)

---

#### Dimension Breakdown

| Dimension              | Status                   | Notes              |
| ---------------------- | ------------------------ | ------------------ |
| Architecture Alignment | In Scope / Partial / Out | [one-line summary] |
| Tech Stack Compliance  | In Scope / Partial / Out | [one-line summary] |
| Business Domain Fit    | In Scope / Partial / Out | [one-line summary] |
| Principle Compliance   | In Scope / Partial / Out | [one-line summary] |
| Feasibility            | In Scope / Partial / Out | [one-line summary] |

---

#### Detailed Findings

For each dimension that is not fully "In Scope", provide:

**[Dimension Name]** — [Status]

- **What conflicts**: specific constitutional principles, tech stack items, or architectural rules
  that the requirement tensions with
- **Evidence**: quote or reference the specific Speckit artifact and section
- **Impact**: what would need to change if this requirement were accepted

---

#### Recommendations

- **If IN SCOPE**: confirm alignment and suggest which Speckit workflow step to proceed with (e.g.,
  "Ready for `/speckit.specify`")
- **If PARTIALLY IN SCOPE**: list specific adjustments that would bring the requirement fully into
  scope, or constitutional amendments that would be needed
- **If OUT OF SCOPE**: explain clearly why, and suggest alternatives if possible (e.g., "This could
  be achieved within scope by [approach]" or "This would require a constitution amendment to
  [section]")

---

## Operating Constraints

1. **READ-ONLY**: This skill never modifies any project files. It is purely analytical.
2. **EVIDENCE-BASED**: Every finding must reference a specific Speckit artifact. Do not make
   assumptions about project scope that aren't backed by the artifacts.
3. **CHARITABLE INTERPRETATION**: When a requirement is ambiguous, evaluate both the in-scope and
   out-of-scope interpretations. Flag the ambiguity rather than assuming the worst.
4. **NO ARTIFACT, NO HARD BOUNDARY**: If the project lacks a constitution or specs, be transparent
   about the limited basis for the verdict. Use whatever artifacts exist, and flag the confidence as
   Low.
5. **MULTIPLE REQUIREMENTS**: When given multiple requirements, evaluate each independently but note
   any cross-requirement dependencies or conflicts.
6. **SCOPE != PRIORITY**: This skill determines whether something fits the project's boundaries, not
   whether it should be prioritized. Avoid making priority judgments.
