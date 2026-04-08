#!/bin/bash
# Sync versions from openiap-versions.json and gradle.properties to platform configs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSIONS_FILE="$PROJECT_ROOT/openiap-versions.json"
GRADLE_PROPS="$PROJECT_ROOT/android/gradle.properties"

if [ ! -f "$VERSIONS_FILE" ]; then
    echo "Error: openiap-versions.json not found at $VERSIONS_FILE"
    exit 1
fi

# Read OpenIAP versions from JSON
APPLE_VERSION=$(python3 -c "import json; print(json.load(open('$VERSIONS_FILE'))['apple'])")
GOOGLE_VERSION=$(python3 -c "import json; print(json.load(open('$VERSIONS_FILE'))['google'])")

# Read kotlinx-coroutines version from gradle.properties
COROUTINES_VERSION=$(grep "kotlinxCoroutinesVersion=" "$GRADLE_PROPS" | cut -d'=' -f2)

echo "Versions:"
echo "  OpenIAP Apple: $APPLE_VERSION (read directly by Package.swift)"
echo "  OpenIAP Google: $GOOGLE_VERSION"
echo "  Kotlinx Coroutines: $COROUTINES_VERSION"

# Note: iOS Package.swift now reads version directly from openiap-versions.json
# No template sync needed for iOS

# Update godot_iap_plugin.gd Android dependencies
PLUGIN_FILE="$PROJECT_ROOT/Example/addons/godot-iap/godot_iap_plugin.gd"
if [ -f "$PLUGIN_FILE" ]; then
    # Use portable sed syntax (works on both macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/openiap-google:[0-9.]*\"/openiap-google:$GOOGLE_VERSION\"/g" "$PLUGIN_FILE"
        sed -i '' "s/kotlinx-coroutines-android:[0-9.]*\"/kotlinx-coroutines-android:$COROUTINES_VERSION\"/g" "$PLUGIN_FILE"
    else
        sed -i "s/openiap-google:[0-9.]*\"/openiap-google:$GOOGLE_VERSION\"/g" "$PLUGIN_FILE"
        sed -i "s/kotlinx-coroutines-android:[0-9.]*\"/kotlinx-coroutines-android:$COROUTINES_VERSION\"/g" "$PLUGIN_FILE"
    fi
    echo "Updated: Example/addons/godot-iap/godot_iap_plugin.gd"
fi

# Update GDAP file Android dependencies
GDAP_FILE="$PROJECT_ROOT/addons/godot-iap/android/GodotIap.gdap"
if [ -f "$GDAP_FILE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/openiap-google:[0-9.]*\"/openiap-google:$GOOGLE_VERSION\"/g" "$GDAP_FILE"
    else
        sed -i "s/openiap-google:[0-9.]*\"/openiap-google:$GOOGLE_VERSION\"/g" "$GDAP_FILE"
    fi
    echo "Updated: addons/godot-iap/android/GodotIap.gdap"
fi

echo "Version sync complete!"
