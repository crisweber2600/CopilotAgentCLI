import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { WorkItemProps } from '../models/work_item';

export interface MetricsSnapshot {
  workItemId: string;
  leadTimeDays: number;
  wip: number;
}

export interface MetricsServiceOptions {
  artifactsDir: string;
}

export class MetricsService {
  private readonly artifactsDir: string;

  constructor(options: MetricsServiceOptions) {
    this.artifactsDir = options.artifactsDir;
  }

  async buildPortfolioSnapshot(): Promise<MetricsSnapshot[]> {
    const workItemsDir = join(this.artifactsDir, 'work-items');
    const entries = await readdir(workItemsDir, { withFileTypes: true }).catch(() => []);
    const snapshots: MetricsSnapshot[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const raw = await readFile(join(workItemsDir, entry.name), 'utf-8');
      const workItem = JSON.parse(raw) as WorkItemProps & { remainingTasks?: string[] };
      const leadTimeDays = this.computeLeadTimeDays(workItem.createdAt, workItem.updatedAt);
      const wip = this.computeWip(workItem);
      snapshots.push({
        workItemId: workItem.id,
        leadTimeDays,
        wip,
      });
    }

    return snapshots;
  }

  private computeLeadTimeDays(createdAt: string, updatedAt: string): number {
    const created = Date.parse(createdAt);
    const updated = Date.parse(updatedAt);
    if (Number.isNaN(created) || Number.isNaN(updated) || updated <= created) {
      return 0;
    }
    const millisPerDay = 86_400_000;
    return Number(((updated - created) / millisPerDay).toFixed(2));
  }

  private computeWip(workItem: WorkItemProps & { remainingTasks?: string[] }): number {
    if (workItem.status === 'completed') {
      return 0;
    }
    return Math.max(workItem.remainingTasks?.length ?? 1, 1);
  }
}
