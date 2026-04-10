#!/bin/bash
# Wrapper: resolve deps from libraries-versions.jsonc, install if needed, then run command.
# Usage: ./scripts/with-resolve.sh <command...>

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# Run resolve-deps.js — exit code 2 means package.json changed
EXIT_CODE=0
node scripts/resolve-deps.js || EXIT_CODE=$?
if [[ "$EXIT_CODE" -eq 2 ]]; then
  echo "[with-resolve] Dependencies changed, running install..."
  bun install
elif [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "[with-resolve] resolve-deps.js failed with exit code $EXIT_CODE"
  exit "$EXIT_CODE"
fi

# Run the actual command
exec "$@"
