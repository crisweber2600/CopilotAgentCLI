#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve('specs/001-create-a-structured/contracts/handoff-artifact.schema.json');
try {
  readFileSync(schemaPath, 'utf-8');
  console.log(`[check-schemas] Verified ${schemaPath}`);
} catch (error) {
  console.error(`[check-schemas] Missing schema at ${schemaPath}`);
  process.exitCode = 1;
}
