#!/bin/bash
# Wrapper: resolve deps from libraries-versions.jsonc, install if needed, then run command.
# Usage: ./scripts/with-resolve.sh <command...>

set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DIR/.." && pwd)"
cd "$DIR"

export RN_IAP_DEV_MODE=true

# Read mode from libraries-versions.jsonc
MODE=$(node -e "
  const fs = require('fs');
  const path = require('path');
  try {
    const f = fs.readFileSync(path.resolve('$ROOT_DIR/../../libraries-versions.jsonc'), 'utf8');
    const v = JSON.parse(f.replace(/^\s*\/\/.*$/gm, ''));
    console.log(v['react-native-iap'] || 'local');
  } catch { console.log('local'); }
" 2>/dev/null || echo "local")

# Run resolve-deps.js — exit code 2 means deps changed
EXIT_CODE=0
node scripts/resolve-deps.js || EXIT_CODE=$?
if [[ "$EXIT_CODE" -eq 2 ]]; then
  echo "[with-resolve] Dependencies changed, running install..."
  if [[ "$MODE" == "local" ]]; then
    # Workspace mode: install from root
    cd "$ROOT_DIR" && yarn install && yarn prepare
    cd "$DIR" && yarn install
  else
    # Standalone mode: install inside example only
    cd "$DIR" && yarn install
  fi
  cd "$DIR/ios" && bundle exec pod install && cd "$DIR"
elif [[ "$EXIT_CODE" -ne 0 ]]; then
  exit "$EXIT_CODE"
fi

# Run the actual command
exec "$@"
