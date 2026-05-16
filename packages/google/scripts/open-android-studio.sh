#!/bin/bash
set -euo pipefail

# OpenIAP Google - Open in Android Studio
# This script opens the Google (Android) package in Android Studio

echo "🚀 Opening OpenIAP Google (Android) in Android Studio..."

# Check if Android Studio is installed
ANDROID_STUDIO_PATH="/Applications/Android Studio.app"
if [ ! -d "$ANDROID_STUDIO_PATH" ]; then
    echo "❌ Android Studio not found at: $ANDROID_STUDIO_PATH"
    echo "Please install Android Studio or update the path in this script"
    exit 1
fi

# Get the script directory and go to the google package root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GOOGLE_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Open the project in Android Studio
cd "$GOOGLE_ROOT"
open -a "Android Studio" .

echo "✅ Google (Android) package opened in Android Studio"
echo ""
echo "📖 Quick Start Guide:"
echo "  1. Wait for Gradle sync to complete"
echo "  2. Select 'Example' configuration from the run dropdown"
echo "  3. Connect an Android device or start an emulator"
echo "  4. Click the Run button (▶️) to launch the example app"
echo ""
echo "🔧 Available Gradle Tasks:"
echo "  • Build Library: ./gradlew :openiap:build"
echo "  • Build Example: ./gradlew :Example:assembleDebug"
echo "  • Install Example: ./gradlew :Example:installDebug"
echo "  • Run Tests: ./gradlew :openiap:test"
echo ""
echo "📱 Running from Terminal:"
echo "  ./gradlew :Example:installDebug && adb shell am start -n dev.hyo.martie/.MainActivity"
echo ""
echo "🔍 View Logs:"
echo "  adb logcat -s OpenIAP:V MainActivity:V"
