# CI Orchestration Patterns

This document describes how the Plan-to-Execution Orchestrator integrates with GitHub Actions to deliver deterministic scheduling, exclusive claims, and tamper-evident handoffs.

## Workflows Overview

| Workflow                             | Purpose                                                                                                  | Key Steps                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `.github/workflows/orchestrator.yml` | Generates `artifacts/schedule/{workItemId}.json`, computes a ready matrix, and dispatches executor jobs. | `delegate --structured-work-item`, `upload-artifact` |
| `.github/workflows/execute.yml`      | Claims ready attempts, runs the associated work, emits handoff artifacts, and uploads results.           | `claim`, run step, `complete`                        |
| `.github/workflows/collector.yml`    | Batches newly produced artifacts, generates exports, and commits them back to the repository.            | `export`, `git commit`                               |

## Typical Lifecycle

1. **Orchestrator Trigger** – Run manually or via schedule when new work is available. The workflow produces a deterministic ready matrix based on the latest schedule.
2. **Executor Fan-Out** – `execute.yml` runs once per ready attempt. Each job claims exactly one attempt, performs the work, and calls the `complete` command to emit a handoff artifact.
3. **Collector** – Optionally run after executors complete to aggregate generated artifacts, update portfolio exports, and push commits.

## Environment Requirements

- Node.js 20+ available on the runner (handled via `actions/setup-node`).
- The repository must contain the `artifacts/` structure seeded by task T004.
- Runners require push access when collector commits artifacts.

## Customising the Matrix

The orchestrator workflow exports a JSON matrix describing ready attempts (work item id, step key, order). Extend the matrix transformation to include executor labels or queue metadata, e.g.

```bash
ready=$(jq --arg work "$WORK_ITEM" -c '[.readySteps[] | {workItemId: $work, stepKey: .key, order: .order, parallelizable: .parallelizable}]' "$SCHEDULE_FILE")
```

`execute.yml` consumes this matrix through `fromJson` and constructs unique attempt identifiers using the run id to avoid naming collisions.

## Failure and Retry Semantics

- If an executor job fails, the claim remains recorded. Launch a new attempt by rerunning orchestrator; the scheduling service will enqueue a new ready entry with a fresh attempt id.
- Baseline-integrated steps require a revert artifact before re-execution. The `complete` command enforces this boundary through the artifact service.

## Logging

All services emit structured JSON logs through `src/lib/logger.ts`. Redirect logs to GitHub Actions annotations or external log stores as needed.

## Local Smoke Test

```bash
npm run build
node dist/cli/index.js delegate --non-interactive --quiet --prompt "Generate schedule" --structured-work-item work-item-001-create-a-structured
node dist/cli/index.js claim --work-item work-item-001-create-a-structured --step phase-tests
node dist/cli/index.js complete --work-item work-item-001-create-a-structured --step phase-tests --attempt phase-tests-local --outcome "Tests authored" --next-action "Run services"
node dist/cli/index.js export --stdout
```

Verify that the corresponding artifacts update under `artifacts/{schedule,claims,handoff,exports}`.
