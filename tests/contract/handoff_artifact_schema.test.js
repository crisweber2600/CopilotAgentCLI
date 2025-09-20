"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ajv_1 = __importDefault(require("ajv"));
const schemaPath = (0, node_path_1.resolve)(__dirname, '..', '..', 'specs', '001-create-a-structured', 'contracts', 'handoff-artifact.schema.json');
const samplePath = (0, node_path_1.resolve)(__dirname, '..', '..', 'artifacts', 'handoff', '2025-09-19T15-45-00Z-work-item-001-create-a-structured-phase-setup-attempt-phase-setup.json');
(0, vitest_1.describe)('handoff artifact schema', () => {
    const schema = JSON.parse((0, node_fs_1.readFileSync)(schemaPath, 'utf-8'));
    const ajv = new ajv_1.default({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    (0, vitest_1.it)('accepts a compliant artifact', () => {
        const artifact = JSON.parse((0, node_fs_1.readFileSync)(samplePath, 'utf-8'));
        const valid = validate(artifact);
        (0, vitest_1.expect)(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
    });
    (0, vitest_1.it)('rejects missing required fields', () => {
        const artifact = JSON.parse((0, node_fs_1.readFileSync)(samplePath, 'utf-8'));
        delete artifact.actor;
        const valid = validate(artifact);
        (0, vitest_1.expect)(valid).toBe(false);
        const messages = validate.errors?.map((error) => error.message) ?? [];
        (0, vitest_1.expect)(messages.some((message) => message?.includes("required property 'actor'"))).toBe(true);
    });
    (0, vitest_1.it)('rejects invalid enum values', () => {
        const artifact = JSON.parse((0, node_fs_1.readFileSync)(samplePath, 'utf-8'));
        artifact.eventType = 'invalid-event';
        const valid = validate(artifact);
        (0, vitest_1.expect)(valid).toBe(false);
        const messages = validate.errors?.map((error) => error.message) ?? [];
        (0, vitest_1.expect)(messages.some((message) => /allowed values/.test(message ?? ''))).toBe(true);
    });
});
//# sourceMappingURL=handoff_artifact_schema.test.js.map