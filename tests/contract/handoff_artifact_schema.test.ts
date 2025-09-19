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

const sampleArtifactPath = resolve(
  __dirname,
  '..',
  '..',
  'artifacts',
  'handoff',
  '2025-09-19T15-45-00Z-work-item-001-create-a-structured-phase-setup-attempt-phase-setup.json',
);

describe('handoff artifact schema contract', () => {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it('accepts a compliant artifact with all required fields', () => {
    const artifact = JSON.parse(readFileSync(sampleArtifactPath, 'utf-8'));
    const valid = validate(artifact);
    const { errors } = validate;

    expect(valid, JSON.stringify(errors, null, 2)).toBe(true);
  });

  it('rejects artifacts missing required fields', () => {
    const artifact = JSON.parse(readFileSync(sampleArtifactPath, 'utf-8'));
    // Remove a required field to simulate an invalid artifact.
    delete artifact.actor;

    const valid = validate(artifact);

    expect(valid).toBe(false);
    const messages = validate.errors?.map((error) => error.message) ?? [];
    expect(messages.some((message) => message?.includes("required property 'actor'"))).toBe(true);
  });

  it('rejects artifacts with invalid enum values', () => {
    const artifact = JSON.parse(readFileSync(sampleArtifactPath, 'utf-8'));
    artifact.eventType = 'unknown-event';

    const valid = validate(artifact);

    expect(valid).toBe(false);
    expect(validate.errors?.map((error) => error.message)).toContain(
      'must be equal to one of the allowed values',
    );
  });
});
