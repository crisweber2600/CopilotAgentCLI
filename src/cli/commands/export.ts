import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MetricsService } from '../../services/metrics_service';
import type { CliContext } from '../types';
import {
  getStringFlag,
  hasFlag,
  parseArgs,
  resolveOutputFormat,
  writeJson,
  writeLine,
} from '../utils';

export default async function exportCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const format = getStringFlag(parsed, 'format') ?? 'json';
  const includeStdout = hasFlag(parsed, 'stdout');

  await context.authService.requireSession();

  const artifactsDir = join(context.cwd, 'artifacts');
  const exportsDir = join(artifactsDir, 'exports');
  await mkdir(exportsDir, { recursive: true });

  const metricsService = new MetricsService({ artifactsDir });
  const snapshot = await metricsService.buildPortfolioSnapshot();

  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const exportPath = join(exportsDir, `portfolio-${timestamp}.json`);
  const payload = { generatedAt: timestamp, items: snapshot };
  await writeFile(exportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  const resolvedFormat =
    resolveOutputFormat(parsed, context.ciDefaultJson) ?? (format === 'json' ? 'json' : 'text');
  if (resolvedFormat === 'json' || includeStdout) {
    writeJson(context.stdout, { path: exportPath, ...payload });
  } else {
    writeLine(context.stdout, `Portfolio snapshot written to ${exportPath}`);
  }

  return 0;
}
