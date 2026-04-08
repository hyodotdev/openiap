#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

# Read TAG from openiap-versions.json
VERSION=$(grep '"gql"' "$REPO_ROOT/openiap-versions.json" | sed 's/.*: *"\([^"]*\)".*/\1/')
TAG="gql-${VERSION}"

ASSET_NAME="openiap-gdscript.zip"
DOWNLOAD_URL="https://github.com/hyodotdev/openiap/releases/download/${TAG}/${ASSET_NAME}"
TARGET_DIR="$REPO_ROOT/Example/addons/godot-iap"

TEMP_DIR=$(mktemp -d)
ZIP_PATH="$TEMP_DIR/$ASSET_NAME"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "⬇️  Downloading $ASSET_NAME from $DOWNLOAD_URL"
curl -fL "$DOWNLOAD_URL" -o "$ZIP_PATH"

echo "📦 Extracting GDScript types"
unzip -qo "$ZIP_PATH" -d "$TEMP_DIR"
rm -f "$ZIP_PATH"

mkdir -p "$TARGET_DIR"

# Copy extracted files to target directory
if [ -f "$TEMP_DIR/types.gd" ]; then
  mv "$TEMP_DIR/types.gd" "$TARGET_DIR/types.gd"
  echo "✅ types.gd has been updated at $TARGET_DIR/types.gd"
fi

# List all extracted files
echo "📁 Extracted files:"
ls -la "$TEMP_DIR"
