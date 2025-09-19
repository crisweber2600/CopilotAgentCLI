export interface BlockerProps {
  id: string;
  workItemId: string;
  type: string;
  startAt: string;
  endAt?: string;
  owner?: string;
  notes?: string;
}

export class Blocker {
  readonly id: string;

  readonly workItemId: string;

  readonly type: string;

  readonly startAt: string;

  readonly endAt?: string;

  readonly owner?: string;

  readonly notes?: string;

  constructor(props: BlockerProps) {
    if (!props.id) {
      throw new Error('Blocker.id is required');
    }
    if (!props.workItemId) {
      throw new Error('Blocker.workItemId is required');
    }
    if (!props.type) {
      throw new Error('Blocker.type is required');
    }
    if (!props.startAt) {
      throw new Error('Blocker.startAt is required');
    }

    this.id = props.id;
    this.workItemId = props.workItemId;
    this.type = props.type;
    this.startAt = props.startAt;
    this.endAt = props.endAt;
    this.owner = props.owner;
    this.notes = props.notes;
  }

  static fromJSON(json: BlockerProps): Blocker {
    return new Blocker(json);
  }

  durationMs(reference: Date = new Date()): number {
    const start = Date.parse(this.startAt);
    const end = this.endAt ? Date.parse(this.endAt) : reference.getTime();
    return Math.max(end - start, 0);
  }
}
