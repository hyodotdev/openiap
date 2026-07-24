#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
VERSIONS_FILE="$REPO_ROOT/openiap-versions.json"
TARGET_REPOSITORY_PATH="libraries/godot-iap/addons/godot-iap/types.gd"
TARGET_FILE="$REPO_ROOT/addons/godot-iap/types.gd"
HEADER_GUIDANCE="Refresh this file with the generated-types workflow documented for your checkout."

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
DOWNLOAD_URL="https://raw.githubusercontent.com/hyodotdev/openiap/${TAG}/${TARGET_REPOSITORY_PATH}"

cleanup() {
  if [[ -n "${TEMP_FILE:-}" && -f "$TEMP_FILE" ]]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT

mkdir -p "$(dirname "$TARGET_FILE")"
TEMP_FILE=$(mktemp "${TARGET_FILE}.tmp.XXXXXX")

echo "⬇️  Downloading the platform-ready GDScript types from $DOWNLOAD_URL"
curl -fL "$DOWNLOAD_URL" -o "$TEMP_FILE"

if ! grep -Fq 'AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY' "$TEMP_FILE" ||
  ! grep -q '^class ProductRequest:' "$TEMP_FILE" ||
  [[ -n "$(tail -c 1 "$TEMP_FILE")" ]]; then
  echo "Error: downloaded file is not the expected generated GDScript target." >&2
  exit 1
fi

python3 - "$TEMP_FILE" "#" "$HEADER_GUIDANCE" <<'PY'
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

echo "✅ types.gd has been updated at $TARGET_FILE from tag $TAG"
