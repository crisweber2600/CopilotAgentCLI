/**
 * Task Specification Interfaces for Agent-Swarmable Framework
 * 
 * This module defines TypeScript interfaces for NDJSON task specifications
 * used in the agent-swarmable framework for parallel task execution.
 */

/**
 * Status of a task claim
 */
export type TaskClaimStatus = 
  | 'open'        // Task is available for claiming
  | 'claimed'     // Task has been claimed but work hasn't started
  | 'in_progress' // Agent is actively working on the task
  | 'blocked'     // Task is blocked waiting for external dependencies
  | 'done'        // Task has been completed successfully
  | 'abandoned';  // Task was abandoned by the agent

/**
 * Retry backoff strategy
 */
export type RetryBackoffStrategy = 'linear' | 'exponential';

/**
 * Task claiming and lease management metadata
 */
export interface TaskClaim {
  /** Current status of the task claim */
  status: TaskClaimStatus;
  
  /** Agent identifier that has claimed this task (null if unclaimed) */
  by: string | null;
  
  /** ISO timestamp when the claim was last updated */
  since: string;
  
  /** Number of minutes the lease is valid for */
  lease_minutes: number;
  
  /** Number of minutes between required heartbeat updates */
  heartbeat_minutes: number;
}

/**
 * Retry policy for failed task attempts
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts allowed */
  max_retries: number;
  
  /** Backoff strategy for retries */
  backoff: RetryBackoffStrategy;
  
  /** Base delay in seconds for retry backoff calculation */
  base_seconds: number;
}

/**
 * Pull request configuration for a task
 */
export interface TaskPullRequest {
  /** Pull request title (must start with [T###]) */
  title: string;
  
  /** Base branch for the pull request */
  base: string;
  
  /** Head branch for the pull request */
  head: string;
  
  /** Array of labels to apply to the pull request */
  labels: string[];
  
  /** Whether the pull request should be created as a draft */
  draft: boolean;
}

/**
 * Complete task specification following NDJSON schema
 */
export interface TaskSpec {
  /** Unique task identifier in format T### (e.g., T001) */
  id: string;
  
  /** Human-readable task name */
  name: string;
  
  /** Detailed task description explaining what needs to be done */
  description: string;
  
  /** Array of task IDs that must be completed before this task can start */
  requires: string[];
  
  /** Optional group name for tasks that can run in parallel */
  parallel_group?: string | null;
  
  /** Array of file paths that this task requires as input */
  inputs: string[];
  
  /** Array of file paths that this task will produce as output */
  outputs: string[];
  
  /** Git branch name for this task (feat/<feature-slug>__T###) */
  branch: string;
  
  /** Base branch that this task branch should be created from */
  base_branch: string;
  
  /** Task claiming and lease management metadata */
  claim: TaskClaim;
  
  /** Unique key for preventing concurrent access to this task */
  concurrency_key: string;
  
  /** Retry policy for failed task attempts */
  retry_policy: RetryPolicy;
  
  /** Array of completion criteria that must be satisfied */
  done_when: string[];
  
  /** Pull request configuration for this task */
  pr: TaskPullRequest;
}

/**
 * Task graph phase
 */
export type TaskPhase = 'spec' | 'impl' | 'test' | 'verify' | 'polish';

/**
 * Parallel execution group definition
 */
export interface ParallelGroup {
  /** Description of what tasks in this group do */
  description: string;
  
  /** Phase this group belongs to */
  phase: TaskPhase;
}

/**
 * Task definition in the graph
 */
export interface TaskGraphNode {
  /** Task ID */
  id: string;
  
  /** Task name */
  name: string;
  
  /** Phase this task belongs to */
  phase: TaskPhase;
  
  /** Parallel group (optional) */
  parallel_group?: string;
  
  /** Estimated time in minutes */
  estimated_minutes: number;
  
  /** Required task IDs */
  requires?: string[];
  
  /** Output files */
  outputs: string[];
  
  /** Merge base branch */
  merge_base: string;
}

/**
 * Complete task graph definition
 */
export interface TaskGraph {
  /** Feature name */
  feature_name: string;
  
  /** Base branch for the feature */
  base_branch: string;
  
  /** Creation timestamp */
  created_at: string;
  
  /** Last update timestamp */
  updated_at: string;
  
  /** Available execution phases */
  phases: TaskPhase[];
  
  /** Parallel execution groups */
  parallel_groups: Record<string, ParallelGroup>;
  
  /** Task definitions */
  tasks: TaskGraphNode[];
  
  /** Validation rules */
  validation: { rule: string }[];
}

/**
 * Task validation result
 */
export interface TaskValidationResult {
  /** Whether the task is valid */
  valid: boolean;
  
  /** Validation error messages */
  errors: string[];
  
  /** Validation warnings */
  warnings: string[];
}

/**
 * Task dependency resolution result
 */
export interface DependencyResolution {
  /** Tasks in topological order */
  sorted_tasks: string[];
  
  /** Circular dependencies detected */
  circular_dependencies: string[][];
  
  /** Tasks ready for execution */
  ready_tasks: string[];
  
  /** Tasks blocked by dependencies */
  blocked_tasks: Record<string, string[]>;
}