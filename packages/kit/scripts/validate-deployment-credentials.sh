#!/usr/bin/env bash
set -euo pipefail

for name in CONVEX_DEPLOY_KEY FLY_API_TOKEN; do
  if [ -z "${!name:-}" ]; then
    echo "error: $name is required for the coordinated deployment." >&2
    exit 1
  fi
done
if [[ ! "${IAPKIT_VERIFICATION_SOURCE_SECRET:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "error: IAPKIT_VERIFICATION_SOURCE_SECRET must be 32 random bytes encoded as lowercase hex." >&2
  exit 1
fi
