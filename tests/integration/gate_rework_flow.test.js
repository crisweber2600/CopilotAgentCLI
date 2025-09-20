"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const gate_service_1 = require("../../src/services/gate_service");
const work_item_service_1 = require("../../src/services/work_item_service");
class FakeWorkItemService extends work_item_service_1.WorkItemService {
    root;
    constructor(root) {
        super({ artifactsDir: root });
        this.root = root;
    }
    async loadWorkItem(workItemId) {
        try {
            return await super.loadWorkItem(workItemId);
        }
        catch {
            return {
                id: workItemId,
                workflowId: 'wf-001-create-a-structured@1.0.0',
                status: 'in-progress',
                currentStepKey: 'phase-tests',
                owner: 'owner@example.com',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                links: [],
                metadata: {},
            };
        }
    }
}
(0, vitest_1.describe)('gate rework flow', () => {
    (0, vitest_1.it)('records rejection and rewinds work item state', async () => {
        const artifactsDir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'gate-service-'));
        const workItemService = new FakeWorkItemService(artifactsDir);
        const gateService = new gate_service_1.GateService({ workItemService });
        const record = await gateService.recordDecision({
            workItemId: 'work-item-001-create-a-structured',
            gateKey: 'phase-tests-quality',
            decision: 'reject',
            reasons: ['Missing edge-case tests'],
            reviewer: 'quality-lead@example.com',
            decidedAt: new Date('2025-09-19T17:15:00.000Z'),
            artifactsDir,
            reentryStepKey: 'phase-tests',
        });
        const raw = JSON.parse((0, node_fs_1.readFileSync)(record.path, 'utf-8'));
        (0, vitest_1.expect)(raw.decision).toBe('reject');
        (0, vitest_1.expect)(raw.reasons).toContain('Missing edge-case tests');
        const workItem = await workItemService.loadWorkItem('work-item-001-create-a-structured');
        (0, vitest_1.expect)(workItem.currentStepKey).toBe('phase-tests');
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=gate_rework_flow.test.js.map