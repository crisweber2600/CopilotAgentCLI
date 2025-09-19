#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function main() {
  const schemaPath = resolve('specs/001-create-a-structured/contracts/handoff-artifact.schema.json');
  try {
    readFileSync(schemaPath, 'utf-8');
    console.log(`[check-schemas] Loaded ${schemaPath}`);
  } catch (error) {
    console.error(`[check-schemas] Failed to read schema at ${schemaPath}`);
    throw error;
  }
}

main();
