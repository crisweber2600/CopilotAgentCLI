import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { WorkItem, type WorkItemProps } from '../models/work_item';

export interface WorkItemStateUpdate {
  workItemId: string;
  currentStepKey: string;
  status: string;
}

export interface WorkItemServiceOptions {
  artifactsDir: string;
}

export interface WorkItemGateway {
  loadWorkItem(workItemId: string): Promise<WorkItem>;
  advanceToStep(workItemId: string, stepKey: string): Promise<WorkItemStateUpdate>;
  rewindToStep(
    workItemId: string,
    stepKey: string,
    reasons: string[],
  ): Promise<WorkItemStateUpdate>;
}

export class WorkItemService implements WorkItemGateway {
  private readonly workItemsDir: string;

  constructor(options: WorkItemServiceOptions) {
    this.workItemsDir = join(options.artifactsDir, 'work-items');
  }

  async loadWorkItem(workItemId: string): Promise<WorkItem> {
    const path = this.workItemPath(workItemId);
    const raw = await readFile(path, 'utf-8');
    const json = JSON.parse(raw) as WorkItemProps;
    return WorkItem.fromJSON(json);
  }

  async advanceToStep(workItemId: string, stepKey: string): Promise<WorkItemStateUpdate> {
    const workItem = await this.loadWorkItem(workItemId);
    const updated = workItem.advanceToStep(stepKey, new Date());
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
    const workItem = await this.loadWorkItem(workItemId);
    const updated = workItem.rewindToStep(stepKey, reasons, new Date());
    await this.persist(updated);
    return {
      workItemId: updated.id,
      currentStepKey: updated.currentStepKey,
      status: updated.status,
    };
  }

  private workItemPath(workItemId: string): string {
    return join(this.workItemsDir, `${workItemId}.json`);
  }

  private async persist(workItem: WorkItem): Promise<void> {
    const path = this.workItemPath(workItem.id);
    await writeFile(path, `${JSON.stringify(workItem.snapshot(), null, 2)}\n`, 'utf-8');
  }
}
