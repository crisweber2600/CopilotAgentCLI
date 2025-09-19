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
  writeJson,
  writeLine,
} from '../utils';

const DEFAULT_SCHEMA_PATH = join(
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
  const outcome = getStringFlag(parsed, 'outcome') ?? 'Step completed.';
  const nextAction = getStringFlag(parsed, 'next-action') ?? 'Proceed to next ready step.';
  const baselineFlag = (getStringFlag(parsed, 'baseline') as 'pre' | 'post' | undefined) ?? 'pre';
  const eventType =
    (getStringFlag(parsed, 'event-type') as 'attempt-completed' | undefined) ?? 'attempt-completed';
  const actor = getStringFlag(parsed, 'actor') ?? context.env.GITHUB_ACTOR ?? 'local-executor';
  const timestampFlag = getStringFlag(parsed, 'timestamp');
  const links = getStringArrayFlag(parsed, 'link');

  if (!workItemId) {
    throw new ValidationError('Specify --work-item for completion.');
  }
  if (!stepKey) {
    throw new ValidationError('Specify --step for completion.');
  }
  if (!attemptId) {
    throw new ValidationError('Specify --attempt for completion.');
  }

  const artifactsDir = join(context.cwd, 'artifacts');
  if (!existsSync(artifactsDir)) {
    throw new ValidationError(`Artifacts directory not found at ${artifactsDir}`);
  }

  const schemaPath = join(context.cwd, DEFAULT_SCHEMA_PATH);
  const artifactService = new ArtifactService({ artifactsDir, schemaPath });
  const workItemService = new WorkItemService({ artifactsDir });
  const workItem = await workItemService.loadWorkItem(workItemId);
  const [workflowId] = workItem.workflowId.split('@');

  const registry = new WorkflowRegistry({ workflowsDir: join(artifactsDir, 'workflows') });
  const workflow = await registry.getWorkflow(workflowId);
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
    timestamp: timestampFlag ? new Date(timestampFlag) : undefined,
  });

  const outputJson = hasFlag(parsed, 'json') || context.ciDefaultJson;
  if (outputJson) {
    writeJson(context.stdout, record);
  } else {
    writeLine(context.stdout, `Handoff artifact written to ${record.path}`);
  }

  return 0;
}
