import { existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type DelegationRequest,
  validateContextRefs,
  validateDelegationRequest,
} from '../../models/cliDelegation';
import { ValidationError } from '../../services/errors';
import { WorkflowRegistry } from '../../services/workflow_registry';
import { SchedulingService } from '../../services/scheduling_service';
import { ArtifactService } from '../../services/artifact_service';
import { WorkItemService } from '../../services/work_item_service';
import { detectRepository } from '../repository';
import type { CliContext } from '../types';
import {
  getStringArrayFlag,
  getStringFlag,
  hasFlag,
  parseArgs,
  resolveOutputFormat,
  resolvePath,
  writeJson,
  writeLine,
} from '../utils';

interface DelegateOptions {
  prompt: string;
  files: string[];
  folders: string[];
  approvals: string[];
  mode: 'interactive' | 'non-interactive';
  output: 'json' | 'text';
  quiet: boolean;
  branch?: string;
  structuredWorkItemId?: string;
}

export async function delegateCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const prompt = (getStringFlag(parsed, 'prompt') ?? parsed.positionals[0] ?? '').trim();

  if (!prompt) {
    throw new ValidationError('A prompt is required to delegate a task.');
  }

  await context.authService.requireSession();

  const interactiveFlag = hasFlag(parsed, 'interactive');
  const nonInteractiveFlag = hasFlag(parsed, 'non-interactive');
  if (interactiveFlag && nonInteractiveFlag) {
    throw new ValidationError('Select either --interactive or --non-interactive, not both.');
  }

  const mode: 'interactive' | 'non-interactive' = nonInteractiveFlag
    ? 'non-interactive'
    : 'interactive';

  const files = getStringArrayFlag(parsed, 'file').map((file) => resolvePath(context.cwd, file));
  const folders = getStringArrayFlag(parsed, 'folder').map((folder) =>
    resolvePath(context.cwd, folder),
  );
  const approvals = getStringArrayFlag(parsed, 'approve');
  const branchOverride = getStringFlag(parsed, 'branch') ?? getStringFlag(parsed, 'base-branch');
  const structuredWorkItemId =
    getStringFlag(parsed, 'structured-work-item') ?? getStringFlag(parsed, 'work-item');
  const quiet = hasFlag(parsed, 'quiet');
  const output = resolveOutputFormat(parsed, quiet ? true : context.ciDefaultJson);

  const options: DelegateOptions = {
    prompt,
    files,
    folders,
    approvals,
    mode,
    output,
    quiet,
    branch: branchOverride ?? undefined,
    structuredWorkItemId: structuredWorkItemId ?? undefined,
  };

  const repository = await detectRepository({ cwd: context.cwd, env: context.env });
  if (!repository && context.sessionService.isRemote() && !context.env.COPILOT_CLI_TEST_MODE) {
    throw new ValidationError(
      'Unable to detect GitHub repository information. Run from a Git repository or set GITHUB_REPOSITORY and GITHUB_REF.',
    );
  }
  if (!repository && options.branch) {
    throw new ValidationError('Cannot override branch when repository information is unavailable.');
  }
  const request = createDelegationRequest(options, repository);
  validateInputContext(request, options);

  if (options.structuredWorkItemId) {
    await generateStructuredSchedule(options.structuredWorkItemId, context);
  }

  const session = await context.sessionService.create(request);

  if (options.quiet) {
    writeLine(context.stdout, session.id);
    return 0;
  }

  if (options.output === 'json') {
    writeJson(context.stdout, {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
    });
  } else {
    writeLine(context.stdout, `Delegated session ${session.id} (status: ${session.status}).`);
  }

  return 0;
}

function createDelegationRequest(
  options: DelegateOptions,
  repository?: Awaited<ReturnType<typeof detectRepository>>,
): DelegationRequest {
  const contextRefs = [...options.files, ...options.folders];
  const repoOverride = repository ? { ...repository } : undefined;
  if (repoOverride && options.branch) {
    repoOverride.branch = options.branch;
  }

  return {
    prompt: options.prompt,
    contextRefs,
    mode: options.mode,
    approvals: options.approvals,
    output: options.output,
    quiet: options.quiet,
    repository: repoOverride,
  };
}

function validateInputContext(request: DelegationRequest, options: DelegateOptions): void {
  const validation = validateDelegationRequest(request);
  if (!validation.valid) {
    const reason = 'reason' in validation ? validation.reason : 'Delegation request is invalid.';
    throw new ValidationError(reason);
  }

  const missing: string[] = [];
  for (const file of options.files) {
    if (!existsSync(file) || !statSync(file).isFile()) {
      missing.push(file);
    }
  }
  for (const folder of options.folders) {
    if (!existsSync(folder) || !statSync(folder).isDirectory()) {
      missing.push(folder);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(`Missing context references: ${missing.join(', ')}`);
  }

  const contextValidation = validateContextRefs(request.contextRefs, (path) => existsSync(path));
  if (!contextValidation.valid) {
    const reason =
      'reason' in contextValidation ? contextValidation.reason : 'Context references are invalid.';
    throw new ValidationError(reason);
  }
}

async function generateStructuredSchedule(workItemId: string, context: CliContext): Promise<void> {
  const artifactsDir = join(context.cwd, 'artifacts');
  if (!existsSync(artifactsDir)) {
    throw new ValidationError(`Artifacts directory not found at ${artifactsDir}`);
  }

  const workflowsDir = join(artifactsDir, 'workflows');
  const registry = new WorkflowRegistry({ workflowsDir });
  const workItemService = new WorkItemService({ artifactsDir });
  const workItem = await workItemService.loadWorkItem(workItemId);

  const [workflowId] = workItem.workflowId.split('@');
  const workflow = await registry.getWorkflow(workflowId);

  const schemaPath = join(
    context.cwd,
    'specs',
    '001-create-a-structured',
    'contracts',
    'handoff-artifact.schema.json',
  );

  const artifactService = new ArtifactService({ artifactsDir, schemaPath });
  const handoffs = await artifactService.listHandoffArtifacts(workItemId);
  const completedSteps = Array.from(
    new Set(
      handoffs
        .filter((artifact) =>
          ['attempt-completed', 'baseline-integration'].includes(artifact.eventType),
        )
        .map((artifact) => artifact.step.key),
    ),
  );

  const schedulingService = new SchedulingService();
  const decision = await schedulingService.generateSchedule({
    workflow,
    workItem: { id: workItem.id, currentStepKey: workItem.currentStepKey },
    completedSteps,
  });

  const scheduleDir = join(artifactsDir, 'schedule');
  const schedulePath = join(scheduleDir, `${workItemId}.json`);
  await writeFile(schedulePath, `${JSON.stringify(decision.snapshot(), null, 2)}\n`, 'utf-8');

  if (!context.ciDefaultJson && !context.env.CI) {
    writeLine(context.stdout, `Generated schedule for ${workItemId} at ${schedulePath}`);
  }
}

export default delegateCommand;
