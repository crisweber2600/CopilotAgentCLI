# CopilotAgentCLI

## Project Overview
CopilotAgentCLI is a TypeScript-based CLI that operationalises the Plan-to-Execution Orchestrator. The implementation is split across the following concrete modules:

- CLI entrypoints in `src/cli/commands/*.ts` implement delegation (`delegate.ts`), execution control (`claim.ts`, `complete.ts`, `cancel.ts`, `gate.ts`), reporting (`status.ts`, `list.ts`, `result.ts`, `follow.ts`, `export.ts`), and authentication (`login.ts`, `logout.ts`, `approve.ts`, `deny.ts`). These commands are wired together by `src/cli/index.ts`.
- Core domain models in `src/models/` (for example `workflow.ts`, `step.ts`, `work_item.ts`, `attempt.ts`, `gate_review.ts`, `audit_record.ts`, `metric_set.ts`) encode the entities described in the orchestrator spec and are consumed by the services at runtime.
- Behavioural services live in `src/services/`, notably `scheduling_service.ts` (deterministic ready-step computation), `assignment_service.ts` (exclusive claim semantics), `artifact_service.ts` (JSON artifact persistence and baseline enforcement), `gate_service.ts`, `metrics_service.ts`, and `work_item_service.ts`. These services are invoked directly from the CLI commands and from tests.
- Durable state is written beneath `artifacts/` (`workflows/`, `work-items/`, `schedule/`, `claims/`, `handoff/`, `gates/`, `exports/`); the file layout matches what `ArtifactService` and GitHub Actions expect.
- Test coverage is enforced through Vitest suites under `tests/contract/`, `tests/integration/`, `tests/unit/`, and `tests/performance/`. For example, `tests/integration/scheduling_determinism.test.ts` exercises `SchedulingService`, while `tests/integration/baseline_integration_boundary.test.ts` asserts the baseline guardrails inside `ArtifactService`.

Tooling is managed via the checked-in `package.json` scripts (`build`, `test`, `lint`, `format`, `package`, `speckit:sync`) and strict compiler rules in `tsconfig.json`. The codebase ships with an ESLint flat config (`eslint.config.js`) and Prettier configuration (`.prettierrc`).

### Repository Guide
- `specs/001-create-a-structured/`: Speckit source of truth (business spec, plan, research, data model, contracts, quickstart, generated tasks). The implementation consumes these artefacts directly; for instance, the AJV schema at `specs/001-create-a-structured/contracts/handoff-artifact.schema.json` is loaded by `ArtifactService`, and multiple tests read the same file during validation.
- `docs/ci-orchestration.md`: Describes the orchestrator, executor, and collector workflows implemented in `.github/workflows/`.
- `.github/workflows/`: CI automation (`orchestrator.yml`, `execute.yml`, `collector.yml`, `pr-auto-merge.yml`) that runs the CLI end-to-end.
- `scripts/`: Utility scripts shipped with the package such as `sync-speckit-artifacts.mjs` and `check-schemas.mjs`.

## Agentic Workflow (Implemented)
The end-to-end flow is executed by the code paths outlined below.

1. **Deterministic scheduling** — `src/cli/commands/delegate.ts` loads workflow definitions through `WorkflowRegistry` (`src/services/workflow_registry.ts`) and calls `SchedulingService` to emit `artifacts/schedule/{id}.json`. The behaviour is proven by `tests/integration/scheduling_determinism.test.ts` and `tests/unit/scheduling_tiebreak.test.ts`.
2. **Execution fan-out** — `.github/workflows/orchestrator.yml` invokes the CLI `delegate` command and passes a ready-matrix into `.github/workflows/execute.yml`. Each matrix job claims a step via `copilot-cli claim`, performs the work, and finalises via `copilot-cli complete`, producing a handoff artifact at `artifacts/handoff/{timestamp}-{workItem}-{stepKey}-{attemptId}.json` that captures actor, outcome, next action, and baseline flags.
3. **Gate reviews & rework** — `copilot-cli gate` (`src/cli/commands/gate.ts`) persists review outcomes beneath `artifacts/gates/` using `GateService`. The rewind semantics are enforced in `tests/integration/gate_rework_flow.test.ts`.
4. **Baseline integration guardrail** — Baseline merges are represented as `baseline-integration` events within the same `artifacts/handoff/` directory. `ArtifactService.enforceBaselineBoundary` blocks new pre-baseline attempts until a revert-style artifact is recorded; see `tests/integration/baseline_integration_boundary.test.ts`.
5. **Portfolio exports & observability** — `copilot-cli export` (`src/cli/commands/export.ts`) pipes through `MetricsService` to produce `artifacts/exports/portfolio-{timestamp}.json`, validated by `tests/integration/exports_snapshot.test.ts`. Session visibility commands (`status.ts`, `list.ts`, `follow.ts`, `result.ts`) rely on `SessionService` to stream and persist progress.
6. **Collector & history** — `.github/workflows/collector.yml` rebuilds the CLI and calls `copilot-cli export`, committing updated `artifacts/` so every action remains tamper-evident. The same flow can be executed locally via the documented commands in `docs/ci-orchestration.md`.

## Speckit Integration
Speckit drives the repository via concrete artefacts that the implementation consumes:

- `spec.md` defines user stories and acceptance criteria. The corresponding acceptance scenarios map directly to the Vitest suites (for example, the “notification-by-artifact” requirement is realised in `tests/integration/handoff_artifact_flow.test.ts`).
- `data-model.md` enumerates entities that materialise as the TypeScript classes inside `src/models/`. Their shapes are exercised throughout the service layer.
- `contracts/handoff-artifact.schema.json` is imported by `ArtifactService` and the contract test in `tests/contract/handoff_artifact_schema.test.ts`, ensuring runtime parity with the Speckit contract.
- `quickstart.md`’s walkthrough aligns with the executable steps inside the CLI commands and CI workflows; each stage is codified in integration tests and the GitHub Actions configurations.
- `tasks.md` captured the T001–T047 backlog that guided the implementation sequence. Every task now corresponds to committed code or tests (e.g., T039–T041 cover the orchestrator/execute/collector workflows present under `.github/workflows/`).

In practice, Speckit produces the structured source of truth, and CopilotAgentCLI consumes those files and enforces the guarantees through code and automated tests. This creates a closed loop where planning artefacts remain authoritative while the implementation provides the executable counterpart.

## GitHub Actions Orchestration
The repository includes four workflows designed to work together with the CLI:

- **Orchestrator (`.github/workflows/orchestrator.yml`)** — Triggered via `workflow_dispatch`. It installs dependencies, builds the CLI (`npm run build`), and executes `copilot-cli delegate --structured-work-item <id>` to generate `artifacts/schedule/<id>.json`. A shell step transforms the schedule into a matrix of ready steps and dispatches the reusable executor workflow.
- **Executor (`.github/workflows/execute.yml`)** — Runs once per matrix entry. Each job runs `copilot-cli claim` to write a claim record (`src/services/assignment_service.ts`), executes the real work (placeholder step), and finalises with `copilot-cli complete`, which emits schema-validated handoff artifacts via `src/services/artifact_service.ts`. The output files land under `artifacts/handoff/` for downstream consumption.
- **Collector (`.github/workflows/collector.yml`)** — Optional. Rebuilds the CLI, runs `copilot-cli export` to refresh portfolio metrics (`src/services/metrics_service.ts`), commits the updated `artifacts/` directory with a bot identity, and pushes to the repository. Requires Actions write permissions.
- **PR Auto Merge (`.github/workflows/pr-auto-merge.yml`)** — On every non-draft PR, runs the full Vitest suite using the CLI. If checks pass and the branch lives in the main repository, it enables GitHub’s squash auto-merge through `peter-evans/enable-pull-request-automerge@v3`. Fork-based PRs are skipped by design.

### Workflow + CLI Interaction
- All workflows expect the CLI to be compiled (`npm run build` or package installation). The orchestrator and executor explicitly call the `dist/cli/index.js` commands; the collector and auto-merge workflows rely on `npm run test:run`, which executes Vitest against this codebase.
- CLI commands read and write the Speckit-driven `artifacts/` directories. For example, `delegate` reads `artifacts/workflows/` and `artifacts/work-items/`, while `complete` writes into `artifacts/handoff/` and `artifact_service.ts` enforces schema compliance and baseline protections.
- The repository ships helper scripts (`scripts/sync-speckit-artifacts.mjs`, `scripts/check-schemas.mjs`) that workflows and local automation can use.

### Required Configuration
1. **Seed artifacts** — After Speckit outputs `specs/<feature-id>/spec.md`, `plan.md`, and `tasks.md`, run `npm run speckit:sync <feature-id>` (or `node scripts/sync-speckit-artifacts.mjs <feature-id>`). This populates `artifacts/workflows/wf-<feature-id>.yaml` and `artifacts/work-items/work-item-<feature-id>.json`, which the CLI expects.
2. **Actions permissions** — If you run `.github/workflows/collector.yml`, grant GitHub Actions write access (Settings → Actions → General → Workflow permissions → “Read and write”). Without it, collector pushes will fail.
3. **Repository settings for auto-merge** — Enable “Allow auto-merge” in GitHub settings and add `PR Auto Merge` as a required status check in branch protection rules if automated merges are desired. Forked PRs remain manual.
4. **Runner environment** — All workflows assume Node.js 20 and the ability to run `npm ci`, `npm run build`, `npm run lint`, and `npm run test:run`. Ensure any self-hosted runners mirror the expected environment.
5. **Workflow triggers** — When running orchestrator/execute in downstream projects, pass the exact work-item identifier that matches the generated artifact (e.g., `work-item-001-create-a-structured`).

## Cross-Project Integration Guide
Use the following steps to adopt CopilotAgentCLI and its GitHub Actions automation in another repository:

1. **Install the CLI** – Publish the tarball created by `npm run package` or install directly via git (`npm install --save-dev git+https://github.com/<your-org>/CopilotAgentCLI.git#<commit>`). The package’s `prepare` hook compiles the CLI so `node_modules/.bin/copilot-cli` is ready to use.
2. **Pull in workflows** – Copy `.github/workflows/orchestrator.yml`, `execute.yml`, `collector.yml`, and `pr-auto-merge.yml` into the target project.
3. **Seed artefact directories** – Replicate the `artifacts/` subdirectories. Either run the bundled Speckit sync script (`node node_modules/copilot-cli/scripts/sync-speckit-artifacts.mjs <feature-id>`) or vendor existing JSON/YAML.
4. **Author specs with Speckit** – Generate `specs/<feature-id>/` outputs, run the sync script, and commit the results. The CLI and workflows consume these files directly.
5. **Delegate work** – Trigger `.github/workflows/orchestrator.yml` or run `copilot-cli delegate --structured-work-item <work-item-id>` locally to produce schedules.
6. **Execute & validate** – Allow `.github/workflows/execute.yml` to fan out attempts, producing handoff artifacts and exercising the baseline guards.
7. **Collect history** – Enable `.github/workflows/collector.yml` to commit `artifacts/` updates, keeping a tamper-evident trail.

### Bridging Speckit to Artifacts
- Run `npm run speckit:sync [feature-id]` after generating new Speckit outputs. The script inspects `specs/<feature-id>/tasks.md`, builds a deterministic workflow definition, and seeds the corresponding work-item descriptor under `artifacts/work-items/`. Existing files are preserved unless you pass `--force`.
- Because the workflow generator consumes the Speckit markdown (`spec.md`, `plan.md`, `tasks.md`), new features land with the structure expected by the CLI and GitHub Actions.

### Publishing & Reuse
- `npm run package` builds the CLI and produces `copilot-cli-<version>.tgz` containing `dist/` binaries, GitHub workflow templates, seed artifacts, specs, docs, and helper scripts.
- When the tarball is installed, `npm run prepare` re-compiles the CLI automatically. Consumers can copy the workflows, configure Actions permissions, and invoke the bundled sync script to generate artifacts.
- `npm run test:run` currently requires follow-up: seven contract suites fail with “Vitest cannot be imported in a CommonJS module using require()…”. This stems from Vitest’s CJS restrictions surfaced on 2025-09-20. Other suites pass, but address this before shipping a release.

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
- **Forked pull requests**: GitHub disallows automatic merges from forks; maintainers must merge those manually after checks pass.

The workflow has been validated locally with the caveat noted above: `npm run test:run` currently fails due to Vitest attempting to load CommonJS entrypoints. Address this (e.g., by running the suites via `tsx`, or migrating to pure ESM tests) before relying on auto-merge.

## Known Issues
- `npm run test:run` (and therefore `PR Auto Merge`) currently reports Vitest CJS import errors in seven contract suites. Investigate and resolve before publishing a release or relying on automated merges.
- The Speckit sync script writes artifacts into the repository; if you package the CLI, ensure downstream consumers understand it.
