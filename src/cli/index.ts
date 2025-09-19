#!/usr/bin/env node
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import loginCommand from './commands/login';
import logoutCommand from './commands/logout';
import delegateCommand from './commands/delegate';
import statusCommand from './commands/status';
import followCommand from './commands/follow';
import listCommand from './commands/list';
import cancelCommand from './commands/cancel';
import resultCommand from './commands/result';
import approveCommand from './commands/approve';
import denyCommand from './commands/deny';
import claimCommand from './commands/claim';
import releaseCommand from './commands/release';
import taskStatusCommand from './commands/task-status';
import type { CliContext, CommandHandler } from './types';
import { AuthService } from '../services/authService';
import { SessionService } from '../services/sessionService';
import { AuthError, isServiceError, ServiceError, UnexpectedError, ValidationError } from '../services/errors';
import { attemptAutoLogin, ensureAuthenticated } from './auth/autoLogin';

const COMMANDS: Record<string, CommandHandler> = {
  login: loginCommand,
  logout: logoutCommand,
  delegate: delegateCommand,
  status: statusCommand,
  follow: followCommand,
  list: listCommand,
  cancel: cancelCommand,
  result: resultCommand,
  approve: approveCommand,
  deny: denyCommand,
  claim: claimCommand,
  release: releaseCommand,
  'task-status': taskStatusCommand,
};

function envTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

function createContext(verbose: boolean, cwdOverride?: string): CliContext {
  const env = process.env;
  const agentHome = env.COPILOT_AGENT_HOME ?? join(homedir(), '.copilot-agent');
  const cwd = resolveWorkingDirectory(cwdOverride);
  const authService = new AuthService({ agentHome, env });
  const sessionService = new SessionService({
    agentHome,
    runnerMode: env.COPILOT_CLI_TEST_MODE ? 'stub' : 'cli',
    authService,
  });
  return {
    authService,
    sessionService,
    stdout: process.stdout,
    stderr: process.stderr,
    env,
    cwd,
    agentHome,
    ciDefaultJson: envTruthy(env.CI) || envTruthy(env.COPILOT_CLI_JSON_DEFAULT),
    verbose,
  };
}

function resolveWorkingDirectory(cwdOverride: string | undefined): string {
  if (!cwdOverride) {
    return process.cwd();
  }

  const trimmed = cwdOverride.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('--cwd flag requires a non-empty directory path.');
  }

  const resolved = resolve(process.cwd(), trimmed);
  try {
    const stats = statSync(resolved);
    if (!stats.isDirectory()) {
      throw new ValidationError(`Working directory override is not a directory: ${resolved}`);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new ValidationError(`Working directory override does not exist: ${resolved}`);
    }
    throw new ValidationError(`Unable to access working directory override: ${resolved}`);
  }

  return resolved;
}

function extractCommandArgs(
  rawArgs: string[]
): { commandName: string | undefined; args: string[]; verbose: boolean; cwdOverride?: string } {
  const args: string[] = [];
  let verbose = false;
  let commandName: string | undefined;
  let cwdOverride: string | undefined;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg === '--cwd') {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new ValidationError('--cwd flag requires a directory path.');
      }
      cwdOverride = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length);
      if (!value) {
        throw new ValidationError('--cwd flag requires a directory path.');
      }
      cwdOverride = value;
      continue;
    }

    if (!commandName) {
      commandName = arg;
    } else {
      args.push(arg);
    }
  }

  return { commandName, args, verbose, cwdOverride };
}

function printHelp(): void {
  const lines = [
    'Usage: copilot-cli <command> [options]',
    '',
    'Commands:',
    '  login        Authenticate with the coding agent service',
    '  logout       Clear authentication state',
    '  delegate     Create a new delegated session',
    '  status       Show the latest status for a session',
    '  follow       Stream live updates for a session',
    '  list         List sessions (optionally filtered by status)',
    '  cancel       Cancel an active session',
    '  approve      Approve a pending coding-agent action',
    '  deny         Deny a pending coding-agent action',
    '  result       Fetch the final result for a session',
    '',
    'Agent Swarmable Framework:',
    '  claim        Claim a task for execution by an agent',
    '  release      Release a claimed task back to the pool',
    '  task-status  Show status of tasks in the swarmable framework',
    '',
    'Global options:',
    '  --verbose   Enable verbose error output',
    '  --cwd PATH  Run commands as if invoked from PATH',
  ];
  lines.forEach((line) => process.stdout.write(`${line}\n`));
}

async function run(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  let parsed;
  try {
    parsed = extractCommandArgs(rawArgs);
  } catch (error) {
    const fallbackContext = createContext(false);
    handleError(error, fallbackContext);
    return;
  }

  const { commandName, args, verbose, cwdOverride } = parsed;

  if (!commandName || commandName === 'help') {
    printHelp();
    process.exitCode = commandName ? 0 : 2;
    return;
  }

  const command = COMMANDS[commandName];
  if (!command) {
    process.stderr.write(`Unknown command: ${commandName}\n`);
    process.exitCode = 2;
    return;
  }

  let context: CliContext;
  try {
    context = createContext(verbose, cwdOverride);
  } catch (error) {
    const fallbackContext = createContext(verbose);
    handleError(error, fallbackContext);
    return;
  }

  const shouldEnsureAuth = commandName !== 'login' && commandName !== 'logout' && !context.env.COPILOT_CLI_TEST_MODE;

  try {
    if (shouldEnsureAuth) {
      await ensureAuthenticated(context);
    }
    const exitCode = await command(args, context);
    process.exitCode = exitCode;
    return;
  } catch (error) {
    const retried = await maybeRetryWithAutoLogin(error, command, args, context);
    if (retried) {
      return;
    }
    handleError(error, context);
  }
}

function handleError(error: unknown, context: CliContext): void {
  if (isServiceError(error)) {
    context.stderr.write(`${(error as ServiceError).message}\n`);
    process.exitCode = (error as ServiceError).exitCode;
    return;
  }

  const unexpected = error instanceof Error ? error : new UnexpectedError('Unexpected failure.');
  context.stderr.write(`Unexpected error: ${unexpected.message}\n`);
  if (context.verbose && unexpected instanceof Error && unexpected.stack) {
    context.stderr.write(`${unexpected.stack}\n`);
  }
  process.exitCode = unexpected instanceof ServiceError ? unexpected.exitCode : 9;
}

run().catch(async (error) => {
  const context = createContext(envTruthy(process.env.COPILOT_CLI_VERBOSE));
  const retried = await maybeRetryWithAutoLogin(error, async () => 0, [], context);
  if (retried) {
    return;
  }
  handleError(error, context);
});

async function maybeRetryWithAutoLogin(
  error: unknown,
  command: CommandHandler,
  args: string[],
  context: CliContext
): Promise<boolean> {
  if (!(error instanceof AuthError)) {
    return false;
  }

  context.stderr.write('Authentication required. Attempting to log in...\n');
  const loggedIn = await attemptAutoLogin(context);
  if (!loggedIn) {
    context.stderr.write('Automatic login failed.\n');
    return false;
  }

  try {
    const exitCode = await command(args, context);
    process.exitCode = exitCode;
    return true;
  } catch (commandError) {
    if (commandError instanceof AuthError) {
      context.stderr.write('Authentication still failed after retry.\n');
    }
    handleError(commandError, context);
    return true;
  }
}
