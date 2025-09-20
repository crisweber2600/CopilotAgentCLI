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
import completeCommand from './commands/complete';
import gateCommand from './commands/gate';
import exportCommand from './commands/export';
import initCommand from './commands/init';
import type { CliContext, CommandHandler } from './types';
import { AuthService } from '../services/authService';
import { SessionService, type RunnerMode } from '../services/sessionService';
import {
  AuthError,
  isServiceError,
  ServiceError,
  UnexpectedError,
  ValidationError,
} from '../services/errors';
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
  complete: completeCommand,
  gate: gateCommand,
  export: exportCommand,
  init: initCommand,
};

const OPTIONAL_AUTH_COMMANDS = new Set(['login', 'init']);

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
  const runnerMode: RunnerMode =
    (env.COPILOT_AGENT_RUNNER_MODE as RunnerMode | undefined) ??
    (env.COPILOT_CLI_TEST_MODE ? 'stub' : 'cli');
  const sessionService = new SessionService({
    agentHome,
    runnerMode,
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

function extractCommandArgs(rawArgs: string[]): {
  commandName: string | undefined;
  args: string[];
  verbose: boolean;
  cwdOverride?: string;
} {
  const args: string[] = [];
  let verbose = false;
  let commandName: string | undefined;
  let cwdOverride: string | undefined;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === '--verbose' || arg === '-v') {
      verbose = true;
      continue;
    }
    if (arg === '--cwd') {
      cwdOverride = rawArgs[index + 1];
      index += 1;
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

async function main(rawArgs: string[]): Promise<number> {
  const { commandName, args, verbose, cwdOverride } = extractCommandArgs(rawArgs);

  if (!commandName) {
    throw new ValidationError(
      'Command not specified. Run `copilot-cli --help` for available commands.',
    );
  }

  const command = COMMANDS[commandName];
  if (!command) {
    throw new ValidationError(`Unknown command: ${commandName}`);
  }

  const context = createContext(verbose, cwdOverride);
  if (!OPTIONAL_AUTH_COMMANDS.has(commandName)) {
    if (!context.env.COPILOT_CLI_TEST_MODE) {
      await attemptAutoLogin(context);
    }
    await ensureAuthenticated(context);
  }

  return command(args, context);
}

async function run(): Promise<void> {
  try {
    const exitCode = await main(process.argv.slice(2));
    process.exit(exitCode);
  } catch (error) {
    if (isServiceError(error)) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
      return;
    }
    if (error instanceof AuthError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
      return;
    }
    if (error instanceof ValidationError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
      return;
    }
    process.stderr.write(`${(error as Error).message}\n`);
    throw new UnexpectedError('Unexpected failure executing CLI command.', error);
  }
}

run().catch((error) => {
  if (error instanceof ServiceError) {
    process.exit(error.exitCode);
  } else {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
});
