export type GateDecision = 'approve' | 'reject';

export interface GateReviewProps {
  id: string;
  workItemId: string;
  stepKey: string;
  gateKey: string;
  decision: GateDecision;
  reasons: string[];
  reviewer: string;
  decidedAt: string;
}

export class GateReview {
  readonly id: string;

  readonly workItemId: string;

  readonly stepKey: string;

  readonly gateKey: string;

  readonly decision: GateDecision;

  readonly reasons: string[];

  readonly reviewer: string;

  readonly decidedAt: string;

  constructor(props: GateReviewProps) {
    if (!props.id) {
      throw new Error('GateReview.id is required');
    }
    if (!props.workItemId) {
      throw new Error('GateReview.workItemId is required');
    }
    if (!props.stepKey) {
      throw new Error('GateReview.stepKey is required');
    }
    if (!props.gateKey) {
      throw new Error('GateReview.gateKey is required');
    }
    if (!props.reviewer) {
      throw new Error('GateReview.reviewer is required');
    }

    this.id = props.id;
    this.workItemId = props.workItemId;
    this.stepKey = props.stepKey;
    this.gateKey = props.gateKey;
    this.decision = props.decision;
    this.reasons = [...props.reasons];
    this.reviewer = props.reviewer;
    this.decidedAt = props.decidedAt;
  }

  static fromJSON(json: GateReviewProps): GateReview {
    return new GateReview(json);
  }

  requiresReentry(): boolean {
    return this.decision === 'reject';
  }
}
