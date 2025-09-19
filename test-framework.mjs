#!/usr/bin/env node

/**
 * Simple test script for the agent swarmable framework
 */

import { TaskParser } from './dist/services/taskParser.js';
import { readNDJSON } from './dist/utils/ndjsonReader.js';
import { join } from 'path';

async function testFramework() {
  console.log('Testing Agent Swarmable Framework...\n');

  const specifyDir = join(process.cwd(), '.specify');
  
  try {
    // Test NDJSON reading
    console.log('1. Testing NDJSON reading...');
    const tasksFile = join(specifyDir, 'tasks', 'agent-swarmable.ndjson');
    const tasks = await readNDJSON(tasksFile);
    console.log(`   ✓ Loaded ${tasks.length} tasks from ${tasksFile}`);

    // Test task parser
    console.log('\n2. Testing task parser...');
    const parser = new TaskParser({
      tasksDirectory: join(specifyDir, 'tasks'),
      graphFile: join(specifyDir, 'graph', 'task_graph.yaml'),
      schemaFile: join(specifyDir, 'schema', 'task.ndjson.schema.json'),
      validateSchema: true,
      skipInvalidTasks: false
    });

    const allTasks = await parser.loadTasks();
    console.log(`   ✓ TaskParser loaded ${allTasks.length} tasks`);

    // Test dependency resolution
    console.log('\n3. Testing dependency resolution...');
    const deps = await parser.resolveDependencies();
    console.log(`   ✓ Sorted tasks: ${deps.sorted_tasks.length}`);
    console.log(`   ✓ Ready tasks: ${deps.ready_tasks.length}`);
    console.log(`   ✓ Blocked tasks: ${Object.keys(deps.blocked_tasks).length}`);
    console.log(`   ✓ Circular dependencies: ${deps.circular_dependencies.length}`);

    if (deps.ready_tasks.length > 0) {
      console.log(`\n   Ready for claiming: ${deps.ready_tasks.join(', ')}`);
    }

    // Show task status summary
    console.log('\n4. Task status summary:');
    const statusCounts = allTasks.reduce((acc, task) => {
      acc[task.claim.status] = (acc[task.claim.status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} task${count !== 1 ? 's' : ''}`);
    });

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (process.argv.includes('--verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testFramework();