"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const assignment_service_1 = require("../../src/services/assignment_service");
const artifact_service_1 = require("../../src/services/artifact_service");
const workflow_registry_1 = require("../../src/services/workflow_registry");
const schemaPath = (0, node_path_1.join)(process.cwd(), 'specs', '001-create-a-structured', 'contracts', 'handoff-artifact.schema.json');
(0, vitest_1.describe)('error handling', () => {
    const makeDir = () => (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'error-service-'));
    (0, vitest_1.it)('prevents duplicate attempt claims', async () => {
        const artifactsDir = makeDir();
        const service = new assignment_service_1.AssignmentService();
        await service.claimAttempt({
            attemptId: 'attempt-duplicate',
            workItemId: 'work-item-1',
            stepKey: 'phase-tests',
            executor: { id: 'executor', displayName: 'Executor' },
            claimedAt: new Date(),
            artifactsDir,
        });
        await (0, vitest_1.expect)(service.claimAttempt({
            attemptId: 'attempt-duplicate',
            workItemId: 'work-item-1',
            stepKey: 'phase-tests',
            executor: { id: 'executor-2', displayName: 'Executor Two' },
            claimedAt: new Date(),
            artifactsDir,
        })).rejects.toThrow(/already claimed/i);
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
    (0, vitest_1.it)('throws when handoff artifacts invalid', async () => {
        const artifactsDir = makeDir();
        const service = new artifact_service_1.ArtifactService({ artifactsDir, schemaPath });
        await (0, vitest_1.expect)(service.writeHandoffArtifact({
            workItemId: 'item-1',
            workflow: { name: 'Sample', version: '1.0.0' },
            step: { key: 'phase-tests', order: 2 },
            eventType: 'attempt-completed',
            attemptId: 'attempt-1',
            actor: 'actor',
            outcome: 'done',
            nextAction: 'next',
            baselineIntegration: 'pre',
            links: [],
            timestamp: new Date('invalid'),
        })).rejects.toThrow(/invalid/i);
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
    (0, vitest_1.it)('throws when workflow missing', async () => {
        const registry = new workflow_registry_1.WorkflowRegistry({ workflowsDir: makeDir() });
        await (0, vitest_1.expect)(registry.getWorkflow('missing')).rejects.toThrow(/not found/i);
    });
});
//# sourceMappingURL=error_handling.test.js.map