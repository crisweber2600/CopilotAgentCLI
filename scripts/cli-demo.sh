#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run this demo." >&2
  exit 1
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CLI="npm run --silent cli --"

pushd "$ROOT_DIR" >/dev/null

if [ -z "${COPILOT_AGENT_HOME:-}" ]; then
  export COPILOT_AGENT_HOME="$ROOT_DIR/.demo/copilot-agent"
fi
mkdir -p "$COPILOT_AGENT_HOME"

if [ -z "${COPILOT_CLI_WORKSPACE:-}" ]; then
  export COPILOT_CLI_WORKSPACE="$ROOT_DIR/.demo/workspace"
fi
mkdir -p "$COPILOT_CLI_WORKSPACE"

if [ ! -f "$COPILOT_CLI_WORKSPACE/README.md" ]; then
  cat <<'README' > "$COPILOT_CLI_WORKSPACE/README.md"
# Copilot CLI Demo Workspace

This workspace is used by scripts/cli-demo.sh to showcase the delegation flow.
README
fi

if ! $CLI login --method device-code --json; then
  echo "Login failed. Complete the device-code flow and rerun the script." >&2
  exit 1
fi

PROMPT="Generate a summary for README.md"
RESULT_JSON=$($CLI --cwd "$COPILOT_CLI_WORKSPACE" delegate --prompt "$PROMPT" --json)
SESSION_ID=$(node -e 'const input=process.argv[1]; try { const parsed = JSON.parse(input); if (!parsed.id) throw new Error("missing id"); console.log(parsed.id); } catch (err) { console.error("Failed to parse delegation output:", err.message); process.exit(1); }' "$RESULT_JSON")

echo "Delegated session: $SESSION_ID"
$CLI status "$SESSION_ID"
$CLI result "$SESSION_ID" --json

popd >/dev/null
