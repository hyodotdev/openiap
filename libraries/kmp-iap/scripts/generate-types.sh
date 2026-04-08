#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

# Read TAG from openiap-versions.json
VERSION=$(grep '"gql"' "$REPO_ROOT/openiap-versions.json" | sed 's/.*: *"\([^"]*\)".*/\1/')
TAG="gql-${VERSION}"

ASSET_NAME="openiap-kotlin.zip"
DOWNLOAD_URL="https://github.com/hyodotdev/openiap/releases/download/${TAG}/${ASSET_NAME}"
TARGET_DIR="$REPO_ROOT/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap"
TARGET_FILE="$TARGET_DIR/Types.kt"

TEMP_DIR=$(mktemp -d)
ZIP_PATH="$TEMP_DIR/$ASSET_NAME"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "⬇️  Downloading $ASSET_NAME from $DOWNLOAD_URL"
curl -fL "$DOWNLOAD_URL" -o "$ZIP_PATH"

echo "📦 Extracting Types.kt"
unzip -qo "$ZIP_PATH" Types.kt -d "$TEMP_DIR"
rm -f "$ZIP_PATH"

mkdir -p "$TARGET_DIR"
mv "$TEMP_DIR/Types.kt" "$TARGET_FILE"

# Ensure generated file declares the correct package and fix enum syntax
python3 - <<'PY' "$TARGET_FILE"
import sys
import re

path = sys.argv[1]
package_line = "package io.github.hyochan.kmpiap.openiap\n"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix package declaration
lines = content.split('\n')
pkg_idx = next((i for i, l in enumerate(lines) if l.strip().startswith("package ")), None)
if pkg_idx is not None:
    lines[pkg_idx] = package_line.strip()
else:
    insert_index = next((i + 1 for i, l in enumerate(lines) if l.startswith("@file:Suppress")), 0)
    lines.insert(insert_index, "")
    lines.insert(insert_index + 1, package_line.strip())
    lines.insert(insert_index + 2, "")

content = '\n'.join(lines)

# Fix enum classes: add semicolon after last enum entry before companion object
# Match enum entry ending with ) followed by newline and companion object
content = re.sub(
    r'("[^"]+"\))([,]?)\s*\n(\s+companion object)',
    r'\1;\n\3',
    content
)

# Step 1: Remove 'override' from interface properties
content = re.sub(
    r'(public interface (?:ProductCommon|PurchaseCommon)\s*\{[^}]*?)(\s+override )(val )',
    r'\1\3',
    content,
    flags=re.DOTALL
)

# Step 2: Add 'override' to implementing class properties
# Find all data classes that implement ProductCommon or PurchaseCommon and add override to matching properties

# Properties that need override
product_props = r'(currency|debugDescription|description|displayName|displayPrice|id|platform|price|title|type)'
purchase_props = r'(currentPlanId|id|ids|isAutoRenewing|productId|purchaseState|purchaseToken|quantity|transactionDate)'

# Pattern to match data class declarations with ProductCommon or PurchaseCommon
# and add override to properties in the constructor
def add_override_to_class(match):
    class_content = match.group(0)

    # Add override to product properties
    class_content = re.sub(
        rf'(\n\s+)(val|var) ({product_props}|{purchase_props}):',
        r'\1override \2 \3:',
        class_content
    )

    return class_content

# Match data classes that implement ProductCommon or PurchaseCommon
pattern = r'public data class \w+\([^)]*?\)\s*:\s*(?:[^{]*?(?:ProductCommon|PurchaseCommon)[^{]*?)\{'

content = re.sub(pattern, add_override_to_class, content, flags=re.DOTALL)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
PY

echo "✅ Types.kt has been updated at $TARGET_FILE"
