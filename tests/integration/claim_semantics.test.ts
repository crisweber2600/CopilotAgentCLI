import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { AssignmentService } from '../../src/services/assignment_service';

describe('claim semantics', () => {
  const makeArtifactsDir = () => mkdtempSync(join(tmpdir(), 'claim-service-'));

  it('prevents duplicate claims for the same attempt', async () => {
    const artifactsDir = makeArtifactsDir();
    const service = new AssignmentService();

    const first = await service.claimAttempt({
      attemptId: 'attempt-setup-001',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: { id: 'executor-alpha', displayName: 'Executor Alpha', runId: 'run-100' },
      claimedAt: new Date('2025-09-19T16:40:00.000Z'),
      artifactsDir,
    });
    expect(first.status).toBe('running');

    await expect(
      service.claimAttempt({
        attemptId: 'attempt-setup-001',
        workItemId: 'work-item-001-create-a-structured',
        stepKey: 'phase-tests',
        executor: { id: 'executor-beta', displayName: 'Executor Beta', runId: 'run-101' },
        claimedAt: new Date('2025-09-19T16:41:00.000Z'),
        artifactsDir,
      }),
    ).rejects.toThrow(/already claimed/i);

    const claimPath = join(artifactsDir, 'claims', 'attempt-setup-001.json');
    const persisted = JSON.parse(readFileSync(claimPath, 'utf-8'));
    expect(persisted.executor.id).toBe('executor-alpha');

    rmSync(artifactsDir, { recursive: true, force: true });
  });

  it('records retry attempts with linkage to previous attempt', async () => {
    const artifactsDir = makeArtifactsDir();
    const service = new AssignmentService();

    await service.claimAttempt({
      attemptId: 'attempt-setup-001',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: { id: 'executor-alpha', displayName: 'Executor Alpha' },
      claimedAt: new Date('2025-09-19T16:40:00.000Z'),
      artifactsDir,
    });

    const retry = await service.claimAttempt({
      attemptId: 'attempt-setup-002',
      workItemId: 'work-item-001-create-a-structured',
      stepKey: 'phase-tests',
      executor: { id: 'executor-alpha', displayName: 'Executor Alpha' },
      claimedAt: new Date('2025-09-19T16:45:00.000Z'),
      artifactsDir,
    });

    expect(retry.previousAttemptId).toBe('attempt-setup-001');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
