# Data Model: Plan‑to‑Execution Orchestrator

## Entities

### Workflow
- id, name, version, steps[], effectiveFrom, effectiveTo?
- steps: [Step]

### Step
- key, order, parallelizable:boolean, entryCriteria[], exitCriteria[], responsibleRole

### WorkItem
- id, workflowId, status, currentStepKey, owner, createdAt, updatedAt, links[]

### Attempt
- attemptId, workItemId, stepKey, status (queued|running|completed|rejected|failed|rework), startAt, endAt, artifactLinks[]

### Assignment
- attemptId, executorId, claimedAt, releasedAt, terminalState

### Executor
- id, name, capacity:1 (MVP), metadata

### GateReview
- id, workItemId, stepKey, decision (approve|reject), reasons[], reviewer, at

### SchedulingDecision
- id, workItemId, readySteps[], launchOrder[], assignments[], at

### HandoffArtifact
- id (path), workItemId, workflowVersion, stepKey, order, eventType, attemptId, timestamp, actor, outcome, nextAction, baselineIntegrationFlag, links[], schemaVersion

### BaselineIntegration
- id, workItemId, at, mergedBy, baseBranch

### Blocker
- id, workItemId, type, startAt, endAt?, owner, notes

### AuditRecord
- id, entityType, entityId, who, what, why, when, prev?, next?

### MetricSet
- id, scope (item|workflow|portfolio), measures { leadTime, cycleTimePerStep, throughput, WIP, reworkRate }

## Relationships
- Workflow 1..n Steps
- WorkItem 1 Workflow (active)
- WorkItem 1..n Attempts
- Attempt 0..1 Assignment
- Attempt 0..n HandoffArtifacts
- WorkItem 0..n GateReviews
- WorkItem 0..n SchedulingDecisions
- WorkItem 0..n Blockers
- All entities 0..n AuditRecords
