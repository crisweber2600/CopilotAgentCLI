import { describe, expect, it } from 'vitest';

import { SchedulingService } from '../../src/services/scheduling_service';

function buildLargeWorkflow(stepCount: number) {
  const steps = Array.from({ length: stepCount }, (_, index) => ({
    key: `step-${index + 1}`,
    order: index + 1,
    parallelizable: false,
    entryCriteria: index === 0 ? [] : [`step-${index}`],
    exitCriteria: ['done'],
    responsibleRole: 'executor',
  }));
  return {
    id: 'wf-large',
    name: 'Large Workflow',
    version: '1.0.0',
    steps,
  };
}

describe('scheduling performance', () => {
  it('computes schedule for large workflows within acceptable time', async () => {
    const service = new SchedulingService();
    const workflow = buildLargeWorkflow(500);

    const start = performance.now();
    const decision = await service.generateSchedule({
      workflow,
      workItem: { id: 'perf-item' },
      completedSteps: [],
    });
    const duration = performance.now() - start;

    expect(decision.readySteps.length).toBe(1);
    expect(duration).toBeLessThan(250);
  });
});
