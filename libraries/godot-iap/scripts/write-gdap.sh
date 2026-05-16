#!/bin/bash
# Write Godot Android plugin metadata from the repository version sources.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="${1:-$PROJECT_ROOT/addons/godot-iap/android/GodotIap.gdap}"
VERSIONS_FILE="$PROJECT_ROOT/openiap-versions.json"
GRADLE_PROPS="$PROJECT_ROOT/android/gradle.properties"
GOOGLE_OPENIAP_BUILD="$PROJECT_ROOT/../../packages/google/openiap/build.gradle.kts"

if [ ! -f "$VERSIONS_FILE" ]; then
    echo "Error: openiap-versions.json not found at $VERSIONS_FILE" >&2
    exit 1
fi

read_openiap_version() {
    python3 - "$VERSIONS_FILE" "$1" <<'PY'
import json
import sys

path, key = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as file:
    value = json.load(file).get(key)

if not isinstance(value, str) or not value.strip():
    raise SystemExit(f"missing {key} in {path}")

print(value.strip())
PY
}

OPENIAP_GOOGLE_VERSION="$(read_openiap_version google)"

read_google_variable() {
    python3 - "$GOOGLE_OPENIAP_BUILD" "$1" <<'PY' || true
import re
import sys

path, name = sys.argv[1], sys.argv[2]
try:
    text = open(path, encoding="utf-8").read()
except FileNotFoundError:
    sys.exit(0)

match = re.search(rf'val\s+{re.escape(name)}\s*=\s*"([^"]+)"', text)
if match:
    print(match.group(1))
PY
}

fallback_property() {
    if [ ! -f "$GRADLE_PROPS" ]; then
        echo ""
        return
    fi
    grep "^$1=" "$GRADLE_PROPS" | cut -d'=' -f2 || true
}

COROUTINES_VERSION="$(read_google_variable coroutinesVersion)"
if [ -z "$COROUTINES_VERSION" ]; then
    COROUTINES_VERSION="$(fallback_property kotlinxCoroutinesVersion)"
fi

if [ -z "$OPENIAP_GOOGLE_VERSION" ] || [ -z "$COROUTINES_VERSION" ]; then
    echo "Error: missing OpenIAP Google or Kotlinx Coroutines version" >&2
    exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
cat > "$OUTPUT_FILE" <<EOF
[config]
name="GodotIap"
binary_type="local"
binary="GodotIap.release.aar"

[dependencies]
local=[]
remote=["io.github.hyochan.openiap:openiap-google:$OPENIAP_GOOGLE_VERSION", "org.jetbrains.kotlinx:kotlinx-coroutines-android:$COROUTINES_VERSION"]
EOF

echo "Wrote: $OUTPUT_FILE"
