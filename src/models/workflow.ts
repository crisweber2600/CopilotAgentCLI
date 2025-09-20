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
    if (!props.id?.trim()) {
      throw new Error('Workflow.id must be provided');
    }
    if (!props.name?.trim()) {
      throw new Error('Workflow.name must be provided');
    }
    if (!props.version?.trim()) {
      throw new Error('Workflow.version must be provided');
    }
    if (!props.steps?.length) {
      throw new Error('Workflow.steps must include at least one step');
    }

    const steps = props.steps.map((step) => Step.fromJSON(step));
    const sorted = [...steps].sort((a, b) =>
      a.order === b.order ? a.key.localeCompare(b.key) : a.order - b.order,
    );

    this.ensureMonotonicOrder(sorted);
    this.ensureUniqueKeys(sorted);

    this.id = props.id;
    this.name = props.name;
    this.version = props.version;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveTo = props.effectiveTo;
    this.steps = sorted;
    this.schemaVersion = props.schemaVersion;
    this.stepIndex = new Map(sorted.map((step) => [step.key, step]));
  }

  static fromDefinition(props: WorkflowProps): Workflow {
    return new Workflow(props);
  }

  getStep(key: string): Step {
    const step = this.stepIndex.get(key);
    if (!step) {
      throw new Error(`Unknown step ${key} in workflow ${this.id}`);
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

  private ensureMonotonicOrder(steps: Step[]): void {
    for (let index = 1; index < steps.length; index += 1) {
      const previous = steps[index - 1];
      const current = steps[index];
      if (current.order < previous.order) {
        throw new Error(
          `Workflow steps must be ordered ascending; ${current.key} (${current.order}) precedes ${previous.key} (${previous.order}).`,
        );
      }
    }
  }

  private ensureUniqueKeys(steps: Step[]): void {
    const seen = new Set<string>();
    for (const step of steps) {
      if (seen.has(step.key)) {
        throw new Error(`Duplicate step key ${step.key} detected in workflow ${this.id}`);
      }
      seen.add(step.key);
    }
  }
}
