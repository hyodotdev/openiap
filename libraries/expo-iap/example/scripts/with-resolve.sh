#!/bin/bash
# Wrapper: resolve deps from libraries-versions.json, install if needed, then run command.
# Usage: ./scripts/with-resolve.sh <command...>

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# Run resolve-deps.js — exit code 2 means package.json changed
node scripts/resolve-deps.js || EXIT_CODE=$?
if [[ "${EXIT_CODE:-0}" -eq 2 ]]; then
  echo "[with-resolve] Dependencies changed, running install..."
  bun install
fi

# Run the actual command
exec "$@"
