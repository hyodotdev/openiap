#!/bin/bash
# Sync versions from repository version sources to platform configs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSIONS_FILE="$PROJECT_ROOT/openiap-versions.json"
GRADLE_PROPS="$PROJECT_ROOT/android/gradle.properties"
GOOGLE_OPENIAP_BUILD="$PROJECT_ROOT/../../packages/google/openiap/build.gradle.kts"

if [ ! -f "$VERSIONS_FILE" ]; then
    echo "Error: openiap-versions.json not found at $VERSIONS_FILE"
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

# Read OpenIAP versions from JSON
APPLE_VERSION="$(read_openiap_version apple)"
GOOGLE_VERSION="$(read_openiap_version google)"

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
if [ -z "$COROUTINES_VERSION" ]; then
    echo "Error: missing Kotlinx Coroutines version"
    exit 1
fi

echo "Versions:"
echo "  OpenIAP Apple: $APPLE_VERSION (read directly by Package.swift)"
echo "  OpenIAP Google: $GOOGLE_VERSION"
echo "  Kotlinx Coroutines: $COROUTINES_VERSION"

# Note: iOS Package.swift now reads version directly from openiap-versions.json
# No template sync needed for iOS

"$SCRIPT_DIR/write-gdap.sh" "$PROJECT_ROOT/addons/godot-iap/android/GodotIap.gdap"

echo "Version sync complete!"
