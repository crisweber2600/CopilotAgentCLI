/**
 * Agent Contract Type Definitions
 * 
 * This module defines the contract that agents must follow when operating
 * in the swarmable task framework, including claiming protocols, heartbeat
 * requirements, and lifecycle management.
 */

import type { TaskSpec, TaskClaimStatus, TaskValidationResult } from '../models/taskSpec';

/**
 * Agent identification and metadata
 */
export interface AgentIdentity {
  /** Unique agent identifier */
  id: string;
  
  /** Agent display name */
  name: string;
  
  /** Agent version */
  version: string;
  
  /** Agent capabilities */
  capabilities: string[];
  
  /** Maximum number of concurrent tasks this agent can handle */
  max_concurrent_tasks: number;
}

/**
 * Task claiming operation result
 */
export interface ClaimResult {
  /** Whether the claim was successful */
  success: boolean;
  
  /** Error message if claim failed */
  error?: string;
  
  /** The claimed task (if successful) */
  task?: TaskSpec;
  
  /** Lease expiration timestamp */
  lease_expires_at?: string;
}

/**
 * Heartbeat update result
 */
export interface HeartbeatResult {
  /** Whether the heartbeat was successful */
  success: boolean;
  
  /** Error message if heartbeat failed */
  error?: string;
  
  /** New lease expiration timestamp */
  lease_expires_at?: string;
}

/**
 * Task release result
 */
export interface ReleaseResult {
  /** Whether the release was successful */
  success: boolean;
  
  /** Error message if release failed */
  error?: string;
  
  /** Reason for release */
  reason?: string;
}

/**
 * Task completion result
 */
export interface CompletionResult {
  /** Whether the completion was successful */
  success: boolean;
  
  /** Error message if completion failed */
  error?: string;
  
  /** Validation results for completion criteria */
  validation?: TaskValidationResult;
  
  /** URLs or paths to produced artifacts */
  artifacts?: string[];
}

/**
 * Agent status information
 */
export interface AgentStatus {
  /** Agent identity */
  identity: AgentIdentity;
  
  /** Currently claimed tasks */
  claimed_tasks: string[];
  
  /** Tasks in progress */
  in_progress_tasks: string[];
  
  /** Last heartbeat timestamp */
  last_heartbeat: string;
  
  /** Agent health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Additional status details */
  details?: Record<string, any>;
}

/**
 * Task claiming options
 */
export interface ClaimOptions {
  /** Agent identity */
  agent: AgentIdentity;
  
  /** Task ID to claim */
  task_id: string;
  
  /** Override default lease duration (minutes) */
  lease_minutes?: number;
  
  /** Override default heartbeat interval (minutes) */
  heartbeat_minutes?: number;
  
  /** Force claim even if dependencies aren't met (dangerous) */
  force?: boolean;
}

/**
 * Task update options
 */
export interface TaskUpdateOptions {
  /** New status for the task */
  status?: TaskClaimStatus;
  
  /** Progress notes or status message */
  notes?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent contract enforcement rules
 */
export interface ContractRules {
  /** Require atomic claiming */
  atomic_claiming: boolean;
  
  /** Enforce heartbeat maintenance */
  enforce_heartbeats: boolean;
  
  /** Verify dependencies before claiming */
  verify_dependencies: boolean;
  
  /** Require branch management compliance */
  enforce_branch_management: boolean;
  
  /** Require incremental commits */
  require_incremental_commits: boolean;
  
  /** Validate completion criteria */
  validate_completion: boolean;
  
  /** Allow self-merge of PRs */
  allow_self_merge: boolean;
}

/**
 * Agent operation context
 */
export interface AgentContext {
  /** Working directory */
  cwd: string;
  
  /** Git repository information */
  repository: {
    remote_url: string;
    default_branch: string;
    current_branch: string;
  };
  
  /** Environment variables */
  env: Record<string, string>;
  
  /** Configuration settings */
  config: Record<string, any>;
}

/**
 * Task lifecycle event
 */
export interface TaskLifecycleEvent {
  /** Event type */
  type: 'claimed' | 'started' | 'progress' | 'blocked' | 'completed' | 'abandoned' | 'failed';
  
  /** Task ID */
  task_id: string;
  
  /** Agent ID */
  agent_id: string;
  
  /** Event timestamp */
  timestamp: string;
  
  /** Event details */
  details: Record<string, any>;
  
  /** Previous status */
  previous_status?: TaskClaimStatus;
  
  /** New status */
  new_status?: TaskClaimStatus;
}

/**
 * Agent contract interface that all agents must implement
 */
export interface AgentContract {
  /**
   * Get agent identity information
   */
  getIdentity(): AgentIdentity;
  
  /**
   * Attempt to claim a task
   */
  claimTask(options: ClaimOptions): Promise<ClaimResult>;
  
  /**
   * Send heartbeat to maintain lease
   */
  heartbeat(task_id: string): Promise<HeartbeatResult>;
  
  /**
   * Release a claimed task
   */
  releaseTask(task_id: string, reason?: string): Promise<ReleaseResult>;
  
  /**
   * Mark a task as completed
   */
  completeTask(task_id: string): Promise<CompletionResult>;
  
  /**
   * Update task status and metadata
   */
  updateTask(task_id: string, updates: TaskUpdateOptions): Promise<boolean>;
  
  /**
   * Get current agent status
   */
  getStatus(): Promise<AgentStatus>;
  
  /**
   * Validate that an agent can claim a task
   */
  canClaimTask(task_id: string): Promise<TaskValidationResult>;
  
  /**
   * Get tasks ready for claiming by this agent
   */
  getAvailableTasks(): Promise<TaskSpec[]>;
  
  /**
   * Subscribe to task lifecycle events
   */
  onTaskEvent(callback: (event: TaskLifecycleEvent) => void): void;
}

/**
 * Agent factory interface for creating agent instances
 */
export interface AgentFactory {
  /**
   * Create a new agent instance
   */
  createAgent(context: AgentContext): AgentContract;
  
  /**
   * Validate agent configuration
   */
  validateConfig(config: Record<string, any>): TaskValidationResult;
  
  /**
   * Get supported agent capabilities
   */
  getSupportedCapabilities(): string[];
}

/**
 * Contract enforcement service interface
 */
export interface ContractEnforcer {
  /**
   * Enforce contract rules for an operation
   */
  enforce(operation: string, context: AgentContext, data: any): Promise<TaskValidationResult>;
  
  /**
   * Get current contract rules
   */
  getRules(): ContractRules;
  
  /**
   * Update contract rules
   */
  setRules(rules: Partial<ContractRules>): void;
  
  /**
   * Validate agent compliance
   */
  validateCompliance(agent_id: string): Promise<TaskValidationResult>;
}