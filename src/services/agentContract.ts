/**
 * Agent Contract Service
 * 
 * This service enforces the agent contract rules and manages task claiming,
 * heartbeat maintenance, and lifecycle management for the swarmable framework.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { 
  TaskSpec, 
  TaskValidationResult,
  TaskClaimStatus 
} from '../models/taskSpec';
import type {
  AgentContract,
  AgentIdentity,
  ClaimOptions,
  ClaimResult,
  HeartbeatResult,
  ReleaseResult,
  CompletionResult,
  TaskUpdateOptions,
  AgentStatus,
  ContractRules,
  TaskLifecycleEvent,
  AgentContext
} from '../types/agentContract';
import { TaskParser } from './taskParser';

/**
 * Agent contract service options
 */
export interface AgentContractServiceOptions {
  /** Base directory for agent framework data */
  baseDirectory: string;
  
  /** Task parser instance */
  taskParser: TaskParser;
  
  /** Contract enforcement rules */
  rules: ContractRules;
  
  /** Agent context */
  context: AgentContext;
}

/**
 * Claim lease metadata stored on disk
 */
interface ClaimLease {
  /** Task ID */
  task_id: string;
  
  /** Agent ID that claimed the task */
  agent_id: string;
  
  /** Claim timestamp */
  claimed_at: string;
  
  /** Last heartbeat timestamp */
  last_heartbeat: string;
  
  /** Lease expiration timestamp */
  expires_at: string;
  
  /** Lease duration in minutes */
  lease_minutes: number;
  
  /** Heartbeat interval in minutes */
  heartbeat_minutes: number;
  
  /** Current status */
  status: TaskClaimStatus;
  
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Agent contract implementation
 */
export class AgentContractService implements AgentContract {
  private options: AgentContractServiceOptions;
  private identity: AgentIdentity;
  private eventCallbacks: Array<(event: TaskLifecycleEvent) => void> = [];
  private claimsDirectory: string;
  private logsDirectory: string;
  
  constructor(options: AgentContractServiceOptions, identity: AgentIdentity) {
    this.options = options;
    this.identity = identity;
    this.claimsDirectory = join(options.baseDirectory, 'claims');
    this.logsDirectory = join(options.baseDirectory, 'logs');
    
    this.ensureDirectories();
  }
  
  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.claimsDirectory, { recursive: true });
    await fs.mkdir(this.logsDirectory, { recursive: true });
  }
  
  /**
   * Get the claim file path for a task
   */
  private getClaimFilePath(taskId: string): string {
    return join(this.claimsDirectory, `${taskId}.json`);
  }
  
  /**
   * Load existing claim lease for a task
   */
  private async loadClaimLease(taskId: string): Promise<ClaimLease | null> {
    const claimFile = this.getClaimFilePath(taskId);
    
    try {
      const content = await fs.readFile(claimFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to load claim lease: ${(error as Error).message}`);
    }
  }
  
  /**
   * Save claim lease to disk
   */
  private async saveClaimLease(lease: ClaimLease): Promise<void> {
    const claimFile = this.getClaimFilePath(lease.task_id);
    await fs.writeFile(claimFile, JSON.stringify(lease, null, 2), 'utf-8');
  }
  
  /**
   * Remove claim lease from disk
   */
  private async removeClaimLease(taskId: string): Promise<void> {
    const claimFile = this.getClaimFilePath(taskId);
    
    try {
      await fs.unlink(claimFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  
  /**
   * Check if a lease has expired
   */
  private isLeaseExpired(lease: ClaimLease): boolean {
    const now = new Date();
    const expiresAt = new Date(lease.expires_at);
    return now > expiresAt;
  }
  
  /**
   * Calculate lease expiration time
   */
  private calculateLeaseExpiration(leaseMinutes: number): string {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (leaseMinutes * 60 * 1000));
    return expiresAt.toISOString();
  }
  
  /**
   * Emit a task lifecycle event
   */
  private async emitEvent(event: Omit<TaskLifecycleEvent, 'timestamp'>): Promise<void> {
    const fullEvent: TaskLifecycleEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    
    // Log the event
    const logFile = join(this.logsDirectory, `${event.task_id}.log`);
    const logEntry = `${fullEvent.timestamp} ${fullEvent.type} ${JSON.stringify(fullEvent)}\n`;
    await fs.appendFile(logFile, logEntry, 'utf-8');
    
    // Notify callbacks
    this.eventCallbacks.forEach(callback => {
      try {
        callback(fullEvent);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }
  
  /**
   * Get agent identity information
   */
  getIdentity(): AgentIdentity {
    return { ...this.identity };
  }
  
  /**
   * Attempt to claim a task
   */
  async claimTask(options: ClaimOptions): Promise<ClaimResult> {
    const { task_id, lease_minutes = 90, heartbeat_minutes = 10, force = false } = options;
    
    try {
      // Load the task specification
      const task = await this.options.taskParser.getTask(task_id);
      if (!task) {
        return {
          success: false,
          error: `Task ${task_id} not found`
        };
      }
      
      // Check if task can be claimed
      if (!force) {
        const canClaim = await this.canClaimTask(task_id);
        if (!canClaim.valid) {
          return {
            success: false,
            error: canClaim.errors.join('; ')
          };
        }
      }
      
      // Try to acquire atomic lock
      const existingLease = await this.loadClaimLease(task_id);
      
      if (existingLease && !this.isLeaseExpired(existingLease)) {
        return {
          success: false,
          error: `Task ${task_id} is already claimed by ${existingLease.agent_id}`
        };
      }
      
      // Create new lease
      const now = new Date().toISOString();
      const expiresAt = this.calculateLeaseExpiration(lease_minutes);
      
      const lease: ClaimLease = {
        task_id,
        agent_id: this.identity.id,
        claimed_at: now,
        last_heartbeat: now,
        expires_at: expiresAt,
        lease_minutes,
        heartbeat_minutes,
        status: 'claimed',
        metadata: {}
      };
      
      await this.saveClaimLease(lease);
      
      // Update task status
      await this.options.taskParser.updateTask(task_id, {
        claim: {
          ...task.claim,
          status: 'claimed',
          by: this.identity.id,
          since: now,
          lease_minutes,
          heartbeat_minutes
        }
      });
      
      // Emit claim event
      await this.emitEvent({
        type: 'claimed',
        task_id,
        agent_id: this.identity.id,
        details: { lease_minutes, heartbeat_minutes },
        previous_status: task.claim.status,
        new_status: 'claimed'
      });
      
      // Refresh task data
      const updatedTask = await this.options.taskParser.getTask(task_id);
      
      return {
        success: true,
        task: updatedTask!,
        lease_expires_at: expiresAt
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to claim task: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Send heartbeat to maintain lease
   */
  async heartbeat(task_id: string): Promise<HeartbeatResult> {
    try {
      const lease = await this.loadClaimLease(task_id);
      
      if (!lease) {
        return {
          success: false,
          error: `No claim found for task ${task_id}`
        };
      }
      
      if (lease.agent_id !== this.identity.id) {
        return {
          success: false,
          error: `Task ${task_id} is claimed by another agent`
        };
      }
      
      if (this.isLeaseExpired(lease)) {
        return {
          success: false,
          error: `Lease for task ${task_id} has expired`
        };
      }
      
      // Update heartbeat timestamp and extend lease
      const now = new Date().toISOString();
      const newExpiresAt = this.calculateLeaseExpiration(lease.lease_minutes);
      
      lease.last_heartbeat = now;
      lease.expires_at = newExpiresAt;
      
      await this.saveClaimLease(lease);
      
      return {
        success: true,
        lease_expires_at: newExpiresAt
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to update heartbeat: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Release a claimed task
   */
  async releaseTask(task_id: string, reason = 'Released by agent'): Promise<ReleaseResult> {
    try {
      const lease = await this.loadClaimLease(task_id);
      
      if (!lease) {
        return {
          success: false,
          error: `No claim found for task ${task_id}`
        };
      }
      
      if (lease.agent_id !== this.identity.id) {
        return {
          success: false,
          error: `Task ${task_id} is claimed by another agent`
        };
      }
      
      // Remove claim lease
      await this.removeClaimLease(task_id);
      
      // Update task status back to open
      await this.options.taskParser.updateTask(task_id, {
        claim: {
          status: 'open',
          by: null,
          since: new Date().toISOString(),
          lease_minutes: 90,
          heartbeat_minutes: 10
        }
      });
      
      // Emit release event
      await this.emitEvent({
        type: 'abandoned',
        task_id,
        agent_id: this.identity.id,
        details: { reason },
        previous_status: lease.status,
        new_status: 'open'
      });
      
      return {
        success: true,
        reason
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to release task: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Mark a task as completed
   */
  async completeTask(task_id: string): Promise<CompletionResult> {
    try {
      const lease = await this.loadClaimLease(task_id);
      
      if (!lease) {
        return {
          success: false,
          error: `No claim found for task ${task_id}`
        };
      }
      
      if (lease.agent_id !== this.identity.id) {
        return {
          success: false,
          error: `Task ${task_id} is claimed by another agent`
        };
      }
      
      const task = await this.options.taskParser.getTask(task_id);
      if (!task) {
        return {
          success: false,
          error: `Task ${task_id} not found`
        };
      }
      
      // Validate completion criteria
      const validation = await this.validateCompletion(task);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join('; '),
          validation
        };
      }
      
      // Update task status to done
      await this.options.taskParser.updateTask(task_id, {
        claim: {
          ...task.claim,
          status: 'done',
          since: new Date().toISOString()
        }
      });
      
      // Remove claim lease
      await this.removeClaimLease(task_id);
      
      // Emit completion event
      await this.emitEvent({
        type: 'completed',
        task_id,
        agent_id: this.identity.id,
        details: { outputs: task.outputs },
        previous_status: lease.status,
        new_status: 'done'
      });
      
      return {
        success: true,
        validation,
        artifacts: task.outputs
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete task: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Validate task completion criteria
   */
  private async validateCompletion(task: TaskSpec): Promise<TaskValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if all output files exist
    for (const output of task.outputs) {
      try {
        await fs.access(join(this.options.context.cwd, output));
      } catch (error) {
        errors.push(`Output file does not exist: ${output}`);
      }
    }
    
    // For now, we can't automatically validate the "done_when" criteria
    // In a full implementation, you'd have pluggable validators for these
    if (task.done_when.length > 0) {
      warnings.push(`Manual validation required for completion criteria: ${task.done_when.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Update task status and metadata
   */
  async updateTask(task_id: string, updates: TaskUpdateOptions): Promise<boolean> {
    try {
      const lease = await this.loadClaimLease(task_id);
      
      if (lease && lease.agent_id !== this.identity.id) {
        throw new Error(`Task ${task_id} is claimed by another agent`);
      }
      
      // Update task in parser
      const taskUpdates: Partial<TaskSpec> = {};
      
      if (updates.status) {
        taskUpdates.claim = {
          status: updates.status,
          by: updates.status === 'open' ? null : this.identity.id,
          since: new Date().toISOString(),
          lease_minutes: 90,
          heartbeat_minutes: 10
        };
      }
      
      await this.options.taskParser.updateTask(task_id, taskUpdates);
      
      // Update lease metadata if exists
      if (lease && updates.metadata) {
        lease.metadata = { ...lease.metadata, ...updates.metadata };
        await this.saveClaimLease(lease);
      }
      
      // Emit progress event
      if (updates.status || updates.notes) {
        await this.emitEvent({
          type: 'progress',
          task_id,
          agent_id: this.identity.id,
          details: { notes: updates.notes, ...updates.metadata },
          new_status: updates.status
        });
      }
      
      return true;
      
    } catch (error) {
      console.error(`Failed to update task ${task_id}:`, error);
      return false;
    }
  }
  
  /**
   * Get current agent status
   */
  async getStatus(): Promise<AgentStatus> {
    // Find all claims by this agent
    const claimFiles = await fs.readdir(this.claimsDirectory);
    const claims: ClaimLease[] = [];
    
    for (const file of claimFiles) {
      if (file.endsWith('.json')) {
        try {
          const lease = await this.loadClaimLease(file.replace('.json', ''));
          if (lease && lease.agent_id === this.identity.id) {
            claims.push(lease);
          }
        } catch (error) {
          // Skip invalid claim files
        }
      }
    }
    
    const claimedTasks = claims.map(claim => claim.task_id);
    const inProgressTasks = claims
      .filter(claim => claim.status === 'in_progress')
      .map(claim => claim.task_id);
    
    // Check agent health based on lease expiration
    const hasExpiredLeases = claims.some(claim => this.isLeaseExpired(claim));
    const health = hasExpiredLeases ? 'degraded' : 'healthy';
    
    return {
      identity: this.identity,
      claimed_tasks: claimedTasks,
      in_progress_tasks: inProgressTasks,
      last_heartbeat: new Date().toISOString(),
      health,
      details: {
        total_claims: claims.length,
        expired_leases: claims.filter(claim => this.isLeaseExpired(claim)).length
      }
    };
  }
  
  /**
   * Validate that an agent can claim a task
   */
  async canClaimTask(task_id: string): Promise<TaskValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const task = await this.options.taskParser.getTask(task_id);
      
      if (!task) {
        errors.push(`Task ${task_id} not found`);
        return { valid: false, errors, warnings };
      }
      
      // Check if task is already claimed
      if (task.claim.status !== 'open') {
        errors.push(`Task ${task_id} is not available for claiming (status: ${task.claim.status})`);
      }
      
      // Check dependencies if enabled
      if (this.options.rules.verify_dependencies) {
        for (const depId of task.requires) {
          const depTask = await this.options.taskParser.getTask(depId);
          if (!depTask) {
            errors.push(`Required dependency ${depId} not found`);
          } else if (depTask.claim.status !== 'done') {
            errors.push(`Required dependency ${depId} is not completed (status: ${depTask.claim.status})`);
          }
        }
      }
      
      // Check agent capacity
      const status = await this.getStatus();
      if (status.claimed_tasks.length >= this.identity.max_concurrent_tasks) {
        errors.push(`Agent has reached maximum concurrent task limit (${this.identity.max_concurrent_tasks})`);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to validate claim: ${(error as Error).message}`],
        warnings
      };
    }
  }
  
  /**
   * Get tasks ready for claiming by this agent
   */
  async getAvailableTasks(): Promise<TaskSpec[]> {
    const readyTasks = await this.options.taskParser.getReadyTasks();
    
    // Filter tasks that this agent can claim
    const availableTasks: TaskSpec[] = [];
    
    for (const task of readyTasks) {
      const canClaim = await this.canClaimTask(task.id);
      if (canClaim.valid) {
        availableTasks.push(task);
      }
    }
    
    return availableTasks;
  }
  
  /**
   * Subscribe to task lifecycle events
   */
  onTaskEvent(callback: (event: TaskLifecycleEvent) => void): void {
    this.eventCallbacks.push(callback);
  }
}