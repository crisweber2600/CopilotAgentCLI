#!/usr/bin/env node

/**
 * Test CLI commands directly
 */

import { taskStatusCommand } from './dist/cli/commands/task-status.js';
import { claimCommand } from './dist/cli/commands/claim.js';

// Mock CLI context that bypasses authentication
const mockContext = {
  authService: null,
  sessionService: null, 
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  cwd: process.cwd(),
  agentHome: '',
  ciDefaultJson: false,
  verbose: true
};

async function testCliCommands() {
  console.log('Testing CLI Commands Directly...\n');
  
  try {
    console.log('1. Testing task-status --all...');
    const statusResult = await taskStatusCommand(['--all'], mockContext);
    console.log(`   → Exit code: ${statusResult}\n`);

    console.log('2. Testing claim --list...');
    const claimResult = await claimCommand(['--list'], mockContext);
    console.log(`   → Exit code: ${claimResult}\n`);

    if (statusResult === 0 && claimResult === 0) {
      console.log('✅ All CLI command tests passed!');
    } else {
      console.log('❌ Some CLI command tests failed');
    }

  } catch (error) {
    console.error('❌ CLI command test failed:', error.message);
    if (process.argv.includes('--verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testCliCommands();