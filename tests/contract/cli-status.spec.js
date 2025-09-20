"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const cli_delegate_spec_1 = require("./cli-delegate.spec");
const statusResponseSchema = {
    type: 'object',
    required: ['id', 'status', 'needsUserInput', 'updatedAt'],
    additionalProperties: false,
    properties: {
        id: { type: 'string', minLength: 1 },
        status: {
            type: 'string',
            enum: ['queued', 'running', 'waiting', 'blocked', 'completed', 'failed', 'cancelled'],
        },
        needsUserInput: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' },
    },
};
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
(0, vitest_1.describe)('cli status contract', () => {
    let agentHome;
    let workspace;
    let baseEnv;
    (0, vitest_1.beforeEach)(async () => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-status-'));
        workspace = (0, node_path_1.join)(agentHome, 'workspace');
        (0, node_fs_1.mkdirSync)(workspace, { recursive: true });
        baseEnv = {
            COPILOT_AGENT_HOME: agentHome,
            COPILOT_CLI_TEST_MODE: 'contract',
        };
        const login = await (0, cli_delegate_spec_1.runCliCommand)(['login', '--method', 'device-code', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(login, 0);
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(agentHome, { recursive: true, force: true });
    });
    (0, vitest_1.it)('reports session status with needsUserInput flag', async () => {
        const delegate = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'check status', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegate, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegate.stdout);
        const status = await (0, cli_delegate_spec_1.runCliCommand)(['status', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(status, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(status.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, statusResponseSchema);
        (0, vitest_1.expect)(payload.needsUserInput).toBe(false);
    });
    (0, vitest_1.it)('reflects waiting state requiring user input', async () => {
        const created = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'need approval', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(created, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(created.stdout);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === id);
        (0, vitest_1.expect)(record).toBeDefined();
        if (record) {
            record.status = 'waiting';
            record.needsUserInput = true;
            record.updatedAt = new Date().toISOString();
        }
        (0, node_fs_1.writeFileSync)(storePath, JSON.stringify(sessions, null, 2));
        const status = await (0, cli_delegate_spec_1.runCliCommand)(['status', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(status, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(status.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, statusResponseSchema);
        (0, vitest_1.expect)(payload.status).toBe('waiting');
        (0, vitest_1.expect)(payload.needsUserInput).toBe(true);
    });
    (0, vitest_1.it)('returns not-found for unknown session ids', async () => {
        const status = await (0, cli_delegate_spec_1.runCliCommand)(['status', 'missing-session', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(status, 5);
        (0, vitest_1.expect)(status.stderr).toContain('missing-session');
    });
});
//# sourceMappingURL=cli-status.spec.js.map