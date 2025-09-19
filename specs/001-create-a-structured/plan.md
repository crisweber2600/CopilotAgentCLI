# Implementation Plan: Plan‑to‑Execution Orchestrator

**Branch**: `[001-create-a-structured]` | **Date**: 2025‑09‑19 | **Spec**: /home/cweber/CopilotAgentCLI/specs/001-create-a-structured/spec.md
**Input**: Feature specification from `/specs/001-create-a-structured/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `.github/copilot-instructions.md` for GitHub Copilot)
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

## Summary

This plan integrates the Plan‑to‑Execution Orchestrator feature spec into the speckit workflow (specify → plan → tasks) and wires it to:

- The existing Copilot CLI agent (TypeScript/Node) for delegation, session tracking, and baseline integration semantics.
- GitHub Actions as the default "executor pool" to claim, run, and complete tasks deterministically with exclusive assignment and tamper‑evident history via committed artifacts.
- Repository‑based durable handoff artifacts (files) as the notification mechanism across steps, aligning with FR‑014.

The output of this plan is a set of design artifacts (research, data model, contracts, quickstart) enabling /tasks to generate an actionable task list and enabling CI to run orchestration reliably.

## Technical Context

**Language/Version**: TypeScript (Node.js)
**Primary Dependencies**: TypeScript, Node.js stdlib, `open` (CLI dependency); GitHub Actions for executors
**Storage**: Git repository (files as durable artifacts committed per event)
**Testing**: Vitest for contract tests (present in tests/contract), plus GitHub Actions workflow validations
**Target Platform**: Linux CI runners, local dev via Node + git
**Project Type**: single (CLI library + services)
**Performance Goals**: MVP only; throughput governed by CI runners; deterministic scheduling required
**Constraints**: Deterministic scheduling, exclusive assignment, tamper‑evident history, no real‑time dashboards
**Scale/Scope**: MVP scope per spec; portfolio visibility via on‑demand exports

## Constitution Check

The current constitution file is a placeholder without explicit constraints. Default gates applied:

- CLI interface and text I/O observed.
- Test‑first planning respected by generating contracts and failing tests before implementation (via /tasks in next phase).
- Observability via artifact commits and CI logs.

Violations: None identified within MVP scope. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```
specs/001-create-a-structured/
├── plan.md              # This file (/plan output)
├── research.md          # Phase 0 output (/plan)
├── data-model.md        # Phase 1 output (/plan)
├── quickstart.md        # Phase 1 output (/plan)
├── contracts/           # Phase 1 output (/plan)
└── tasks.md             # Phase 2 output (/tasks - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 1: Single project (SELECTED)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Option 1 (single project) fits the CLI + services codebase.

## Phase 0: Outline & Research

Unknowns and choices captured in research.md:

- Task claim semantics in CI (exclusive assignment, retries → new attempt).
- Artifact schema for handoff (FR‑014) and baseline integration events.
- Deterministic scheduling across parallelizable steps using CI runners (grouping, tie‑breakers, launch order).
- Mapping FR‑entities to CLI commands and GitHub Actions.
- Base branch detection and enforcement in CLI (GitService) to align with "Baseline Integration" events.

Output: research.md consolidates decisions, trade‑offs, and patterns.

## Phase 1: Design & Contracts

This phase produces the concrete design:

1. Data model: Entities and relationships per spec (Workflow, Step, Work Item, Executor, Assignment, Attempt, Gate Review, Scheduling Decision, Handoff Artifact, Baseline Integration, Blocker, Audit Record, Metric Set).
2. Contracts:
   - Artifact JSON schema (handoff‑artifact v1) with required business fields.
   - CLI integration contract: mapping new/extended commands and env vars to support claim/release, status, artifact commit, and baseline integration.
   - GitHub Actions workflow contract: job triggers, concurrency groups, claim/taken/done lifecycle, artifact commit conventions, and audit trail rules.
3. Quickstart: Step‑by‑step to enable flows locally and in CI, including how to run Copilot CLI to delegate work and how GH Actions claims tasks.
4. Update Copilot agent context: `.specify/scripts/bash/update-agent-context.sh copilot` after plan.md is committed.

### CI Orchestration Pattern (Isolation‑Aware)
- Orchestrator job (single): reads `artifacts/schedule/{workItem}.json`, applies deterministic rules (FR‑005), and emits a matrix of ready attempts in stable launch order. Optionally pre‑writes claim files to ensure exclusive assignment before fan‑out.
- Execute jobs (matrix): each entry processes one attempt; on completion, produce handoff artifacts (FR‑014).
- Collector job (single): downloads produced artifacts (or reads direct commits) and commits a batch to the durable workspace to minimize push contention; the commit can trigger the next orchestration cycle.

Persistence strategies given isolated runners:
1) Direct producer commit with rebase+retry (unique file paths avoid collisions). 
2) Upload as workflow artifacts, then a single Collector commits once. Both preserve tamper‑evident history and exclusive assignment semantics.

Concurrency controls:
- Ensure only one orchestration instance per work item at a time (e.g., concurrency key per work item) to preserve determinism and audit trail.

## Phase 2: Task Planning Approach

The /tasks phase will generate tasks.md from Phase 1 artifacts. Strategy:

- Contracts → contract tests [P]
- Entities → model/service scaffolds [P]
- User scenarios → integration tests
- Implementation tasks to make tests pass in TDD order

Ordering:

- Tests before implementation
- Models → services → CLI changes → CI workflows
- Mark independent tasks with [P] for parallel execution

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (for MVP)
- [ ] Complexity deviations documented

---

_Based on Constitution v2.1.1 (placeholder) - See `/memory/constitution.md`_
