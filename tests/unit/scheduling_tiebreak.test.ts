import { describe, expect, it } from 'vitest';

import { SchedulingService } from '../../src/services/scheduling_service';

describe('scheduling tie-breakers', () => {
  it('sorts equal-order steps by lexical key', async () => {
    const service = new SchedulingService();
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

    expect(decision.readySteps.map((step) => step.key)).toEqual(['alpha', 'beta', 'gamma']);
  });
});
