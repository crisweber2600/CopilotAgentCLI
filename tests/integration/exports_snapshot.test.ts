import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { MetricsService } from '../../src/services/metrics_service';

describe('portfolio exports snapshot', () => {
  it('aggregates work item history into portfolio metrics', async () => {
    const artifactsDir = resolve(process.cwd(), 'artifacts');
    const service = new MetricsService({ artifactsDir });

    const snapshot = await service.buildPortfolioSnapshot();
    const target = snapshot.find((item) => item.workItemId === 'work-item-001-create-a-structured');

    expect(target).toBeDefined();
    expect(target?.leadTimeDays).toBeGreaterThanOrEqual(0);
    expect(target?.wip).toBeGreaterThanOrEqual(1);
  });
});
