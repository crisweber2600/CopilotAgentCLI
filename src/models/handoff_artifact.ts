export type HandoffEventType =
  | 'attempt-started'
  | 'attempt-completed'
  | 'attempt-failed'
  | 'attempt-rejected'
  | 'gate-approved'
  | 'gate-rejected'
  | 'baseline-integration';

export type BaselineIntegrationFlag = 'pre' | 'post';

export interface HandoffArtifactProps {
  workItemId: string;
  workflow: { name: string; version: string };
  step: { key: string; order: number };
  eventType: HandoffEventType;
  attemptId: string;
  timestamp: string;
  actor: string;
  outcome: string;
  nextAction: string;
  baselineIntegration: BaselineIntegrationFlag;
  links: string[];
  schemaVersion?: string;
}

export class HandoffArtifact {
  readonly workItemId: string;
  readonly workflow: { name: string; version: string };
  readonly step: { key: string; order: number };
  readonly eventType: HandoffEventType;
  readonly attemptId: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly outcome: string;
  readonly nextAction: string;
  readonly baselineIntegration: BaselineIntegrationFlag;
  readonly links: string[];
  readonly schemaVersion: string;

  constructor(props: HandoffArtifactProps) {
    if (!props.workItemId?.trim()) {
      throw new Error('HandoffArtifact.workItemId is required');
    }
    if (!props.workflow?.name || !props.workflow?.version) {
      throw new Error('HandoffArtifact.workflow name and version are required');
    }
    if (!props.step?.key || typeof props.step.order !== 'number') {
      throw new Error('HandoffArtifact.step key and order are required');
    }
    if (!props.attemptId?.trim()) {
      throw new Error('HandoffArtifact.attemptId is required');
    }
    if (!props.actor?.trim()) {
      throw new Error('HandoffArtifact.actor is required');
    }

    this.workItemId = props.workItemId;
    this.workflow = { ...props.workflow };
    this.step = { ...props.step };
    this.eventType = props.eventType;
    this.attemptId = props.attemptId;
    this.timestamp = props.timestamp;
    this.actor = props.actor;
    this.outcome = props.outcome;
    this.nextAction = props.nextAction;
    this.baselineIntegration = props.baselineIntegration;
    this.links = [...props.links];
    this.schemaVersion = props.schemaVersion ?? '1.0';
  }

  static fromJSON(json: HandoffArtifactProps): HandoffArtifact {
    return new HandoffArtifact(json);
  }

  isBaselineIntegrated(): boolean {
    return this.baselineIntegration === 'post' && this.eventType === 'baseline-integration';
  }
}
