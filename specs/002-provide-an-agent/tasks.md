# Tasks: Agent-Swarmable Task Framework

**Input**: Design documents from `/specs/002-provide-an-agent/`
**Prerequisites**: spec.md (available)
**Tech Stack**: TypeScript/Node.js, Python scripts, JSON/YAML specifications, GitHub Actions

## Execution Flow Summary

1. **Setup Phase**: Create schemas and directory structure
2. **Core Implementation**: Build task management, parsing, and orchestration
3. **Integration**: Connect CLI commands and agent contract
4. **Testing**: Comprehensive unit and integration tests
5. **CI/Polish**: Workflows, documentation, and examples

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Schema Definition

- [ ] T001 Create JSON Schema for NDJSON task specifications in `.specify/schema/task.ndjson.schema.json`
- [ ] T002 [P] Create YAML DAG template structure in `.specify/graph/task_graph.yaml`
- [ ] T003 [P] Setup .specify directory structure with config, templates, and scripts directories

## Phase 3.2: TypeScript Interfaces & Spec-Kit Integration

- [ ] T004 [P] Create TypeScript task specification interfaces in `src/models/taskSpec.ts`
- [ ] T005 [P] Create agent contract type definitions in `src/types/agentContract.ts`
- [ ] T006 [P] Setup spec-kit adapter service in `src/services/specKitAdapter.ts`

## Phase 3.3: Core Infrastructure (ONLY after Phase 3.2)

- [ ] T007 [P] Implement task claiming and lease management in `scripts/task_claim.py`
- [ ] T008 [P] Create DAG validation with cycle detection in `scripts/dag_validate.py`
- [ ] T009 [P] Build TypeScript graph validator in `src/utils/graphValidator.ts`
- [ ] T010 [P] Create spec-kit bridge script in `scripts/spec_kit_bridge.py`

## Phase 3.4: Parsing & Task Management

- [ ] T011 [P] Build NDJSON task parser in `src/services/taskParser.ts`
- [ ] T012 [P] Create streaming NDJSON reader utility in `src/utils/ndjsonReader.ts`

## Phase 3.5: Orchestration Engine

- [ ] T013 Implement parallel group orchestrator Python script in `scripts/run_parallel.py`
- [ ] T014 Build TypeScript task orchestrator service in `src/services/taskOrchestrator.ts`

## Phase 3.6: Agent Contract Implementation

- [ ] T015 Create agent contract enforcement service in `src/services/agentContract.ts`
- [ ] T016 Write agent contract documentation in `docs/agent_contract.md`
- [ ] T017 Create task claiming protocol documentation in `docs/claiming.md`

## Phase 3.7: CLI Integration

- [ ] T018 [P] Implement claim command in `src/commands/claim.ts`
- [ ] T019 [P] Implement release command in `src/commands/release.ts`
- [ ] T020 [P] Implement status command in `src/commands/status.ts`

## Phase 3.8: Testing Suite

- [ ] T021 [P] Unit tests for task specifications in `tests/unit/taskSpec.spec.ts`
- [ ] T022 [P] Unit tests for agent contract in `tests/unit/agentContract.spec.ts`
- [ ] T023 [P] Unit tests for spec-kit adapter in `tests/unit/specKitAdapter.spec.ts`
- [ ] T024 [P] Integration tests for task workflows in `tests/integration/taskWorkflow.spec.ts`
- [ ] T025 [P] Integration tests for claiming protocol in `tests/integration/claiming.spec.ts`
- [ ] T026 [P] Integration tests for spec-kit integration in `tests/integration/specKitIntegration.spec.ts`

## Phase 3.9: CI/CD & Automation

- [ ] T027 [P] Create tasks CI workflow in `.github/workflows/tasks-ci.yml`
- [ ] T028 [P] Create spec-kit integration workflow in `.github/workflows/spec-kit-integration.yml`

## Phase 3.10: Documentation & Polish

- [ ] T029 [P] Write swarm framework documentation in `docs/swarm_framework.md`
- [ ] T030 [P] Create spec-kit integration guide in `docs/spec_kit_integration.md`
- [ ] T031 [P] Create sample feature YAML in `examples/sample_feature.yaml`
- [ ] T032 [P] Create sample tasks NDJSON in `examples/sample_tasks.ndjson`
- [ ] T033 Update main README with agent-swarmable framework documentation

## Dependencies

### Critical Dependencies

- **T001-T003**: Must complete before any implementation (schema foundation)
- **T004-T006**: TypeScript interfaces required for all services
- **T007-T010**: Infrastructure scripts needed for orchestration
- **T011-T012**: Parsing capabilities required for agent contract
- **T013-T014**: Orchestration needed before agent contract
- **T015-T017**: Agent contract blocks CLI integration
- **T018-T020**: CLI commands needed for testing
- **T021-T026**: All tests require implementation completion
- **T027-T028**: CI workflows require tests
- **T029-T033**: Documentation requires working implementation

### Parallel Execution Groups

- **Bootstrap Group**: T002, T003 (directory structure setup)
- **Interface Group**: T004, T005, T006 (TypeScript definitions)
- **Infrastructure Group**: T007, T008, T009, T010 (core scripts)
- **Parser Group**: T011, T012 (parsing utilities)
- **CLI Group**: T018, T019, T020 (command implementations)
- **Unit Test Group**: T021, T022, T023 (unit testing)
- **Integration Test Group**: T024, T025, T026 (integration testing)
- **CI Group**: T027, T028 (workflow definitions)
- **Documentation Group**: T029, T030, T031, T032 (docs and examples)

## Parallel Execution Examples

### Phase 3.1 Parallel Launch

```bash
# Launch setup tasks together:
Task: "Create YAML DAG template structure in .specify/graph/task_graph.yaml"
Task: "Setup .specify directory structure with config, templates, and scripts"
```

### Phase 3.2 Interface Development

```bash
# Launch TypeScript interface tasks:
Task: "Create TypeScript task specification interfaces in src/models/taskSpec.ts"
Task: "Create agent contract type definitions in src/types/agentContract.ts"
Task: "Setup spec-kit adapter service in src/services/specKitAdapter.ts"
```

### Phase 3.3 Infrastructure Scripts

```bash
# Launch core infrastructure in parallel:
Task: "Implement task claiming and lease management in scripts/task_claim.py"
Task: "Create DAG validation with cycle detection in scripts/dag_validate.py"
Task: "Build TypeScript graph validator in src/utils/graphValidator.ts"
Task: "Create spec-kit bridge script in scripts/spec_kit_bridge.py"
```

### Phase 3.8 Testing Parallel Launch

```bash
# Launch all unit tests simultaneously:
Task: "Unit tests for task specifications in tests/unit/taskSpec.spec.ts"
Task: "Unit tests for agent contract in tests/unit/agentContract.spec.ts"
Task: "Unit tests for spec-kit adapter in tests/unit/specKitAdapter.spec.ts"

# Launch integration tests in parallel:
Task: "Integration tests for task workflows in tests/integration/taskWorkflow.spec.ts"
Task: "Integration tests for claiming protocol in tests/integration/claiming.spec.ts"
Task: "Integration tests for spec-kit integration in tests/integration/specKitIntegration.spec.ts"
```

## Task Generation Rules Applied

1. **From Specification Artifacts**:

   - Schema files → validation and setup tasks (T001-T003)
   - TypeScript interfaces → type definition tasks (T004-T006)
   - Python scripts → infrastructure tasks (T007-T010)
   - Services → implementation tasks (T011-T020)

2. **From Agent Contract Requirements**:

   - Claiming protocol → claim management tasks
   - Heartbeat mechanism → lease management
   - PR management → workflow integration

3. **From Testing Strategy**:

   - Each major component → unit test task [P]
   - Each workflow → integration test task [P]
   - Each spec-kit integration → compatibility test

4. **Ordering Logic Applied**:
   - Schema definition before implementation
   - Interfaces before services
   - Infrastructure before orchestration
   - Core services before CLI integration
   - Implementation before testing
   - Tests before CI/CD
   - Everything before documentation

## Validation Checklist

- [x] All artifacts from specification have corresponding tasks
- [x] All TypeScript interfaces have implementation tasks
- [x] All services have unit tests
- [x] All workflows have integration tests
- [x] Parallel tasks operate on different files
- [x] Each task specifies exact file path
- [x] Dependencies prevent circular references
- [x] Critical path identified (schema → interfaces → services → CLI)
- [x] Spec-kit integration throughout pipeline

## Key Implementation Notes

- **Schema-First Approach**: T001 creates validation foundation for all subsequent tasks
- **Test-Driven Development**: Unit tests parallel implementation, integration tests verify workflows
- **Spec-Kit Compatibility**: Adapter service ensures bidirectional compatibility throughout
- **Atomic Operations**: Task claiming implements lease/heartbeat protocol for agent coordination
- **CI Integration**: Workflows validate both manual CLI and automated spec-kit operations
- **Documentation**: Comprehensive guides for both manual users and automated agents

## File Path Conventions

- **Schemas**: `.specify/schema/` for validation rules
- **Configuration**: `.specify/config/` for agent settings
- **Templates**: `.specify/templates/` for task templates
- **Scripts**: `scripts/` for Python automation
- **TypeScript Source**: `src/` with models, services, utils, commands
- **Tests**: `tests/unit/` and `tests/integration/`
- **Documentation**: `docs/` for guides and contracts
- **Examples**: `examples/` for sample files
- **CI/CD**: `.github/workflows/` for automation

This task breakdown provides a clear, executable path from initial schema definition to complete agent-swarmable framework with comprehensive testing and documentation.
