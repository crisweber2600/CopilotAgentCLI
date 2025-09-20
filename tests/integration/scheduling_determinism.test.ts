import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

import { SchedulingService } from '../../src/services/scheduling_service';

const workflowPath = resolve(
  __dirname,
  '..',
  '..',
  'artifacts',
  'workflows',
  'wf-001-create-a-structured.yaml',
);

const workItemPath = resolve(
  __dirname,
  '..',
  '..',
  'artifacts',
  'work-items',
  'work-item-001-create-a-structured.json',
);

const schedulePath = resolve(
  __dirname,
  '..',
  '..',
  'artifacts',
  'schedule',
  'work-item-001-create-a-structured.json',
);

describe('scheduling determinism', () => {
  it('orders ready steps deterministically with lexical tie-breaks', async () => {
    const workflowDef = YAML.parse(readFileSync(workflowPath, 'utf-8'));
    const workItem = JSON.parse(readFileSync(workItemPath, 'utf-8'));
    const expected = JSON.parse(readFileSync(schedulePath, 'utf-8'));

    const service = new SchedulingService();
    const decision = await service.generateSchedule({
      workflow: workflowDef,
      workItem,
      completedSteps: ['phase-setup'],
      now: new Date('2025-09-19T16:30:00.000Z'),
    });

    expect(decision.workItemId).toBe(workItem.id);
    expect(decision.launchOrder).toEqual(expected.launchOrder);
    expect(decision.readySteps.map((step) => step.key)).toEqual(['phase-tests']);
    expect(decision.blockedSteps.find((step) => step.key === 'phase-models')?.blockedBy).toContain(
      'phase-tests',
    );
  });
});
