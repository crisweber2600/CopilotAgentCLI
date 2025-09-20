export type AssignmentTerminalState = 'completed' | 'failed' | 'rejected';

export interface AssignmentProps {
  attemptId: string;
  executorId: string;
  claimedAt: string;
  releasedAt?: string;
  terminalState?: AssignmentTerminalState;
  metadata?: Record<string, unknown>;
}

export class Assignment {
  readonly attemptId: string;
  readonly executorId: string;
  readonly claimedAt: string;
  readonly releasedAt?: string;
  readonly terminalState?: AssignmentTerminalState;
  readonly metadata: Record<string, unknown>;

  constructor(props: AssignmentProps) {
    if (!props.attemptId?.trim()) {
      throw new Error('Assignment.attemptId is required');
    }
    if (!props.executorId?.trim()) {
      throw new Error('Assignment.executorId is required');
    }
    if (!props.claimedAt?.trim()) {
      throw new Error('Assignment.claimedAt is required');
    }

    this.attemptId = props.attemptId;
    this.executorId = props.executorId;
    this.claimedAt = props.claimedAt;
    this.releasedAt = props.releasedAt;
    this.terminalState = props.terminalState;
    this.metadata = { ...(props.metadata ?? {}) };
  }

  static fromJSON(json: AssignmentProps): Assignment {
    return new Assignment(json);
  }

  isActive(): boolean {
    return !this.terminalState && !this.releasedAt;
  }

  withTerminalState(state: AssignmentTerminalState, releasedAt: Date): Assignment {
    return new Assignment({
      ...this.snapshot(),
      terminalState: state,
      releasedAt: releasedAt.toISOString(),
    });
  }

  snapshot(): AssignmentProps {
    return {
      attemptId: this.attemptId,
      executorId: this.executorId,
      claimedAt: this.claimedAt,
      releasedAt: this.releasedAt,
      terminalState: this.terminalState,
      metadata: { ...this.metadata },
    };
  }
}
