import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { AssignmentService } from '../../src/services/assignment_service';
import { ArtifactService } from '../../src/services/artifact_service';
import { WorkflowRegistry } from '../../src/services/workflow_registry';

const schemaPath = join(
  process.cwd(),
  'specs',
  '001-create-a-structured',
  'contracts',
  'handoff-artifact.schema.json',
);

describe('error handling', () => {
  const makeDir = () => mkdtempSync(join(tmpdir(), 'error-service-'));

  it('prevents duplicate attempt claims', async () => {
    const artifactsDir = makeDir();
    const service = new AssignmentService();

    await service.claimAttempt({
      attemptId: 'attempt-duplicate',
      workItemId: 'work-item-1',
      stepKey: 'phase-tests',
      executor: { id: 'executor', displayName: 'Executor' },
      claimedAt: new Date(),
      artifactsDir,
    });

    await expect(
      service.claimAttempt({
        attemptId: 'attempt-duplicate',
        workItemId: 'work-item-1',
        stepKey: 'phase-tests',
        executor: { id: 'executor-2', displayName: 'Executor Two' },
        claimedAt: new Date(),
        artifactsDir,
      }),
    ).rejects.toThrow(/already claimed/i);

    rmSync(artifactsDir, { recursive: true, force: true });
  });

  it('throws when handoff artifacts invalid', async () => {
    const artifactsDir = makeDir();
    const service = new ArtifactService({ artifactsDir, schemaPath });

    await expect(
      service.writeHandoffArtifact({
        workItemId: 'item-1',
        workflow: { name: 'Sample', version: '1.0.0' },
        step: { key: 'phase-tests', order: 2 },
        eventType: 'attempt-completed',
        attemptId: 'attempt-1',
        actor: 'actor',
        outcome: 'done',
        nextAction: 'next',
        baselineIntegration: 'pre',
        links: [],
        timestamp: new Date('invalid'),
      }),
    ).rejects.toThrow(/invalid/i);

    rmSync(artifactsDir, { recursive: true, force: true });
  });

  it('throws when workflow missing', async () => {
    const registry = new WorkflowRegistry({ workflowsDir: makeDir() });
    await expect(registry.getWorkflow('missing')).rejects.toThrow(/not found/i);
  });
});
