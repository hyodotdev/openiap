#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
codex_home="${CODEX_HOME:-$HOME/.codex}"
skills_dir="$codex_home/skills"

mkdir -p "$skills_dir"

ln -sfn "$repo_root/.codex/skills/openiap-workflows" \
  "$skills_dir/openiap-workflows"

echo "Installed Codex skill: openiap-workflows"
echo "Target: $skills_dir/openiap-workflows"
