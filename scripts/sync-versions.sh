#!/bin/bash

# Sync version files from root to packages
# Uses symlinks for native packages, copies for docs (Vercel requirement)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$REPO_ROOT"

echo "📦 Syncing version files..."

# Function to create symlink
create_symlink() {
    local target="$1"
    local link_path="$2"

    # Remove existing file or symlink
    if [ -e "$target" ] || [ -L "$target" ]; then
        rm "$target"
    fi

    # Create symlink
    ln -s "$link_path" "$target"
    echo "  ✓ $target -> $link_path (symlink)"
}

# Function to copy file
copy_file() {
    local target="$1"

    # Remove existing file or symlink
    if [ -e "$target" ] || [ -L "$target" ]; then
        rm "$target"
    fi

    # Copy file
    cp "openiap-versions.json" "$target"
    echo "  ✓ $target (copied)"
}

# Docs needs real file for Vercel deployment
copy_file "packages/docs/openiap-versions.json"

# Native packages can use symlinks
create_symlink "packages/apple/Sources/openiap-versions.json" "../../../openiap-versions.json"
create_symlink "packages/google/openiap-versions.json" "../../openiap-versions.json"

echo "✅ Version files synced successfully"
