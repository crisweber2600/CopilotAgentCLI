import { Workflow, type WorkflowProps } from '../models/workflow';
import type { Step } from '../models/step';
import {
  SchedulingDecision,
  type ReadyStepSnapshot,
  type BlockedStepSnapshot,
} from '../models/scheduling_decision';

export interface SchedulingInput {
  workflow: Workflow | WorkflowProps;
  workItem: { id: string; currentStepKey?: string };
  completedSteps: string[];
  now?: Date;
}

export class SchedulingService {
  async generateSchedule(input: SchedulingInput): Promise<SchedulingDecision> {
    const workflow = this.normalizeWorkflow(input.workflow);
    const completed = new Set(input.completedSteps);
    const generatedAt = (input.now ?? new Date()).toISOString();
    const launchOrder = workflow.steps.map((step) => step.key);

    const pendingSteps = workflow.steps.filter((step) => !completed.has(step.key));
    if (pendingSteps.length === 0) {
      return new SchedulingDecision({
        workItemId: input.workItem.id,
        generatedAt,
        launchOrder,
        readySteps: [],
        blockedSteps: [],
        rationale: 'All steps complete',
      });
    }

    const lowestOrder = Math.min(...pendingSteps.map((step) => step.order));
    const candidates = pendingSteps
      .filter((step) => step.order === lowestOrder)
      .sort((a, b) => a.key.localeCompare(b.key));

    const readySteps = this.computeReadySteps(candidates);
    const blockedSteps = this.computeBlockedSteps(
      workflow.steps,
      completed,
      candidates,
      readySteps,
    );

    return new SchedulingDecision({
      workItemId: input.workItem.id,
      generatedAt,
      launchOrder,
      readySteps,
      blockedSteps,
      rationale: this.buildRationale(readySteps, blockedSteps),
    });
  }

  private normalizeWorkflow(workflow: Workflow | WorkflowProps): Workflow {
    return workflow instanceof Workflow ? workflow : Workflow.fromDefinition(workflow);
  }

  private computeReadySteps(candidates: Step[]): ReadyStepSnapshot[] {
    if (candidates.length === 0) {
      return [];
    }

    const sequential = candidates.find((step) => !step.parallelizable);
    if (sequential) {
      return [this.snapshotStep(sequential, 'Sequential step executes first')];
    }

    return candidates.map((step, index) =>
      this.snapshotStep(step, index === 0 ? 'Parallel branch leader' : 'Parallel branch'),
    );
  }

  private snapshotStep(step: Step, notes?: string): ReadyStepSnapshot {
    return {
      key: step.key,
      order: step.order,
      parallelizable: step.parallelizable,
      supportingTasks: step.supportingTasks,
      notes,
    };
  }

  private computeBlockedSteps(
    steps: Step[],
    completed: Set<string>,
    candidates: Step[],
    readySteps: ReadyStepSnapshot[],
  ): BlockedStepSnapshot[] {
    const readyKeys = new Set(readySteps.map((step) => step.key));
    const lowestOrder = candidates.length > 0 ? candidates[0].order : Number.POSITIVE_INFINITY;

    const blocked: BlockedStepSnapshot[] = [];
    for (const step of steps) {
      if (completed.has(step.key) || readyKeys.has(step.key)) {
        continue;
      }

      const blockers = steps
        .filter((other) => other.order < step.order && !completed.has(other.key))
        .map((other) => other.key);

      if (step.order === lowestOrder && !step.parallelizable && !readyKeys.has(step.key)) {
        blockers.push(...readySteps.map((ready) => ready.key));
      } else if (step.order === lowestOrder && !readyKeys.has(step.key)) {
        blockers.push(...readySteps.map((ready) => ready.key));
      }

      if (blockers.length === 0 && step.order > lowestOrder) {
        blockers.push(...candidates.map((candidate) => candidate.key));
      }

      blocked.push({
        key: step.key,
        blockedBy: Array.from(new Set(blockers)),
        supportingTasks: step.supportingTasks,
      });
    }

    return blocked.sort((a, b) => {
      const orderA = steps.find((step) => step.key === a.key)?.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = steps.find((step) => step.key === b.key)?.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA === orderB) {
        return a.key.localeCompare(b.key);
      }
      return orderA - orderB;
    });
  }

  private buildRationale(
    readySteps: ReadyStepSnapshot[],
    blockedSteps: BlockedStepSnapshot[],
  ): string {
    const ready = readySteps.map((step) => step.key).join(', ') || 'none';
    const blocked = blockedSteps.map((step) => step.key).join(', ') || 'none';
    return `Ready: ${ready}; Blocked: ${blocked}`;
  }
}
