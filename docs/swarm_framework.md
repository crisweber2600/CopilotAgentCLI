# Agent-Swarmable Framework Documentation

## Overview

The Agent-Swarmable Framework enables multiple agents to work on parallelizable tasks without conflicts or duplication through explicit dependency management and atomic task claiming mechanisms.

## Key Features

- **Atomic Task Claiming**: Tasks are claimed atomically with lease/heartbeat mechanisms to prevent race conditions
- **Dependency Management**: Tasks have explicit dependencies with topological ordering enforcement
- **Parallel Execution**: Tasks can be grouped for parallel execution while respecting dependencies
- **Branch Per Task**: Each task gets its own Git branch following the pattern `feat/<feature-slug>__T###`
- **Lease Management**: Tasks have time-based leases with heartbeat requirements
- **Status Tracking**: Comprehensive status tracking through the task lifecycle

## Directory Structure

```
.specify/
├── schema/
│   └── task.ndjson.schema.json      # JSON Schema for task validation
├── graph/
│   └── task_graph.yaml              # Task dependency graph definition
├── config/
│   └── agent_config.yaml            # Agent behavior configuration
├── templates/
│   └── task_template.ndjson         # Template for new tasks
├── tasks/
│   └── *.ndjson                     # Task specification files
├── claims/
│   └── *.json                       # Active task claim leases
└── logs/
    └── *.log                        # Task lifecycle event logs
```

## Task Specification Format

Tasks are defined in NDJSON (Newline Delimited JSON) format. Each line contains a complete task specification:

```json
{
  "id": "T001",
  "name": "Example Task",
  "description": "Description of what this task accomplishes",
  "requires": ["T000"],
  "parallel_group": "group-name",
  "inputs": ["path/to/input/file"],
  "outputs": ["path/to/output/file"],
  "branch": "feat/example-feature__T001",
  "base_branch": "feat/example-feature",
  "claim": {
    "status": "open",
    "by": null,
    "since": "2025-09-19T00:00:00Z",
    "lease_minutes": 90,
    "heartbeat_minutes": 10
  },
  "concurrency_key": "example-feature::T001",
  "retry_policy": {
    "max_retries": 2,
    "backoff": "exponential",
    "base_seconds": 20
  },
  "done_when": [
    "All implementation is complete",
    "Tests pass",
    "Documentation is updated"
  ],
  "pr": {
    "title": "[T001] Example Task",
    "base": "feat/example-feature", 
    "head": "feat/example-feature__T001",
    "labels": ["auto:swarm", "task", "T001"],
    "draft": false
  }
}
```

## Task States

- **open**: Task is available for claiming
- **claimed**: Task has been claimed but work hasn't started
- **in_progress**: Agent is actively working on the task
- **blocked**: Task is blocked waiting for external dependencies
- **done**: Task has been completed successfully
- **abandoned**: Task was abandoned by the agent

## CLI Commands

### claim
Claim an available task for execution:

```bash
# List available tasks
copilot-cli claim --list

# Claim a specific task
copilot-cli claim T001

# Claim with custom agent identity
copilot-cli claim T001 --agent my-agent --agent-name "My Agent"

# Force claim (skip dependency checks)
copilot-cli claim T001 --force
```

### release
Release a claimed task back to the pool:

```bash
# Release a task
copilot-cli release T001

# Release with reason
copilot-cli release T001 --reason "Switching priorities"
```

### task-status
Check status of tasks:

```bash
# Show status of all tasks
copilot-cli task-status --all

# Show status with dependency information
copilot-cli task-status --all --deps

# Show status of specific task
copilot-cli task-status T001
```

## Agent Contract

Agents operating within this framework must adhere to the following protocol:

1. **Atomic Claiming**: Transition task status from `open` to `claimed` atomically
2. **Heartbeat Maintenance**: Refresh heartbeat before expiration
3. **Dependency Verification**: Verify all dependencies are complete before starting
4. **Branch Management**: Create dedicated task branch following naming convention
5. **Incremental Commits**: Commit work in small, verifiable steps
6. **Completion Protocol**: Mark task as `done` and provide artifacts
7. **Graceful Abandonment**: Properly release tasks when abandoning work

## Example Workflow

1. **List Available Tasks**:
   ```bash
   copilot-cli claim --list --json
   ```

2. **Claim a Task**:
   ```bash
   copilot-cli claim T007 --agent my-agent
   ```

3. **Work on the Task**:
   - Create the task branch
   - Make incremental commits
   - Send periodic heartbeats (automatically handled by agent)

4. **Complete or Release**:
   ```bash
   # If completed successfully, the agent contract service marks it done
   # If need to abandon:
   copilot-cli release T007 --reason "Blocked by external dependency"
   ```

## Configuration

Agent behavior can be configured via `.specify/config/agent_config.yaml`:

```yaml
agent:
  default_lease_minutes: 90
  default_heartbeat_minutes: 10
  max_concurrent_tasks: 3

git:
  feature_branch_pattern: "feat/{feature-slug}"
  task_branch_pattern: "feat/{feature-slug}__T{task-id}"
  auto_push: true
  auto_create_pr: true
```

## Integration

The framework integrates with:
- **Git**: Branch management and PR creation
- **GitHub**: Pull request automation
- **CI/CD**: Automated validation and checks
- **Spec-Kit**: Compatible with spec-kit workflows

## Development

To extend the framework:

1. **Add New Task Types**: Extend the JSON schema and TypeScript interfaces
2. **Custom Validators**: Implement completion criteria validators
3. **Agent Extensions**: Create specialized agent implementations
4. **Integration Hooks**: Add hooks for external system integration

## Testing

The framework includes comprehensive testing:

```bash
# Test core functionality
node test-framework.mjs

# Test claiming workflow
node test-claim.mjs

# Run with verbose output
node test-framework.mjs --verbose
```