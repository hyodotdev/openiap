# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.13-slim AS base

# Build context is the monorepo root (see deploy-kit.yml + scripts/deploy-prod.sh).
# This is required because the workspace lockfile lives at the root, not under
# packages/kit/, and Bun resolves workspace deps (`@hyodotdev/openiap-gql` etc.)
# via the root `package.json` `workspaces` field.

# --- Install deps --------------------------------------------------------
FROM base AS deps
WORKDIR /app
# Copy only what bun install needs to maximize layer caching: root manifest +
# lockfile + every workspace package.json (so Bun can plan the install graph).
COPY package.json bun.lock ./
COPY packages/kit/package.json ./packages/kit/
COPY packages/gql/package.json ./packages/gql/
COPY packages/apple/package.json ./packages/apple/
COPY packages/google/package.json ./packages/google/
COPY packages/docs/package.json ./packages/docs/
# `mcp-server` is a workspace member (added in PR #124 (https://github.com/hyodotdev/openiap/pull/124)). Without
# its package.json bun's workspace resolver disagrees with the
# root lockfile and `--frozen-lockfile` rejects the install with
# "lockfile had changes, but lockfile is frozen".
COPY packages/mcp-server/package.json ./packages/mcp-server/
RUN bun install --frozen-lockfile --filter @hyodotdev/openiap-kit

# --- Build the unified app (Vite SPA + compiled Bun server) --------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY packages/kit ./packages/kit
# bun 1.3.13 + workspaces installs some deps under each package's
# local node_modules (e.g. `vite`, `@vitejs/plugin-react`) instead of
# fully hoisting. Pull kit's local node_modules from the deps stage
# AFTER the source COPY so it isn't clobbered. Without this the
# build fails with `vite: command not found` (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review
# fallout).
COPY --from=deps /app/packages/kit/node_modules ./packages/kit/node_modules
WORKDIR /app/packages/kit
ARG VITE_KIT_CONVEX_URL
ENV VITE_KIT_CONVEX_URL=${VITE_KIT_CONVEX_URL}
# Client-side Sentry DSN baked into the SPA bundle. Technically public
# (any visitor can read it out of the JS), but we still route it through
# a build arg instead of committing to the repo so it rotates cleanly.
ARG VITE_KIT_SENTRY_DSN
ENV VITE_KIT_SENTRY_DSN=${VITE_KIT_SENTRY_DSN}
# Mixpanel project token is public by design and baked into the SPA when set,
# but pass it via BuildKit secret so Docker does not flag TOKEN-named ARG/ENV.
# BuildKit secret values are not part of the layer cache key, so a non-secret
# fingerprint of the token is passed as a build arg purely to bust the
# `bun run build:all` cache when the token rotates — without it, GHA / Fly's
# remote builder would happily reuse the prior layer and ship a stale token.
ARG VITE_KIT_MIXPANEL_TOKEN_HASH=
# VITE_KIT_MIXPANEL_TOKEN_HASH must be expanded inside the RUN command
# string for BuildKit to fold it into the layer cache key — an unused
# ARG does not affect caching, so the rotation-busting effect would
# silently disappear if we only declared it above. The build script
# does not consume the hash; it only exists as a cache fingerprint.
RUN --mount=type=secret,id=VITE_KIT_MIXPANEL_TOKEN,required=false \
    VITE_KIT_MIXPANEL_TOKEN_HASH="${VITE_KIT_MIXPANEL_TOKEN_HASH}" \
    VITE_KIT_MIXPANEL_TOKEN="$(cat /run/secrets/VITE_KIT_MIXPANEL_TOKEN 2>/dev/null || true)" \
    bun run build:all

# --- Runtime image (single binary + static assets) -----------------------
FROM debian:bookworm-slim AS runtime
WORKDIR /srv

RUN addgroup --system --gid 1001 openiap && \
    adduser --system --uid 1001 --ingroup openiap openiap

COPY --from=builder --chown=openiap:openiap /app/packages/kit/openiap-kit-server ./openiap-kit-server
COPY --from=builder --chown=openiap:openiap /app/packages/kit/dist ./public

ENV STATIC_ROOT=/srv/public
ENV PORT=3000
EXPOSE 3000/tcp

USER openiap
ENTRYPOINT ["./openiap-kit-server"]
