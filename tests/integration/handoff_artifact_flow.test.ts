import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Ajv from 'ajv';

import { ArtifactService } from '../../src/services/artifact_service';

const schemaPath = join(
  process.cwd(),
  'specs',
  '001-create-a-structured',
  'contracts',
  'handoff-artifact.schema.json',
);

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const validate = ajv.compile(schema);

describe('handoff artifact flow', () => {
  it('writes schema-compliant artifacts and lists them for consumers', async () => {
    const artifactsDir = mkdtempSync(join(tmpdir(), 'handoff-service-'));
    const service = new ArtifactService({ artifactsDir, schemaPath });

    const record = await service.writeHandoffArtifact({
      workItemId: 'work-item-001-create-a-structured',
      workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
      step: { key: 'phase-tests', order: 2 },
      eventType: 'attempt-completed',
      attemptId: 'attempt-phase-tests-001',
      actor: 'quality-engineer',
      outcome: 'Tests authored and committed.',
      nextAction: 'Run models implementation.',
      baselineIntegration: 'pre',
      links: ['artifacts/claims/attempt-phase-tests-001.json'],
      timestamp: new Date('2025-09-19T17:00:00.000Z'),
    });

    const raw = JSON.parse(readFileSync(record.path, 'utf-8'));
    const valid = validate(raw);
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);

    const artifacts = await service.listHandoffArtifacts('work-item-001-create-a-structured');
    expect(artifacts.map((artifact) => artifact.attemptId)).toContain('attempt-phase-tests-001');

    rmSync(artifactsDir, { recursive: true, force: true });
  });
});
