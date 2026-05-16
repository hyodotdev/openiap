#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
VERSIONS_FILE="$REPO_ROOT/openiap-versions.json"

VERSION=$(python3 - "$VERSIONS_FILE" <<'PY'
import json
import sys
from pathlib import Path

versions_path = Path(sys.argv[1])
try:
    data = json.loads(versions_path.read_text(encoding="utf-8"))
except FileNotFoundError:
    print(f"Error: {versions_path} not found", file=sys.stderr)
    sys.exit(1)
except json.JSONDecodeError as exc:
    print(f"Error parsing {versions_path}: {exc}", file=sys.stderr)
    sys.exit(1)

value = data.get("spec")
if not value:
    print("Error: 'spec' version missing in openiap-versions.json", file=sys.stderr)
    sys.exit(1)

print(value)
PY
)
TAG="gql-${VERSION}"

ASSET_NAME="openiap-gdscript.zip"
DOWNLOAD_URL="https://github.com/hyodotdev/openiap/releases/download/${TAG}/${ASSET_NAME}"
ADDON_DIR="$REPO_ROOT/addons/godot-iap"
EXAMPLE_ADDON_DIR="$REPO_ROOT/Example/addons/godot-iap"

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

mkdir -p "$ADDON_DIR" "$EXAMPLE_ADDON_DIR"

# Copy extracted files to target directory
if [ -f "$TEMP_DIR/types.gd" ]; then
  cp "$TEMP_DIR/types.gd" "$ADDON_DIR/types.gd"
  cp "$TEMP_DIR/types.gd" "$EXAMPLE_ADDON_DIR/types.gd"
  echo "✅ types.gd has been updated at $ADDON_DIR/types.gd"
  echo "✅ types.gd has been updated at $EXAMPLE_ADDON_DIR/types.gd"
fi

# List all extracted files
echo "📁 Extracted files:"
ls -la "$TEMP_DIR"
