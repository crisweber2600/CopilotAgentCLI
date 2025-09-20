"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const cli_delegate_spec_1 = require("./cli-delegate.spec");
const cancelResponseSchema = {
    type: 'object',
    required: ['id', 'status'],
    additionalProperties: false,
    properties: {
        id: { type: 'string', minLength: 1 },
        status: {
            type: 'string',
            enum: ['cancelled'],
        },
    },
};
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
(0, vitest_1.describe)('cli cancel contract', () => {
    let agentHome;
    let workspace;
    let baseEnv;
    (0, vitest_1.beforeEach)(async () => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-cancel-'));
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
    (0, vitest_1.it)('cancels a running session and returns updated state', async () => {
        const delegated = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'need cancel', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegated, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegated.stdout);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === id);
        if (record) {
            record.status = 'running';
            record.updatedAt = new Date().toISOString();
        }
        (0, node_fs_1.writeFileSync)(storePath, JSON.stringify(sessions, null, 2));
        const cancel = await (0, cli_delegate_spec_1.runCliCommand)(['cancel', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(cancel, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(cancel.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, cancelResponseSchema);
    });
    (0, vitest_1.it)('is idempotent for already cancelled sessions', async () => {
        const delegated = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'cancel twice', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegated, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegated.stdout);
        const cancel = await (0, cli_delegate_spec_1.runCliCommand)(['cancel', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(cancel, 0);
        const second = await (0, cli_delegate_spec_1.runCliCommand)(['cancel', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(second, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(second.stdout);
        (0, vitest_1.expect)(payload.status).toBe('cancelled');
    });
    (0, vitest_1.it)('exits with conflict when session already completed', async () => {
        const delegated = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'already done', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegated, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegated.stdout);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === id);
        if (record) {
            record.status = 'completed';
            record.updatedAt = new Date().toISOString();
        }
        (0, node_fs_1.writeFileSync)(storePath, JSON.stringify(sessions, null, 2));
        const cancel = await (0, cli_delegate_spec_1.runCliCommand)(['cancel', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(cancel, 6);
        (0, vitest_1.expect)(cancel.stderr).toContain('completed');
    });
});
//# sourceMappingURL=cli-cancel.spec.js.map