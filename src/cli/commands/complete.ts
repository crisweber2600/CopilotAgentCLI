import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ArtifactService } from '../../services/artifact_service';
import { WorkflowRegistry } from '../../services/workflow_registry';
import { WorkItemService } from '../../services/work_item_service';
import { ValidationError } from '../../services/errors';
import type { CliContext } from '../types';
import {
  getStringArrayFlag,
  getStringFlag,
  hasFlag,
  parseArgs,
  resolveOutputFormat,
  writeJson,
  writeLine,
} from '../utils';

const SCHEMA_PATH = join(
  'specs',
  '001-create-a-structured',
  'contracts',
  'handoff-artifact.schema.json',
);

export default async function completeCommand(
  args: string[],
  context: CliContext,
): Promise<number> {
  const parsed = parseArgs(args);
  const workItemId = getStringFlag(parsed, 'work-item') ?? parsed.positionals[0];
  const stepKey = getStringFlag(parsed, 'step');
  const attemptId = getStringFlag(parsed, 'attempt');
  const eventType =
    (getStringFlag(parsed, 'event-type') as
      | 'attempt-completed'
      | 'baseline-integration'
      | 'attempt-rejected'
      | undefined) ?? 'attempt-completed';
  const actor = getStringFlag(parsed, 'actor') ?? context.env.GITHUB_ACTOR ?? 'local-executor';
  const outcome = getStringFlag(parsed, 'outcome') ?? 'Step completed.';
  const nextAction = getStringFlag(parsed, 'next-action') ?? 'Proceed to next ready step.';
  const baselineFlag =
    (getStringFlag(parsed, 'baseline') as 'pre' | 'post' | undefined) ??
    (eventType === 'baseline-integration' ? 'post' : 'pre');
  const timestamp = getStringFlag(parsed, 'timestamp');
  const links = getStringArrayFlag(parsed, 'link');

  if (!workItemId) {
    throw new ValidationError('Specify --work-item when completing an attempt.');
  }
  if (!stepKey) {
    throw new ValidationError('Specify --step when completing an attempt.');
  }
  if (!attemptId) {
    throw new ValidationError('Specify --attempt when completing an attempt.');
  }

  await context.authService.requireSession();

  const artifactsDir = join(context.cwd, 'artifacts');
  if (!existsSync(artifactsDir)) {
    throw new ValidationError(`Artifacts directory not found at ${artifactsDir}`);
  }

  const schemaPath = join(context.cwd, SCHEMA_PATH);
  const artifactService = new ArtifactService({ artifactsDir, schemaPath });
  const workItemService = new WorkItemService({ artifactsDir });
  const [workflowId] = (await workItemService.loadWorkItem(workItemId)).workflowId.split('@');
  const workflow = await new WorkflowRegistry({
    workflowsDir: join(artifactsDir, 'workflows'),
  }).getWorkflow(workflowId);
  const step = workflow.getStep(stepKey);

  const record = await artifactService.writeHandoffArtifact({
    workItemId,
    workflow: { name: workflow.name, version: workflow.version },
    step: { key: step.key, order: step.order },
    eventType,
    attemptId,
    actor,
    outcome,
    nextAction,
    baselineIntegration: baselineFlag,
    links,
    timestamp: timestamp ? new Date(timestamp) : undefined,
  });

  const format =
    resolveOutputFormat(parsed, context.ciDefaultJson) ||
    (hasFlag(parsed, 'json') ? 'json' : 'text');

  if (format === 'json') {
    writeJson(context.stdout, record);
  } else {
    writeLine(context.stdout, `Handoff artifact written to ${record.path}`);
  }

  return 0;
}
