#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
VERSIONS_FILE="$REPO_ROOT/openiap-versions.json"

VERSION=$(python3 - "$VERSIONS_FILE" <<'PY'
import json
import re
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
if not isinstance(value, str) or not value.strip():
    print("Error: 'spec' version missing in openiap-versions.json", file=sys.stderr)
    sys.exit(1)
value = value.strip()
if not re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z.+_-]*", value):
    print(f"Error: invalid 'spec' version {value!r}", file=sys.stderr)
    sys.exit(1)

print(value)
PY
)
TAG="docs-${VERSION}"

TARGET_REPOSITORY_PATH="libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt"
DOWNLOAD_URL="https://raw.githubusercontent.com/hyodotdev/openiap/${TAG}/${TARGET_REPOSITORY_PATH}"
TARGET_DIR="$REPO_ROOT/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap"
TARGET_FILE="$TARGET_DIR/Types.kt"
HEADER_GUIDANCE="Refresh this file with the generated-types workflow documented for your checkout."

cleanup() {
  if [[ -n "${TEMP_FILE:-}" && -f "$TEMP_FILE" ]]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT

mkdir -p "$TARGET_DIR"
TEMP_FILE=$(mktemp "${TARGET_FILE}.tmp.XXXXXX")

echo "⬇️  Downloading the platform-ready KMP types from $DOWNLOAD_URL"
curl -fL "$DOWNLOAD_URL" -o "$TEMP_FILE"

PACKAGE_COUNT=$(grep -c '^package ' "$TEMP_FILE" || true)
if [[ "$PACKAGE_COUNT" -ne 1 ]] ||
  ! grep -qx 'package io.github.hyochan.kmpiap.openiap' "$TEMP_FILE"; then
  echo "Error: downloaded KMP types have an unexpected package declaration" >&2
  exit 1
fi
if ! grep -q 'AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY' "$TEMP_FILE"; then
  echo "Error: downloaded KMP types are missing the canonical generated header" >&2
  exit 1
fi
if ! grep -q '^public data class ProductRequest(' "$TEMP_FILE" ||
  [[ -n "$(tail -c 1 "$TEMP_FILE")" ]]; then
  echo "Error: downloaded file is not the expected generated KMP target" >&2
  exit 1
fi

python3 - "$TEMP_FILE" "//" "$HEADER_GUIDANCE" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
prefix = sys.argv[2]
guidance = sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
separator = f"{prefix} " + "=" * 76
header = f"{prefix} AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY"
expected = f"{prefix} {guidance}"
plain_lines = [line.rstrip("\r\n") for line in lines]
if len(lines) < 4 or plain_lines[0] != separator or plain_lines[1] != header:
    print("Error: downloaded file has an unexpected generated header.", file=sys.stderr)
    sys.exit(1)
try:
    closing_index = plain_lines.index(separator, 2)
except ValueError:
    print("Error: downloaded file has an unterminated generated header.", file=sys.stderr)
    sys.exit(1)
candidates = [
    index
    for index in range(2, closing_index)
    if plain_lines[index] == expected
    or re.fullmatch(
        re.escape(prefix) + r" Run `[^`\r\n]+`[^\r\n]*\.",
        plain_lines[index],
    )
]
if len(candidates) != 1:
    print("Error: downloaded file has unexpected generated guidance.", file=sys.stderr)
    sys.exit(1)
guidance_index = candidates[0]
if plain_lines[guidance_index] != expected:
    ending = "\r\n" if lines[guidance_index].endswith("\r\n") else "\n"
    lines[guidance_index] = expected + ending
    path.write_text("".join(lines), encoding="utf-8")
PY

chmod 0644 "$TEMP_FILE"
mv -f "$TEMP_FILE" "$TARGET_FILE"
TEMP_FILE=""

echo "✅ Types.kt has been updated at $TARGET_FILE from tag $TAG"
