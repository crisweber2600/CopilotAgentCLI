# Quickstart: Plan‑to‑Execution Orchestrator

## Prerequisites

- Node.js + npm
- GitHub repository with Actions enabled
- Branch: `001-create-a-structured`

## 1) Create a Workflow and Work Item

- Represent workflow and steps as YAML/JSON under `artifacts/workflows/` (design choice; see data-model.md)
- Register a work item by committing `artifacts/work-items/{id}.json` with workflow binding

## 2) Generate a Schedule

- Run `node dist/cli/index.js delegate --non-interactive --quiet --prompt "Generate schedule" --structured-work-item {id}`.
- The command writes `artifacts/schedule/{id}.json` with `readySteps` and `blockedSteps` ordered deterministically.

## 3) GitHub Actions Claim and Execute

- Executor jobs claim attempts via `node dist/cli/index.js claim --work-item {id} --step {stepKey}`.
- Each job runs work, then completes via `node dist/cli/index.js complete --work-item {id} --step {stepKey} --attempt {attemptId}`.
- `.github/workflows/orchestrator.yml` and `.github/workflows/execute.yml` automate this pattern.

## 4) Emit Handoff Artifacts

- Completion writes `artifacts/handoff/{timestamp}-{workItem}-{stepKey}-{attemptId}.json` validated against the schema.
- Downstream steps read these artifacts as durable notifications.

## 5) Reviews and Rework

- Record gate decisions using `node dist/cli/index.js gate --work-item {id} --gate {gateKey} --decision approve|reject --reason "..."`.
- Rejection rewinds the work item to the specified step and logs re-entry criteria.

## 6) Baseline Integration

- When merging to the base branch, emit a baseline integration artifact with `--event-type baseline-integration --baseline post`.
- Subsequent attempts require an explicit revert artifact before re-execution.

## 7) Portfolio Exports

- `node dist/cli/index.js export --stdout` produces `artifacts/exports/portfolio-{timestamp}.json` with aggregated metrics.
- The collector workflow can run this before committing artifacts.

Notes:

- Ensure CI runners have permissions to push commits when collector workflow runs.
- Populate `tools/remote-agent-cli/remote-agent-cli.js` if using CLI runner mode in tests.
