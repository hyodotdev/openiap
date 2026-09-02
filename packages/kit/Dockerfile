# syntax=docker/dockerfile:1.7

FROM oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS base

# Build context is the monorepo root (see deploy-kit.yml + scripts/deploy-prod.sh).
# This is required because the workspace lockfile lives at the root, not under
# packages/kit/, and Bun resolves workspace deps (`@hyodotdev/openiap` etc.)
# via the root `package.json` `workspaces` field.

# --- Install deps --------------------------------------------------------
FROM base AS deps
WORKDIR /app
# Copy only what bun install needs to maximize layer caching: root manifest +
# lockfile + every workspace package.json (so Bun can plan the install graph).
COPY package.json bun.lock ./
COPY packages/kit/package.json ./packages/kit/
COPY specs/openiap/client/package.json ./specs/openiap/client/
COPY packages/apple/package.json ./packages/apple/
COPY packages/google/package.json ./packages/google/
COPY packages/docs/package.json ./packages/docs/
# `mcp-server` is a workspace member (added in PR #124 (https://github.com/hyodotdev/openiap/pull/124)). Without
# its package.json bun's workspace resolver disagrees with the
# root lockfile and `--frozen-lockfile` rejects the install with
# "lockfile had changes, but lockfile is frozen".
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/conformance/package.json ./packages/conformance/
COPY specs/openiap/commerce-protocol/package.json ./specs/openiap/commerce-protocol/
RUN bun install --frozen-lockfile --filter @hyodotdev/openiap-kit

# --- Build the unified app (Vite SPA + compiled Bun server) --------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY packages/kit ./packages/kit
COPY packages/mcp-server ./packages/mcp-server
# The MCP client imports the client specification's public kit-api subpath.
COPY specs/openiap/client ./specs/openiap/client
# Kit runtime code imports openiap-commerce-protocol (generated schemas,
# binding manifest, capability descriptor); without the sources the workspace
# symlink dangles inside the image and only inside the image.
COPY specs/openiap/commerce-protocol ./specs/openiap/commerce-protocol
# Bun workspaces install some deps under each package's
# local node_modules (e.g. `vite`, `@vitejs/plugin-react`) instead of
# fully hoisting. Pull kit's local node_modules from the deps stage
# AFTER the source COPY so it isn't clobbered. Without this the
# build fails with `vite: command not found` (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review
# fallout).
COPY --from=deps /app/packages/kit/node_modules ./packages/kit/node_modules
COPY --from=deps /app/packages/mcp-server/node_modules ./packages/mcp-server/node_modules
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
FROM gcr.io/distroless/base-debian12:nonroot@sha256:7f0c72cd138b442ae0deeb69c08b1acf5525439ba251a49ad93c320a061567e5 AS runtime
WORKDIR /srv

ARG IAPKIT_REVISION=unknown
LABEL org.opencontainers.image.title="IAPKit" \
      org.opencontainers.image.source="https://github.com/hyodotdev/openiap" \
      org.opencontainers.image.revision="${IAPKIT_REVISION}"

COPY --from=builder --chown=65532:65532 /app/packages/kit/openiap-kit-server ./openiap-kit-server
COPY --from=builder --chown=65532:65532 /app/packages/kit/dist ./public

ENV STATIC_ROOT=/srv/public
ENV PORT=3000
ENV NODE_ENV=production
ENV APP_ENV=production
ENV IAPKIT_REVISION=${IAPKIT_REVISION}
EXPOSE 3000/tcp

USER 65532:65532
ENTRYPOINT ["./openiap-kit-server"]
