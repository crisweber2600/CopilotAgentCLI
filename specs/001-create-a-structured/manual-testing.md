# Manual Testing Checklist

## Environment Setup

- [ ] `npm ci`
- [ ] `npm run build`
- [ ] Verify `artifacts/` seeded from T004

## Schedule Generation

- [ ] `node dist/cli/index.js delegate --non-interactive --quiet --prompt "Generate schedule" --structured-work-item work-item-001-create-a-structured`
- [ ] Inspect `artifacts/schedule/work-item-001-create-a-structured.json`

## Claim and Complete Flow

- [ ] `node dist/cli/index.js claim --work-item work-item-001-create-a-structured --step phase-tests`
- [ ] `node dist/cli/index.js complete --work-item work-item-001-create-a-structured --step phase-tests --attempt phase-tests-local --outcome "Tests authored" --next-action "Implement services"`
- [ ] Validate handoff artifact via `npx vitest run tests/contract/handoff_artifact_schema.test.ts`

## Gate Rejection

- [ ] `node dist/cli/index.js gate --work-item work-item-001-create-a-structured --gate phase-tests-quality --decision reject --reason "Missing negative tests" --reentry-step phase-tests`
- [ ] Run delegate to ensure schedule rewinds to `phase-tests`

## Baseline Integration Boundary

- [ ] Emit `complete` with `--event-type baseline-integration --baseline post`
- [ ] Attempt re-run without revert to confirm CLI rejects the action
- [ ] Emit revert artifact, then retry completion successfully

## Portfolio Export

- [ ] `node dist/cli/index.js export --stdout`
- [ ] Inspect `artifacts/exports/portfolio-*.json`

## GitHub Actions Dry Run

- [ ] Trigger `.github/workflows/orchestrator.yml` with `work-item-001-create-a-structured`
- [ ] Confirm schedule artifact uploaded and `execute.yml` dispatched
- [ ] Run `.github/workflows/collector.yml` to commit artifacts

## Regression Tests

- [ ] `npx vitest run tests/contract/handoff_artifact_schema.test.ts`
- [ ] `npx vitest run tests/integration/*.test.ts`
- [ ] `npx vitest run tests/unit/*.test.ts`
- [ ] `npx vitest run tests/performance/scheduling_perf.test.ts`
