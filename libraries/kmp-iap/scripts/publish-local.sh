#!/bin/bash
set -euo pipefail

echo "📦 Publishing KMP-IAP to Maven Local"
echo "===================================="

# Check if version is provided
VERSION=${1:-"1.0.0-SNAPSHOT"}

echo "Version: $VERSION"
echo ""

# Clean and build
echo "🧹 Cleaning..."
./gradlew clean

# Publish to Maven Local
echo "📤 Publishing to Maven Local..."
./gradlew :library:publishToMavenLocal -PlibraryVersion="$VERSION"

echo ""
echo "✅ Published successfully to Maven Local!"
echo ""
echo "To use in your project, add:"
echo ""
echo "dependencies {"
echo "    implementation(\"io.github.hyochan:kmp-iap:$VERSION\")"
echo "}"
echo ""
echo "Make sure to add mavenLocal() to your repositories:"
echo ""
echo "repositories {"
echo "    mavenLocal()"
echo "    mavenCentral()"
echo "}"
