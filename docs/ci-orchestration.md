# CI Orchestration Patterns

This document describes how the Plan-to-Execution Orchestrator integrates with GitHub Actions to orchestrate claims, execution, and artifact collection.

## Workflows

| Workflow                             | Purpose                                                         | Key Steps                                         |
| ------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------- |
| `.github/workflows/orchestrator.yml` | Generates deterministic schedules and dispatches executor jobs. | `delegate --structured-work-item`, compute matrix |
| `.github/workflows/execute.yml`      | Claims attempts, runs work, writes handoff artifacts.           | `claim`, run step, `complete`                     |
| `.github/workflows/collector.yml`    | Aggregates artifacts, creates exports, commits history.         | `export`, `git commit`                            |

## Lifecycle

1. **Orchestrator** runs when new work is available. It calculates the ready matrix based on `artifacts/schedule/{workItemId}.json`.
2. **Execute** fan-out jobs claim one attempt at a time, perform the work, and emit handoff artifacts validated against the schema.
3. **Collector** optionally batches changes, generates portfolio exports, and pushes commits to maintain the tamper-evident history.

## Runner Requirements

- Node.js 20+
- Permissions to push back to the repository when collector commits artifacts.
- Seeded `artifacts/` directory with workflows, work items, and other stubs (see T004).

## Local Smoke Test

```bash
npm run build
node dist/cli/index.js delegate --non-interactive --quiet --prompt "Generate schedule" --structured-work-item work-item-001-create-a-structured
node dist/cli/index.js claim --work-item work-item-001-create-a-structured --step phase-tests
node dist/cli/index.js complete --work-item work-item-001-create-a-structured --step phase-tests --attempt phase-tests-local --outcome "Tests authored" --next-action "Implement models"
node dist/cli/index.js export --stdout
```

Confirm that artifacts update under `artifacts/{schedule,claims,handoff,exports}`.
