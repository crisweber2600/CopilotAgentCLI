import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ArtifactService } from '../../src/services/artifact_service';

describe('baseline integration boundary', () => {
  it('requires explicit revert before re-executing a baseline-integrated step', async () => {
    const artifactsDir = mkdtempSync(join(tmpdir(), 'baseline-artifacts-'));
    const schemaPath = join(
      process.cwd(),
      'specs',
      '001-create-a-structured',
      'contracts',
      'handoff-artifact.schema.json',
    );
    const service = new ArtifactService({ artifactsDir, schemaPath });

    await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: {
        name: 'Implement Plan-to-Execution Orchestrator (001-create-a-structured)',
        version: '1.0.0',
      },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'attempt-completed',
      attemptId: 'attempt-phase-cli-001',
      actor: 'cli-engineer',
      outcome: 'CLI commands implemented.',
      nextAction: 'Review baseline integration',
      baselineIntegration: 'pre',
      links: [],
      timestamp: new Date('2025-09-20T10:00:00.000Z'),
    });

    await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: {
        name: 'Implement Plan-to-Execution Orchestrator (001-create-a-structured)',
        version: '1.0.0',
      },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'baseline-integration',
      attemptId: 'attempt-phase-cli-001',
      actor: 'devops-engineer',
      outcome: 'Merged CLI changes to baseline.',
      nextAction: 'If rework required, perform explicit revert first.',
      baselineIntegration: 'post',
      links: [],
      timestamp: new Date('2025-09-20T12:00:00.000Z'),
    });

    await expect(
      service.writeHandoffArtifact({
        workItemId: 'work-item-001-create-a-structured',
        workflow: {
          name: 'Implement Plan-to-Execution Orchestrator (001-create-a-structured)',
          version: '1.0.0',
        },
        step: { key: 'phase-cli', order: 5 },
        eventType: 'attempt-completed',
        attemptId: 'attempt-phase-cli-002',
        actor: 'cli-engineer',
        outcome: 'Attempted to re-run CLI changes without revert.',
        nextAction: 'Revert baseline integration first.',
        baselineIntegration: 'pre',
        links: [],
        timestamp: new Date('2025-09-20T13:00:00.000Z'),
      }),
    ).rejects.toThrow(/baseline integration boundary/i);

    await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: {
        name: 'Implement Plan-to-Execution Orchestrator (001-create-a-structured)',
        version: '1.0.0',
      },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'attempt-rejected',
      attemptId: 'attempt-phase-cli-001',
      actor: 'release-manager',
      outcome: 'Baseline reverted; ready for re-execution.',
      nextAction: 'Re-run CLI implementation with new attempt id.',
      baselineIntegration: 'post',
      links: [],
      timestamp: new Date('2025-09-20T13:30:00.000Z'),
    });

    const reworkRecord = await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: {
        name: 'Implement Plan-to-Execution Orchestrator (001-create-a-structured)',
        version: '1.0.0',
      },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'attempt-completed',
      attemptId: 'attempt-phase-cli-002',
      actor: 'cli-engineer',
      outcome: 'CLI commands re-implemented after revert.',
      nextAction: 'Proceed to CI workflows.',
      baselineIntegration: 'pre',
      links: [],
      timestamp: new Date('2025-09-20T14:00:00.000Z'),
    });

    expect(reworkRecord.attemptId).toBe('attempt-phase-cli-002');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
