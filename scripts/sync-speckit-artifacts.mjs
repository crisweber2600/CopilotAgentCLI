#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const cwd = process.cwd();
const specsRoot = join(cwd, 'specs');
const artifactsRoot = join(cwd, 'artifacts');

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const targetIds = args.filter((arg) => !arg.startsWith('--'));
  const specDirs = await listSpecDirectories();

  const targets = targetIds.length > 0 ? specDirs.filter((dir) => targetIds.includes(dir.id)) : specDirs;
  if (targets.length === 0) {
    console.error('No matching Speckit feature directories found.');
    process.exit(1);
  }

  for (const spec of targets) {
    await ensureArtifacts(spec, { force });
  }
}

async function listSpecDirectories() {
  const entries = await fs.readdir(specsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      id: entry.name,
      path: join(specsRoot, entry.name),
    }));
}

async function ensureArtifacts(spec, options) {
  const specMeta = await readSpecMetadata(spec.path);
  const workflowPath = join(artifactsRoot, 'workflows', `wf-${spec.id}.yaml`);
  const workItemPath = join(artifactsRoot, 'work-items', `work-item-${spec.id}.json`);

  await fs.mkdir(dirname(workflowPath), { recursive: true });
  await fs.mkdir(dirname(workItemPath), { recursive: true });

  if (!existsSync(workflowPath) || options.force) {
    const workflow = buildWorkflowDefinition(spec.id, specMeta, options);
    const yaml = YAML.stringify(workflow, { lineWidth: 0 });
    await fs.writeFile(workflowPath, yaml, 'utf8');
    console.log(`Wrote ${workflowPath}`);
  } else {
    console.log(`Skipped ${workflowPath} (exists)`);
  }

  if (!existsSync(workItemPath) || options.force) {
    const workItem = buildWorkItemDefinition(spec.id, specMeta);
    await fs.writeFile(workItemPath, `${JSON.stringify(workItem, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${workItemPath}`);
  } else {
    console.log(`Skipped ${workItemPath} (exists)`);
  }
}

async function readSpecMetadata(specPath) {
  const specRaw = await fs.readFile(join(specPath, 'spec.md'), 'utf8');
  const planRaw = await fs.readFile(join(specPath, 'plan.md'), 'utf8').catch(() => '');
  const tasksRaw = await fs.readFile(join(specPath, 'tasks.md'), 'utf8');

  const name = extractFirstHeading(specRaw) ?? inferNameFromPlan(planRaw) ?? 'Unnamed Feature';
  const phases = parsePhases(tasksRaw);
  return { name, phases, specPath: specPath.slice(cwd.length + 1) };
}

function extractFirstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)/m);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/^Feature Specification:\s*/i, '').trim();
}

function inferNameFromPlan(markdown) {
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].replace(/^Implementation Plan:\s*/i, '').trim() : undefined;
}

function parsePhases(markdown) {
  const lines = markdown.split(/\r?\n/);
  const phases = [];
  let current = null;
  for (const line of lines) {
    const phaseMatch = line.match(/^##\s+Phase\s+([\d.]+):\s*(.+)$/i);
    if (phaseMatch) {
      if (current) {
        phases.push(current);
      }
      const order = phases.length + 1;
      const title = phaseMatch[2].trim();
      const key = slug(`phase-${title}`);
      current = {
        rawLabel: title,
        order,
        key,
        tasks: [],
      };
      continue;
    }

    const taskMatch = line.match(/^-\s*\[.\]\s*(T\d{3})\s*(\[P\])?\s*(.*)$/);
    if (taskMatch && current) {
      const taskId = taskMatch[1];
      const isParallel = Boolean(taskMatch[2]);
      current.tasks.push({ id: taskId, parallel: isParallel, description: taskMatch[3].trim() });
    }
  }
  if (current) {
    phases.push(current);
  }
  return phases;
}

function buildWorkflowDefinition(specId, meta) {
  const steps = meta.phases.map((phase) => {
    const supportingTasks = phase.tasks.map((task) => task.id);
    const exitCriteria = supportingTasks.length > 0
      ? [`Complete ${supportingTasks.join(', ')}`]
      : ['Documented exit criteria satisfied'];
    const entryCriteria = meta.phases[phase.order - 2]
      ? [`Phase ${meta.phases[phase.order - 2].rawLabel} completed`]
      : ['Work item ready'];
    const parallelizable = phase.tasks.length > 0 && phase.tasks.every((task) => task.parallel);
    return {
      key: phase.key,
      order: phase.order,
      parallelizable,
      entryCriteria,
      exitCriteria,
      responsibleRole: suggestRole(phase.rawLabel),
      supportingTasks: supportingTasks.length > 0 ? supportingTasks : undefined,
    };
  });

  return {
    id: `wf-${specId}`,
    name: meta.name,
    version: '1.0.0',
    effectiveFrom: new Date().toISOString(),
    steps,
    schemaVersion: 1,
  };
}

function suggestRole(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes('setup')) return 'implementation-lead';
  if (normalized.includes('test')) return 'quality-engineer';
  if (normalized.includes('model')) return 'domain-engineer';
  if (normalized.includes('service')) return 'backend-engineer';
  if (normalized.includes('cli')) return 'cli-engineer';
  if (normalized.includes('integration')) return 'devops-engineer';
  if (normalized.includes('polish') || normalized.includes('review')) return 'release-engineer';
  return 'owner';
}

function buildWorkItemDefinition(specId, meta) {
  return {
    id: `work-item-${specId}`,
    title: meta.name,
    workflowId: `wf-${specId}`,
    specPath: meta.specPath,
    status: 'not-started',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .replace(/-{2,}/g, '-');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
