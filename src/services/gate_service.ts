import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { WorkItemService } from './work_item_service';

export interface GateDecisionInput {
  workItemId: string;
  gateKey: string;
  decision: 'approve' | 'reject';
  reasons: string[];
  reviewer: string;
  decidedAt: Date;
  artifactsDir: string;
  reentryStepKey?: string;
}

export interface GateDecisionRecord {
  workItemId: string;
  gateKey: string;
  decision: 'approve' | 'reject';
  reasons: string[];
  reviewer: string;
  decidedAt: string;
  path: string;
}

export class GateService {
  constructor(private readonly options: { workItemService: WorkItemService }) {}

  async recordDecision(input: GateDecisionInput): Promise<GateDecisionRecord> {
    const gateDir = join(input.artifactsDir, 'gates', input.workItemId);
    await mkdir(gateDir, { recursive: true });

    const decidedAt = input.decidedAt.toISOString();
    const payload = {
      schemaVersion: '1.0',
      workItemId: input.workItemId,
      gateKey: input.gateKey,
      decision: input.decision,
      reasons: input.reasons,
      reviewer: input.reviewer,
      decidedAt,
      reentryStepKey: input.reentryStepKey,
    };

    const path = join(gateDir, `${input.gateKey}.json`);
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

    if (input.decision === 'reject') {
      const stepKey = input.reentryStepKey ?? input.gateKey;
      await this.options.workItemService.rewindToStep(input.workItemId, stepKey, input.reasons);
    }

    return {
      workItemId: input.workItemId,
      gateKey: input.gateKey,
      decision: input.decision,
      reasons: input.reasons,
      reviewer: input.reviewer,
      decidedAt,
      path,
    };
  }
}
