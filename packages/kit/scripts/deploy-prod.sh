#!/usr/bin/env bash
# Manual-fallback deploy of openiap-kit to Fly.io with the production
# Convex SPA bundle.
#
# Normally the `deploy` job in `.github/workflows/deploy-kit.yml`
# handles production deploys. This script is only for the rare case where CI
# is unavailable (billing pause, emergency revert, etc.) and a human has to
# deploy from their laptop. Both paths ask the Convex CLI for the canonical URL
# selected by its deploy key, compare it with the committed `production.env`
# SSOT, and pass that exact URL to Fly. `.env.production` is optional and may
# contain only credentials or optional analytics settings; it never chooses
# the production Convex deployment.
#
# Usage: bash scripts/deploy-prod.sh
set -euo pipefail

# Run from packages/kit/ for env loading, but flyctl must build from
# the monorepo root so the Docker context has bun.lock + every workspace
# package.json available to `bun install --filter @hyodotdev/openiap-kit`.
KIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$KIT_DIR/../.." && pwd)"
cd "$KIT_DIR"

# shellcheck disable=SC1091
set -a
if [ -f .env.production ]; then
  source .env.production
fi
if [ -f .env.production.local ]; then
  source .env.production.local
fi
set +a

# The health response identifies the deployed Git revision. Refuse a manual
# build from a dirty checkout, where that revision would not describe the
# Docker context accurately. Ignored local env files remain allowed.
if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
  echo "error: refusing to deploy from a dirty worktree." >&2
  echo "Commit or remove tracked/untracked source changes first." >&2
  exit 1
fi

# Deploy Convex first and capture the canonical cloud URL selected by the same
# credentials. `convex deploy` runs --cmd before pushing functions, so a target
# mismatch stops both the Convex and Fly deployments.
CONVEX_URL_FILE="$(mktemp)"
trap 'rm -f "$CONVEX_URL_FILE"' EXIT
export IAPKIT_CONVEX_URL_FILE="$CONVEX_URL_FILE"
bunx convex deploy --yes \
  --cmd './scripts/verify-production-convex-target.sh && printf "%s\n" "$VITE_KIT_CONVEX_URL" > "$IAPKIT_CONVEX_URL_FILE"' \
  --cmd-url-env-var-name VITE_KIT_CONVEX_URL
VITE_KIT_CONVEX_URL="$(tr -d '\r\n' < "$CONVEX_URL_FILE")"
rm -f "$CONVEX_URL_FILE"
trap - EXIT

echo "Deploying to Fly with verified VITE_KIT_CONVEX_URL=$VITE_KIT_CONVEX_URL"

IAPKIT_REVISION="$(git -C "$REPO_ROOT" rev-parse HEAD)"
BUILD_FLAGS=(
  --build-arg "VITE_KIT_CONVEX_URL=$VITE_KIT_CONVEX_URL"
  --build-arg "IAPKIT_REVISION=$IAPKIT_REVISION"
)
if [ -n "${VITE_KIT_SENTRY_DSN:-}" ]; then
  BUILD_FLAGS+=(--build-arg "VITE_KIT_SENTRY_DSN=$VITE_KIT_SENTRY_DSN")
fi
if [ -n "${VITE_KIT_MIXPANEL_TOKEN:-}" ]; then
  # Public SPA config, passed as a BuildKit secret to avoid Docker's
  # TOKEN-named ARG/ENV warning while still baking it into the bundle.
  # The hash arg is purely a cache buster — BuildKit secret values do
  # not participate in the layer cache key, so without it a token
  # rotation would happily reuse the prior `bun run build:all` layer.
  if command -v sha256sum >/dev/null 2>&1; then
    MIXPANEL_TOKEN_HASH=$(printf '%s' "$VITE_KIT_MIXPANEL_TOKEN" | sha256sum | cut -c1-16)
  elif command -v shasum >/dev/null 2>&1; then
    MIXPANEL_TOKEN_HASH=$(printf '%s' "$VITE_KIT_MIXPANEL_TOKEN" | shasum -a 256 | cut -c1-16)
  else
    echo "error: need sha256sum (most Linux) or shasum (macOS) on PATH to hash the Mixpanel token." >&2
    exit 1
  fi
  BUILD_FLAGS+=(--build-arg "VITE_KIT_MIXPANEL_TOKEN_HASH=$MIXPANEL_TOKEN_HASH")
  BUILD_FLAGS+=(--build-secret "VITE_KIT_MIXPANEL_TOKEN=$VITE_KIT_MIXPANEL_TOKEN")
fi

cd "$REPO_ROOT"
exec flyctl deploy --app openiap-kit \
  --config packages/kit/fly.toml \
  --dockerfile packages/kit/Dockerfile \
  "${BUILD_FLAGS[@]}" "$@"
