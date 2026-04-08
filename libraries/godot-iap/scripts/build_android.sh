#!/bin/bash
# Build script for GodotIap Android plugin
#
# Prerequisites:
# 1. Android SDK installed
# 2. ANDROID_HOME environment variable set
# 3. Godot Android library (godot-lib.aar) in android/libs/
#
# Usage:
#   ./scripts/build_android.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$PROJECT_ROOT/android"

echo "=== Building GodotIap Android Plugin ==="
echo "Project root: $PROJECT_ROOT"
echo "Android source: $ANDROID_DIR"

cd "$ANDROID_DIR"

# Check for Godot library
if [ ! -d "libs" ]; then
    mkdir -p libs
    echo ""
    echo "⚠ Warning: libs/ directory created but godot-lib.aar is missing"
    echo "  To build, you need to:"
    echo "  1. Export a Godot project for Android once"
    echo "  2. Copy godot-lib.aar from the export to android/libs/"
    echo "  Or download from: https://godotengine.org/download"
    echo ""
fi

# Build debug and release
echo ""
echo "=== Building Debug ==="
./gradlew assembleDebug

echo ""
echo "=== Building Release ==="
./gradlew assembleRelease

echo ""
echo "=== Build Complete ==="
echo "Output files:"
ls -la "$PROJECT_ROOT/Example/addons/godot-iap/android/" 2>/dev/null || echo "  (no files yet)"
