"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const cli_delegate_spec_1 = require("./cli-delegate.spec");
const resultResponseSchema = {
    type: 'object',
    required: ['id', 'status', 'summary', 'artifacts'],
    additionalProperties: false,
    properties: {
        id: { type: 'string', minLength: 1 },
        status: {
            type: 'string',
            enum: ['completed', 'failed', 'cancelled'],
        },
        summary: { type: 'string' },
        artifacts: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
        },
    },
};
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
(0, vitest_1.describe)('cli result contract', () => {
    let agentHome;
    let workspace;
    let baseEnv;
    (0, vitest_1.beforeEach)(async () => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-result-'));
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
    (0, vitest_1.it)('returns summary and artifacts for completed sessions', async () => {
        const delegated = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'collect result', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegated, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegated.stdout);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === id);
        if (record) {
            record.status = 'completed';
            record.summary = 'Implemented the requested feature.';
            record.artifacts = ['file:///workspace/result.txt'];
            record.updatedAt = new Date().toISOString();
        }
        (0, node_fs_1.writeFileSync)(storePath, JSON.stringify(sessions, null, 2));
        const result = await (0, cli_delegate_spec_1.runCliCommand)(['result', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(result, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(result.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, resultResponseSchema);
        (0, vitest_1.expect)(payload.summary.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(payload.artifacts.length).toBe(1);
    });
    (0, vitest_1.it)('returns not found for unknown session', async () => {
        const result = await (0, cli_delegate_spec_1.runCliCommand)(['result', 'missing', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(result, 5);
        (0, vitest_1.expect)(result.stderr).toContain('missing');
    });
});
//# sourceMappingURL=cli-result.spec.js.map