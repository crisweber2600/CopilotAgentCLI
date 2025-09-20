"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const ajv_1 = __importDefault(require("ajv"));
const artifact_service_1 = require("../../src/services/artifact_service");
const schemaPath = (0, node_path_1.join)(process.cwd(), 'specs', '001-create-a-structured', 'contracts', 'handoff-artifact.schema.json');
const ajv = new ajv_1.default({ allErrors: true, strict: false });
const schema = JSON.parse((0, node_fs_1.readFileSync)(schemaPath, 'utf-8'));
const validate = ajv.compile(schema);
(0, vitest_1.describe)('handoff artifact flow', () => {
    (0, vitest_1.it)('writes schema-compliant artifacts and lists them for consumers', async () => {
        const artifactsDir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'handoff-service-'));
        const service = new artifact_service_1.ArtifactService({ artifactsDir, schemaPath });
        const record = await service.writeHandoffArtifact({
            workItemId: 'work-item-001-create-a-structured',
            workflow: { name: 'Implement Plan-to-Execution Orchestrator', version: '1.0.0' },
            step: { key: 'phase-tests', order: 2 },
            eventType: 'attempt-completed',
            attemptId: 'attempt-phase-tests-001',
            actor: 'quality-engineer',
            outcome: 'Tests authored and committed.',
            nextAction: 'Run models implementation.',
            baselineIntegration: 'pre',
            links: ['artifacts/claims/attempt-phase-tests-001.json'],
            timestamp: new Date('2025-09-19T17:00:00.000Z'),
        });
        const raw = JSON.parse((0, node_fs_1.readFileSync)(record.path, 'utf-8'));
        const valid = validate(raw);
        (0, vitest_1.expect)(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
        const artifacts = await service.listHandoffArtifacts('work-item-001-create-a-structured');
        (0, vitest_1.expect)(artifacts.map((artifact) => artifact.attemptId)).toContain('attempt-phase-tests-001');
        (0, node_fs_1.rmSync)(artifactsDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=handoff_artifact_flow.test.js.map