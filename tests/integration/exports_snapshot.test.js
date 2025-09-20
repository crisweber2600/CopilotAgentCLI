"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_path_1 = require("node:path");
const metrics_service_1 = require("../../src/services/metrics_service");
(0, vitest_1.describe)('portfolio exports snapshot', () => {
    (0, vitest_1.it)('aggregates work item metrics', async () => {
        const artifactsDir = (0, node_path_1.resolve)(process.cwd(), 'artifacts');
        const service = new metrics_service_1.MetricsService({ artifactsDir });
        const snapshot = await service.buildPortfolioSnapshot();
        const workItem = snapshot.find((item) => item.workItemId === 'work-item-001-create-a-structured');
        (0, vitest_1.expect)(workItem).toBeDefined();
        (0, vitest_1.expect)(workItem?.wip).toBeGreaterThanOrEqual(1);
    });
});
//# sourceMappingURL=exports_snapshot.test.js.map