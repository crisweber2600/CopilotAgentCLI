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
1) Data model: Entities and relationships per spec (Workflow, Step, Work Item, Executor, Assignment, Attempt, Gate Review, Scheduling Decision, Handoff Artifact, Baseline Integration, Blocker, Audit Record, Metric Set).
2) Contracts:
   - Artifact JSON schema (handoff‑artifact v1) with required business fields.
   - CLI integration contract: mapping new/extended commands and env vars to support claim/release, status, artifact commit, and baseline integration.
   - GitHub Actions workflow contract: job triggers, concurrency groups, claim/taken/done lifecycle, artifact commit conventions, and audit trail rules.
3) Quickstart: Step‑by‑step to enable flows locally and in CI, including how to run Copilot CLI to delegate work and how GH Actions claims tasks.
4) Update Copilot agent context: `.specify/scripts/bash/update-agent-context.sh copilot` after plan.md is committed.

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
|-----------|------------|-------------------------------------|
| — | — | — |

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
*Based on Constitution v2.1.1 (placeholder) - See `/memory/constitution.md`*

# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context
**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh copilot` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
