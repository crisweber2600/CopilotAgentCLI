"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const cli_delegate_spec_1 = require("./cli-delegate.spec");
const listResponseSchema = {
    type: 'object',
    required: ['sessions'],
    additionalProperties: false,
    properties: {
        sessions: {
            type: 'array',
            items: {
                type: 'object',
                required: ['id', 'status', 'updatedAt'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', minLength: 1 },
                    status: {
                        type: 'string',
                        enum: ['queued', 'running', 'waiting', 'blocked', 'completed', 'failed', 'cancelled'],
                    },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
        },
    },
};
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
(0, vitest_1.describe)('cli list contract', () => {
    let agentHome;
    let workspace;
    let baseEnv;
    (0, vitest_1.beforeEach)(async () => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-list-'));
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
    (0, vitest_1.it)('lists all sessions with schema compliance', async () => {
        const ids = [];
        for (let i = 0; i < 3; i += 1) {
            const result = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', `session-${i}`, '--json'], { env: baseEnv, cwd: workspace });
            (0, cli_delegate_spec_1.expectExitCode)(result, 0);
            ids.push((0, cli_delegate_spec_1.parseJson)(result.stdout).id);
        }
        const response = await (0, cli_delegate_spec_1.runCliCommand)(['list', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(response, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(response.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, listResponseSchema);
        const sessionIds = payload.sessions.map((session) => session.id);
        ids.forEach((id) => (0, vitest_1.expect)(sessionIds).toContain(id));
    });
    (0, vitest_1.it)('filters sessions by status', async () => {
        const completedResult = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'completed session', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(completedResult, 0);
        const completedId = (0, cli_delegate_spec_1.parseJson)(completedResult.stdout).id;
        const queuedResult = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'queued session', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(queuedResult, 0);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === completedId);
        if (record) {
            record.status = 'completed';
            record.updatedAt = new Date().toISOString();
        }
        (0, node_fs_1.writeFileSync)(storePath, JSON.stringify(sessions, null, 2));
        const response = await (0, cli_delegate_spec_1.runCliCommand)(['list', '--status', 'completed', '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(response, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(response.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, listResponseSchema);
        (0, vitest_1.expect)(payload.sessions.length).toBe(1);
        (0, vitest_1.expect)(payload.sessions[0].id).toBe(completedId);
    });
});
//# sourceMappingURL=cli-list.spec.js.map