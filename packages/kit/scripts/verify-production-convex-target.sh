#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# CI passes the target from the kit-production environment; a local deploy
# reads the gitignored production.env.
if [ -z "${IAPKIT_PRODUCTION_CONVEX_URL:-}" ] && [ -f "$SCRIPT_DIR/../production.env" ]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/../production.env"
fi

if [ -z "${IAPKIT_PRODUCTION_CONVEX_URL:-}" ]; then
  echo "error: set IAPKIT_PRODUCTION_CONVEX_URL or create packages/kit/production.env." >&2
  exit 1
fi

if [ -z "${VITE_KIT_CONVEX_URL:-}" ]; then
  echo "error: Convex CLI did not provide its canonical deployment URL." >&2
  exit 1
fi

if [ "$VITE_KIT_CONVEX_URL" != "$IAPKIT_PRODUCTION_CONVEX_URL" ]; then
  echo "error: Convex deploy target $VITE_KIT_CONVEX_URL does not match production $IAPKIT_PRODUCTION_CONVEX_URL." >&2
  exit 1
fi

echo "Verified production Convex target: $VITE_KIT_CONVEX_URL"
