#!/usr/bin/env bash
set -euo pipefail

# Generate types from local gql package in monorepo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONOREPO_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"

# Source and target paths
GQL_DIR="${MONOREPO_ROOT}/packages/gql"
SOURCE_FILE="${GQL_DIR}/src/generated/Types.swift"
OUTPUT_DIR="${REPO_ROOT}/Sources/Models"
OUTPUT_FILE="${OUTPUT_DIR}/Types.swift"

# Check if gql package exists
if [[ ! -d "$GQL_DIR" ]]; then
  echo "Error: gql package not found at $GQL_DIR" >&2
  echo "Please run this from the monorepo structure" >&2
  exit 1
fi

# Generate types in gql package first
echo "📦 Generating Swift types in gql package..."
cd "$GQL_DIR"
bun run generate:swift

# Check if source file was generated
if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Error: Types.swift not found at $SOURCE_FILE" >&2
  echo "Generation may have failed" >&2
  exit 1
fi

# Copy to ios package
echo "📋 Copying Types.swift to iOS package..."
mkdir -p "${OUTPUT_DIR}"
cp "${SOURCE_FILE}" "${OUTPUT_FILE}"

echo "✅ Successfully updated ${OUTPUT_FILE}"
