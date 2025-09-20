"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const cli_delegate_spec_1 = require("./cli-delegate.spec");
const loginResponseSchema = {
    type: 'object',
    properties: {
        status: { type: 'string', enum: ['authenticated'] },
        expiresAt: { type: 'string', format: 'date-time' },
        method: { type: 'string' },
    },
    required: ['status', 'method'],
    additionalProperties: false,
};
const logoutResponseSchema = {
    type: 'object',
    properties: {
        status: { type: 'string', enum: ['unauthenticated'] },
    },
    required: ['status'],
    additionalProperties: false,
};
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
(0, vitest_1.describe)('cli auth contract', () => {
    let agentHome;
    let baseEnv;
    (0, vitest_1.beforeEach)(() => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-auth-'));
        baseEnv = {
            COPILOT_AGENT_HOME: agentHome,
            COPILOT_CLI_TEST_MODE: 'contract',
        };
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(agentHome, { recursive: true, force: true });
    });
    (0, vitest_1.it)('authenticates via device-code flow and persists session', async () => {
        const result = await (0, cli_delegate_spec_1.runCliCommand)(['login', '--method', 'device-code', '--json'], {
            env: baseEnv,
        });
        (0, cli_delegate_spec_1.expectExitCode)(result, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(result.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, loginResponseSchema);
        (0, vitest_1.expect)(payload.method).toBe('device-code');
        (0, vitest_1.expect)(result.stderr).toContain('device');
    });
    (0, vitest_1.it)('authenticates via env-token when token provided', async () => {
        const result = await (0, cli_delegate_spec_1.runCliCommand)(['login', '--method', 'env-token', '--json'], {
            env: {
                ...baseEnv,
                COPILOT_AGENT_TOKEN: 'test-token',
            },
        });
        (0, cli_delegate_spec_1.expectExitCode)(result, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(result.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, loginResponseSchema);
        (0, vitest_1.expect)(payload.method).toBe('env-token');
    });
    (0, vitest_1.it)('fails env-token login without token', async () => {
        const result = await (0, cli_delegate_spec_1.runCliCommand)(['login', '--method', 'env-token', '--json'], {
            env: baseEnv,
        });
        (0, cli_delegate_spec_1.expectExitCode)(result, 3);
        (0, vitest_1.expect)(result.stderr).toContain('token');
    });
    (0, vitest_1.it)('logs out and clears session state', async () => {
        const env = {
            ...baseEnv,
            COPILOT_AGENT_TOKEN: 'logout-token',
        };
        const login = await (0, cli_delegate_spec_1.runCliCommand)(['login', '--method', 'env-token', '--json'], { env });
        (0, cli_delegate_spec_1.expectExitCode)(login, 0);
        const logout = await (0, cli_delegate_spec_1.runCliCommand)(['logout', '--json'], { env });
        (0, cli_delegate_spec_1.expectExitCode)(logout, 0);
        const payload = (0, cli_delegate_spec_1.parseJson)(logout.stdout);
        (0, cli_delegate_spec_1.expectJsonSchema)(payload, logoutResponseSchema);
    });
});
//# sourceMappingURL=cli-auth.spec.js.map