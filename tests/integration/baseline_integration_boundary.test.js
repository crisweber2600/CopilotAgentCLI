"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const artifact_service_1 = require("../../src/services/artifact_service");
const schemaPath = (0, node_path_1.join)(process.cwd(), 'specs', '001-create-a-structured', 'contracts', 'handoff-artifact.schema.json');
(0, vitest_1.describe)('baseline integration boundary', () => {
    (0, vitest_1.it)('requires revert before re-executing post-baseline steps', async () => {
        const artifactsDir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'baseline-service-'));
        const service = new artifact_service_1.ArtifactService({ artifactsDir, schemaPath });
        await service.writeHandoffArtifact({
            workItemId: 'work-item-001-create-a-structured',
            workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
            step: { key: 'phase-cli', order: 5 },
            eventType: 'attempt-completed',
            attemptId: 'attempt-phase-cli-001',
            actor: 'cli-engineer',
            outcome: 'CLI commands implemented.',
            nextAction: 'Prepare baseline integration.',
            baselineIntegration: 'pre',
            links: [],
            timestamp: new Date('2025-09-20T10:00:00.000Z'),
        });
        await service.writeHandoffArtifact({
            workItemId: 'work-item-001-create-a-structured',
            workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
            step: { key: 'phase-cli', order: 5 },
            eventType: 'baseline-integration',
            attemptId: 'attempt-phase-cli-001',
            actor: 'devops-engineer',
            outcome: 'Merged CLI changes to baseline.',
            nextAction: 'Require revert before rework.',
            baselineIntegration: 'post',
            links: [],
            timestamp: new Date('2025-09-20T12:00:00.000Z'),
        });
        await (0, vitest_1.expect)(service.writeHandoffArtifact({
            workItemId: 'work-item-001-create-a-structured',
            workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
            step: { key: 'phase-cli', order: 5 },
            eventType: 'attempt-completed',
            attemptId: 'attempt-phase-cli-002',
            actor: 'cli-engineer',
            outcome: 'Attempted re-run without revert.',
            nextAction: 'Revert baseline first.',
            baselineIntegration: 'pre',
            links: [],
            timestamp: new Date('2025-09-20T13:00:00.000Z'),
        })).rejects.toThrow(/baseline integration boundary/i);
        await service.writeHandoffArtifact({
            workItemId: 'work-item-001-create-a-structured',
            workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
            step: { key: 'phase-cli', order: 5 },
            eventType: 'attempt-rejected',
            attemptId: 'attempt-phase-cli-001',
            actor: 'release-manager',
            outcome: 'Baseline reverted; safe to retry.',
            nextAction: 'Create new attempt.',
            baselineIntegration: 'post',
            links: [],
            timestamp: new Date('2025-09-20T13:30:00.000Z'),
        });
        const rework = await service.writeHandoffArtifact({
            workItemId: 'work-item-001-create-a-structured',
            workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
            step: { key: 'phase-cli', order: 5 },
            eventType: 'attempt-completed',
            attemptId: 'attempt-phase-cli-002',
            actor: 'cli-engineer',
            outcome: 'CLI commands re-implemented.',
            nextAction: 'Proceed to CI workflows.',
            baselineIntegration: 'pre',
            links: [],
            timestamp: new Date('2025-09-20T14:00:00.000Z'),
        });
        (0, vitest_1.expect)(rework.attemptId).toBe('attempt-phase-cli-002');
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=baseline_integration_boundary.test.js.map