# Manual Testing Checklist

Use this checklist after implementing the Plan-to-Execution Orchestrator feature.

## Environment Preparation

- [ ] Install dependencies: `npm ci`
- [ ] Build the CLI: `npm run build`
- [ ] Ensure `artifacts/` contains seeded workflow/work item stubs (T004)

## Schedule Generation

- [ ] Run `node dist/cli/index.js delegate --non-interactive --quiet --prompt "Generate schedule" --structured-work-item work-item-001-create-a-structured`
- [ ] Confirm `artifacts/schedule/work-item-001-create-a-structured.json` updated with ready steps

## Claim + Execute Path

- [ ] Execute `node dist/cli/index.js claim --work-item work-item-001-create-a-structured --step phase-tests`
- [ ] Validate `artifacts/claims/` contains a new claim JSON with executor metadata
- [ ] Complete the attempt via `node dist/cli/index.js complete --work-item work-item-001-create-a-structured --step phase-tests --attempt {attemptId} --outcome "Tests authored" --next-action "Implement models"`
- [ ] Verify handoff artifact passes schema validation (run `npx vitest run tests/contract/handoff_artifact_schema.test.ts`)

## Gate Rework Flow

- [ ] Record a rejection: `node dist/cli/index.js gate --work-item work-item-001-create-a-structured --gate phase-tests-quality --decision reject --reason "Missing negative tests" --reentry-step phase-tests`
- [ ] Confirm `artifacts/gates/work-item-001-create-a-structured/phase-tests-quality.json` exists and work item current step rewinds
- [ ] Run `node dist/cli/index.js delegate --structured-work-item ...` to ensure schedule reflects rework state

## Baseline Integration Guardrail

- [ ] Complete a later step and emit `--event-type baseline-integration --baseline post`
- [ ] Attempt to rerun `complete` without a revert and confirm the command fails with a baseline boundary message
- [ ] Emit a revert artifact via `node dist/cli/index.js complete --event-type attempt-rejected --baseline post ...` then re-run completion successfully

## Portfolio Export & Metrics

- [ ] Run `node dist/cli/index.js export --stdout`
- [ ] Validate `artifacts/exports/portfolio-*.json` contains lead time and WIP metrics for `work-item-001-create-a-structured`

## GitHub Actions Dry Run

- [ ] Trigger `.github/workflows/orchestrator.yml` with `work-item-001-create-a-structured`
- [ ] Confirm the workflow uploads the schedule artifact and dispatches `execute.yml`
- [ ] After executor jobs complete, run `.github/workflows/collector.yml` to commit artifacts

## Regression Tests

- [ ] `npx vitest run tests/contract/handoff_artifact_schema.test.ts`
- [ ] `npx vitest run tests/integration/*.test.ts`
- [ ] `npx vitest run tests/unit/*.test.ts`
- [ ] `npx vitest run tests/performance/scheduling_perf.test.ts`

Record findings and link to relevant artifacts in the final release notes.
