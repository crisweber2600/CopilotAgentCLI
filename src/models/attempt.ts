export type AttemptStatus = 'queued' | 'running' | 'completed' | 'rejected' | 'failed' | 'rework';

export interface AttemptProps {
  attemptId: string;
  workItemId: string;
  stepKey: string;
  status: AttemptStatus;
  startAt?: string;
  endAt?: string;
  artifactLinks?: string[];
  retryOf?: string;
}

export class Attempt {
  readonly attemptId: string;

  readonly workItemId: string;

  readonly stepKey: string;

  readonly status: AttemptStatus;

  readonly startAt?: string;

  readonly endAt?: string;

  readonly artifactLinks: string[];

  readonly retryOf?: string;

  constructor(props: AttemptProps) {
    if (!props.attemptId) {
      throw new Error('Attempt.attemptId is required');
    }
    if (!props.workItemId) {
      throw new Error(`Attempt.workItemId is required for attempt ${props.attemptId}`);
    }
    if (!props.stepKey) {
      throw new Error(`Attempt.stepKey is required for attempt ${props.attemptId}`);
    }

    this.attemptId = props.attemptId;
    this.workItemId = props.workItemId;
    this.stepKey = props.stepKey;
    this.status = props.status;
    this.startAt = props.startAt;
    this.endAt = props.endAt;
    this.artifactLinks = [...(props.artifactLinks ?? [])];
    this.retryOf = props.retryOf;
  }

  static fromJSON(json: AttemptProps): Attempt {
    return new Attempt(json);
  }

  isTerminal(): boolean {
    return ['completed', 'rejected', 'failed'].includes(this.status);
  }

  markRunning(startAt: Date): Attempt {
    return new Attempt({
      ...this.snapshot(),
      status: 'running',
      startAt: startAt.toISOString(),
    });
  }

  markCompleted(endAt: Date, artifactLinks: string[]): Attempt {
    return new Attempt({
      ...this.snapshot(),
      status: 'completed',
      endAt: endAt.toISOString(),
      artifactLinks,
    });
  }

  markFailed(endAt: Date, outcome: 'failed' | 'rejected' | 'rework'): Attempt {
    return new Attempt({
      ...this.snapshot(),
      status: outcome,
      endAt: endAt.toISOString(),
    });
  }

  createRetry(newAttemptId: string): Attempt {
    return new Attempt({
      attemptId: newAttemptId,
      workItemId: this.workItemId,
      stepKey: this.stepKey,
      status: 'queued',
      retryOf: this.attemptId,
    });
  }

  snapshot(): AttemptProps {
    return {
      attemptId: this.attemptId,
      workItemId: this.workItemId,
      stepKey: this.stepKey,
      status: this.status,
      startAt: this.startAt,
      endAt: this.endAt,
      artifactLinks: [...this.artifactLinks],
      retryOf: this.retryOf,
    };
  }
}
