#!/bin/bash

# Sync version files from root to packages
# This ensures real files exist for package publishing

set -e

ROOT_VERSION_FILE="openiap-versions.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

echo "📦 Syncing version files..."

# Copy to packages that need real files (not symlinks)
TARGETS=(
    "packages/docs/openiap-versions.json"
    "packages/apple/Sources/openiap-versions.json"
    "packages/google/openiap-versions.json"
)

for target in "${TARGETS[@]}"; do
    # Remove symlink if it exists
    if [ -L "$target" ]; then
        rm "$target"
    fi

    # Copy real file
    cp "$ROOT_VERSION_FILE" "$target"
    echo "  ✓ $target"
done

echo "✅ Version files synced successfully"
