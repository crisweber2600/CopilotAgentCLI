# Quickstart: Plan‑to‑Execution Orchestrator

## Prerequisites

- Node.js + npm
- GitHub repository with Actions enabled
- Branch: `001-create-a-structured`

## 1) Create a Workflow and Work Item

- Represent workflow and steps as YAML/JSON under `artifacts/workflows/` (design choice; see data-model.md)
- Register a work item by committing `artifacts/work-items/{id}.json` with workflow binding

## 2) Generate an Initial Schedule

- Run `node dist/cli/index.js delegate --non-interactive --quiet --prompt "Generate schedule" --structured-work-item {id}` to produce `artifacts/schedule/{id}.json`.
- The schedule lists `readySteps` and `blockedSteps` in deterministic order. Commit the schedule for transparency.

## 3) Claim Attempts via CLI or GitHub Actions

- CI runners call `node dist/cli/index.js claim --work-item {id} --step {stepKey}` to produce `artifacts/claims/{attemptId}.json`.
- The command rejects duplicate claims and records executor metadata.
- Use `.github/workflows/orchestrator.yml` to compute a matrix of ready attempts and dispatch `.github/workflows/execute.yml` to claim and run steps in stable order.

## 4) Execute Work and Emit Handoff Artifacts

- Complete a step with `node dist/cli/index.js complete --work-item {id} --step {stepKey} --attempt {attemptId} --outcome "..." --next-action "..."`.
- The command writes `artifacts/handoff/{timestamp}-{workItem}-{stepKey}-{attemptId}.json`, validates against the handoff schema, and enforces baseline integration boundaries.
- Upload artifacts or commit them directly; the collector workflow can batch-commit if direct pushes are restricted.

## 5) Reviews and Rework Gates

- Record gate outcomes with `node dist/cli/index.js gate --work-item {id} --gate {gateKey} --decision approve|reject --reason "..."`.
- On rejection the command rewinds the work item to the specified step and logs the re-entry reasons.

## 6) Baseline Integration

- When merging to the base branch, emit a handoff artifact with `--event-type baseline-integration --baseline post`. Subsequent executions require an explicit revert artifact before the same step can run again.

## 7) Portfolio Exports

- Run `node dist/cli/index.js export` to generate `artifacts/exports/portfolio-{timestamp}.json` plus CLI output summarising lead time and WIP metrics.
- The collector workflow can run this command before committing artifacts back to the repository.

Notes:

- All file paths are examples; contracts will fix the exact structure.
- Ensure CI has permissions to push commits when claiming/completing tasks.
- Review `.github/workflows/` for orchestration patterns and extend matrices or runner pools as needed.
