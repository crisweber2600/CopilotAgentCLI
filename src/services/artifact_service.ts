import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';

import type { HandoffArtifactProps } from '../models/handoff_artifact';
import { logger } from '../lib/logger';

export interface HandoffArtifactInput {
  workItemId: string;
  workflow: { name: string; version: string };
  step: { key: string; order: number };
  eventType: HandoffArtifactProps['eventType'];
  attemptId: string;
  actor: string;
  outcome: string;
  nextAction: string;
  baselineIntegration: 'pre' | 'post';
  links: string[];
  timestamp?: Date;
}

export interface HandoffArtifactRecord {
  workItemId: string;
  workflow: { name: string; version: string };
  step: { key: string; order: number };
  eventType: HandoffArtifactProps['eventType'];
  attemptId: string;
  actor: string;
  outcome: string;
  nextAction: string;
  baselineIntegration: 'pre' | 'post';
  links: string[];
  timestamp: string;
  path: string;
}

export interface ArtifactServiceOptions {
  artifactsDir: string;
  schemaPath: string;
}

export class ArtifactService {
  private readonly artifactsDir: string;

  private readonly schemaPath: string;

  private readonly ajv: Ajv;

  private validator: ValidateFunction | null = null;

  constructor(options: ArtifactServiceOptions) {
    this.artifactsDir = options.artifactsDir;
    this.schemaPath = options.schemaPath;
    this.ajv = new Ajv({ allErrors: true, strict: false });
  }

  async writeHandoffArtifact(input: HandoffArtifactInput): Promise<HandoffArtifactRecord> {
    await this.ensureValidator();

    const timestamp = (input.timestamp ?? new Date()).toISOString();
    const artifact: HandoffArtifactProps = {
      workItemId: input.workItemId,
      workflow: input.workflow,
      step: input.step,
      eventType: input.eventType,
      attemptId: input.attemptId,
      timestamp,
      actor: input.actor,
      outcome: input.outcome,
      nextAction: input.nextAction,
      baselineIntegration: input.baselineIntegration,
      links: input.links,
      schemaVersion: '1.0',
    };

    await this.validateBaselineBoundary(artifact);
    this.validateAgainstSchema(artifact);

    const handoffDir = join(this.artifactsDir, 'handoff');
    await mkdir(handoffDir, { recursive: true });

    const fileName = `${timestamp.replace(/[:]/g, '-')}-${artifact.workItemId}-${artifact.step.key}-${artifact.attemptId}.json`;
    const path = join(handoffDir, fileName);
    await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');

    logger.info('Handoff artifact written', {
      workItemId: artifact.workItemId,
      stepKey: artifact.step.key,
      attemptId: artifact.attemptId,
      eventType: artifact.eventType,
    });

    return {
      workItemId: artifact.workItemId,
      workflow: artifact.workflow,
      step: artifact.step,
      eventType: artifact.eventType,
      attemptId: artifact.attemptId,
      actor: artifact.actor,
      outcome: artifact.outcome,
      nextAction: artifact.nextAction,
      baselineIntegration: artifact.baselineIntegration,
      links: artifact.links,
      timestamp: artifact.timestamp,
      path,
    };
  }

  async listHandoffArtifacts(workItemId: string): Promise<HandoffArtifactRecord[]> {
    const rawArtifacts = await this.readArtifactsFromDisk();
    return rawArtifacts
      .filter((artifact) => artifact.workItemId === workItemId)
      .map((artifact) => ({
        workItemId: artifact.workItemId,
        workflow: artifact.workflow,
        step: artifact.step,
        eventType: artifact.eventType,
        attemptId: artifact.attemptId,
        actor: artifact.actor,
        outcome: artifact.outcome,
        nextAction: artifact.nextAction,
        baselineIntegration: artifact.baselineIntegration,
        links: artifact.links,
        timestamp: artifact.timestamp,
        path: artifact.path,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private async ensureValidator(): Promise<void> {
    if (this.validator) {
      return;
    }
    const rawSchema = await readFile(this.schemaPath, 'utf-8');
    const schema = JSON.parse(rawSchema);
    this.validator = this.ajv.compile(schema);
  }

  private validateAgainstSchema(payload: HandoffArtifactProps): void {
    const validate = this.validator;
    if (!validate) {
      throw new Error('AJV validator not initialised');
    }
    const valid = validate(payload);
    if (!valid) {
      const message = (validate.errors ?? [])
        .map((error) => `${error.instancePath} ${error.message}`)
        .join('; ');
      throw new Error(`Handoff artifact invalid: ${message}`);
    }
  }

  private async validateBaselineBoundary(candidate: HandoffArtifactProps): Promise<void> {
    const artifacts = await this.readArtifactsFromDisk();
    const relevant = artifacts.filter(
      (artifact) =>
        artifact.workItemId === candidate.workItemId && artifact.step.key === candidate.step.key,
    );

    const lastBaseline = relevant
      .filter((artifact) => artifact.eventType === 'baseline-integration')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .pop();

    if (!lastBaseline) {
      return;
    }

    if (candidate.eventType === 'baseline-integration') {
      return;
    }

    if (candidate.eventType === 'attempt-completed' || candidate.eventType === 'attempt-started') {
      const revertEvent = relevant
        .filter(
          (artifact) =>
            artifact.timestamp > lastBaseline.timestamp &&
            ['attempt-rejected', 'attempt-failed'].includes(artifact.eventType) &&
            artifact.baselineIntegration === 'post',
        )
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .pop();

      if (!revertEvent) {
        throw new Error(
          `Baseline integration boundary: step ${candidate.step.key} for work item ${candidate.workItemId} requires explicit revert before re-execution`,
        );
      }
    }
  }

  private async readArtifactsFromDisk(): Promise<Array<HandoffArtifactProps & { path: string }>> {
    const handoffDir = join(this.artifactsDir, 'handoff');
    const entries = await readdir(handoffDir, { withFileTypes: true }).catch(() => []);
    const results: Array<HandoffArtifactProps & { path: string }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const path = join(handoffDir, entry.name);
      const raw = await readFile(path, 'utf-8');
      const artifact = JSON.parse(raw) as HandoffArtifactProps;
      results.push({ ...artifact, path });
    }

    return results;
  }
}
