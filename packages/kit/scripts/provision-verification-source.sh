#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/validate-deployment-credentials.sh"
bash "$SCRIPT_DIR/verify-production-convex-target.sh"

# Neither command receives the credential in argv or writes it to a build file.
if ! printf '%s' "$IAPKIT_VERIFICATION_SOURCE_SECRET" |
  bunx convex env set --prod IAPKIT_VERIFICATION_SOURCE_SECRET >/dev/null 2>&1; then
  echo "error: could not configure the verification source on the verified Convex target." >&2
  exit 1
fi
if ! printf 'IAPKIT_VERIFICATION_SOURCE_SECRET=%s\n' "$IAPKIT_VERIFICATION_SOURCE_SECRET" |
  flyctl secrets import --stage --app openiap-kit >/dev/null 2>&1; then
  echo "error: could not stage the verification source for the Fly deployment." >&2
  exit 1
fi
echo "Verification source configured for Convex and staged for Fly."
