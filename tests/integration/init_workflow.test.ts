import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TSX_ENTRY = resolve(__dirname, '../../node_modules/tsx/dist/cli.cjs');
const CLI_ENTRY = resolve(__dirname, '../../src/cli/index.ts');

async function runCli(args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }): Promise<CliResult> {
  const child = spawn(process.execPath, [TSX_ENTRY, CLI_ENTRY, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  if (child.stdout) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
  }

  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
  }

  const [code] = await once(child, 'exit');

  return {
    exitCode: typeof code === 'number' ? code : 1,
    stdout,
    stderr,
  };
}

describe('init workflow bootstrap', () => {
  it('copies workflows, scripts, specs, and artifacts into target repo', async () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'copilot-cli-init-'));

    const result = await runCli(['init', '--minimal'], {
      cwd: targetDir,
      env: {
        COPILOT_CLI_TEST_MODE: '1',
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');

    const orchestrator = readFileSync(join(targetDir, '.github', 'workflows', 'orchestrator.yml'), 'utf-8');
    expect(orchestrator).toContain('node dist/cli/index.js delegate');

    const execute = readFileSync(join(targetDir, '.github', 'workflows', 'execute.yml'), 'utf-8');
    expect(execute).toContain('node dist/cli/index.js complete');

    const syncScript = readFileSync(join(targetDir, 'scripts', 'sync-speckit-artifacts.mjs'), 'utf-8');
    expect(syncScript).toContain('Speckit');

    expect(() =>
      readFileSync(join(targetDir, 'artifacts', 'workflows', 'wf-001-create-a-structured.yaml'), 'utf-8'),
    ).toThrow();

    rmSync(targetDir, { recursive: true, force: true });
  });
});
