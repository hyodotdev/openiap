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

# Libraries use symlinks to root openiap-versions.json
echo ""
echo "📦 Syncing to libraries..."
create_symlink "libraries/react-native-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/expo-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/flutter_inapp_purchase/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/godot-iap/openiap-versions.json" "../../openiap-versions.json"
create_symlink "libraries/kmp-iap/openiap-versions.json" "../../openiap-versions.json"

# Sync generated types from packages/gql to libraries
echo ""
echo "📦 Syncing generated types..."
GQL_GENERATED="packages/gql/src/generated"

# TypeScript types → react-native-iap, expo-iap
if [ -f "$GQL_GENERATED/types.ts" ]; then
    cp "$GQL_GENERATED/types.ts" "libraries/react-native-iap/src/types.ts"
    echo "  ✓ libraries/react-native-iap/src/types.ts"
    cp "$GQL_GENERATED/types.ts" "libraries/expo-iap/src/types.ts"
    echo "  ✓ libraries/expo-iap/src/types.ts"
fi

# Dart types → flutter_inapp_purchase
if [ -f "$GQL_GENERATED/types.dart" ]; then
    cp "$GQL_GENERATED/types.dart" "libraries/flutter_inapp_purchase/lib/types.dart"
    echo "  ✓ libraries/flutter_inapp_purchase/lib/types.dart"
fi

# GDScript types → godot-iap
if [ -f "$GQL_GENERATED/types.gd" ]; then
    cp "$GQL_GENERATED/types.gd" "libraries/godot-iap/addons/godot-iap/types.gd"
    echo "  ✓ libraries/godot-iap/addons/godot-iap/types.gd"
fi

echo "✅ Version files and types synced successfully"
