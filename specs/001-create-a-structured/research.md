# Research: Plan‑to‑Execution Orchestrator

## Questions and Decisions

1) Exclusive Assignment in CI
- Options: GitHub Actions concurrency groups; job‑level claim via a claim file; GitHub Checks API (future).
- Decision: Use a claim file in repo + commit to record claim. CI job writes `artifacts/claims/{attemptId}.json` with executor metadata; commit to feature branch. Retries create new attemptId files.

2) Deterministic Scheduling
- Options: Orchestrate in CLI vs CI.
- Decision: Deterministic schedule computed in CLI (SessionService + GitService). Parallelizable steps are emitted in ascending order; CI jobs consume in that order using a queue file. Tie‑break by step key lexical order.

3) Handoff Artifact Schema (FR‑014)
- Required fields: Work Item ID; Workflow name/version; Step key & order; Event type; Attempt ID; Timestamp; Actor; Outcome summary; Next required action; Baseline‑integration flag; Links; Schema version.
- Decision: JSON artifact at `artifacts/handoff/{timestamp}-{workItem}-{stepKey}-{attemptId}.json` committed per event.

4) Baseline Integration Event
- Decision: Map to “merge to base branch” semantics. CLI detects base branch via GitService (default main) and records BaselineIntegration artifact when merging PRs.

5) Portfolio/Exports
- Decision: On‑demand exports via CLI command writing CSV/JSON snapshots under `artifacts/exports/`.

6) Review Gates
- Decision: Gate decisions are files under `artifacts/gates/{workItem}/{gateKey}.json` with approve/reject, reasons, by, at.

## Patterns
- “Notification by artifact”: Producers commit artifact; consumers poll/read in CI job steps.
- History is tamper‑evident via git commits; corrections are additive.
