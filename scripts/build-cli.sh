#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
pushd "$ROOT_DIR" >/dev/null

rm -rf dist

npx tsc -p tsconfig.json

if [[ ${NODE_ENV:-} == development ]]; then
  echo "Skipping npm pack in development mode."
  popd >/dev/null
  exit 0
fi

npm_config_ignore_scripts=1 npm pack

popd >/dev/null
