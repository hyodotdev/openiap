#!/bin/bash

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$REPO_ROOT"

# Preserve the package-local entrypoint while keeping deployment policy,
# version handling, branch guards, and Vercel behavior in one canonical script.
exec ./scripts/deploy.sh "$@"
