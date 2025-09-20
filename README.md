# CopilotAgentCLI

## Project Overview
CopilotAgentCLI is a TypeScript-based CLI that operationalises the Plan-to-Execution Orchestrator. The implementation is split across the following concrete modules:

- CLI entrypoints in `src/cli/commands/*.ts` implement delegation (`delegate.ts`), execution control (`claim.ts`, `complete.ts`, `cancel.ts`, `gate.ts`), reporting (`status.ts`, `list.ts`, `result.ts`, `follow.ts`, `export.ts`), and authentication (`login.ts`, `logout.ts`, `approve.ts`, `deny.ts`). These commands are wired together by `src/cli/index.ts`.
- Core domain models in `src/models/` (for example `workflow.ts`, `step.ts`, `work_item.ts`, `attempt.ts`, `gate_review.ts`, `audit_record.ts`, `metric_set.ts`) encode the entities described in the orchestrator spec and are consumed by the services at runtime.
- Behavioural services live in `src/services/`, notably `scheduling_service.ts` (deterministic ready-step computation), `assignment_service.ts` (exclusive claim semantics), `artifact_service.ts` (JSON artifact persistence and baseline enforcement), `gate_service.ts`, `metrics_service.ts`, and `work_item_service.ts`. These services are invoked directly from the CLI commands and from tests.
- Durable state is written beneath `artifacts/` (`workflows/`, `work-items/`, `schedule/`, `claims/`, `handoff/`, `gates/`, `exports/`); the file layout matches what `ArtifactService` and GitHub Actions expect.
- Test coverage is enforced through Vitest suites under `tests/contract/`, `tests/integration/`, `tests/unit/`, and `tests/performance/`. For example, `tests/integration/scheduling_determinism.test.ts` exercises `SchedulingService`, while `tests/integration/baseline_integration_boundary.test.ts` asserts the baseline guardrails inside `ArtifactService`.

Tooling is managed via the checked-in `package.json` scripts (`build`, `test`, `lint`, `format`) and strict compiler rules in `tsconfig.json`. The codebase ships with an ESLint flat config (`eslint.config.js`) and Prettier configuration (`.prettierrc`).

### Repository Guide
- `specs/001-create-a-structured/`: Speckit source of truth (business spec, research, plan, data model, contracts, quickstart, generated tasks). The implementation consumes these artefacts directly; for instance, the AJV schema at `specs/001-create-a-structured/contracts/handoff-artifact.schema.json` is loaded by `ArtifactService`, and multiple tests read the same file during validation.
- `docs/ci-orchestration.md`: Describes the orchestrator, executor, and collector workflows implemented in `.github/workflows/`.
- `.github/workflows/`: CI automation (`orchestrator.yml`, `execute.yml`, `collector.yml`, `pr-auto-merge.yml`) that runs the CLI end-to-end.
- `tools/`: Support scripts and the remote-agent harness used in integration tests.

## Agentic Workflow (Implemented)
The end-to-end flow is executed by the code paths outlined below.

1. **Deterministic scheduling** — `src/cli/commands/delegate.ts` loads workflow definitions through `WorkflowRegistry` (`src/services/workflow_registry.ts`) and calls `SchedulingService` to emit `artifacts/schedule/{id}.json`. The behaviour is proven by `tests/integration/scheduling_determinism.test.ts` and `tests/unit/scheduling_tiebreak.test.ts`.
2. **Execution fan-out** — `.github/workflows/orchestrator.yml` invokes the CLI `delegate` command and passes a ready-matrix into `.github/workflows/execute.yml`. Each matrix job runs `copilot-cli claim`/`complete`, which are backed by `AssignmentService` and `ArtifactService` respectively, guaranteeing one executor per attempt. Contract coverage exists in `tests/integration/claim_semantics.test.ts` and `tests/integration/handoff_artifact_flow.test.ts`.
3. **Gate reviews & rework** — `copilot-cli gate` (`src/cli/commands/gate.ts`) persists review outcomes beneath `artifacts/gates/` using `GateService`. The rewind semantics are enforced in `tests/integration/gate_rework_flow.test.ts`.
4. **Baseline integration guardrail** — Baseline merges are represented as `baseline-integration` events within the same `artifacts/handoff/` directory. `ArtifactService.enforceBaselineBoundary` blocks new pre-baseline attempts until a revert-style artifact is recorded; see `tests/integration/baseline_integration_boundary.test.ts`.
5. **Portfolio exports & observability** — `copilot-cli export` (`src/cli/commands/export.ts`) pipes through `MetricsService` to produce `artifacts/exports/portfolio-*.json`, validated by `tests/integration/exports_snapshot.test.ts`. Session visibility commands (`status.ts`, `list.ts`, `follow.ts`, `result.ts`) rely on `SessionService` to stream and persist progress.
6. **Collector & history** — `.github/workflows/collector.yml` rebuilds the CLI and calls `copilot-cli export`, committing updated `artifacts/` so every action remains tamper-evident. The same flow can be executed locally via the documented commands in `docs/ci-orchestration.md`.

## Speckit Integration
Speckit drives the repository via concrete artefacts that the implementation consumes:

- `spec.md` defines user stories and acceptance criteria. The corresponding acceptance scenarios map directly to the Vitest suites (for example, the “notification-by-artifact” requirement is realised in `tests/integration/handoff_artifact_flow.test.ts`).
- `data-model.md` enumerates entities that materialise as the TypeScript classes inside `src/models/`. Their shapes are exercised throughout the service layer.
- `contracts/handoff-artifact.schema.json` is imported by `ArtifactService` and the contract test in `tests/contract/handoff_artifact_schema.test.ts`, ensuring runtime parity with the Speckit contract.
- `quickstart.md`’s walkthrough aligns with the executable steps inside the CLI commands and CI workflows; each stage is codified in integration tests and the GitHub Actions configurations.
- `tasks.md` captured the T001–T047 backlog that guided the implementation sequence. Every task now corresponds to committed code or tests (e.g., T039–T041 cover the orchestrator/execute/collector workflows present under `.github/workflows/`).

In practice, Speckit produces the structured source of truth, and CopilotAgentCLI consumes those files and enforces the guarantees through code and automated tests. This creates a closed loop where planning artefacts remain authoritative while the implementation provides the executable counterpart.

## Cross-Project Integration Guide
Use the following steps to adopt CopilotAgentCLI and its GitHub Actions automation in another repository:

1. **Install the CLI** – Add this repository as a dev dependency (for example `npm install --save-dev git+https://github.com/<your-org>/CopilotAgentCLI.git#<commit>` or `npm link` from a checked-out clone) or vendor the source tree. After installation, run `npm run build` so the published `bin` entry (`copilot-cli -> dist/cli/index.js`) is available.
2. **Pull in workflows** – Copy `.github/workflows/orchestrator.yml`, `execute.yml`, `collector.yml`, and `pr-auto-merge.yml` into the target project. These workflows depend only on Node.js 20 and the CLI commands located in `dist/cli/index.js` after `npm run build`.
3. **Seed artefact directories** – Replicate the `artifacts/` subdirectories (`workflows`, `work-items`, `schedule`, `claims`, `handoff`, `gates`, `exports`). `ArtifactService` (src/services/artifact_service.ts) expects this structure and will create missing directories at runtime.
4. **Author specs with Speckit** – Run Speckit in the new repository to generate `specs/.../spec.md`, `plan.md`, `data-model.md`, `contracts/`, and `tasks.md`. `SchedulingService`, `AssignmentService`, and the Vitest suites all read directly from these files, so no additional wiring is required beyond placing them in `specs/{feature-id}/`.
5. **Delegate work** – Trigger `.github/workflows/orchestrator.yml` via workflow dispatch or run `copilot-cli delegate --structured-work-item {id}` locally. This command uses `WorkflowRegistry` and `SchedulingService` to produce `artifacts/schedule/{id}.json`.
6. **Execute & validate** – Allow `.github/workflows/execute.yml` to fan out attempts. Each executor runs `copilot-cli claim` and `copilot-cli complete`, producing validated handoff documents enforced by the AJV schema located at `specs/{feature-id}/contracts/handoff-artifact.schema.json`.
7. **Collect history** – Enable `.github/workflows/collector.yml` to batch commits of the updated `artifacts/` folder, maintaining the tamper-evident audit trail that the CLI assumes.

### Bridging Speckit to Artifacts
- Run `npm run speckit:sync [feature-id]` after generating new Speckit outputs. The script in `scripts/sync-speckit-artifacts.mjs` inspects `specs/<feature-id>/tasks.md`, builds a deterministic workflow definition (`artifacts/workflows/wf-<feature-id>.yaml`), and seeds the corresponding work-item descriptor under `artifacts/work-items/`. Existing files are preserved unless you pass `--force`, ensuring repeatable generation without clobbering curated workflows.
- Because the workflow generator consumes the exact markdown that Speckit emits (`spec.md`, `plan.md`, `tasks.md`), new features coming out of Speckit land with all of the structure that the CLI and GitHub Actions expect—ready to delegate via `copilot-cli delegate` and execute through the orchestrator/execute pipelines.

### Publishing & Reuse
- `npm run package` builds the CLI and produces a tarball (`copilot-cli-<version>.tgz`) that you can publish or attach to a release. The `files` allowlist ships `dist/`, GitHub workflow templates, seed artifacts, docs, and the Speckit sync script—everything downstream repos need.
- When the package is installed via npm or git, the `prepare` script automatically compiles TypeScript so `node_modules/.bin/copilot-cli` is immediately usable.
- Consumers can copy the bundled `.github/workflows/*.yml`, then execute `npx copilot-cli -- structured-work-item` commands as normal. To regenerate artifacts from Speckit outputs inside another repository, invoke the bundled script directly (for example `node node_modules/copilot-cli/scripts/sync-speckit-artifacts.mjs <feature-id>`).

Because every workflow step delegates to the shipped CLI commands and services, integrating into a new project only requires aligning directory layout and installing the package. All runtime guarantees (deterministic scheduling, exclusive claims, baseline enforcement) are delivered by the existing code rather than by documentation.

## PR Auto Merge Workflow
This repository includes a `PR Auto Merge` GitHub Actions workflow that validates pull requests and, when they originate from in-repo branches, calls GitHub’s auto-merge APIs through `peter-evans/enable-pull-request-automerge@v3`.

### What the workflow does
- Checks out the pull request with full history (`actions/checkout@v4`).
- Installs dependencies with Node.js 20 (`actions/setup-node@v4` + `npm ci`).
- Executes the Vitest run (`npm run test:run`), matching the local test command.
- On success for non-fork branches, enables squash auto-merge for that PR.

### Current blockers & follow-up actions
- **Repository setting**: A maintainer must enable “Allow auto-merge” in repository settings or GitHub will reject the API call.
- **Branch protection**: Add `PR Auto Merge` as a required status check to gate merges on the workflow result.
- **Forked pull requests**: GitHub disallows automatic merges from forks, so maintainers must merge those manually after checks pass.

The workflow has been validated locally via `npm run test:run`, and no stubs remain in the automation.
