"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_events_1 = require("node:events");
const cli_delegate_spec_1 = require("./cli-delegate.spec");
vitest_1.vi.setConfig({ testTimeout: 40000, hookTimeout: 40000 });
(0, vitest_1.describe)('cli follow contract', () => {
    let agentHome;
    let workspace;
    let baseEnv;
    (0, vitest_1.beforeEach)(async () => {
        agentHome = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'cli-follow-'));
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
    (0, vitest_1.it)('streams line-delimited json events until completion', async () => {
        const delegated = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'stream events', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegated, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegated.stdout);
        const storePath = (0, node_path_1.join)(agentHome, 'sessions.json');
        const sessions = JSON.parse((0, node_fs_1.readFileSync)(storePath, 'utf8'));
        const record = sessions.find((session) => session.id === id);
        (0, vitest_1.expect)(record).toBeDefined();
        if (record) {
            record.events = [
                {
                    type: 'status',
                    status: 'queued',
                    timestamp: new Date().toISOString(),
                },
                {
                    type: 'log',
                    message: 'Agent is analyzing the request',
                    timestamp: new Date().toISOString(),
                },
                {
                    type: 'status',
                    status: 'completed',
                    timestamp: new Date().toISOString(),
                },
            ];
            record.status = 'completed';
            record.updatedAt = new Date().toISOString();
        }
        (0, node_fs_1.writeFileSync)(storePath, JSON.stringify(sessions, null, 2));
        const follow = await (0, cli_delegate_spec_1.runCliCommand)(['follow', id, '--json'], {
            env: baseEnv,
            cwd: workspace,
        });
        (0, cli_delegate_spec_1.expectExitCode)(follow, 0);
        const lines = follow.stdout
            .trim()
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        (0, vitest_1.expect)(lines.length).toBeGreaterThan(1);
        const last = (0, cli_delegate_spec_1.parseJson)(lines[lines.length - 1]);
        (0, vitest_1.expect)(last.status).toBe('completed');
    });
    (0, vitest_1.it)('gracefully exits on interrupt while streaming', async () => {
        const delegated = await (0, cli_delegate_spec_1.runCliCommand)(['delegate', '--prompt', 'long stream', '--json'], { env: baseEnv, cwd: workspace });
        (0, cli_delegate_spec_1.expectExitCode)(delegated, 0);
        const { id } = (0, cli_delegate_spec_1.parseJson)(delegated.stdout);
        const child = (0, cli_delegate_spec_1.spawnCliProcess)(['follow', id, '--json'], {
            env: {
                ...baseEnv,
                COPILOT_CLI_TEST_FOLLOW_DELAY_MS: '2000',
            },
            cwd: workspace,
        });
        const chunks = [];
        child.stdout?.setEncoding('utf8');
        child.stdout?.on('data', (chunk) => {
            chunks.push(chunk);
        });
        await (0, node_events_1.once)(child.stdout, 'data');
        child.kill('SIGINT');
        const [code] = (await (0, node_events_1.once)(child, 'exit'));
        (0, vitest_1.expect)(code === null ? 0 : code).toBe(0);
        const combined = chunks.join('');
        const firstLine = combined.trim().split('\n')[0];
        (0, vitest_1.expect)(() => (0, cli_delegate_spec_1.parseJson)(firstLine)).not.toThrow();
    });
});
//# sourceMappingURL=cli-follow.spec.js.map