#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$LIB_DIR/example/OpenIap.Maui.Example"
PROJECT="$APP_DIR/OpenIap.Maui.Example.csproj"
APP_ID="dev.hyo.martie"
APP_BUILD_DIR="$APP_DIR/bin/Debug/net9.0-ios/ios-arm64"
APP_OBJ_DIR="$APP_DIR/obj/Debug/net9.0-ios/ios-arm64"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command dotnet
require_command ios-deploy
require_command xcrun

detect_ios_device() {
  ios-deploy -c 2>&1 |
    sed -nE 's/.*Found ([0-9A-Fa-f-]{20,}) .*/\1/p' |
    head -n1
}

if ! dotnet workload list | grep -Eq '^maui([[:space:]]|$)'; then
  echo "MAUI workload missing. Run: sudo dotnet workload install maui" >&2
  exit 1
fi

DEVICE="${MAUI_IOS_DEVICE:-}"
if [ -z "$DEVICE" ]; then
  DEVICE="$(detect_ios_device || true)"
fi

if [ -z "$DEVICE" ]; then
  echo "No USB-connected iOS device found by ios-deploy." >&2
  echo "Set MAUI_IOS_DEVICE=<udid> to pin a device, or unlock/trust/replug the device." >&2
  echo "" >&2
  echo "xctrace device list:" >&2
  xcrun xctrace list devices >&2
  exit 1
fi

echo "Using USB iOS device: $DEVICE"
echo "Cleaning previous iOS device build output..."
rm -rf "$APP_BUILD_DIR" "$APP_OBJ_DIR"

build_device() {
  dotnet build "$PROJECT" \
    -f net9.0-ios \
    -p:RuntimeIdentifier=ios-arm64 \
    -p:_DeviceName="$DEVICE" \
    -tl:off \
    -v:minimal
}

BUILD_LOG="$(mktemp "${TMPDIR:-/tmp}/maui-ios-build.XXXXXX")"
trap 'rm -f "$BUILD_LOG"' EXIT
if ! build_device 2>&1 | tee "$BUILD_LOG"; then
  if grep -Eq 'AssetCatalogSimulatorAgent|MPSNeuralNetwork|actool exited' "$BUILD_LOG"; then
    echo "Retrying once after transient Xcode asset catalog failure..."
    rm -rf "$APP_OBJ_DIR/actool"
    build_device
  else
    exit 1
  fi
fi

APP_BUNDLE="$APP_BUILD_DIR/OpenIap.Maui.Example.app"
if [ ! -d "$APP_BUNDLE" ]; then
  echo "iOS app bundle was not produced: $APP_BUNDLE" >&2
  exit 1
fi

echo "Uninstalling previous $APP_ID build if present..."
ios-deploy --id "$DEVICE" --uninstall_only --bundle_id "$APP_ID" --timeout 5 >/dev/null 2>&1 || true

echo "Installing $APP_BUNDLE..."
ios-deploy \
  --id "$DEVICE" \
  --bundle "$APP_BUNDLE" \
  --uninstall \
  --nostart \
  --timeout 30

echo "Launching $APP_ID..."
set +e
LAUNCH_OUTPUT="$(xcrun devicectl device process launch \
  --terminate-existing \
  --device "$DEVICE" \
  "$APP_ID" 2>&1)"
LAUNCH_STATUS=$?
set -e

echo "$LAUNCH_OUTPUT" |
  sed '/Failed to load provisioning paramter list/d;/`devicectl manage create` may support/d'

if [ "$LAUNCH_STATUS" -ne 0 ]; then
  exit "$LAUNCH_STATUS"
fi
