export interface BaselineIntegrationProps {
  id: string;
  workItemId: string;
  attemptId: string;
  stepKey: string;
  mergedBy: string;
  baseBranch: string;
  at: string;
  relatedArtifacts?: string[];
}

export class BaselineIntegration {
  readonly id: string;

  readonly workItemId: string;

  readonly attemptId: string;

  readonly stepKey: string;

  readonly mergedBy: string;

  readonly baseBranch: string;

  readonly at: string;

  readonly relatedArtifacts: string[];

  constructor(props: BaselineIntegrationProps) {
    if (!props.id) {
      throw new Error('BaselineIntegration.id is required');
    }
    if (!props.workItemId) {
      throw new Error('BaselineIntegration.workItemId is required');
    }
    if (!props.attemptId) {
      throw new Error('BaselineIntegration.attemptId is required');
    }
    if (!props.stepKey) {
      throw new Error('BaselineIntegration.stepKey is required');
    }
    if (!props.mergedBy) {
      throw new Error('BaselineIntegration.mergedBy is required');
    }
    if (!props.baseBranch) {
      throw new Error('BaselineIntegration.baseBranch is required');
    }

    this.id = props.id;
    this.workItemId = props.workItemId;
    this.attemptId = props.attemptId;
    this.stepKey = props.stepKey;
    this.mergedBy = props.mergedBy;
    this.baseBranch = props.baseBranch;
    this.at = props.at;
    this.relatedArtifacts = [...(props.relatedArtifacts ?? [])];
  }

  static fromJSON(json: BaselineIntegrationProps): BaselineIntegration {
    return new BaselineIntegration(json);
  }
}
