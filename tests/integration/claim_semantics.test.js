"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const assignment_service_1 = require("../../src/services/assignment_service");
(0, vitest_1.describe)('claim semantics', () => {
    const makeArtifactsDir = () => (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'claim-service-'));
    (0, vitest_1.it)('prevents duplicate claims for the same attempt', async () => {
        const artifactsDir = makeArtifactsDir();
        const service = new assignment_service_1.AssignmentService();
        const first = await service.claimAttempt({
            attemptId: 'attempt-setup-001',
            workItemId: 'work-item-001-create-a-structured',
            stepKey: 'phase-tests',
            executor: { id: 'executor-alpha', displayName: 'Executor Alpha', runId: 'run-100' },
            claimedAt: new Date('2025-09-19T16:40:00.000Z'),
            artifactsDir,
        });
        (0, vitest_1.expect)(first.status).toBe('running');
        await (0, vitest_1.expect)(service.claimAttempt({
            attemptId: 'attempt-setup-001',
            workItemId: 'work-item-001-create-a-structured',
            stepKey: 'phase-tests',
            executor: { id: 'executor-beta', displayName: 'Executor Beta', runId: 'run-101' },
            claimedAt: new Date('2025-09-19T16:41:00.000Z'),
            artifactsDir,
        })).rejects.toThrow(/already claimed/i);
        const claimPath = (0, node_path_1.join)(artifactsDir, 'claims', 'attempt-setup-001.json');
        const persisted = JSON.parse((0, node_fs_1.readFileSync)(claimPath, 'utf-8'));
        (0, vitest_1.expect)(persisted.executor.id).toBe('executor-alpha');
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
    (0, vitest_1.it)('records retry attempts with linkage to previous attempt', async () => {
        const artifactsDir = makeArtifactsDir();
        const service = new assignment_service_1.AssignmentService();
        await service.claimAttempt({
            attemptId: 'attempt-setup-001',
            workItemId: 'work-item-001-create-a-structured',
            stepKey: 'phase-tests',
            executor: { id: 'executor-alpha', displayName: 'Executor Alpha' },
            claimedAt: new Date('2025-09-19T16:40:00.000Z'),
            artifactsDir,
        });
        const retry = await service.claimAttempt({
            attemptId: 'attempt-setup-002',
            workItemId: 'work-item-001-create-a-structured',
            stepKey: 'phase-tests',
            executor: { id: 'executor-alpha', displayName: 'Executor Alpha' },
            claimedAt: new Date('2025-09-19T16:45:00.000Z'),
            artifactsDir,
        });
        (0, vitest_1.expect)(retry.previousAttemptId).toBe('attempt-setup-001');
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=claim_semantics.test.js.map