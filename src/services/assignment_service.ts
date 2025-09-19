import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

import type { Assignment } from '../models/assignment';
import { logger } from '../lib/logger';

export interface ClaimExecutor {
  id: string;
  displayName: string;
  runId?: string;
}

export interface ClaimRequest {
  attemptId: string;
  workItemId: string;
  stepKey: string;
  executor: ClaimExecutor;
  claimedAt: Date;
  artifactsDir: string;
}

export interface ClaimRecord {
  attemptId: string;
  workItemId: string;
  stepKey: string;
  claimedAt: string;
  executor: ClaimExecutor;
  status: 'running';
  artifactPath: string;
  previousAttemptId?: string;
}

interface PersistedClaimRecord extends ClaimRecord {
  schemaVersion: string;
}

export class AssignmentService {
  async claimAttempt(request: ClaimRequest): Promise<ClaimRecord> {
    const claimsDir = join(request.artifactsDir, 'claims');
    await mkdir(claimsDir, { recursive: true });

    const claimPath = join(claimsDir, `${request.attemptId}.json`);
    if (await this.claimExists(claimPath)) {
      throw new Error(`Attempt ${request.attemptId} already claimed`);
    }

    const previousAttemptId = await this.findPreviousAttemptId(claimsDir, request);

    const record: PersistedClaimRecord = {
      schemaVersion: '1.0',
      attemptId: request.attemptId,
      workItemId: request.workItemId,
      stepKey: request.stepKey,
      claimedAt: request.claimedAt.toISOString(),
      executor: request.executor,
      status: 'running',
      artifactPath: claimPath,
      previousAttemptId: previousAttemptId ?? undefined,
    };

    await writeFile(claimPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');

    logger.info('Attempt claimed', {
      workItemId: record.workItemId,
      stepKey: record.stepKey,
      attemptId: record.attemptId,
      executorId: record.executor.id,
    });

    return {
      attemptId: record.attemptId,
      workItemId: record.workItemId,
      stepKey: record.stepKey,
      claimedAt: record.claimedAt,
      executor: record.executor,
      status: record.status,
      artifactPath: claimPath,
      previousAttemptId: record.previousAttemptId,
    };
  }

  // Placeholder for future implementation (assignment completion)
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  completeAssignment(_assignment: Assignment): Promise<void> {
    throw new Error('Assignment completion not implemented');
  }

  private async claimExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async findPreviousAttemptId(dir: string, request: ClaimRequest): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true });
    const candidates: Array<{ attemptId: string; claimedAt: string } | null> = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const filePath = join(dir, entry.name);
          const raw = await readFile(filePath, 'utf-8');
          const json = JSON.parse(raw) as PersistedClaimRecord;
          if (json.workItemId === request.workItemId && json.stepKey === request.stepKey) {
            return { attemptId: json.attemptId, claimedAt: json.claimedAt };
          }
          return null;
        }),
    );

    const filtered = candidates.filter(
      (value): value is { attemptId: string; claimedAt: string } => value !== null,
    );
    if (filtered.length === 0) {
      return null;
    }

    filtered.sort((a, b) => a.claimedAt.localeCompare(b.claimedAt));
    return filtered[filtered.length - 1]!.attemptId;
  }
}
