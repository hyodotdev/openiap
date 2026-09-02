#!/usr/bin/env bash
set -euo pipefail

# Generate types from the local client specification in the monorepo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONOREPO_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"

# Canonical generation path
GQL_DIR="${MONOREPO_ROOT}/specs/openiap/client"

# Check if the client specification exists
if [[ ! -d "$GQL_DIR" ]]; then
  echo "Error: client specification not found at $GQL_DIR" >&2
  echo "Please run this from the monorepo structure" >&2
  exit 1
fi

# Generate and sync through the client specification. Its sync step owns the Google
# target mapping and invokes the canonical, fail-closed Kotlin post-processor.
echo "📦 Generating and syncing types through the client specification..."
cd "$GQL_DIR"
bun run generate
