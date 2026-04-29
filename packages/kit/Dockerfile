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
RUN bun install --frozen-lockfile --filter @hyodotdev/openiap-kit

# --- Build the unified app (Vite SPA + compiled Bun server) --------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/kit/node_modules ./packages/kit/node_modules
COPY package.json bun.lock ./
COPY packages/kit ./packages/kit
WORKDIR /app/packages/kit
ARG VITE_KIT_CONVEX_URL
ENV VITE_KIT_CONVEX_URL=${VITE_KIT_CONVEX_URL}
# Client-side Sentry DSN baked into the SPA bundle. Technically public
# (any visitor can read it out of the JS), but we still route it through
# a build arg instead of committing to the repo so it rotates cleanly.
ARG VITE_KIT_SENTRY_DSN
ENV VITE_KIT_SENTRY_DSN=${VITE_KIT_SENTRY_DSN}
# Mixpanel project token — also public by design (exposed in the SPA
# bundle to identify users client-side). Empty value disables init.
ARG VITE_KIT_MIXPANEL_TOKEN
ENV VITE_KIT_MIXPANEL_TOKEN=${VITE_KIT_MIXPANEL_TOKEN}
RUN bun run build:all

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
