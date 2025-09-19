import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MetricsService } from '../../services/metrics_service';
import type { CliContext } from '../types';
import { getStringFlag, hasFlag, parseArgs, writeJson, writeLine } from '../utils';

export default async function exportCommand(args: string[], context: CliContext): Promise<number> {
  const parsed = parseArgs(args);
  const format = getStringFlag(parsed, 'format') ?? 'json';
  const includeStdout = hasFlag(parsed, 'stdout');

  const artifactsDir = join(context.cwd, 'artifacts');
  const exportsDir = join(artifactsDir, 'exports');
  await mkdir(exportsDir, { recursive: true });

  const metricsService = new MetricsService({ artifactsDir });
  const snapshot = await metricsService.buildPortfolioSnapshot();

  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const exportPath = join(exportsDir, `portfolio-${timestamp}.json`);
  await writeFile(
    exportPath,
    `${JSON.stringify({ generatedAt: timestamp, items: snapshot }, null, 2)}\n`,
    'utf-8',
  );

  if (format === 'json' || includeStdout || context.ciDefaultJson) {
    writeJson(context.stdout, { path: exportPath, generatedAt: timestamp, items: snapshot });
  } else {
    writeLine(context.stdout, `Portfolio snapshot written to ${exportPath}`);
  }

  return 0;
}
