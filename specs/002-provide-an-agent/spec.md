# Feature Specification: Agent-Swarmable Task Framework

**Feature Branch**: `002-provide-an-agent`  
**Created**: September 19, 2025  
**Status**: Draft  
**Input**: User description: "Provide an agent-swarmable framework where parallelizable work is explicit, dependencies are enforced, and in-flight tasks are tracked to prevent duplication."

## GOAL

• Enable multiple agents to work on parallelizable tasks without conflicts or duplication through explicit dependency management
• Provide a machine-digestible task specification format that enforces topological ordering and tracks in-flight work status
• Implement branch-per-task workflow with automatic integration into a single feature branch to maintain clean merge history
• Support atomic task claiming with lease/heartbeat mechanisms to prevent race conditions between concurrent agents
• Enable automatic validation of task completion through standardized done criteria and schema validation
• Create a scalable framework that can handle complex multi-phase development workflows with clear progress visibility
• Integrate seamlessly with GitHub spec-kit framework to support both manual CLI operations and automated spec-driven workflows
• Provide bidirectional compatibility between CLI task management and spec-kit automated orchestration systems

## CONSTRAINTS

• Must use existing TypeScript/Node.js ecosystem and maintain compatibility with current CLI architecture
• All task specifications must be machine-parsable using standard JSON/YAML formats for automated orchestration
• Branch naming must follow `feat/<feature-slug>__T###` pattern to maintain consistency with existing Git workflows
• Task IDs must be stable, unique, and follow T### format for reliable cross-reference and dependency tracking
• Implementation must respect existing `.github/` directory structure and CI/CD pipeline configurations
• Must integrate with current authentication and session management systems without breaking existing functionality
• All metadata persistence must use file-based storage within the repository to maintain auditability and version control
• Must be compatible with GitHub spec-kit framework and `.specify/` directory structure for automated orchestration
• CLI must be able to consume and produce spec-kit compatible task definitions and DAG structures
• Integration must support both manual CLI operations and automated spec-kit driven workflows

## ARTIFACTS

• `.specify/schema/task.ndjson.schema.json` - JSON Schema for task specification validation
• `.specify/graph/task_graph.yaml` - YAML DAG definition with dependencies and parallel groups
• `.specify/tasks/` - Directory containing NDJSON task specifications per feature
• `.specify/config/agent_config.yaml` - Agent behavior configuration and spec-kit integration settings
• `.specify/templates/task_template.ndjson` - Template for creating new task specifications
• `.specify/scripts/` - Directory for spec-kit compatible automation scripts
• `scripts/task_claim.py` - Task claiming and lease management utilities
• `scripts/dag_validate.py` - DAG validation and topological sort implementation
• `scripts/run_parallel.py` - Parallel group orchestration and execution
• `scripts/spec_kit_bridge.py` - Bridge between CLI and spec-kit workflows
• `docs/agent_contract.md` - Agent behavior specification and compliance rules
• `docs/claiming.md` - Task claiming protocol and lease management documentation
• `docs/spec_kit_integration.md` - Guide for spec-kit and CLI interoperability
• `.github/workflows/tasks-ci.yml` - CI workflow for task validation and automated checks
• `.github/workflows/spec-kit-integration.yml` - Workflow for spec-kit automation
• `src/models/taskSpec.ts` - TypeScript interfaces for task specification objects
• `src/services/specKitAdapter.ts` - Service for spec-kit format conversion and compatibility

## TASK_GRAPH

```yaml
tasks:
  - id: T001
    name: Define machine schema + wiring
    phase: spec
    requires: []
    parallel_group: bootstrap
    outputs: [".specify/schema/task.ndjson.schema.json", ".specify/graph/task_graph.yaml"]
    estimated_minutes: 30
    merge_base: feature-branch
  - id: T002
    name: Create TypeScript task interfaces
    phase: spec
    requires: [T001]
    parallel_group: bootstrap
    outputs: ["src/models/taskSpec.ts", "src/types/agentContract.ts"]
    estimated_minutes: 25
    merge_base: feature-branch
  - id: T003
    name: Setup .specify directory structure
    phase: spec
    requires: [T001]
    parallel_group: bootstrap
    outputs: [".specify/config/agent_config.yaml", ".specify/templates/task_template.ndjson", ".specify/scripts/"]
    estimated_minutes: 20
    merge_base: feature-branch
  - id: T004
    name: Implement lock/lease metadata I/O
    phase: impl
    requires: [T002]
    parallel_group: infra
    outputs: ["scripts/task_claim.py", "docs/claiming.md"]
    estimated_minutes: 40
    merge_base: feature-branch
  - id: T005
    name: DAG validator + topo sort
    phase: impl
    requires: [T002]
    parallel_group: infra
    outputs: ["scripts/dag_validate.py", "src/utils/graphValidator.ts"]
    estimated_minutes: 35
    merge_base: feature-branch
  - id: T006
    name: Spec-kit adapter service
    phase: impl
    requires: [T003]
    parallel_group: adapter
    outputs: ["src/services/specKitAdapter.ts", "scripts/spec_kit_bridge.py"]
    estimated_minutes: 35
    merge_base: feature-branch
  - id: T007
    name: Task specification parser
    phase: impl
    requires: [T002, T003]
    parallel_group: parser
    outputs: ["src/services/taskParser.ts", "src/utils/ndjsonReader.ts"]
    estimated_minutes: 30
    merge_base: feature-branch
  - id: T008
    name: Parallel group orchestrator
    phase: impl
    requires: [T004, T005]
    parallel_group: orchestrator
    outputs: ["scripts/run_parallel.py", "src/services/taskOrchestrator.ts"]
    estimated_minutes: 45
    merge_base: feature-branch
  - id: T009
    name: Agent contract implementation
    phase: impl
    requires: [T006, T007, T008]
    outputs: ["src/services/agentContract.ts", "docs/agent_contract.md"]
    estimated_minutes: 35
    merge_base: feature-branch
  - id: T010
    name: CLI integration commands
    phase: impl
    requires: [T009]
    outputs: ["src/commands/claim.ts", "src/commands/release.ts", "src/commands/status.ts"]
    estimated_minutes: 40
    merge_base: feature-branch
  - id: T011
    name: Unit tests for core components
    phase: test
    requires: [T010]
    parallel_group: testing
    outputs: ["tests/unit/taskSpec.spec.ts", "tests/unit/agentContract.spec.ts", "tests/unit/specKitAdapter.spec.ts"]
    estimated_minutes: 55
    merge_base: feature-branch
  - id: T012
    name: Integration tests for workflows
    phase: test
    requires: [T010]
    parallel_group: testing
    outputs: ["tests/integration/taskWorkflow.spec.ts", "tests/integration/claiming.spec.ts", "tests/integration/specKitIntegration.spec.ts"]
    estimated_minutes: 65
    merge_base: feature-branch
  - id: T013
    name: CI wiring & checks
    phase: verify
    requires: [T011, T012]
    outputs: [".github/workflows/tasks-ci.yml", ".github/workflows/spec-kit-integration.yml"]
    estimated_minutes: 30
    merge_base: feature-branch
  - id: T014
    name: Documentation and examples
    phase: polish
    requires: [T013]
    outputs: ["docs/swarm_framework.md", "docs/spec_kit_integration.md", "examples/sample_feature.yaml", "examples/sample_tasks.ndjson"]
    estimated_minutes: 40
    merge_base: feature-branch
```

## TASKS

{"id":"T001","name":"Define machine schema + wiring","description":"Create JSON Schema for NDJSON task specifications and YAML schema for DAG structure. Establish validation rules for task IDs, dependencies, and metadata fields. Place schemas under .specify/ directory with clear documentation.","requires":[],"parallel_group":"bootstrap","inputs":[],"outputs":[".specify/schema/task.ndjson.schema.json",".specify/graph/task_graph.yaml"],"branch":"feat/agent-swarmable__T001","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T001","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["schemas validate against examples","YAML parses correctly","lint passes"],"pr":{"title":"[T001] Define machine schema + wiring","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T001","labels":["auto:swarm","task","T001"],"draft":false}}
{"id":"T002","name":"Create TypeScript task interfaces","description":"Define TypeScript interfaces for task specifications, claim objects, retry policies, and PR metadata. Ensure type safety for all agent contract interactions and provide proper exports for CLI integration.","requires":["T001"],"parallel_group":"bootstrap","inputs":[".specify/schema/task.ndjson.schema.json"],"outputs":["src/models/taskSpec.ts","src/types/agentContract.ts"],"branch":"feat/agent-swarmable__T002","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T002","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["TypeScript compiles without errors","interfaces match JSON schema","exports are properly defined"],"pr":{"title":"[T002] Create TypeScript task interfaces","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T002","labels":["auto:swarm","task","T002"],"draft":false}}
{"id":"T003","name":"Setup .specify directory structure","description":"Create and configure .specify directory structure for spec-kit compatibility. Include agent configuration, task templates, and automation scripts directory with proper permissions and documentation.","requires":["T001"],"parallel_group":"bootstrap","inputs":[".specify/schema/task.ndjson.schema.json"],"outputs":[".specify/config/agent_config.yaml",".specify/templates/task_template.ndjson",".specify/scripts/"],"branch":"feat/agent-swarmable__T003","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T003","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["directory structure created","config validates","templates are usable"],"pr":{"title":"[T003] Setup .specify directory structure","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T003","labels":["auto:swarm","task","T003"],"draft":false}}
{"id":"T004","name":"Implement lock/lease metadata I/O","description":"Create Python script for atomic task claiming using file-based locking with lease expiration and heartbeat tracking. Implement claim acquisition, renewal, and release operations with proper error handling.","requires":["T002"],"parallel_group":"infra","inputs":["src/models/taskSpec.ts"],"outputs":["scripts/task_claim.py","docs/claiming.md"],"branch":"feat/agent-swarmable__T004","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T004","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["atomic claim operations work","lease expiration logic tested","documentation complete"],"pr":{"title":"[T004] Implement lock/lease metadata I/O","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T004","labels":["auto:swarm","task","T004"],"draft":false}}
{"id":"T005","name":"DAG validator + topo sort","description":"Implement DAG validation with cycle detection and topological sorting for task dependencies. Create both Python and TypeScript versions for CLI and script integration with clear error reporting.","requires":["T002"],"parallel_group":"infra","inputs":["src/models/taskSpec.ts"],"outputs":["scripts/dag_validate.py","src/utils/graphValidator.ts"],"branch":"feat/agent-swarmable__T005","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T005","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["cycle detection works","topological sort correct","error messages clear"],"pr":{"title":"[T005] DAG validator + topo sort","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T005","labels":["auto:swarm","task","T005"],"draft":false}}
{"id":"T006","name":"Spec-kit adapter service","description":"Create adapter service that bridges CLI operations with spec-kit workflows. Handle format conversion, state synchronization, and provide compatibility layer for both manual and automated operations.","requires":["T003"],"parallel_group":"adapter","inputs":[".specify/config/agent_config.yaml",".specify/templates/task_template.ndjson"],"outputs":["src/services/specKitAdapter.ts","scripts/spec_kit_bridge.py"],"branch":"feat/agent-swarmable__T006","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T006","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["format conversion works","state sync functional","compatibility verified"],"pr":{"title":"[T006] Spec-kit adapter service","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T006","labels":["auto:swarm","task","T006"],"draft":false}}
{"id":"T007","name":"Task specification parser","description":"Create NDJSON parser for task specifications with schema validation and TypeScript integration. Handle streaming input, provide utilities for task filtering and querying, and support spec-kit format compatibility.","requires":["T002","T003"],"parallel_group":"parser","inputs":["src/models/taskSpec.ts",".specify/templates/task_template.ndjson"],"outputs":["src/services/taskParser.ts","src/utils/ndjsonReader.ts"],"branch":"feat/agent-swarmable__T007","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T007","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["NDJSON parsing works","schema validation integrated","streaming supported","spec-kit compatibility verified"],"pr":{"title":"[T007] Task specification parser","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T007","labels":["auto:swarm","task","T007"],"draft":false}}
{"id":"T008","name":"Parallel group orchestrator","description":"Build orchestration engine that manages parallel task execution within groups while respecting dependencies. Implement both Python and TypeScript versions with progress tracking and spec-kit integration.","requires":["T004","T005"],"parallel_group":"orchestrator","inputs":["scripts/task_claim.py","scripts/dag_validate.py"],"outputs":["scripts/run_parallel.py","src/services/taskOrchestrator.ts"],"branch":"feat/agent-swarmable__T008","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T008","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["parallel execution works","dependency blocking correct","progress tracking functional","spec-kit integration tested"],"pr":{"title":"[T008] Parallel group orchestrator","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T008","labels":["auto:swarm","task","T008"],"draft":false}}
{"id":"T009","name":"Agent contract implementation","description":"Implement the agent contract service that enforces claiming rules, heartbeat requirements, and PR management protocols. Create comprehensive documentation and ensure spec-kit workflow compatibility.","requires":["T006","T007","T008"],"inputs":["src/services/specKitAdapter.ts","src/services/taskParser.ts","src/services/taskOrchestrator.ts"],"outputs":["src/services/agentContract.ts","docs/agent_contract.md"],"branch":"feat/agent-swarmable__T009","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T009","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["contract rules enforced","heartbeat monitoring works","spec-kit compatibility verified","documentation complete"],"pr":{"title":"[T009] Agent contract implementation","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T009","labels":["auto:swarm","task","T009"],"draft":false}}
{"id":"T010","name":"CLI integration commands","description":"Add CLI commands for task claiming (claim), releasing (release), and status checking (status). Integrate with existing CLI architecture, authentication system, and provide spec-kit bridge commands.","requires":["T009"],"inputs":["src/services/agentContract.ts"],"outputs":["src/commands/claim.ts","src/commands/release.ts","src/commands/status.ts"],"branch":"feat/agent-swarmable__T010","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T010","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["CLI commands work","integration tests pass","spec-kit bridge functional","help documentation updated"],"pr":{"title":"[T010] CLI integration commands","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T010","labels":["auto:swarm","task","T010"],"draft":false}}
{"id":"T011","name":"Unit tests for core components","description":"Create comprehensive unit tests for task specifications, agent contract, claim management, parsing utilities, and spec-kit adapter. Achieve high code coverage and test edge cases.","requires":["T010"],"parallel_group":"testing","inputs":["src/models/taskSpec.ts","src/services/agentContract.ts","src/services/specKitAdapter.ts"],"outputs":["tests/unit/taskSpec.spec.ts","tests/unit/agentContract.spec.ts","tests/unit/specKitAdapter.spec.ts"],"branch":"feat/agent-swarmable__T011","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T011","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["all unit tests pass","coverage above 90%","edge cases covered","spec-kit adapter tested"],"pr":{"title":"[T011] Unit tests for core components","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T011","labels":["auto:swarm","task","T011"],"draft":false}}
{"id":"T012","name":"Integration tests for workflows","description":"Build integration tests that validate end-to-end task workflows including claiming, execution, completion, and spec-kit integration. Test multi-agent scenarios and conflict resolution.","requires":["T010"],"parallel_group":"testing","inputs":["src/commands/claim.ts","src/services/taskOrchestrator.ts","scripts/spec_kit_bridge.py"],"outputs":["tests/integration/taskWorkflow.spec.ts","tests/integration/claiming.spec.ts","tests/integration/specKitIntegration.spec.ts"],"branch":"feat/agent-swarmable__T012","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T012","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["integration tests pass","multi-agent scenarios tested","conflict resolution verified","spec-kit workflows validated"],"pr":{"title":"[T012] Integration tests for workflows","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T012","labels":["auto:swarm","task","T012"],"draft":false}}
{"id":"T013","name":"CI wiring & checks","description":"Create GitHub Actions workflows for automated task validation, schema checking, DAG integrity verification, and spec-kit integration testing. Integrate with existing CI pipeline and add required checks.","requires":["T011","T012"],"inputs":[".github/workflows/","tests/unit/","tests/integration/"],"outputs":[".github/workflows/tasks-ci.yml",".github/workflows/spec-kit-integration.yml"],"branch":"feat/agent-swarmable__T013","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T013","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["CI workflows execute","all checks pass","PR gates functional","spec-kit integration validated"],"pr":{"title":"[T013] CI wiring & checks","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T013","labels":["auto:swarm","task","T013"],"draft":false}}
{"id":"T014","name":"Documentation and examples","description":"Create comprehensive documentation for the swarm framework including usage examples, sample task specifications, spec-kit integration guide, and best practices. Provide complete examples that demonstrate both CLI and spec-kit workflows.","requires":["T013"],"inputs":["docs/agent_contract.md","docs/claiming.md",".specify/config/agent_config.yaml"],"outputs":["docs/swarm_framework.md","docs/spec_kit_integration.md","examples/sample_feature.yaml","examples/sample_tasks.ndjson"],"branch":"feat/agent-swarmable__T014","base_branch":"feat/agent-swarmable","claim":{"status":"open","by":null,"since":"2025-09-19T00:00:00Z","lease_minutes":90,"heartbeat_minutes":10},"concurrency_key":"agent-swarmable::T014","retry_policy":{"max_retries":2,"backoff":"exponential","base_seconds":20},"done_when":["documentation complete","examples validate","spec-kit integration guide clear","usage guide comprehensive"],"pr":{"title":"[T014] Documentation and examples","base":"feat/agent-swarmable","head":"feat/agent-swarmable__T014","labels":["auto:swarm","task","T014"],"draft":false}}

## AGENT_CONTRACT

Agents operating within this framework MUST adhere to the following protocol:

**A) Atomic Claiming**: Before starting any work, agents MUST atomically transition `claim.status` from `open` to `claimed` with a valid lease timestamp. If a task is already claimed, agents MUST refuse the work and select another eligible task.

**B) Heartbeat Maintenance**: Agents MUST refresh their heartbeat before `heartbeat_minutes` elapses by updating the claim timestamp. If the lease expires, other agents MAY reclaim the task.

**C) Dependency Verification**: Agents MUST verify that all tasks listed in `requires` have `claim.status=done` before beginning work. Dependency checks MUST be performed atomically with claiming.

**D) Branch Management**: Agents MUST create a fresh branch named `feat/<feature-slug>__T###` from the current state of `base_branch`. All work MUST be committed to this dedicated task branch.

**E) Incremental Commits**: Agents MUST commit work in small, verifiable steps with commit messages that reference the task ID `T###`. Each commit MUST represent a logical unit of progress.

**F) Pull Request Management**: Agents MUST open or update the PR according to the specification in `TASKS[*].pr`, ensuring all required checks pass before marking ready for review.

**G) Completion Protocol**: Upon successful completion, agents MUST set `claim.status=done`, update the `outputs` field with produced artifacts, and mark the PR as ready. Agents MUST NOT self-merge unless explicitly permitted by MERGE_POLICY.

**H) Blocking Handling**: If work becomes blocked due to external dependencies or issues, agents MUST set `status=blocked` with a descriptive reason and release the lease for potential reassignment.

**I) Graceful Abandonment**: When abandoning work, agents MUST set `status=abandoned`, provide a reason, release the lease, and clean up any partial work or draft PRs.

## MERGE_POLICY

**Integration Branch**: All task PRs MUST target the feature branch `feat/<feature-slug>` as their merge base. This serves as the single integration point for all related work.

**Merge Strategy**: Fast-forward merges are prohibited. All task PRs MUST use squash-merge to maintain clean history and associate all changes with the specific task completion.

**Required Checks**: Before merging, the following checks MUST pass: unit tests, integration tests, linting, schema validation, DAG integrity verification, and task completion criteria validation.

**Parallel Group Handling**: When multiple PRs from the same `parallel_group` are ready simultaneously, they MAY be merged in any order since they all target the same base branch and have been validated for independence.

**Final Integration**: After all tasks in the DAG are completed (`claim.status=done`), a final integration PR MUST be opened from `feat/<feature-slug>` to `main` with comprehensive validation of the complete feature.

**Conflict Resolution**: In case of merge conflicts within a parallel group, the conflicting PRs MUST be rebased against the updated integration branch before merging.

## VALIDATION

**Task JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "description", "requires", "inputs", "outputs", "branch", "base_branch", "claim", "concurrency_key", "retry_policy", "done_when", "pr"],
  "properties": {
    "id": {"type": "string", "pattern": "^T[0-9]{3}$"},
    "name": {"type": "string", "minLength": 1, "maxLength": 100},
    "description": {"type": "string", "minLength": 10},
    "requires": {"type": "array", "items": {"type": "string", "pattern": "^T[0-9]{3}$"}},
    "parallel_group": {"type": ["string", "null"]},
    "inputs": {"type": "array", "items": {"type": "string"}},
    "outputs": {"type": "array", "items": {"type": "string"}},
    "branch": {"type": "string", "pattern": "^feat/[a-z0-9-]+__T[0-9]{3}$"},
    "base_branch": {"type": "string", "pattern": "^feat/[a-z0-9-]+$"},
    "claim": {
      "type": "object",
      "required": ["status", "by", "since", "lease_minutes", "heartbeat_minutes"],
      "properties": {
        "status": {"enum": ["open", "claimed", "in_progress", "blocked", "done", "abandoned"]},
        "by": {"type": ["string", "null"]},
        "since": {"type": "string", "format": "date-time"},
        "lease_minutes": {"type": "integer", "minimum": 1},
        "heartbeat_minutes": {"type": "integer", "minimum": 1}
      }
    },
    "concurrency_key": {"type": "string", "pattern": "^[a-z0-9-]+::T[0-9]{3}$"},
    "retry_policy": {
      "type": "object",
      "required": ["max_retries", "backoff", "base_seconds"],
      "properties": {
        "max_retries": {"type": "integer", "minimum": 0},
        "backoff": {"enum": ["linear", "exponential"]},
        "base_seconds": {"type": "integer", "minimum": 1}
      }
    },
    "done_when": {"type": "array", "items": {"type": "string"}, "minItems": 1},
    "pr": {
      "type": "object",
      "required": ["title", "base", "head", "labels", "draft"],
      "properties": {
        "title": {"type": "string", "pattern": "^\\[T[0-9]{3}\\]"},
        "base": {"type": "string"},
        "head": {"type": "string"},
        "labels": {"type": "array", "items": {"type": "string"}},
        "draft": {"type": "boolean"}
      }
    }
  }
}
```

**YAML DAG Schema Rules**:
- Each task MUST have unique `id` matching pattern `T[0-9]{3}`
- `requires` array MUST reference valid task IDs that exist in the graph
- `phase` MUST be one of: spec, plan, impl, test, verify, polish
- `parallel_group` enables concurrent execution within the same phase
- `estimated_minutes` MUST be positive integer for planning purposes
- `merge_base` MUST always be "feature-branch"

**Spec Digest**: 
```
spec_digest: e8f1b4c7d2a9e6f3c0d5b8e1a4c7d0e3f6b9c2d5e8f1b4c7a0e3d6b9c2f5e8f1
```

This SHA256 digest is calculated from the concatenation of the YAML TASK_GRAPH content and all NDJSON task lines to detect specification drift and ensure agents operate on consistent definitions.
