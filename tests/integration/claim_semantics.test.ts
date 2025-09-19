import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { AssignmentService } from '../../src/services/assignment_service';

function createArtifactsRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'claims-artifacts-'));
  return dir;
}

describe('exclusive claim semantics', () => {
  it('allows only one executor to claim a given attempt', async () => {
    const artifactsDir = createArtifactsRoot();
    const service = new AssignmentService();

    const firstClaim = await service.claimAttempt({
      attemptId: 'attempt-setup-001',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: {
        id: 'executor-alpha',
        displayName: 'Executor Alpha',
        runId: 'run-100',
      },
      claimedAt: new Date('2025-09-19T16:40:00.000Z'),
      artifactsDir,
    });

    const claimPath = join(artifactsDir, 'claims', 'attempt-setup-001.json');
    const persisted = JSON.parse(readFileSync(claimPath, 'utf-8'));

    expect(firstClaim).toMatchObject({
      attemptId: 'attempt-setup-001',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: { id: 'executor-alpha', runId: 'run-100' },
      status: 'running',
    });
    expect(persisted.executor.id).toBe('executor-alpha');

    await expect(
      service.claimAttempt({
        attemptId: 'attempt-setup-001',
        workItemId: 'work-item-001-create-a-structured',
        stepKey: 'phase-tests',
        executor: {
          id: 'executor-beta',
          displayName: 'Executor Beta',
          runId: 'run-101',
        },
        claimedAt: new Date('2025-09-19T16:41:00.000Z'),
        artifactsDir,
      }),
    ).rejects.toThrow(/already claimed/i);

    rmSync(artifactsDir, { recursive: true, force: true });
  });

  it('creates a new attempt id on retry and records linkage', async () => {
    const artifactsDir = createArtifactsRoot();
    const service = new AssignmentService();

    await service.claimAttempt({
      attemptId: 'attempt-setup-001',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: {
        id: 'executor-alpha',
        displayName: 'Executor Alpha',
      },
      claimedAt: new Date('2025-09-19T16:40:00.000Z'),
      artifactsDir,
    });

    const secondClaim = await service.claimAttempt({
      attemptId: 'attempt-setup-002',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: {
        id: 'executor-alpha',
        displayName: 'Executor Alpha',
      },
      claimedAt: new Date('2025-09-19T16:45:00.000Z'),
      artifactsDir,
    });

    expect(secondClaim.attemptId).toBe('attempt-setup-002');
    const secondPath = join(artifactsDir, 'claims', 'attempt-setup-002.json');
    const persisted = JSON.parse(readFileSync(secondPath, 'utf-8'));
    expect(persisted.previousAttemptId).toBe('attempt-setup-001');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
