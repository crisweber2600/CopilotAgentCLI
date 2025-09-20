"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scheduling_service_1 = require("../../src/services/scheduling_service");
(0, vitest_1.describe)('scheduling tie-breakers', () => {
    (0, vitest_1.it)('sorts equal-order steps by lexical key', async () => {
        const service = new scheduling_service_1.SchedulingService();
        const workflow = {
            id: 'wf-lexical',
            name: 'Lexical Order Workflow',
            version: '1.0.0',
            steps: [
                {
                    key: 'step-start',
                    order: 1,
                    parallelizable: false,
                    entryCriteria: [],
                    exitCriteria: ['done'],
                    responsibleRole: 'planner',
                },
                {
                    key: 'beta',
                    order: 2,
                    parallelizable: true,
                    entryCriteria: [],
                    exitCriteria: ['done'],
                    responsibleRole: 'executor',
                },
                {
                    key: 'alpha',
                    order: 2,
                    parallelizable: true,
                    entryCriteria: [],
                    exitCriteria: ['done'],
                    responsibleRole: 'executor',
                },
                {
                    key: 'gamma',
                    order: 2,
                    parallelizable: true,
                    entryCriteria: [],
                    exitCriteria: ['done'],
                    responsibleRole: 'executor',
                },
            ],
        };
        const decision = await service.generateSchedule({
            workflow,
            workItem: { id: 'work-item-lexical', currentStepKey: 'step-start' },
            completedSteps: ['step-start'],
        });
        (0, vitest_1.expect)(decision.readySteps.map((step) => step.key)).toEqual(['alpha', 'beta', 'gamma']);
    });
});
//# sourceMappingURL=scheduling_tiebreak.test.js.map