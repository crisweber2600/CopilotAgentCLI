export interface ReadyStepSnapshot {
  key: string;
  order: number;
  parallelizable: boolean;
  notes?: string;
  supportingTasks?: string[];
}

export interface BlockedStepSnapshot {
  key: string;
  blockedBy: string[];
  supportingTasks?: string[];
}

export interface SchedulingDecisionProps {
  workItemId: string;
  generatedAt: string;
  launchOrder: string[];
  readySteps: ReadyStepSnapshot[];
  blockedSteps: BlockedStepSnapshot[];
  rationale?: string;
}

export class SchedulingDecision {
  readonly workItemId: string;
  readonly generatedAt: string;
  readonly launchOrder: string[];
  readonly readySteps: ReadyStepSnapshot[];
  readonly blockedSteps: BlockedStepSnapshot[];
  readonly rationale?: string;

  constructor(props: SchedulingDecisionProps) {
    if (!props.workItemId?.trim()) {
      throw new Error('SchedulingDecision.workItemId is required');
    }
    if (!props.generatedAt?.trim()) {
      throw new Error('SchedulingDecision.generatedAt is required');
    }

    this.workItemId = props.workItemId;
    this.generatedAt = props.generatedAt;
    this.launchOrder = [...props.launchOrder];
    this.readySteps = props.readySteps.map((step) => ({ ...step }));
    this.blockedSteps = props.blockedSteps.map((step) => ({ ...step }));
    this.rationale = props.rationale;
  }

  snapshot(): SchedulingDecisionProps {
    return {
      workItemId: this.workItemId,
      generatedAt: this.generatedAt,
      launchOrder: [...this.launchOrder],
      readySteps: this.readySteps.map((step) => ({ ...step })),
      blockedSteps: this.blockedSteps.map((step) => ({ ...step })),
      rationale: this.rationale,
    };
  }
}
