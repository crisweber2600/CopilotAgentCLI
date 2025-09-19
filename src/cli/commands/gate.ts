import { join } from 'node:path';

import { GateService } from '../../services/gate_service';
import { WorkItemService } from '../../services/work_item_service';
import { ValidationError } from '../../services/errors';
import type { CliContext } from '../types';
import { getStringArrayFlag, getStringFlag, parseArgs, writeJson, writeLine } from '../utils';

export default async function gateCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const workItemId = getStringFlag(parsed, 'work-item') ?? parsed.positionals[0];
  const gateKey = getStringFlag(parsed, 'gate');
  const decision =
    (getStringFlag(parsed, 'decision') as 'approve' | 'reject' | undefined) ?? 'approve';
  const reasons = getStringArrayFlag(parsed, 'reason');
  const reentryStepKey = getStringFlag(parsed, 'reentry-step');
  const reviewer = getStringFlag(parsed, 'reviewer') ?? context.env.GITHUB_ACTOR ?? 'reviewer';

  if (!workItemId) {
    throw new ValidationError('Specify --work-item when recording a gate decision.');
  }
  if (!gateKey) {
    throw new ValidationError('Specify --gate for the decision.');
  }

  const artifactsDir = join(context.cwd, 'artifacts');
  const workItemService = new WorkItemService({ artifactsDir });
  const gateService = new GateService({ workItemService });

  const record = await gateService.recordDecision({
    workItemId,
    gateKey,
    decision,
    reasons,
    reviewer,
    decidedAt: new Date(),
    artifactsDir,
    reentryStepKey,
  });

  if (context.ciDefaultJson || getStringFlag(parsed, 'output') === 'json') {
    writeJson(context.stdout, record);
  } else {
    writeLine(
      context.stdout,
      `Recorded ${record.decision} for ${record.gateKey} at ${record.path}`,
    );
  }

  return 0;
}
