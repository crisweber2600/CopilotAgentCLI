"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scheduling_service_1 = require("../../src/services/scheduling_service");
function buildWorkflow(size) {
    return {
        id: 'wf-performance',
        name: 'Performance Workflow',
        version: '1.0.0',
        steps: Array.from({ length: size }, (_, index) => ({
            key: `step-${index + 1}`,
            order: index + 1,
            parallelizable: false,
            entryCriteria: index === 0 ? [] : [`step-${index}`],
            exitCriteria: ['done'],
            responsibleRole: 'executor',
        })),
    };
}
(0, vitest_1.describe)('scheduling performance', () => {
    (0, vitest_1.it)('handles large workflows within expected time', async () => {
        const workflow = buildWorkflow(500);
        const service = new scheduling_service_1.SchedulingService();
        const start = performance.now();
        const decision = await service.generateSchedule({
            workflow,
            workItem: { id: 'perf-item', currentStepKey: 'step-1' },
            completedSteps: ['step-1'],
        });
        const duration = performance.now() - start;
        (0, vitest_1.expect)(decision.readySteps.length).toBe(1);
        (0, vitest_1.expect)(duration).toBeLessThan(250);
    });
});
//# sourceMappingURL=scheduling_perf.test.js.map