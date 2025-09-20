import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';

const schemaPath = resolve(
  __dirname,
  '..',
  '..',
  'specs',
  '001-create-a-structured',
  'contracts',
  'handoff-artifact.schema.json',
);

const samplePath = resolve(
  __dirname,
  '..',
  '..',
  'artifacts',
  'handoff',
  '2025-09-19T15-45-00Z-work-item-001-create-a-structured-phase-setup-attempt-phase-setup.json',
);

describe('handoff artifact schema', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it('accepts a compliant artifact', () => {
    const artifact = JSON.parse(readFileSync(samplePath, 'utf-8'));
    const valid = validate(artifact);
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it('rejects missing required fields', () => {
    const artifact = JSON.parse(readFileSync(samplePath, 'utf-8'));
    delete artifact.actor;
    const valid = validate(artifact);
    expect(valid).toBe(false);
    const messages = validate.errors?.map((error) => error.message) ?? [];
    expect(messages.some((message) => message?.includes("required property 'actor'"))).toBe(true);
  });

  it('rejects invalid enum values', () => {
    const artifact = JSON.parse(readFileSync(samplePath, 'utf-8'));
    artifact.eventType = 'invalid-event';
    const valid = validate(artifact);
    expect(valid).toBe(false);
    const messages = validate.errors?.map((error) => error.message) ?? [];
    expect(messages.some((message) => /allowed values/.test(message ?? ''))).toBe(true);
  });
});
