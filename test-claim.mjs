#!/usr/bin/env node

/**
 * Test the claim functionality
 */

import { TaskParser } from './dist/services/taskParser.js';
import { AgentContractService } from './dist/services/agentContract.js';
import { join } from 'path';

async function testClaim() {
  console.log('Testing Task Claiming...\n');

  const specifyDir = join(process.cwd(), '.specify');
  
  const taskParser = new TaskParser({
    tasksDirectory: join(specifyDir, 'tasks'),
    graphFile: join(specifyDir, 'graph', 'task_graph.yaml'),
    schemaFile: join(specifyDir, 'schema', 'task.ndjson.schema.json'),
    validateSchema: true,
    skipInvalidTasks: false
  });

  const agentIdentity = {
    id: 'test-agent',
    name: 'Test Agent',
    version: '1.0.0',
    capabilities: ['git', 'typescript', 'javascript', 'python'],
    max_concurrent_tasks: 3
  };

  const agentContext = {
    cwd: process.cwd(),
    repository: {
      remote_url: 'unknown',
      default_branch: 'main',
      current_branch: 'main'
    },
    env: process.env,
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
    // Get available tasks
    console.log('1. Getting available tasks...');
    const availableTasks = await contractService.getAvailableTasks();
    console.log(`   ✓ Found ${availableTasks.length} available tasks`);
    
    if (availableTasks.length > 0) {
      const task = availableTasks[0];
      console.log(`   → Available: ${task.id} - ${task.name}`);
      
      // Try to claim the task
      console.log('\n2. Attempting to claim task...');
      const claimResult = await contractService.claimTask({
        agent: agentIdentity,
        task_id: task.id,
        lease_minutes: 90,
        heartbeat_minutes: 10,
        force: false
      });

      if (claimResult.success) {
        console.log(`   ✅ Successfully claimed task ${task.id}`);
        console.log(`   → Lease expires at: ${claimResult.lease_expires_at}`);

        // Test heartbeat
        console.log('\n3. Testing heartbeat...');
        const heartbeatResult = await contractService.heartbeat(task.id);
        if (heartbeatResult.success) {
          console.log(`   ✅ Heartbeat successful, lease extended to: ${heartbeatResult.lease_expires_at}`);
        } else {
          console.log(`   ❌ Heartbeat failed: ${heartbeatResult.error}`);
        }

        // Test release
        console.log('\n4. Releasing task...');
        const releaseResult = await contractService.releaseTask(task.id, 'Testing complete');
        if (releaseResult.success) {
          console.log(`   ✅ Successfully released task: ${releaseResult.reason}`);
        } else {
          console.log(`   ❌ Release failed: ${releaseResult.error}`);
        }

      } else {
        console.log(`   ❌ Failed to claim task: ${claimResult.error}`);
      }
    } else {
      console.log('   → No tasks available for claiming');
    }

    console.log('\n✅ Claim test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (process.argv.includes('--verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testClaim();