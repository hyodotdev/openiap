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

# Run the binary in the background with placeholder env.
CONVEX_URL="https://placeholder.convex.cloud" \
STATIC_ROOT="$DIST" \
PORT="$PORT" \
"$BINARY" > /tmp/openiap-kit-smoke.log 2>&1 &
PID=$!

# Always clean up the child, even on failure.
cleanup() {
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
}
trap cleanup EXIT

# Poll until the server is listening or we give up. `kill -0` bails out
# fast when the child crashed during boot (bind conflict, missing env,
# import failure) instead of burning the full ~5s timeout before curl
# surfaces the same conclusion.
for _ in $(seq 1 20); do
  if curl -sS -f -o /dev/null "http://localhost:${PORT}/health"; then
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "smoke: server process exited before /health responded" >&2
    echo "---- server log ----" >&2
    cat /tmp/openiap-kit-smoke.log >&2 || true
    exit 1
  fi
  sleep 0.25
done

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

# Core surface: liveness probe must return 200 and the SPA fallback
# must serve index.html for an unknown path.
probe "/health" "200"
probe "/" "200"
probe "/api/v1" "200"

if [[ "$fail" -ne 0 ]]; then
  echo "---- server log ----" >&2
  cat /tmp/openiap-kit-smoke.log >&2 || true
  exit 1
fi

echo "smoke: all probes passed"
