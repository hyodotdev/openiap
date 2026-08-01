#!/bin/bash

# Regenerate and stage every generated file that embeds release version
# metadata (docs version-metadata.json via sync-versions.sh, llms.txt /
# llms-full.txt / context.md via scripts/agent compile:ai). Release workflows
# call this inside their version-bump commit step so the bump and its derived
# files land in the same commit; otherwise CI's clean-worktree audits
# (Audit SDK Parity, Test Agent Scripts) fail on every later PR.
# Requires node, python3, and bun on PATH.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

./scripts/sync-versions.sh

(cd scripts/agent && bun install --frozen-lockfile && bun run compile:ai)

git add \
  packages/docs/src/generated/version-metadata.json \
  packages/docs/public/llms.txt \
  packages/docs/public/llms-full.txt \
  knowledge/_claude-context/context.md
