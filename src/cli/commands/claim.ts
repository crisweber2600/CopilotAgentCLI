import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { AssignmentService } from '../../services/assignment_service';
import { ValidationError } from '../../services/errors';
import type { CliContext } from '../types';
import { getStringFlag, parseArgs, resolveOutputFormat, writeJson, writeLine } from '../utils';

export default async function claimCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const workItemId = getStringFlag(parsed, 'work-item') ?? parsed.positionals[0];
  const stepKey = getStringFlag(parsed, 'step');
  const attemptId = getStringFlag(parsed, 'attempt') ?? `attempt-${randomUUID()}`;

  if (!workItemId) {
    throw new ValidationError('Specify --work-item to claim an attempt.');
  }
  if (!stepKey) {
    throw new ValidationError('Specify --step for the attempt.');
  }

  await context.authService.requireSession();

  const artifactsDir = join(context.cwd, 'artifacts');
  const service = new AssignmentService();
  const record = await service.claimAttempt({
    attemptId,
    workItemId,
    stepKey,
    executor: {
      id: context.env.GITHUB_RUN_ID ?? context.env.HOSTNAME ?? 'local-executor',
      displayName: context.env.GITHUB_JOB ?? 'local',
      runId: context.env.GITHUB_RUN_ID,
    },
    claimedAt: new Date(),
    artifactsDir,
  });

  const format = resolveOutputFormat(parsed, context.ciDefaultJson);
  if (format === 'json') {
    writeJson(context.stdout, record);
  } else {
    writeLine(
      context.stdout,
      `Claimed ${record.attemptId} for ${record.workItemId} (${record.stepKey}).`,
    );
  }

  return 0;
}
