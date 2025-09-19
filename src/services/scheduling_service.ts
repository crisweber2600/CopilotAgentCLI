import { Workflow, type WorkflowProps } from '../models/workflow';
import type { Step } from '../models/step';
import {
  SchedulingDecision,
  type ReadyStepSnapshot,
  type BlockedStepSnapshot,
} from '../models/scheduling_decision';
import { logger } from '../lib/logger';

export interface SchedulingInput {
  workflow: Workflow | WorkflowProps;
  workItem: { id: string; currentStepKey?: string; remainingTasks?: string[] };
  completedSteps: string[];
  now?: Date;
}

export class SchedulingService {
  async generateSchedule(input: SchedulingInput): Promise<SchedulingDecision> {
    const workflow = this.resolveWorkflow(input.workflow);
    const completedSet = new Set(input.completedSteps);
    const generatedAt = (input.now ?? new Date()).toISOString();

    const incompleteSteps = workflow.steps.filter((step) => !completedSet.has(step.key));
    const launchOrder = workflow.steps.map((step) => step.key);

    if (incompleteSteps.length === 0) {
      return new SchedulingDecision({
        workItemId: input.workItem.id,
        generatedAt,
        launchOrder,
        readySteps: [],
        blockedSteps: [],
        rationale: 'All steps complete',
      });
    }

    const minimalOrder = Math.min(...incompleteSteps.map((step) => step.order));
    const candidateSteps = incompleteSteps
      .filter((step) => step.order === minimalOrder)
      .sort((a, b) => a.key.localeCompare(b.key));

    const readySteps = this.computeReadySteps(candidateSteps);
    const blockedSteps = this.computeBlockedSteps(
      workflow.steps,
      completedSet,
      candidateSteps,
      readySteps,
    );

    const decision = new SchedulingDecision({
      workItemId: input.workItem.id,
      generatedAt,
      launchOrder,
      readySteps,
      blockedSteps,
      rationale: this.buildRationale(readySteps, blockedSteps),
    });

    logger.info('Schedule generated', {
      workItemId: input.workItem.id,
      readySteps: readySteps.map((step) => step.key),
      blockedSteps: blockedSteps.map((step) => step.key),
    });

    return decision;
  }

  private resolveWorkflow(workflow: Workflow | WorkflowProps): Workflow {
    return workflow instanceof Workflow ? workflow : Workflow.fromDefinition(workflow);
  }

  private computeReadySteps(candidateSteps: Step[]): ReadyStepSnapshot[] {
    if (candidateSteps.length === 0) {
      return [];
    }

    const hasSequential = candidateSteps.some((step) => !step.parallelizable);
    if (hasSequential) {
      const primary = candidateSteps.find((step) => !step.parallelizable) ?? candidateSteps[0];
      return [this.snapshotStep(primary, 'First sequential step in launch order')];
    }

    return candidateSteps.map((step, index) =>
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
    candidateSteps: Step[],
    readySteps: ReadyStepSnapshot[],
  ): BlockedStepSnapshot[] {
    const readyKeys = new Set(readySteps.map((step) => step.key));
    const minimalOrder =
      candidateSteps.length > 0 ? candidateSteps[0].order : Number.POSITIVE_INFINITY;

    const blocked: BlockedStepSnapshot[] = [];

    for (const step of steps) {
      if (completed.has(step.key) || readyKeys.has(step.key)) {
        continue;
      }

      const blockers = steps
        .filter((other) => other.order < step.order && !completed.has(other.key))
        .map((other) => other.key);

      if (step.order === minimalOrder && !step.parallelizable) {
        // Sequential peer blocked by primary sequential step.
        blockers.push(...readySteps.map((ready) => ready.key));
      } else if (step.order === minimalOrder && !readyKeys.has(step.key)) {
        blockers.push(...readySteps.map((ready) => ready.key));
      }

      if (blockers.length === 0 && step.order > minimalOrder) {
        blockers.push(...candidateSteps.map((cand) => cand.key));
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
