/**
 * Release Command
 * 
 * This command allows agents to release claimed tasks in the swarmable framework.
 */

import type { CliContext } from '../types';
import { ValidationError } from '../../services/errors';
import { TaskParser } from '../../services/taskParser';
import { AgentContractService } from '../../services/agentContract';
import type { AgentIdentity, AgentContext } from '../../types/agentContract';
import { 
  parseArgs, 
  getStringFlag, 
  resolveOutputFormat, 
  writeJson, 
  writeLine 
} from '../utils';
import { join } from 'node:path';

export async function releaseCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const taskId = getStringFlag(parsed, 'task') ?? parsed.positionals[0];
  const agentId = getStringFlag(parsed, 'agent') ?? 'cli-agent';
  const agentName = getStringFlag(parsed, 'agent-name') ?? 'CLI Agent';
  const reason = getStringFlag(parsed, 'reason') ?? 'Released by user request';
  const format = resolveOutputFormat(parsed, context.ciDefaultJson);

  if (!taskId) {
    throw new ValidationError('Task ID is required. Use: release <task-id>');
  }

  // Setup agent framework
  const specifyDir = join(context.cwd, '.specify');
  const taskParser = new TaskParser({
    tasksDirectory: join(specifyDir, 'tasks'),
    graphFile: join(specifyDir, 'graph', 'task_graph.yaml'),
    schemaFile: join(specifyDir, 'schema', 'task.ndjson.schema.json'),
    validateSchema: true,
    skipInvalidTasks: false
  });

  const agentIdentity: AgentIdentity = {
    id: agentId,
    name: agentName,
    version: '1.0.0',
    capabilities: ['git', 'typescript', 'javascript', 'python'],
    max_concurrent_tasks: 3
  };

  const agentContext: AgentContext = {
    cwd: context.cwd,
    repository: {
      remote_url: 'unknown',
      default_branch: 'main',
      current_branch: 'main'
    },
    env: context.env,
    config: {}
  };

  const contractService = new AgentContractService({
    baseDirectory: specifyDir,
    taskParser,
    rules: {
      atomic_claiming: true,
      enforce_heartbeats: true,
      verify_dependencies: true,
      enforce_branch_management: true,
      require_incremental_commits: true,
      validate_completion: true,
      allow_self_merge: false
    },
    context: agentContext
  }, agentIdentity);

  try {
    const result = await contractService.releaseTask(taskId, reason);

    if (!result.success) {
      if (format === 'json') {
        writeJson(context.stdout, {
          success: false,
          error: result.error
        });
      } else {
        writeLine(context.stderr, `Failed to release task ${taskId}: ${result.error}`);
      }
      return 1;
    }

    const payload = {
      success: true,
      task_id: taskId,
      agent_id: agentId,
      reason: result.reason,
      released_at: new Date().toISOString()
    };

    if (format === 'json') {
      writeJson(context.stdout, payload);
    } else {
      writeLine(context.stdout, `Successfully released task ${taskId}`);
      writeLine(context.stdout, `Agent: ${agentId} (${agentName})`);
      writeLine(context.stdout, `Reason: ${result.reason}`);
      writeLine(context.stdout, `Released at: ${payload.released_at}`);
    }

    return 0;

  } catch (error) {
    if (format === 'json') {
      writeJson(context.stdout, {
        success: false,
        error: (error as Error).message
      });
    } else {
      writeLine(context.stderr, `Error: ${(error as Error).message}`);
    }
    return 1;
  }
}

export default releaseCommand;