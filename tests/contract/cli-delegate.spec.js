"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnCliProcess = spawnCliProcess;
exports.runCliCommand = runCliCommand;
exports.expectExitCode = expectExitCode;
exports.expectJsonSchema = expectJsonSchema;
exports.parseJson = parseJson;
const vitest_1 = require("vitest");
const node_child_process_1 = require("node:child_process");
const node_events_1 = require("node:events");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const ajv_1 = __importDefault(require("ajv"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, node_path_1.dirname)(__filename);
const CLI_ENTRY = (0, node_path_1.resolve)(__dirname, '../../src/cli/index.ts');
const TSX_ENTRY = (0, node_path_1.resolve)(__dirname, '../../node_modules/tsx/dist/cli.cjs');
const ajv = new ajv_1.default({ allErrors: true, strict: false });
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
function collectStream(child) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        if (!child.stdout || !child.stderr) {
            reject(new Error('CLI spawn did not provide stdout/stderr streams'));
            return;
        }
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.once('error', reject);
        child.once('close', () => resolve({ stdout, stderr }));
    });
}
function spawnCliProcess(args, options = {}) {
    const { env, cwd } = options;
    return (0, node_child_process_1.spawn)(process.execPath, [TSX_ENTRY, CLI_ENTRY, ...args], {
        cwd: cwd ?? (0, node_path_1.resolve)(__dirname, '../../'),
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}
async function runCliCommand(args, options = {}) {
    const { input, timeoutMs = 30000 } = options;
    const child = spawnCliProcess(args, options);
    if (input) {
        child.stdin?.write(input);
        child.stdin?.end();
    }
    const timeout = timeoutMs > 0 ? setTimeout(() => {
        child.kill('SIGKILL');
    }, timeoutMs) : null;
    const [streams, exitTuple] = await Promise.all([
        collectStream(child),
        (0, node_events_1.once)(child, 'exit'),
    ]);
    if (timeout) {
        clearTimeout(timeout);
    }
    const [code, signal] = exitTuple;
    const exit = typeof code === 'number' ? code : child.exitCode;
    return {
        args,
        stdout: streams.stdout,
        stderr: streams.stderr,
        exitCode: typeof exit === 'number' ? exit : 1,
        signal: signal ?? child.signalCode,
    };
}
function expectExitCode(result, expected) {
    (0, vitest_1.expect)(result.exitCode, `Expected exit code ${expected}, received ${result.exitCode}. stderr: ${result.stderr}`).toBe(expected);
}
function expectJsonSchema(payload, schema) {
    const validate = ajv.compile(schema);
    const valid = validate(payload);
    if (!valid) {
        const message = ajv.errorsText(validate.errors, { separator: '\n' });
        throw new Error(`JSON schema assertion failed:\n${message}`);
    }
}
function parseJson(stdout) {
    const trimmed = stdout.trim();
    if (!trimmed) {
        throw new Error('Expected stdout to contain JSON payload, received empty output');
    }
    try {
        return JSON.parse(trimmed);
    }
    catch (error) {
        throw new Error(`Failed to parse JSON from stdout: ${error.message}\nOutput: ${trimmed}`);
    }
}
const delegateResponseSchema = {
    type: 'object',
    required: ['id', 'status', 'createdAt'],
    additionalProperties: false,
    properties: {
        id: { type: 'string', minLength: 1 },
        status: {
            type: 'string',
            enum: ['queued', 'running', 'waiting', 'blocked', 'completed', 'failed', 'cancelled'],
        },
        createdAt: { type: 'string', format: 'date-time' },
    },
};
(0, vitest_1.describe)('cli delegate contract', () => {
    let agentHome;
    let workspace;
    let baseEnv;
    (0, vitest_1.beforeEach)(async () => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-delegate-'));
        workspace = (0, node_path_1.join)(agentHome, 'workspace');
        (0, node_fs_1.mkdirSync)(workspace, { recursive: true });
        baseEnv = {
            COPILOT_AGENT_HOME: agentHome,
            COPILOT_CLI_TEST_MODE: 'contract',
        };
        const login = await runCliCommand(['login', '--method', 'device-code', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        expectExitCode(login, 0);
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(agentHome, { recursive: true, force: true });
    });
    (0, vitest_1.it)('requires a prompt', async () => {
        const result = await runCliCommand(['delegate', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        expectExitCode(result, 2);
        (0, vitest_1.expect)(result.stderr).toContain('prompt');
    });
    (0, vitest_1.it)('enqueues a delegation request with JSON output', async () => {
        const prompt = 'Refactor the authentication module';
        const filePath = (0, node_path_1.join)(workspace, 'auth.ts');
        (0, node_fs_1.writeFileSync)(filePath, 'export const stub = true;');
        const result = await runCliCommand(['delegate', '--prompt', prompt, '--file', filePath, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        expectExitCode(result, 0);
        const payload = parseJson(result.stdout);
        expectJsonSchema(payload, delegateResponseSchema);
        (0, vitest_1.expect)(payload.status).toBe('queued');
    });
    (0, vitest_1.it)('fails when referenced files do not exist', async () => {
        const result = await runCliCommand(['delegate', '--prompt', 'do something', '--file', 'missing.txt', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        expectExitCode(result, 2);
        (0, vitest_1.expect)(result.stderr).toContain('missing.txt');
    });
    (0, vitest_1.it)('supports quiet mode outputting only the session id', async () => {
        const prompt = 'Implement feature flag toggle';
        const result = await runCliCommand(['delegate', '--prompt', prompt, '--quiet'], {
            env: baseEnv,
            cwd: workspace,
        });
        expectExitCode(result, 0);
        const trimmed = result.stdout.trim();
        (0, vitest_1.expect)(trimmed.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(trimmed.split('\n').length).toBe(1);
    });
    (0, vitest_1.it)('validates folder references', async () => {
        const contextFolder = (0, node_path_1.join)(workspace, 'context');
        (0, node_fs_1.mkdirSync)(contextFolder);
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(contextFolder, 'README.md'), '# context');
        const result = await runCliCommand(['delegate', '--prompt', 'analyze context', '--folder', contextFolder, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        expectExitCode(result, 0);
        const payload = parseJson(result.stdout);
        expectJsonSchema(payload, delegateResponseSchema);
    });
    (0, vitest_1.it)('captures repository metadata from GitHub Actions environment variables', async () => {
        const env = {
            ...baseEnv,
            GITHUB_REPOSITORY: 'octocat/hello-world',
            GITHUB_REF: 'refs/heads/feature-branch',
        };
        const result = await runCliCommand(['delegate', '--prompt', 'repo context capture', '--json'], {
            env,
            cwd: workspace,
        });
        expectExitCode(result, 0);
        const payload = parseJson(result.stdout);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === payload.id);
        (0, vitest_1.expect)(record?.repository).toBeDefined();
        (0, vitest_1.expect)(record?.repository).toMatchObject({
            provider: 'github',
            owner: 'octocat',
            repo: 'hello-world',
            branch: 'feature-branch',
        });
    });
});
//# sourceMappingURL=cli-delegate.spec.js.map