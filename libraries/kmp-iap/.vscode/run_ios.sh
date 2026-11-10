#!/bin/bash

# iOS Simulator 실행 스크립트
# 1. Xcode 프로젝트 빌드
# 2. iOS 시뮬레이터 시작
# 3. 앱 설치 및 실행

set -e

EXAMPLE_DIR="${BASH_SOURCE%/*}/../example"
cd "$EXAMPLE_DIR"

echo "🔨 Building iOS project..."
xcodebuild -project iosApp/iosApp.xcodeproj -scheme iosApp -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 16,OS=18.5' build

echo "📱 Starting iOS Simulator..."
# 사용 가능한 iPhone 시뮬레이터 찾기 (부팅된 것 우선)
DEVICE_ID=$(xcrun simctl list devices | grep "iPhone" | grep "Booted" | head -1 | grep -o '([A-F0-9-]\{36\})' | tr -d '()')

if [ -z "$DEVICE_ID" ]; then
    echo "🔍 No booted iPhone simulator found. Looking for available ones..."
    DEVICE_ID=$(xcrun simctl list devices available | grep "iPhone 16" | head -1 | grep -o '([A-F0-9-]\{36\})' | tr -d '()')
fi

if [ -z "$DEVICE_ID" ]; then
    echo "❌ iPhone 16 simulator not found. Using first available iPhone simulator..."
    DEVICE_ID=$(xcrun simctl list devices available | grep "iPhone" | head -1 | grep -o '([A-F0-9-]\{36\})' | tr -d '()')
fi

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No iPhone simulators found!"
    exit 1
fi

echo "🚀 Using simulator with ID: $DEVICE_ID"

# 시뮬레이터가 이미 부팅되어 있는지 확인
BOOT_STATUS=$(xcrun simctl list devices | grep "$DEVICE_ID" | grep -o '(.*)')
if [[ "$BOOT_STATUS" == *"Booted"* ]]; then
    echo "✅ Simulator is already booted"
else
    echo "🔄 Booting simulator..."
    xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
    
    # 시뮬레이터 앱 열기
    echo "📱 Opening Simulator app..."
    open -a Simulator
    
    # 시뮬레이터가 완전히 부팅될 때까지 대기
    echo "⏳ Waiting for simulator to boot..."
    xcrun simctl bootstatus "$DEVICE_ID" -b
fi

echo "📦 Installing app..."
# Find app in XcodeDerivedData (correct path, excluding Index.noindex)
APP_PATH=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name "kmp-iap-example.app" -path "*/Build/Products/Debug-iphonesimulator/*" -not -path "*/Index.noindex/*" -type d 2>/dev/null | head -1)

if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
    echo "Found app at: $APP_PATH"

    # Install app to simulator
    echo "🔧 Installing app to simulator..."
    xcrun simctl install "$DEVICE_ID" "$APP_PATH"

    echo "🎉 Launching app..."
    xcrun simctl launch "$DEVICE_ID" dev.hyo.martie
    echo "✅ iOS app launched successfully!"
else
    echo "❌ App not found. Searching for available apps..."
    find "$HOME/Library/Developer/Xcode/DerivedData" -name "*.app" -path "*/Build/Products/Debug-iphonesimulator/*" 2>/dev/null || echo "No apps found in DerivedData"

    echo "Try building the project first with:"
    echo "xcodebuild -project iosApp/iosApp.xcodeproj -scheme iosApp -configuration Debug build"
    exit 1
fi
