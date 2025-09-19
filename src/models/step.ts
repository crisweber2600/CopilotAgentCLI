export interface StepProps {
  key: string;
  order: number;
  parallelizable?: boolean;
  entryCriteria?: string[];
  exitCriteria: string[];
  responsibleRole: string;
  gateKey?: string;
  supportingTasks?: string[];
}

export class Step {
  readonly key: string;

  readonly order: number;

  readonly parallelizable: boolean;

  readonly entryCriteria: string[];

  readonly exitCriteria: string[];

  readonly responsibleRole: string;

  readonly gateKey?: string;

  readonly supportingTasks: string[];

  constructor(props: StepProps) {
    if (!props.key || props.key.trim().length === 0) {
      throw new Error('Step.key must be a non-empty string');
    }
    if (!Number.isInteger(props.order) || props.order < 1) {
      throw new Error(`Step.order must be a positive integer for step ${props.key}`);
    }
    if (!props.exitCriteria || props.exitCriteria.length === 0) {
      throw new Error(`Step.exitCriteria must contain at least one item for step ${props.key}`);
    }
    if (!props.responsibleRole || props.responsibleRole.trim().length === 0) {
      throw new Error(`Step.responsibleRole must be defined for step ${props.key}`);
    }

    this.key = props.key;
    this.order = props.order;
    this.parallelizable = props.parallelizable ?? false;
    this.entryCriteria = [...(props.entryCriteria ?? [])];
    this.exitCriteria = [...props.exitCriteria];
    this.responsibleRole = props.responsibleRole;
    this.gateKey = props.gateKey;
    this.supportingTasks = [...(props.supportingTasks ?? [])];
  }

  static fromJSON(json: StepProps): Step {
    return new Step(json);
  }

  isParallelizable(): boolean {
    return this.parallelizable;
  }

  pendingExitCriteria(completed: string[]): string[] {
    const completedSet = new Set(completed);
    return this.exitCriteria.filter((criterion) => !completedSet.has(criterion));
  }
}
