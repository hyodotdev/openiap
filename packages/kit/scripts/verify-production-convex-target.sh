#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../production.env"

if [ -z "${VITE_KIT_CONVEX_URL:-}" ]; then
  echo "error: Convex CLI did not provide its canonical deployment URL." >&2
  exit 1
fi

if [ "$VITE_KIT_CONVEX_URL" != "$IAPKIT_PRODUCTION_CONVEX_URL" ]; then
  echo "error: Convex deploy target $VITE_KIT_CONVEX_URL does not match production $IAPKIT_PRODUCTION_CONVEX_URL." >&2
  exit 1
fi

echo "Verified production Convex target: $VITE_KIT_CONVEX_URL"
