import { describe, expect, it } from 'vitest';

import { SchedulingService } from '../../src/services/scheduling_service';

describe('scheduling tie-breaks', () => {
  it('sorts ready steps with identical order by lexical key', async () => {
    const service = new SchedulingService();
    const workflow = {
      id: 'wf-lexical-test',
      name: 'Lexical Ordering Workflow',
      version: '1.0.0',
      steps: [
        { key: 'step-start', order: 1, parallelizable: false },
        { key: 'alpha', order: 2, parallelizable: true },
        { key: 'gamma', order: 2, parallelizable: true },
        { key: 'beta', order: 2, parallelizable: true },
      ].map((step) => ({
        ...step,
        entryCriteria: [],
        exitCriteria: ['done'],
        responsibleRole: 'tester',
      })),
    };

    const decision = await service.generateSchedule({
      workflow,
      workItem: { id: 'work-item-lexical', currentStepKey: 'step-start' },
      completedSteps: ['step-start'],
    });

    expect(decision.readySteps.map((step) => step.key)).toEqual(['alpha', 'beta', 'gamma']);
  });
});
