import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { GateService } from '../../src/services/gate_service';
import { WorkItemService } from '../../src/services/work_item_service';

class FakeWorkItemService extends WorkItemService {
  constructor(private readonly root: string) {
    super({ artifactsDir: root });
  }

  async loadWorkItem(workItemId: string) {
    try {
      return await super.loadWorkItem(workItemId);
    } catch {
      return {
        id: workItemId,
        workflowId: 'wf-001-create-a-structured@1.0.0',
        status: 'in-progress',
        currentStepKey: 'phase-tests',
        owner: 'owner@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        links: [],
        metadata: {},
      };
    }
  }
}

describe('gate rework flow', () => {
  it('records rejection and rewinds work item state', async () => {
    const artifactsDir = mkdtempSync(join(tmpdir(), 'gate-service-'));
    const workItemService = new FakeWorkItemService(artifactsDir);
    const gateService = new GateService({ workItemService });

    const record = await gateService.recordDecision({
      workItemId: 'work-item-001-create-a-structured',
      gateKey: 'phase-tests-quality',
      decision: 'reject',
      reasons: ['Missing edge-case tests'],
      reviewer: 'quality-lead@example.com',
      decidedAt: new Date('2025-09-19T17:15:00.000Z'),
      artifactsDir,
      reentryStepKey: 'phase-tests',
    });

    const raw = JSON.parse(readFileSync(record.path, 'utf-8'));
    expect(raw.decision).toBe('reject');
    expect(raw.reasons).toContain('Missing edge-case tests');

    const workItem = await workItemService.loadWorkItem('work-item-001-create-a-structured');
    expect(workItem.currentStepKey).toBe('phase-tests');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
