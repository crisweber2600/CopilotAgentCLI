/**
 * Claim Command
 * 
 * This command allows agents to claim available tasks in the swarmable framework.
 */

import type { CliContext } from '../types';
import { ValidationError } from '../../services/errors';
import { TaskParser } from '../../services/taskParser';
import { AgentContractService } from '../../services/agentContract';
import type { AgentIdentity, AgentContext } from '../../types/agentContract';
import { 
  parseArgs, 
  getStringFlag, 
  getBooleanFlag,
  getNumberFlag,
  resolveOutputFormat, 
  writeJson, 
  writeLine 
} from '../utils';
import { join } from 'node:path';

export async function claimCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const taskId = getStringFlag(parsed, 'task') ?? parsed.positionals[0];
  const agentId = getStringFlag(parsed, 'agent') ?? 'cli-agent';
  const agentName = getStringFlag(parsed, 'agent-name') ?? 'CLI Agent';
  const leaseMinutes = getNumberFlag(parsed, 'lease-minutes') ?? 90;
  const heartbeatMinutes = getNumberFlag(parsed, 'heartbeat-minutes') ?? 10;
  const force = getBooleanFlag(parsed, 'force') ?? false;
  const listAvailable = getBooleanFlag(parsed, 'list') ?? false;
  const format = resolveOutputFormat(parsed, context.ciDefaultJson);

  if (!taskId && !listAvailable) {
    throw new ValidationError('Task ID is required unless --list is specified. Use: claim <task-id> or claim --list');
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
    if (listAvailable) {
      // List available tasks
      const availableTasks = await contractService.getAvailableTasks();
      
      const payload = {
        available_tasks: availableTasks.map(task => ({
          id: task.id,
          name: task.name,
          description: task.description,
          parallel_group: task.parallel_group,
          requires: task.requires,
          outputs: task.outputs,
          estimated_minutes: 0 // Would come from graph
        }))
      };

      if (format === 'json') {
        writeJson(context.stdout, payload);
      } else {
        if (payload.available_tasks.length === 0) {
          writeLine(context.stdout, 'No tasks available for claiming.');
        } else {
          writeLine(context.stdout, 'Available tasks:');
          payload.available_tasks.forEach(task => {
            const deps = task.requires.length > 0 ? ` (requires: ${task.requires.join(', ')})` : '';
            const group = task.parallel_group ? ` [${task.parallel_group}]` : '';
            writeLine(context.stdout, `  ${task.id}: ${task.name}${group}${deps}`);
          });
        }
      }

      return 0;
    }

    // Claim specific task
    const result = await contractService.claimTask({
      agent: agentIdentity,
      task_id: taskId!,
      lease_minutes: leaseMinutes,
      heartbeat_minutes: heartbeatMinutes,
      force
    });

    if (!result.success) {
      if (format === 'json') {
        writeJson(context.stdout, {
          success: false,
          error: result.error
        });
      } else {
        writeLine(context.stderr, `Failed to claim task ${taskId}: ${result.error}`);
      }
      return 1;
    }

    const payload = {
      success: true,
      task_id: taskId,
      agent_id: agentId,
      lease_expires_at: result.lease_expires_at,
      task: result.task ? {
        id: result.task.id,
        name: result.task.name,
        description: result.task.description,
        branch: result.task.branch,
        outputs: result.task.outputs
      } : undefined
    };

    if (format === 'json') {
      writeJson(context.stdout, payload);
    } else {
      writeLine(context.stdout, `Successfully claimed task ${taskId}`);
      writeLine(context.stdout, `Agent: ${agentId} (${agentName})`);
      writeLine(context.stdout, `Lease expires at: ${result.lease_expires_at}`);
      if (result.task) {
        writeLine(context.stdout, `Task: ${result.task.name}`);
        writeLine(context.stdout, `Branch: ${result.task.branch}`);
        writeLine(context.stdout, `Outputs: ${result.task.outputs.join(', ')}`);
      }
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

export default claimCommand;