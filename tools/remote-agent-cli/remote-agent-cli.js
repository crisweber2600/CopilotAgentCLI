#!/usr/bin/env node
const sessionId = process.env.COPILOT_AGENT_SESSION_ID ?? 'unknown-session';
const prompt = process.env.COPILOT_AGENT_PROMPT ?? 'unknown prompt';
const summary = `Remote Agent CLI completed: ${prompt}`;
const logs = [
  `Remote Agent CLI started session ${sessionId}.`,
  `Processing prompt: ${prompt}`,
  `Remote Agent CLI finished session ${sessionId}.`,
];

process.stdout.write(
  `${JSON.stringify({ summary, logs, artifacts: [] })}\n`,
);
