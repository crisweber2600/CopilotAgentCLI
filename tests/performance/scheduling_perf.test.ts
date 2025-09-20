import { describe, expect, it } from 'vitest';

import { SchedulingService } from '../../src/services/scheduling_service';

function buildWorkflow(size: number) {
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

describe('scheduling performance', () => {
  it('handles large workflows within expected time', async () => {
    const workflow = buildWorkflow(500);
    const service = new SchedulingService();

    const start = performance.now();
    const decision = await service.generateSchedule({
      workflow,
      workItem: { id: 'perf-item', currentStepKey: 'step-1' },
      completedSteps: ['step-1'],
    });
    const duration = performance.now() - start;

    expect(decision.readySteps.length).toBe(1);
    expect(duration).toBeLessThan(250);
  });
});
