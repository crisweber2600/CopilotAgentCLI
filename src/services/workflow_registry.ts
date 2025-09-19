import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import YAML from 'yaml';

import { Workflow, type WorkflowProps } from '../models/workflow';

export interface WorkflowRegistryOptions {
  workflowsDir: string;
}

export class WorkflowRegistry {
  private readonly workflowsDir: string;

  private cache: Map<string, Workflow> | null = null;

  constructor(options: WorkflowRegistryOptions) {
    this.workflowsDir = options.workflowsDir;
  }

  async getWorkflow(workflowId: string): Promise<Workflow> {
    const cache = await this.ensureCache();
    const workflow = cache.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found in ${this.workflowsDir}`);
    }
    return workflow;
  }

  async listWorkflows(): Promise<Workflow[]> {
    const cache = await this.ensureCache();
    return [...cache.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async refresh(): Promise<void> {
    this.cache = await this.loadWorkflows();
  }

  private async ensureCache(): Promise<Map<string, Workflow>> {
    if (!this.cache) {
      this.cache = await this.loadWorkflows();
    }
    return this.cache;
  }

  private async loadWorkflows(): Promise<Map<string, Workflow>> {
    const entries = readdirSync(this.workflowsDir, { withFileTypes: true });
    const workflows = new Map<string, Workflow>();

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const extension = extname(entry.name).toLowerCase();
      if (!['.yaml', '.yml', '.json'].includes(extension)) {
        continue;
      }
      const filePath = join(this.workflowsDir, entry.name);
      const workflowDefinition = await this.readWorkflowFile(filePath, extension);
      const workflow = Workflow.fromDefinition(workflowDefinition);
      workflows.set(workflow.id, workflow);
    }

    return workflows;
  }

  private async readWorkflowFile(filePath: string, extension: string): Promise<WorkflowProps> {
    const raw = await readFile(filePath, 'utf-8');
    if (extension === '.json') {
      return JSON.parse(raw) as WorkflowProps;
    }
    return YAML.parse(raw) as WorkflowProps;
  }
}
