#!/bin/bash

# Android 에뮬레이터 시작 및 앱 설치 스크립트
set -e

PROJECT_ROOT="${BASH_SOURCE%/*}/.."
cd "$PROJECT_ROOT"

echo "📱 Checking Android emulator status..."

# 실행 중인 에뮬레이터 확인
RUNNING_DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l)

if [ "$RUNNING_DEVICES" -eq 0 ]; then
    echo "🚀 Starting Android emulator..."
    
    # 에뮬레이터 백그라운드에서 시작
    emulator -avd Pixel_9_API_36 &
    EMULATOR_PID=$!
    
    echo "⏳ Waiting for emulator to boot..."
    # 에뮬레이터가 완전히 부팅될 때까지 대기
    adb wait-for-device
    
    # 부팅이 완료될 때까지 추가 대기
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do
        echo "   Still booting..."
        sleep 2
    done
    
    echo "✅ Emulator is ready!"
else
    echo "✅ Android device/emulator is already running"
fi

echo "🔨 Building and installing app..."
./gradlew :example:composeApp:installDebug

echo "🚀 Launching app..."
adb shell am start -n dev.hyo.martie/dev.hyo.martie.MainActivity

echo "🎉 App launched successfully!"
echo "📱 The app should now be running in the emulator"
