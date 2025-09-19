import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

import { SchedulingService } from '../../src/services/scheduling_service';

describe('scheduling determinism', () => {
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
  const handoffPath = resolve(
    __dirname,
    '..',
    '..',
    'artifacts',
    'handoff',
    '2025-09-19T15-45-00Z-work-item-001-create-a-structured-phase-setup-attempt-phase-setup.json',
  );
  const expectedSchedulePath = resolve(
    __dirname,
    '..',
    '..',
    'artifacts',
    'schedule',
    'work-item-001-create-a-structured.json',
  );

  const workflow = YAML.parse(readFileSync(workflowPath, 'utf-8'));
  const workItem = JSON.parse(readFileSync(workItemPath, 'utf-8'));
  const handoff = JSON.parse(readFileSync(handoffPath, 'utf-8'));
  const expectedSchedule = JSON.parse(readFileSync(expectedSchedulePath, 'utf-8'));

  it('emits ready steps honoring deterministic ordering and blocked dependencies', async () => {
    const service = new SchedulingService();
    const decision = await service.generateSchedule({
      workflow,
      workItem,
      completedSteps: [handoff.step.key],
      now: new Date('2025-09-19T16:30:00.000Z'),
    });

    expect(decision.workItemId).toBe('work-item-001-create-a-structured');
    expect(decision.launchOrder).toEqual(expectedSchedule.launchOrder);
    expect(decision.readySteps.map((step) => step.key)).toEqual(['phase-tests']);
    expect(decision.readySteps[0]).toMatchObject({
      key: 'phase-tests',
      order: 2,
      parallelizable: false,
    });

    const phaseModels = decision.blockedSteps.find((step) => step.key === 'phase-models');
    expect(phaseModels?.blockedBy).toContain('phase-tests');

    expect(new Date(decision.generatedAt).toISOString()).toBe(decision.generatedAt);
  });
});
