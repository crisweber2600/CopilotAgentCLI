"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const yaml_1 = __importDefault(require("yaml"));
const scheduling_service_1 = require("../../src/services/scheduling_service");
const workflowPath = (0, node_path_1.resolve)(__dirname, '..', '..', 'artifacts', 'workflows', 'wf-001-create-a-structured.yaml');
const workItemPath = (0, node_path_1.resolve)(__dirname, '..', '..', 'artifacts', 'work-items', 'work-item-001-create-a-structured.json');
const schedulePath = (0, node_path_1.resolve)(__dirname, '..', '..', 'artifacts', 'schedule', 'work-item-001-create-a-structured.json');
(0, vitest_1.describe)('scheduling determinism', () => {
    (0, vitest_1.it)('orders ready steps deterministically with lexical tie-breaks', async () => {
        const workflowDef = yaml_1.default.parse((0, node_fs_1.readFileSync)(workflowPath, 'utf-8'));
        const workItem = JSON.parse((0, node_fs_1.readFileSync)(workItemPath, 'utf-8'));
        const expected = JSON.parse((0, node_fs_1.readFileSync)(schedulePath, 'utf-8'));
        const service = new scheduling_service_1.SchedulingService();
        const decision = await service.generateSchedule({
            workflow: workflowDef,
            workItem,
            completedSteps: ['phase-setup'],
            now: new Date('2025-09-19T16:30:00.000Z'),
        });
        (0, vitest_1.expect)(decision.workItemId).toBe(workItem.id);
        (0, vitest_1.expect)(decision.launchOrder).toEqual(expected.launchOrder);
        (0, vitest_1.expect)(decision.readySteps.map((step) => step.key)).toEqual(['phase-tests']);
        (0, vitest_1.expect)(decision.blockedSteps.find((step) => step.key === 'phase-models')?.blockedBy).toContain('phase-tests');
    });
});
//# sourceMappingURL=scheduling_determinism.test.js.map