import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { WorkItem, type WorkItemProps, type WorkItemStatus } from '../models/work_item';

export interface WorkItemStateUpdate {
  workItemId: string;
  currentStepKey: string;
  status: WorkItemStatus;
}

export interface WorkItemServiceOptions {
  artifactsDir: string;
}

export class WorkItemService {
  private readonly workItemsDir: string;

  constructor(options: WorkItemServiceOptions) {
    this.workItemsDir = join(options.artifactsDir, 'work-items');
  }

  async loadWorkItem(workItemId: string): Promise<WorkItem> {
    const path = this.resolvePath(workItemId);
    const raw = await readFile(path, 'utf-8');
    return WorkItem.fromJSON(JSON.parse(raw) as WorkItemProps);
  }

  async advanceToStep(workItemId: string, stepKey: string): Promise<WorkItemStateUpdate> {
    const item = await this.loadWorkItem(workItemId);
    const hydrated = this.hydrate(item);
    const updated = hydrated.advanceToStep(stepKey, new Date());
    await this.persist(updated);
    return {
      workItemId: updated.id,
      currentStepKey: updated.currentStepKey,
      status: updated.status,
    };
  }

  async rewindToStep(
    workItemId: string,
    stepKey: string,
    reasons: string[],
  ): Promise<WorkItemStateUpdate> {
    const item = await this.loadWorkItem(workItemId);
    const hydrated = this.hydrate(item);
    const updated = hydrated.rewindToStep(stepKey, reasons, new Date());
    await this.persist(updated);
    return {
      workItemId: updated.id,
      currentStepKey: updated.currentStepKey,
      status: updated.status,
    };
  }

  private resolvePath(workItemId: string): string {
    return join(this.workItemsDir, `${workItemId}.json`);
  }

  private async persist(workItem: WorkItem): Promise<void> {
    await import('node:fs/promises').then(({ mkdir }) => mkdir(this.workItemsDir, { recursive: true }));
    const path = this.resolvePath(workItem.id);
    await writeFile(path, `${JSON.stringify(workItem.snapshot(), null, 2)}\n`, 'utf-8');
  }

  private hydrate(item: WorkItem | WorkItemProps): WorkItem {
    return item instanceof WorkItem ? item : WorkItem.fromJSON(item as WorkItemProps);
  }
}
