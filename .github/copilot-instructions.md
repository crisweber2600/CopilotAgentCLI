# Copilot Agent CLI - AI Development Guide

This CLI enables delegating software tasks to GitHub Copilot coding agents from any shell environment. Understanding the architecture patterns will help you contribute effectively.

## Architecture Overview

**Three-layer service architecture:**

- `src/cli/` - Command parsing, validation, and user interaction
- `src/services/` - Core business logic (auth, sessions, git, remote client)
- `src/models/` - Shared data structures and validation

**Key insight**: The CLI supports two execution modes via `RunnerMode`:

- `cli` mode: Remote execution through GitHub Copilot Agent API
- `stub` mode: Local simulation for testing (enabled via `COPILOT_CLI_TEST_MODE`)

## Essential Patterns

### Command Structure

Each command follows this pattern in `src/cli/commands/`:

```typescript
export async function commandName(
  args: string[],
  context: CliContext
): Promise<number> {
  const parsed = parseArgs(args);
  // Validate inputs using ValidationError for user errors
  await context.authService.requireSession(); // Auth check when needed
  // Business logic via services
  // Output via writeJson() or writeLine()
  return 0; // Exit code
}
```

### Error Handling Strategy

- `ValidationError` - User input problems (exit code 2)
- `AuthError` - Authentication failures (exit code 3)
- `ConflictError` - Resource conflicts like cancelling finished sessions (exit code 6)
- `ServiceError` - Other service-level errors with specific exit codes
- Always provide actionable error messages, never raw stack traces to users

### Session Management

Sessions are the core entity, stored in `~/.copilot-agent/sessions.json`:

- Created via `SessionService.create()` with a `DelegationRequest`
- Status progression: `queued` → `running` → `waiting`/`completed`/`failed`
- Terminal states: `completed`, `failed`, `cancelled`
- Use `session.needsUserInput` to determine if approval commands apply

### Authentication Flow

Multiple auth methods supported via `AuthService`:

- Device code (default): Browser-based OAuth flow
- Environment token: `COPILOT_AGENT_TOKEN` for CI/CD
- GitHub PAT: `GITHUB_TOKEN` with specific scopes
- Session cookie: For VS Code integration

Auth state persisted in `~/.copilot-agent/auth.json`. Always call `requireSession()` before authenticated operations.

## Development Workflows

### Building and Testing

```bash
npm run build              # TypeScript compilation to dist/
npm run cli -- <args>      # Run from source without global install
npx vitest run tests/contract  # Contract tests (spawn CLI processes)
```

### Contract Testing Philosophy

Tests in `tests/contract/` spawn the actual CLI via Node.js and validate:

- JSON output schemas using AJV
- Exit codes match documented behavior
- State persistence across command invocations
- Error message formats

**Critical**: Tests run in `COPILOT_CLI_TEST_MODE` with stub runner - no real API calls.

### Git Integration

The CLI auto-detects repository context via `GitService`:

- Resolves repo metadata from git remotes or GitHub Actions env vars
- Auto-commits uncommitted changes when `COPILOT_CLI_AUTO_COMMIT_AND_PUSH=1`
- Creates checkpoint branches before delegating tasks
- Captures PR URLs from remote job responses

## Project Conventions

### Output Formatting

- All commands support `--json` and `--text` flags
- JSON mode auto-enabled in CI environments (`process.env.CI`)
- Use `writeJson()` and `writeLine()` helpers for consistent formatting
- `--quiet` flag outputs only essential data (usually session IDs)

### Environment Configuration

Heavy use of environment variables for customization:

- `COPILOT_AGENT_HOME` - Override storage directory (default `~/.copilot-agent`)
- `COPILOT_CLI_AUTO_COMMIT_AND_PUSH` - Enable git automation
- `COPILOT_CLI_TEST_MODE` - Force stub runner for testing
- Runtime behavior configured via env vars, not CLI flags

### Service Composition

`CliContext` provides dependency injection:

```typescript
interface CliContext {
  authService: AuthService;
  sessionService: SessionService;
  stdout/stderr: NodeJS.WriteStream;
  env: NodeJS.ProcessEnv;
  // ...
}
```

Services use constructor injection with options interfaces for testability.

### File Structure Patterns

- `commands/` - One file per CLI command
- `models/` - TypeScript interfaces and validation logic
- `services/` - Stateful business logic classes
- `auth/` - Authentication utilities and flows
- `specs/` - Feature specifications in markdown
- `tests/contract/` - End-to-end CLI behavior tests

## Key Integration Points

### Remote API Client (`CopilotAgentClient`)

Handles communication with `https://api.githubcopilot.com`:

- Job creation with context files and repository metadata
- Session polling and status updates
- Pull request URL extraction from job responses
- Error mapping from remote API to local error types

### Repository Detection

`detectRepository()` in `src/cli/repository.ts` supports:

- Local git repository introspection
- GitHub Actions environment variables (`GITHUB_REPOSITORY`, `GITHUB_REF`)
- Manual branch/remote overrides via command flags

### Context References

File and folder context via `--file` and `--folder` flags:

- Validated for existence before delegation
- Stored as absolute paths in session records
- Used by remote agent for task context

## Common Pitfalls

1. **Don't use `console.log`** - Use `context.stdout` and the output helpers
2. **Test in both modes** - Ensure commands work with stub and real runners
3. **Validate early** - Throw `ValidationError` for bad user input before service calls
4. **Check terminal states** - Many operations only apply to active sessions
5. **Handle missing auth** - Call `requireSession()` before authenticated operations

## Structured Prompt Commands

The project includes specialized prompt files in `.github/prompts/` for structured development workflows:

### `/specify` - Feature Specification

Creates feature specifications from natural language descriptions:

```bash
# Usage in AI tools: /specify "Add user authentication with JWT tokens"
```

- Runs `.specify/scripts/bash/create-new-feature.sh` to create new feature branch
- Uses `.specify/templates/spec-template.md` to generate structured spec
- Outputs: Creates `SPEC_FILE` with requirements, user stories, and acceptance criteria
- Branch naming: Feature branches follow consistent naming conventions

### `/plan` - Implementation Planning

Executes implementation planning workflow from feature specifications:

```bash
# Usage in AI tools: /plan "Focus on REST API design and database schema"
```

- Runs `.specify/scripts/bash/setup-plan.sh` to prepare planning environment
- Loads feature spec and constitution requirements from `.specify/memory/`
- Generates design artifacts in phases:
  - Phase 0: `research.md` - Technical decisions and approach
  - Phase 1: `data-model.md`, `contracts/`, `quickstart.md` - Core design
  - Phase 2: `tasks.md` - Implementation tasks
- Follows `.specify/templates/plan-template.md` execution flow

### `/tasks` - Task Generation

Creates actionable, dependency-ordered implementation tasks:

```bash
# Usage in AI tools: /tasks "Include integration tests for all API endpoints"
```

- Runs `.specify/scripts/bash/check-task-prerequisites.sh` to validate prerequisites
- Analyzes available design documents (plan.md, data-model.md, contracts/, etc.)
- Generates numbered tasks (T001, T002, etc.) with:
  - Clear file paths and dependencies
  - Parallel execution markers [P] for independent tasks
  - TDD approach (tests before implementation)
- Task ordering: Setup → Tests → Models → Services → Endpoints → Integration → Polish

### Prompt Workflow Integration

These prompts work together in sequence:

1. **Specify** → Creates feature branch and specification
2. **Plan** → Generates design artifacts from specification
3. **Tasks** → Creates executable task list from design artifacts

Each prompt expects specific directory structure under `.specify/` with templates, scripts, and memory files.

## Debug Commands

For development and troubleshooting:

```bash
copilot-cli list --json           # View all session states
copilot-cli status <id> --json    # Detailed session information
COPILOT_CLI_VERBOSE=1 copilot-cli delegate ...  # Stack traces on errors
```
