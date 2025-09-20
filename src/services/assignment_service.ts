import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

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

interface PersistedRecord extends ClaimRecord {
  schemaVersion: string;
}

export class AssignmentService {
  async claimAttempt(request: ClaimRequest): Promise<ClaimRecord> {
    const claimsDir = join(request.artifactsDir, 'claims');
    await mkdir(claimsDir, { recursive: true });

    const claimPath = join(claimsDir, `${request.attemptId}.json`);
    if (await this.fileExists(claimPath)) {
      throw new Error(`Attempt ${request.attemptId} already claimed`);
    }

    const previousAttemptId = await this.resolvePreviousAttemptId(claimsDir, request);

    const record: PersistedRecord = {
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

  private async resolvePreviousAttemptId(
    dir: string,
    request: ClaimRequest,
  ): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const history: Array<{ attemptId: string; claimedAt: string }> = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const filePath = join(dir, entry.name);
      const raw = await readFile(filePath, 'utf-8');
      const json = JSON.parse(raw) as PersistedRecord;
      if (json.workItemId === request.workItemId && json.stepKey === request.stepKey) {
        history.push({ attemptId: json.attemptId, claimedAt: json.claimedAt });
      }
    }

    if (history.length === 0) {
      return null;
    }

    history.sort((a, b) => a.claimedAt.localeCompare(b.claimedAt));
    return history[history.length - 1]?.attemptId ?? null;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
