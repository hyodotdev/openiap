#!/usr/bin/env bash
# Smoke test for the compiled server binary.
#
# Why this exists: the precompiled binary can bind a port even when
# `bun --watch ./server/server.ts` works fine locally — the two have
# different module-loading semantics (auto-default-export serving vs.
# explicit Bun.serve). Catching startup regressions here is cheap and
# matches what CI's smoke step would do.
#
# Required env:
#   None. Uses placeholder CONVEX_URL + local dist so it never hits
#   real external services.
#
# Exit code: 0 on success, non-zero if startup or any probe fails.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY="$ROOT_DIR/openiap-kit-server"
DIST="$ROOT_DIR/dist"
PORT="${SMOKE_PORT:-3100}"    # avoid colliding with a dev server on 3000

if [[ ! -x "$BINARY" ]]; then
  echo "smoke: binary not found at $BINARY — run 'bun run build:server' first" >&2
  exit 1
fi

if [[ ! -f "$DIST/index.html" ]]; then
  echo "smoke: dist/index.html not found — run 'bun run build' first" >&2
  exit 1
fi

# Per-process log file via mktemp so parallel CI matrix jobs don't
# interleave their writes into a shared `/tmp/openiap-kit-smoke.log`
# and cross-contaminate each other's failure output.
LOG_FILE="$(mktemp /tmp/openiap-kit-smoke.XXXXXX.log)"

# Run the binary in the background with placeholder env.
CONVEX_URL="https://placeholder-build-1.convex.cloud" \
VITE_KIT_CONVEX_URL="https://placeholder-build-1.convex.cloud" \
STATIC_ROOT="$DIST" \
PORT="$PORT" \
"$BINARY" > "$LOG_FILE" 2>&1 &
PID=$!

# Always clean up the child + temp log, even on failure.
cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

# Wait for this child to report that it owns the listener before probing HTTP.
# A health-first poll can accidentally hit an older process on the same port and
# report success even though the binary under test exited with EADDRINUSE.
ready=0
for _ in $(seq 1 20); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "smoke: server process exited before owning port $PORT" >&2
    echo "---- server log ----" >&2
    cat "$LOG_FILE" >&2 || true
    exit 1
  fi
  if grep -Fq "IAPKit server listening on :${PORT}" "$LOG_FILE"; then
    ready=1
    break
  fi
  sleep 0.25
done

if [[ "$ready" -ne 1 ]]; then
  echo "smoke: server did not confirm ownership of port $PORT" >&2
  echo "---- server log ----" >&2
  cat "$LOG_FILE" >&2 || true
  exit 1
fi

fail=0
probe() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${path}")"
  if [[ "$code" != "$expected" ]]; then
    echo "smoke: $path expected $expected, got $code" >&2
    fail=1
  else
    echo "smoke: $path → $code ✓"
  fi
}

probe_json_post() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer openiap-kit_smoke-test-key" \
    -H "Content-Type: application/json" \
    --data '{}' \
    "http://localhost:${PORT}${path}")"
  if [[ "$code" != "$expected" ]]; then
    echo "smoke: POST $path expected $expected, got $code" >&2
    fail=1
  else
    echo "smoke: POST $path → $code ✓"
  fi
}

# Core surface: liveness probe must return 200 and the SPA fallback
# must serve index.html for an unknown path.
probe "/health" "200"
probe "/" "200"
probe "/v1" "200"
probe "/api/v1" "200"
probe "/intu/project/intu/apikeys" "200"
probe "/assets/missing-build-asset.js" "404"
probe "/missing-static-doc.json" "404"
# The removed outbound IAPKit-to-SDK SSE surface must remain absent in the
# compiled server, including both API mount points and the legacy key-in-path
# shape. These probes also guard against the SPA fallback masking a missing API
# route with a misleading 200 HTML response.
probe "/v1/webhooks/stream" "404"
probe "/api/v1/webhooks/stream" "404"
probe "/v1/webhooks/stream/openiap-kit_pk_smoke-test-key" "404"
probe "/api/v1/webhooks/stream/openiap-kit_pk_smoke-test-key" "404"
# Exercise the compiled receipt route without reaching Convex or a store. The
# well-formed Bearer header passes auth-shape middleware, then the empty JSON
# object is rejected by the request schema with 400.
probe_json_post "/v1/purchase/verify" "400"

if [[ "$fail" -ne 0 ]]; then
  echo "---- server log ----" >&2
  cat "$LOG_FILE" >&2 || true
  exit 1
fi

# HTTP probes pass even when the SPA bundle is broken at runtime
# (PR #120 (https://github.com/hyodotdev/openiap/pull/120) shipped a chunk-cycle crash that left a 200 response and a
# blank page). Run a headless-browser smoke to catch that class of
# failure. Skipped when SKIP_BROWSER_SMOKE=1 (e.g. dev iteration where
# Playwright + chromium aren't installed yet).
if [[ "${SKIP_BROWSER_SMOKE:-0}" != "1" ]]; then
  if ! SMOKE_URL="http://localhost:${PORT}/" bun run "$ROOT_DIR/scripts/smoke-browser.ts"; then
    echo "---- server log ----" >&2
    cat "$LOG_FILE" >&2 || true
    exit 1
  fi
fi

echo "smoke: all probes passed"
