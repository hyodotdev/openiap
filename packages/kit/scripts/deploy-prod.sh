#!/usr/bin/env bash
# Manual-fallback deploy of openiap-kit to Fly.io with the production
# Convex SPA bundle.
#
# Normally the `deploy` job in `.github/workflows/deploy-kit.yml`
# handles prod deploys and reads `VITE_KIT_CONVEX_URL` /
# `VITE_KIT_SENTRY_DSN` / `VITE_KIT_MIXPANEL_TOKEN` directly from
# GitHub Actions secrets (KIT_-prefixed). This
# script is only for the rare case where CI is unavailable (billing
# pause, emergency revert, etc.) and a human has to run `flyctl deploy`
# from their laptop. To keep that path from accidentally shipping a
# dev SPA, it reads from `.env.production` — which is git-ignored and
# MUST be created locally by the deployer before the first run (see
# `.env.example`). Direct `source .env.local && flyctl deploy ...`
# has baked the DEV Convex URL into kit.openiap.dev before; don't do
# that again.
#
# Usage: bash scripts/deploy-prod.sh
set -euo pipefail

# Run from packages/kit/ for env loading, but flyctl must build from
# the monorepo root so the Docker context has bun.lock + every workspace
# package.json available to `bun install --filter @hyodotdev/openiap-kit`.
KIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$KIT_DIR/../.." && pwd)"
cd "$KIT_DIR"

if [ ! -f .env.production ]; then
  echo "error: .env.production missing. This file is git-ignored —"
  echo "create it locally from .env.example and fill in the PROD"
  echo "values (at minimum VITE_KIT_CONVEX_URL). Do NOT commit it."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env.production
if [ -f .env.production.local ]; then
  source .env.production.local
fi
set +a

if [ -z "${VITE_KIT_CONVEX_URL:-}" ]; then
  echo "error: VITE_KIT_CONVEX_URL not set after sourcing .env.production"
  exit 1
fi

# Guard against ever sending a localhost or dev-labelled URL to Fly.
case "$VITE_KIT_CONVEX_URL" in
  *localhost*|*127.0.0.1*|*fabulous-gnat-876*)
    echo "error: VITE_KIT_CONVEX_URL looks like a dev URL ($VITE_KIT_CONVEX_URL)."
    echo "Refusing to deploy that to prod. Fix .env.production first."
    exit 1
    ;;
esac

echo "Deploying to Fly with VITE_KIT_CONVEX_URL=$VITE_KIT_CONVEX_URL"

BUILD_ARGS=(--build-arg "VITE_KIT_CONVEX_URL=$VITE_KIT_CONVEX_URL")
if [ -n "${VITE_KIT_SENTRY_DSN:-}" ]; then
  BUILD_ARGS+=(--build-arg "VITE_KIT_SENTRY_DSN=$VITE_KIT_SENTRY_DSN")
fi
if [ -n "${VITE_KIT_MIXPANEL_TOKEN:-}" ]; then
  BUILD_ARGS+=(--build-arg "VITE_KIT_MIXPANEL_TOKEN=$VITE_KIT_MIXPANEL_TOKEN")
fi

cd "$REPO_ROOT"
exec flyctl deploy --app openiap-kit \
  --config packages/kit/fly.toml \
  --dockerfile packages/kit/Dockerfile \
  "${BUILD_ARGS[@]}" "$@"
