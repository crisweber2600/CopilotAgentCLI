import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

function createArtifactsDir(): string {
  return mkdtempSync(join(tmpdir(), 'error-artifacts-'));
}

describe('error handling', () => {
  it('prevents duplicate claims on the same attempt', async () => {
    const artifactsDir = createArtifactsDir();
    const service = new AssignmentService();

    await service.claimAttempt({
      attemptId: 'attempt-reused',
      workItemId: 'work-item-1',
      stepKey: 'phase-tests',
      executor: { id: 'executor-a', displayName: 'Executor A' },
      claimedAt: new Date(),
      artifactsDir,
    });

    await expect(
      service.claimAttempt({
        attemptId: 'attempt-reused',
        workItemId: 'work-item-1',
        stepKey: 'phase-tests',
        executor: { id: 'executor-b', displayName: 'Executor B' },
        claimedAt: new Date(),
        artifactsDir,
      }),
    ).rejects.toThrow(/already claimed/i);

    rmSync(artifactsDir, { recursive: true, force: true });
  });

  it('rejects handoff artifacts that fail schema validation', async () => {
    const artifactsDir = createArtifactsDir();
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

  it('throws when workflow definition is missing', async () => {
    const artifactsDir = createArtifactsDir();
    const registry = new WorkflowRegistry({ workflowsDir: artifactsDir });

    await expect(registry.getWorkflow('does-not-exist')).rejects.toThrow(/not found/i);

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
