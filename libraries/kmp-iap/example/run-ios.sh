#!/bin/bash

# Run iOS app script

echo "Building iOS app..."
cd /Users/hyo/Github/hyochan/kmp-iap/example

# Build the Kotlin Multiplatform part first
./gradlew :composeApp:linkPodDebugFrameworkIosSimulatorArm64

# Build and run the iOS app
cd iosApp
xcodebuild \
    -project iosApp.xcodeproj \
    -scheme iosApp \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath build/DerivedData \
    -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=latest' \
    build

# Launch in simulator
xcrun simctl boot "iPhone 16 Pro" 2>/dev/null || true
xcrun simctl install "iPhone 16 Pro" build/DerivedData/Build/Products/Debug-iphonesimulator/kmp-iap-example.app
xcrun simctl launch "iPhone 16 Pro" dev.hyo.martie