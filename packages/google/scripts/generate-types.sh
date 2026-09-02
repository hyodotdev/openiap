#!/usr/bin/env bash
set -euo pipefail

# Generate types from local gql package in monorepo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONOREPO_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"

# Canonical generation path
GQL_DIR="${MONOREPO_ROOT}/specs/openiap/client"

# Check if gql package exists
if [[ ! -d "$GQL_DIR" ]]; then
  echo "Error: gql package not found at $GQL_DIR" >&2
  echo "Please run this from the monorepo structure" >&2
  exit 1
fi

# Generate and sync through the GQL package. Its sync step owns the Google
# target mapping and invokes the canonical, fail-closed Kotlin post-processor.
echo "📦 Generating and syncing types through the GQL package..."
cd "$GQL_DIR"
bun run generate
