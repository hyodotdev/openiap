#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$LIB_DIR/example/OpenIap.Maui.Example"
PROJECT="$APP_DIR/OpenIap.Maui.Example.csproj"
GOOGLE_DIR="$(cd "$LIB_DIR/../../packages/google" && pwd)"
MAUI_ANDROID_DIR="$LIB_DIR/android"
APP_ID="dev.hyo.martie"
OLD_APP_ID="dev.hyo.openiap.maui.example"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command adb
require_command dotnet
require_command java

LOCK_ROOT="$APP_DIR/obj"
LOCK_DIR="$LOCK_ROOT/.maui-android-launch.lock"
mkdir -p "$LOCK_ROOT"

acquire_lock() {
  for _ in {1..120}; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      echo "$$" > "$LOCK_DIR/pid"
      trap 'rm -rf "$LOCK_DIR"' EXIT
      return 0
    fi

    LOCK_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
      echo "Another MAUI Android launch is still running (pid $LOCK_PID). Waiting..."
      sleep 1
      continue
    fi

    echo "Removing stale MAUI Android launch lock."
    rm -rf "$LOCK_DIR"
  done

  echo "Timed out waiting for another MAUI Android launch to finish." >&2
  exit 1
}

acquire_lock

if ! dotnet workload list | grep -Eq '^maui([[:space:]]|$)'; then
  echo "MAUI workload missing. Run: sudo dotnet workload install maui" >&2
  exit 1
fi

adb start-server >/dev/null

DEVICE="${MAUI_ANDROID_DEVICE:-}"
if [ -z "$DEVICE" ]; then
  DEVICE="$(adb devices -l | awk 'NR > 1 && $2 == "device" && / usb:/ { print $1; exit }')"
fi

if [ -z "$DEVICE" ]; then
  DEVICE="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi

if [ -z "$DEVICE" ]; then
  echo "No connected Android device found." >&2
  adb devices -l >&2
  exit 1
fi

ABI="$(adb -s "$DEVICE" shell getprop ro.product.cpu.abi | tr -d '\r')"
case "$ABI" in
  arm64-v8a) RID="android-arm64" ;;
  armeabi-v7a | armeabi) RID="android-arm" ;;
  x86_64) RID="android-x64" ;;
  x86) RID="android-x86" ;;
  *)
    echo "Unsupported Android ABI '$ABI' on device '$DEVICE'." >&2
    exit 1
    ;;
esac

echo "Using Android device: $DEVICE ($ABI -> $RID)"
echo "Uninstalling previous $APP_ID build if present..."
adb -s "$DEVICE" uninstall "$APP_ID" >/dev/null 2>&1 || true
adb -s "$DEVICE" uninstall "$OLD_APP_ID" >/dev/null 2>&1 || true

echo "Resetting stale Android build server and wrapped assemblies..."
dotnet build-server shutdown >/dev/null 2>&1 || true
rm -rf "$APP_DIR/obj/Debug/net9.0-android/$RID/$RID/wrapped"
rm -f "$APP_DIR/bin/Debug/net9.0-android/$APP_ID.apk"
rm -f "$APP_DIR/bin/Debug/net9.0-android/$APP_ID-Signed.apk"
rm -f "$APP_DIR/bin/Debug/net9.0-android/$RID/$APP_ID.apk"
rm -f "$APP_DIR/bin/Debug/net9.0-android/$RID/$APP_ID-Signed.apk"

echo "Building OpenIAP Google Play AAR..."
(cd "$GOOGLE_DIR" && ./gradlew :openiap:assemblePlayRelease)

echo "Building MAUI Android shim AAR..."
(cd "$MAUI_ANDROID_DIR" && "$GOOGLE_DIR/gradlew" :openiap-maui-shim:assembleRelease)

echo "Building and packaging MAUI Android APK. This can take 1-2 minutes after DLL output..."
dotnet build "$PROJECT" \
  -f net9.0-android \
  -p:RuntimeIdentifier="$RID" \
  -p:EmbedAssembliesIntoApk=true \
  -maxcpucount:1 \
  -tl:off \
  -v:minimal

echo "Build completed. Locating APK..."
APK=""
for candidate in \
  "$APP_DIR/bin/Debug/net9.0-android/$RID/$APP_ID-Signed.apk" \
  "$APP_DIR/bin/Debug/net9.0-android/$RID/$APP_ID.apk" \
  "$APP_DIR/bin/Debug/net9.0-android/$APP_ID-Signed.apk" \
  "$APP_DIR/bin/Debug/net9.0-android/$APP_ID.apk" \
  "$APP_DIR/obj/Debug/net9.0-android/$RID/android/bin/$APP_ID.apk" \
  "$APP_DIR/obj/Debug/net9.0-android/android/bin/$APP_ID.apk"; do
  if [ -f "$candidate" ]; then
    APK="$candidate"
    break
  fi
done

if [ ! -f "$APK" ]; then
  echo "Android APK was not produced under $APP_DIR/bin/Debug/net9.0-android." >&2
  exit 1
fi

echo "Installing $APK..."
adb -s "$DEVICE" install --no-streaming -r "$APK"

ACTIVITY="$(adb -s "$DEVICE" shell cmd package resolve-activity --brief "$APP_ID" | tail -n1 | tr -d '\r')"
if [ -z "$ACTIVITY" ] || [[ "$ACTIVITY" != "$APP_ID/"* ]]; then
  echo "Could not resolve launcher activity for $APP_ID." >&2
  exit 1
fi

echo "Waking Android device..."
adb -s "$DEVICE" shell input keyevent 224 >/dev/null 2>&1 || true
adb -s "$DEVICE" shell wm dismiss-keyguard >/dev/null 2>&1 || true
adb -s "$DEVICE" shell input keyevent 82 >/dev/null 2>&1 || true

adb -s "$DEVICE" logcat -c
adb -s "$DEVICE" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
echo "Launching $ACTIVITY..."
adb -s "$DEVICE" shell am start -n "$ACTIVITY"

APP_ID_PATTERN="${APP_ID//./\\.}"
PID=""
FOREGROUND=""
for _ in {1..30}; do
  PID="$(adb -s "$DEVICE" shell pidof "$APP_ID" | tr -d '\r' || true)"
  FOREGROUND="$(adb -s "$DEVICE" shell dumpsys activity activities |
    grep -E "ResumedActivity:.*$APP_ID_PATTERN|mFocusedApp=.*$APP_ID_PATTERN|topResumedActivity=.*$APP_ID_PATTERN" || true)"
  if [ -n "$PID" ] && [ -n "$FOREGROUND" ]; then
    break
  fi
  sleep 1
done

if [ -z "$PID" ] || [ -z "$FOREGROUND" ]; then
  echo "App exited immediately. Recent relevant logcat:" >&2
  adb -s "$DEVICE" logcat -d -t 500 |
    grep -Ei 'dev\.hyo\.martie|OpenIap|AndroidRuntime|FATAL EXCEPTION|Resources\+NotFoundException|No assemblies|monodroid' >&2 || true
  exit 1
fi

echo "Android app is running. PID: $PID"
