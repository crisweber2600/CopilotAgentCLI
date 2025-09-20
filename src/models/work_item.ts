export type WorkItemStatus = 'queued' | 'in-progress' | 'completed' | 'blocked' | 'rework';

export interface WorkItemLink {
  rel: string;
  href: string;
}

export interface WorkItemProps {
  id: string;
  workflowId: string;
  status: WorkItemStatus;
  currentStepKey: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  links?: WorkItemLink[];
  metadata?: Record<string, unknown>;
}

export class WorkItem {
  readonly id: string;
  readonly workflowId: string;
  readonly status: WorkItemStatus;
  readonly currentStepKey: string;
  readonly owner: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly links: WorkItemLink[];
  readonly metadata: Record<string, unknown>;

  constructor(props: WorkItemProps) {
    if (!props.id?.trim()) {
      throw new Error('WorkItem.id is required');
    }
    if (!props.workflowId?.trim()) {
      throw new Error(`WorkItem.workflowId is required for ${props.id}`);
    }
    if (!props.currentStepKey?.trim()) {
      throw new Error(`WorkItem.currentStepKey is required for ${props.id}`);
    }
    if (!props.owner?.trim()) {
      throw new Error(`WorkItem.owner is required for ${props.id}`);
    }

    this.id = props.id;
    this.workflowId = props.workflowId;
    this.status = props.status;
    this.currentStepKey = props.currentStepKey;
    this.owner = props.owner;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.links = [...(props.links ?? [])];
    this.metadata = { ...(props.metadata ?? {}) };
  }

  static fromJSON(json: WorkItemProps): WorkItem {
    return new WorkItem(json);
  }

  advanceToStep(stepKey: string, updatedAt: Date): WorkItem {
    return new WorkItem({
      ...this.snapshot(),
      status: 'in-progress',
      currentStepKey: stepKey,
      updatedAt: updatedAt.toISOString(),
    });
  }

  rewindToStep(stepKey: string, reasons: string[], updatedAt: Date): WorkItem {
    const metadata = {
      ...this.metadata,
      lastReworkReasons: reasons,
    };
    return new WorkItem({
      ...this.snapshot(),
      status: 'rework',
      currentStepKey: stepKey,
      updatedAt: updatedAt.toISOString(),
      metadata,
    });
  }

  withStatus(status: WorkItemStatus, updatedAt: Date): WorkItem {
    return new WorkItem({
      ...this.snapshot(),
      status,
      updatedAt: updatedAt.toISOString(),
    });
  }

  snapshot(): WorkItemProps {
    return {
      id: this.id,
      workflowId: this.workflowId,
      status: this.status,
      currentStepKey: this.currentStepKey,
      owner: this.owner,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      links: this.links.map((link) => ({ ...link })),
      metadata: { ...this.metadata },
    };
  }
}
