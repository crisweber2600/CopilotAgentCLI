/**
 * Task Status Command
 * 
 * This command allows checking the status of tasks in the swarmable framework,
 * including claim status, dependencies, and agent information.
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
  resolveOutputFormat, 
  writeJson, 
  writeLine 
} from '../utils';
import { join } from 'node:path';

export async function taskStatusCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const taskId = getStringFlag(parsed, 'task') ?? parsed.positionals[0];
  const agentId = getStringFlag(parsed, 'agent') ?? 'cli-agent';
  const agentName = getStringFlag(parsed, 'agent-name') ?? 'CLI Agent';
  const showAll = getBooleanFlag(parsed, 'all') ?? false;
  const showDependencies = getBooleanFlag(parsed, 'deps') ?? false;
  const format = resolveOutputFormat(parsed, context.ciDefaultJson);

  if (!taskId && !showAll) {
    throw new ValidationError('Task ID is required unless --all is specified. Use: task-status <task-id> or task-status --all');
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
    if (showAll) {
      // Show status of all tasks
      const allTasks = await taskParser.loadTasks();
      
      if (showDependencies) {
        const dependencyInfo = await taskParser.resolveDependencies();
        
        const payload = {
          tasks: allTasks.map(task => ({
            id: task.id,
            name: task.name,
            status: task.claim.status,
            claimed_by: task.claim.by,
            claimed_since: task.claim.since,
            parallel_group: task.parallel_group,
            requires: task.requires,
            outputs: task.outputs
          })),
          dependency_analysis: {
            ready_tasks: dependencyInfo.ready_tasks,
            blocked_tasks: Object.keys(dependencyInfo.blocked_tasks),
            circular_dependencies: dependencyInfo.circular_dependencies
          }
        };

        if (format === 'json') {
          writeJson(context.stdout, payload);
        } else {
          writeLine(context.stdout, `Task Status Overview (${allTasks.length} tasks):`);
          writeLine(context.stdout, '');
          
          // Group by status
          const byStatus = allTasks.reduce((acc, task) => {
            if (!acc[task.claim.status]) {
              acc[task.claim.status] = [];
            }
            acc[task.claim.status].push(task);
            return acc;
          }, {} as Record<string, typeof allTasks>);

          Object.entries(byStatus).forEach(([status, tasks]) => {
            writeLine(context.stdout, `${status.toUpperCase()} (${tasks.length}):`);
            tasks.forEach(task => {
              const claimedBy = task.claim.by ? ` by ${task.claim.by}` : '';
              const group = task.parallel_group ? ` [${task.parallel_group}]` : '';
              writeLine(context.stdout, `  ${task.id}: ${task.name}${claimedBy}${group}`);
            });
            writeLine(context.stdout, '');
          });

          if (dependencyInfo.ready_tasks.length > 0) {
            writeLine(context.stdout, `Ready for claiming: ${dependencyInfo.ready_tasks.join(', ')}`);
          }

          if (Object.keys(dependencyInfo.blocked_tasks).length > 0) {
            writeLine(context.stdout, `Blocked tasks: ${Object.keys(dependencyInfo.blocked_tasks).join(', ')}`);
          }

          if (dependencyInfo.circular_dependencies.length > 0) {
            writeLine(context.stdout, `⚠️  Circular dependencies detected:`);
            dependencyInfo.circular_dependencies.forEach(cycle => {
              writeLine(context.stdout, `  ${cycle.join(' → ')}`);
            });
          }
        }

        return 0;
      }

      const payload = {
        tasks: allTasks.map(task => ({
          id: task.id,
          name: task.name,
          status: task.claim.status,
          claimed_by: task.claim.by,
          claimed_since: task.claim.since,
          parallel_group: task.parallel_group
        }))
      };

      if (format === 'json') {
        writeJson(context.stdout, payload);
      } else {
        writeLine(context.stdout, `Task Status (${allTasks.length} tasks):`);
        payload.tasks.forEach(task => {
          const claimedBy = task.claimed_by ? ` by ${task.claimed_by}` : '';
          const group = task.parallel_group ? ` [${task.parallel_group}]` : '';
          writeLine(context.stdout, `  ${task.id}: ${task.name} (${task.status})${claimedBy}${group}`);
        });
      }

      return 0;
    }

    // Show status of specific task
    const task = await taskParser.getTask(taskId!);
    
    if (!task) {
      if (format === 'json') {
        writeJson(context.stdout, {
          error: `Task ${taskId} not found`
        });
      } else {
        writeLine(context.stderr, `Task ${taskId} not found`);
      }
      return 1;
    }

    // Check if agent can claim this task
    const canClaim = await contractService.canClaimTask(taskId!);

    const payload = {
      task: {
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.claim.status,
        claimed_by: task.claim.by,
        claimed_since: task.claim.since,
        lease_minutes: task.claim.lease_minutes,
        heartbeat_minutes: task.claim.heartbeat_minutes,
        parallel_group: task.parallel_group,
        requires: task.requires,
        outputs: task.outputs,
        branch: task.branch,
        base_branch: task.base_branch,
        done_when: task.done_when
      },
      can_claim: canClaim.valid,
      claim_errors: canClaim.errors,
      claim_warnings: canClaim.warnings
    };

    if (format === 'json') {
      writeJson(context.stdout, payload);
    } else {
      writeLine(context.stdout, `Task: ${task.name} (${task.id})`);
      writeLine(context.stdout, `Description: ${task.description}`);
      writeLine(context.stdout, `Status: ${task.claim.status}`);
      
      if (task.claim.by) {
        writeLine(context.stdout, `Claimed by: ${task.claim.by}`);
        writeLine(context.stdout, `Claimed since: ${task.claim.since}`);
        writeLine(context.stdout, `Lease: ${task.claim.lease_minutes} minutes, heartbeat every ${task.claim.heartbeat_minutes} minutes`);
      }

      if (task.parallel_group) {
        writeLine(context.stdout, `Parallel group: ${task.parallel_group}`);
      }

      if (task.requires.length > 0) {
        writeLine(context.stdout, `Requires: ${task.requires.join(', ')}`);
      }

      writeLine(context.stdout, `Branch: ${task.branch}`);
      writeLine(context.stdout, `Base branch: ${task.base_branch}`);
      writeLine(context.stdout, `Outputs: ${task.outputs.join(', ')}`);
      
      writeLine(context.stdout, `Completion criteria:`);
      task.done_when.forEach(criterion => {
        writeLine(context.stdout, `  - ${criterion}`);
      });

      writeLine(context.stdout, '');
      if (canClaim.valid) {
        writeLine(context.stdout, '✅ This task can be claimed');
      } else {
        writeLine(context.stdout, '❌ This task cannot be claimed:');
        canClaim.errors.forEach(error => {
          writeLine(context.stdout, `  - ${error}`);
        });
      }

      if (canClaim.warnings.length > 0) {
        writeLine(context.stdout, '⚠️  Warnings:');
        canClaim.warnings.forEach(warning => {
          writeLine(context.stdout, `  - ${warning}`);
        });
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

export default taskStatusCommand;