import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { GateService } from '../../src/services/gate_service';
import type { WorkItemGateway, WorkItemStateUpdate } from '../../src/services/work_item_service';

class FakeWorkItemService implements WorkItemGateway {
  rewindCalls: Array<{ workItemId: string; stepKey: string; reasons: string[] }> = [];

  async loadWorkItem(): Promise<unknown> {
    return {};
  }

  async advanceToStep(): Promise<WorkItemStateUpdate> {
    throw new Error('not implemented');
  }

  async rewindToStep(
    workItemId: string,
    stepKey: string,
    reasons: string[],
  ): Promise<WorkItemStateUpdate> {
    this.rewindCalls.push({ workItemId, stepKey, reasons });
    return {
      workItemId,
      currentStepKey: stepKey,
      status: 'rework',
    };
  }
}

describe('gate rework flow', () => {
  it('writes gate artifact and rewinds work item on reject', async () => {
    const artifactsDir = mkdtempSync(join(tmpdir(), 'gate-artifacts-'));
    const workItemService = new FakeWorkItemService();
    const service = new GateService({ workItemService });

    const record = await service.recordDecision({
      workItemId: 'work-item-001-create-a-structured',
      gateKey: 'phase-tests-quality',
      decision: 'reject',
      reasons: ['Tests missing negative cases'],
      reviewer: 'quality-lead@example.com',
      decidedAt: new Date('2025-09-19T17:15:00.000Z'),
      artifactsDir,
      reentryStepKey: 'phase-tests',
    });

    expect(workItemService.rewindCalls).toEqual([
      {
        workItemId: 'work-item-001-create-a-structured',
        stepKey: 'phase-tests',
        reasons: ['Tests missing negative cases'],
      },
    ]);

    const raw = JSON.parse(readFileSync(record.path, 'utf-8'));
    expect(raw.decision).toBe('reject');
    expect(raw.reviewer).toBe('quality-lead@example.com');
    expect(raw.reasons).toContain('Tests missing negative cases');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
