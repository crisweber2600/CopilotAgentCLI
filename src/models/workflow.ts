import { Step, type StepProps } from './step';

export interface WorkflowProps {
  id: string;
  name: string;
  version: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  steps: StepProps[];
  schemaVersion?: string;
}

export class Workflow {
  readonly id: string;

  readonly name: string;

  readonly version: string;

  readonly effectiveFrom?: string;

  readonly effectiveTo?: string;

  readonly steps: Step[];

  readonly schemaVersion?: string;

  private readonly stepIndex: Map<string, Step>;

  constructor(props: WorkflowProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Workflow.id must be a non-empty string');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Workflow.name must be a non-empty string');
    }
    if (!props.version || props.version.trim().length === 0) {
      throw new Error('Workflow.version must be a non-empty string');
    }
    if (!props.steps || props.steps.length === 0) {
      throw new Error('Workflow.steps must contain at least one step');
    }

    const steps = props.steps.map((step) => Step.fromJSON(step));
    const sortedSteps = [...steps].sort((a, b) => {
      if (a.order === b.order) {
        return a.key.localeCompare(b.key);
      }
      return a.order - b.order;
    });

    this.ensureOrdersAreMonotonic(sortedSteps);
    this.ensureUniqueStepKeys(sortedSteps);

    this.id = props.id;
    this.name = props.name;
    this.version = props.version;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveTo = props.effectiveTo;
    this.steps = sortedSteps;
    this.schemaVersion = props.schemaVersion;
    this.stepIndex = new Map(sortedSteps.map((step) => [step.key, step]));
  }

  static fromDefinition(definition: WorkflowProps): Workflow {
    return new Workflow(definition);
  }

  getStep(stepKey: string): Step {
    const step = this.stepIndex.get(stepKey);
    if (!step) {
      throw new Error(`Unknown step key ${stepKey} in workflow ${this.id}`);
    }
    return step;
  }

  listParallelizableSteps(): Step[] {
    return this.steps.filter((step) => step.isParallelizable());
  }

  snapshot(): WorkflowProps {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      effectiveFrom: this.effectiveFrom,
      effectiveTo: this.effectiveTo,
      steps: this.steps.map((step) => ({
        key: step.key,
        order: step.order,
        parallelizable: step.parallelizable,
        entryCriteria: [...step.entryCriteria],
        exitCriteria: [...step.exitCriteria],
        responsibleRole: step.responsibleRole,
        gateKey: step.gateKey,
        supportingTasks: [...step.supportingTasks],
      })),
      schemaVersion: this.schemaVersion,
    };
  }

  private ensureOrdersAreMonotonic(steps: Step[]): void {
    for (let index = 1; index < steps.length; index += 1) {
      const previous = steps[index - 1];
      const current = steps[index];
      if (current.order < previous.order) {
        throw new Error(
          `Workflow steps must be ordered ascending; ${current.key} has order ${current.order} while ${previous.key} has order ${previous.order}`,
        );
      }
    }
  }

  private ensureUniqueStepKeys(steps: Step[]): void {
    const seen = new Set<string>();
    for (const step of steps) {
      if (seen.has(step.key)) {
        throw new Error(`Duplicate step key ${step.key} detected in workflow ${this.id}`);
      }
      seen.add(step.key);
    }
  }
}
