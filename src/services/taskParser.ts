/**
 * Task Parser Service
 * 
 * This service handles parsing, validation, and management of NDJSON task specifications
 * for the agent-swarmable framework.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { NDJSONReader, NDJSONUtils, readNDJSON } from '../utils/ndjsonReader';
import type { 
  TaskSpec, 
  TaskGraph, 
  TaskValidationResult, 
  DependencyResolution,
  TaskClaimStatus 
} from '../models/taskSpec';

/**
 * Task parsing options
 */
export interface TaskParserOptions {
  /** Directory containing task specification files */
  tasksDirectory: string;
  
  /** Path to task graph YAML file */
  graphFile: string;
  
  /** Path to JSON schema file for validation */
  schemaFile: string;
  
  /** Validate tasks against schema */
  validateSchema: boolean;
  
  /** Skip invalid tasks */
  skipInvalidTasks: boolean;
}

/**
 * Task query filter
 */
export interface TaskFilter {
  /** Filter by task IDs */
  ids?: string[];
  
  /** Filter by claim status */
  status?: TaskClaimStatus[];
  
  /** Filter by parallel group */
  parallel_group?: string;
  
  /** Filter by required dependencies */
  requires?: string[];
  
  /** Filter by output files */
  outputs?: string[];
  
  /** Custom filter predicate */
  predicate?: (task: TaskSpec) => boolean;
}

/**
 * Task update operation
 */
export interface TaskUpdate {
  /** Task ID to update */
  task_id: string;
  
  /** Fields to update */
  updates: Partial<TaskSpec>;
}

/**
 * Task parser service class
 */
export class TaskParser {
  private options: TaskParserOptions;
  private cachedTasks: TaskSpec[] | null = null;
  private cachedGraph: TaskGraph | null = null;
  
  constructor(options: TaskParserOptions) {
    this.options = options;
  }
  
  /**
   * Load all task specifications from the tasks directory
   */
  async loadTasks(forceRefresh = false): Promise<TaskSpec[]> {
    if (this.cachedTasks && !forceRefresh) {
      return this.cachedTasks;
    }
    
    const tasks: TaskSpec[] = [];
    
    try {
      // Read all .ndjson files in the tasks directory
      const files = await fs.readdir(this.options.tasksDirectory);
      const ndjsonFiles = files.filter(file => file.endsWith('.ndjson'));
      
      for (const file of ndjsonFiles) {
        const filePath = join(this.options.tasksDirectory, file);
        const fileTasks = await this.loadTasksFromFile(filePath);
        tasks.push(...fileTasks);
      }
      
      this.cachedTasks = tasks;
      return tasks;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Tasks directory doesn't exist, return empty array
        return [];
      }
      throw new Error(`Failed to load tasks: ${(error as Error).message}`);
    }
  }
  
  /**
   * Load task specifications from a specific file
   */
  async loadTasksFromFile(filePath: string): Promise<TaskSpec[]> {
    const reader = new NDJSONReader<TaskSpec>({
      skipInvalidLines: this.options.skipInvalidTasks,
      validateSchema: this.options.validateSchema
    });
    
    const result = await reader.readFile(filePath);
    
    if (result.errors.length > 0 && !this.options.skipInvalidTasks) {
      const errorMsg = result.errors.map(err => 
        `Line ${err.line}: ${err.error}`
      ).join(', ');
      throw new Error(`Invalid tasks in ${filePath}: ${errorMsg}`);
    }
    
    return result.data;
  }
  
  /**
   * Load task graph from YAML file
   */
  async loadGraph(forceRefresh = false): Promise<TaskGraph> {
    if (this.cachedGraph && !forceRefresh) {
      return this.cachedGraph;
    }
    
    try {
      // For now, we'll create a basic task graph structure
      // In a full implementation, you'd use a YAML parser here
      const content = await fs.readFile(this.options.graphFile, 'utf-8');
      
      // This is a simplified version - you'd use yaml.parse() in practice
      const graph: TaskGraph = {
        feature_name: "agent-swarmable",
        base_branch: "feat/agent-swarmable",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phases: ['spec', 'impl', 'test', 'verify', 'polish'],
        parallel_groups: {},
        tasks: [],
        validation: []
      };
      
      this.cachedGraph = graph;
      return graph;
    } catch (error) {
      throw new Error(`Failed to load task graph: ${(error as Error).message}`);
    }
  }
  
  /**
   * Find tasks matching a filter
   */
  async findTasks(filter: TaskFilter): Promise<TaskSpec[]> {
    const allTasks = await this.loadTasks();
    
    return allTasks.filter(task => {
      // Filter by IDs
      if (filter.ids && !filter.ids.includes(task.id)) {
        return false;
      }
      
      // Filter by status
      if (filter.status && !filter.status.includes(task.claim.status)) {
        return false;
      }
      
      // Filter by parallel group
      if (filter.parallel_group !== undefined) {
        if (task.parallel_group !== filter.parallel_group) {
          return false;
        }
      }
      
      // Filter by requirements
      if (filter.requires) {
        const hasAllRequirements = filter.requires.every(req => 
          task.requires.includes(req)
        );
        if (!hasAllRequirements) {
          return false;
        }
      }
      
      // Filter by outputs
      if (filter.outputs) {
        const hasAllOutputs = filter.outputs.every(output => 
          task.outputs.includes(output)
        );
        if (!hasAllOutputs) {
          return false;
        }
      }
      
      // Apply custom predicate
      if (filter.predicate && !filter.predicate(task)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<TaskSpec | null> {
    const tasks = await this.findTasks({ ids: [taskId] });
    return tasks.length > 0 ? tasks[0] : null;
  }
  
  /**
   * Get tasks that are ready for claiming (dependencies met, status is open)
   */
  async getReadyTasks(): Promise<TaskSpec[]> {
    const allTasks = await this.loadTasks();
    const taskMap = new Map(allTasks.map(task => [task.id, task]));
    
    return allTasks.filter(task => {
      // Must be open for claiming
      if (task.claim.status !== 'open') {
        return false;
      }
      
      // All dependencies must be completed
      return task.requires.every(depId => {
        const depTask = taskMap.get(depId);
        return depTask && depTask.claim.status === 'done';
      });
    });
  }
  
  /**
   * Get tasks by parallel group
   */
  async getTasksByGroup(parallelGroup: string): Promise<TaskSpec[]> {
    return this.findTasks({ parallel_group: parallelGroup });
  }
  
  /**
   * Update a task specification
   */
  async updateTask(taskId: string, updates: Partial<TaskSpec>): Promise<boolean> {
    const allTasks = await this.loadTasks();
    const taskIndex = allTasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      return false;
    }
    
    // Update the task
    const updatedTask = { ...allTasks[taskIndex], ...updates };
    allTasks[taskIndex] = updatedTask;
    
    // For now, we'll just update the cache
    // In a full implementation, you'd persist this back to the file
    this.cachedTasks = allTasks;
    
    return true;
  }
  
  /**
   * Validate a task specification
   */
  async validateTask(task: TaskSpec): Promise<TaskValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate task ID format
    if (!/^T[0-9]{3}$/.test(task.id)) {
      errors.push(`Invalid task ID format: ${task.id}. Must be T### (e.g., T001)`);
    }
    
    // Validate branch name format
    if (!/^feat\/[a-z0-9-]+__T[0-9]{3}$/.test(task.branch)) {
      errors.push(`Invalid branch name format: ${task.branch}`);
    }
    
    // Validate base branch format
    if (!/^feat\/[a-z0-9-]+$/.test(task.base_branch)) {
      errors.push(`Invalid base branch format: ${task.base_branch}`);
    }
    
    // Validate concurrency key format
    if (!/^[a-z0-9-]+::T[0-9]{3}$/.test(task.concurrency_key)) {
      errors.push(`Invalid concurrency key format: ${task.concurrency_key}`);
    }
    
    // Validate PR title format
    if (!/^\[T[0-9]{3}\]/.test(task.pr.title)) {
      errors.push(`PR title must start with [T###]: ${task.pr.title}`);
    }
    
    // Validate completion criteria
    if (task.done_when.length === 0) {
      errors.push('Task must have at least one completion criterion');
    }
    
    // Validate lease and heartbeat times
    if (task.claim.lease_minutes <= 0) {
      errors.push('Lease minutes must be positive');
    }
    
    if (task.claim.heartbeat_minutes <= 0) {
      errors.push('Heartbeat minutes must be positive');
    }
    
    if (task.claim.heartbeat_minutes >= task.claim.lease_minutes) {
      warnings.push('Heartbeat interval should be less than lease duration');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Resolve task dependencies and return execution order
   */
  async resolveDependencies(): Promise<DependencyResolution> {
    const tasks = await this.loadTasks();
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    
    // Find circular dependencies using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDeps: string[][] = [];
    
    const detectCycles = (taskId: string, path: string[] = []): void => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        circularDeps.push([...path.slice(cycleStart), taskId]);
        return;
      }
      
      if (visited.has(taskId)) {
        return;
      }
      
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.requires) {
          detectCycles(depId, [...path, taskId]);
        }
      }
      
      recursionStack.delete(taskId);
    };
    
    // Check all tasks for cycles
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        detectCycles(task.id);
      }
    }
    
    // Topological sort (simplified version)
    const sorted: string[] = [];
    const processed = new Set<string>();
    
    const topSort = (taskId: string): void => {
      if (processed.has(taskId)) {
        return;
      }
      
      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.requires) {
          topSort(depId);
        }
      }
      
      processed.add(taskId);
      sorted.push(taskId);
    };
    
    for (const task of tasks) {
      topSort(task.id);
    }
    
    // Find ready and blocked tasks
    const readyTasks = tasks
      .filter(task => task.claim.status === 'open')
      .filter(task => task.requires.every(depId => {
        const depTask = taskMap.get(depId);
        return depTask && depTask.claim.status === 'done';
      }))
      .map(task => task.id);
    
    const blockedTasks: Record<string, string[]> = {};
    tasks.forEach(task => {
      if (task.claim.status === 'open') {
        const blockers = task.requires.filter(depId => {
          const depTask = taskMap.get(depId);
          return !depTask || depTask.claim.status !== 'done';
        });
        if (blockers.length > 0) {
          blockedTasks[task.id] = blockers;
        }
      }
    });
    
    return {
      sorted_tasks: sorted,
      circular_dependencies: circularDeps,
      ready_tasks: readyTasks,
      blocked_tasks: blockedTasks
    };
  }
  
  /**
   * Clear cached data
   */
  clearCache(): void {
    this.cachedTasks = null;
    this.cachedGraph = null;
  }
}