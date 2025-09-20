import { constants } from 'node:fs';
import { access, cp, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { CliContext } from '../types';
import { getStringFlag, hasFlag, parseArgs, writeLine } from '../utils';

interface InitOptions {
  targetDir: string;
  force: boolean;
  minimal: boolean;
}

const FULL_DIRECTORIES = [
  { relative: '.github/workflows', optional: false },
  { relative: 'artifacts', optional: false },
  { relative: 'specs', optional: false },
  { relative: 'docs', optional: false },
];

const MINIMAL_DIRECTORIES = [
  { relative: '.github/workflows', optional: false },
];

const FULL_FILES = [
  { relative: 'scripts/sync-speckit-artifacts.mjs', optional: false },
  { relative: 'scripts/check-schemas.mjs', optional: true },
];

const MINIMAL_FILES = [
  { relative: 'scripts/sync-speckit-artifacts.mjs', optional: false },
];

export default async function initCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const targetDir = resolve(context.cwd, getStringFlag(parsed, 'target') ?? '.');
  const force = hasFlag(parsed, 'force');
  const minimal = hasFlag(parsed, 'minimal');

  const options: InitOptions = {
    targetDir,
    force,
    minimal,
  };

  const packageRoot = await resolvePackageRoot();

  await mkdir(join(targetDir, '.github'), { recursive: true });
  await mkdir(join(targetDir, 'scripts'), { recursive: true });

  await copyDirectories(packageRoot, options);
  await copyFiles(packageRoot, options);

  const summary = options.minimal
    ? `CopilotAgent workflows and helper scripts installed to ${targetDir}. ` +
      'Use --force to overwrite existing files or rerun without --minimal for full assets.'
    : `CopilotAgent workflows, specs, artifacts, and scripts installed to ${targetDir}. ` +
      'Review the copied files and commit them to bootstrap orchestration.';

  writeLine(context.stdout, summary);

  return 0;
}

async function resolvePackageRoot(): Promise<string> {
  let current = __dirname;
  while (true) {
    const candidate = join(current, 'package.json');
    if (await pathExists(candidate)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate package root for CopilotAgentCLI.');
    }
    current = parent;
  }
}

async function copyDirectories(packageRoot: string, options: InitOptions): Promise<void> {
  const directories = options.minimal ? MINIMAL_DIRECTORIES : FULL_DIRECTORIES;
  for (const entry of directories) {
    const source = join(packageRoot, entry.relative);
    const destination = join(options.targetDir, entry.relative);
    if (!(await pathExists(source))) {
      if (entry.optional) {
        continue;
      }
      throw new Error(`Missing source directory: ${entry.relative}`);
    }

    if (!options.force && (await pathExists(destination))) {
      continue;
    }

    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
  }
}

async function copyFiles(packageRoot: string, options: InitOptions): Promise<void> {
  const files = options.minimal ? MINIMAL_FILES : FULL_FILES;
  for (const entry of files) {
    const source = join(packageRoot, entry.relative);
    const destination = join(options.targetDir, entry.relative);

    if (!(await pathExists(source))) {
      if (entry.optional) {
        continue;
      }
      throw new Error(`Missing source file: ${entry.relative}`);
    }

    if (!options.force && (await pathExists(destination))) {
      continue;
    }

    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { force: true });
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
