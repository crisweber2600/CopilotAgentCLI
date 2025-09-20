export interface ExecutorProps {
  id: string;
  name: string;
  capacity?: number;
  metadata?: Record<string, unknown>;
}

export class Executor {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
  readonly metadata: Record<string, unknown>;

  constructor(props: ExecutorProps) {
    if (!props.id?.trim()) {
      throw new Error('Executor.id is required');
    }
    if (!props.name?.trim()) {
      throw new Error('Executor.name is required');
    }

    this.id = props.id;
    this.name = props.name;
    this.capacity = props.capacity ?? 1;
    this.metadata = { ...(props.metadata ?? {}) };
  }

  static fromJSON(json: ExecutorProps): Executor {
    return new Executor(json);
  }

  isAvailable(activeAssignments: number): boolean {
    return activeAssignments < this.capacity;
  }
}
