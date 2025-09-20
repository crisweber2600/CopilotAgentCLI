import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ArtifactService } from '../../src/services/artifact_service';

const schemaPath = join(
  process.cwd(),
  'specs',
  '001-create-a-structured',
  'contracts',
  'handoff-artifact.schema.json',
);

describe('baseline integration boundary', () => {
  it('requires revert before re-executing post-baseline steps', async () => {
    const artifactsDir = mkdtempSync(join(tmpdir(), 'baseline-service-'));
    const service = new ArtifactService({ artifactsDir, schemaPath });

    await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'attempt-completed',
      attemptId: 'attempt-phase-cli-001',
      actor: 'cli-engineer',
      outcome: 'CLI commands implemented.',
      nextAction: 'Prepare baseline integration.',
      baselineIntegration: 'pre',
      links: [],
      timestamp: new Date('2025-09-20T10:00:00.000Z'),
    });

    await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'baseline-integration',
      attemptId: 'attempt-phase-cli-001',
      actor: 'devops-engineer',
      outcome: 'Merged CLI changes to baseline.',
      nextAction: 'Require revert before rework.',
      baselineIntegration: 'post',
      links: [],
      timestamp: new Date('2025-09-20T12:00:00.000Z'),
    });

    await expect(
      service.writeHandoffArtifact({
        workItemId: 'work-item-001-create-a-structured',
        workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
        step: { key: 'phase-cli', order: 5 },
        eventType: 'attempt-completed',
        attemptId: 'attempt-phase-cli-002',
        actor: 'cli-engineer',
        outcome: 'Attempted re-run without revert.',
        nextAction: 'Revert baseline first.',
        baselineIntegration: 'pre',
        links: [],
        timestamp: new Date('2025-09-20T13:00:00.000Z'),
      }),
    ).rejects.toThrow(/baseline integration boundary/i);

    await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'attempt-rejected',
      attemptId: 'attempt-phase-cli-001',
      actor: 'release-manager',
      outcome: 'Baseline reverted; safe to retry.',
      nextAction: 'Create new attempt.',
      baselineIntegration: 'post',
      links: [],
      timestamp: new Date('2025-09-20T13:30:00.000Z'),
    });

    const rework = await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
      step: { key: 'phase-cli', order: 5 },
      eventType: 'attempt-completed',
      attemptId: 'attempt-phase-cli-002',
      actor: 'cli-engineer',
      outcome: 'CLI commands re-implemented.',
      nextAction: 'Proceed to CI workflows.',
      baselineIntegration: 'pre',
      links: [],
      timestamp: new Date('2025-09-20T14:00:00.000Z'),
    });

    expect(rework.attemptId).toBe('attempt-phase-cli-002');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
