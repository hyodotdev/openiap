#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
XCODE_PLATFORM="$(xcrun --sdk macosx --show-sdk-platform-path)"
XCTEST_FRAMEWORKS="$XCODE_PLATFORM/Developer/Library/Frameworks"
XCTEST_MODULES="$XCODE_PLATFORM/Developer/usr/lib"
trap 'rm -rf "$BUILD_DIR"' EXIT

run_test() {
  local name="$1"
  local source="$2"
  local test_source="$3"
  local executable="$BUILD_DIR/$name"

  xcrun --sdk macosx swiftc \
    -emit-executable \
    -F "$XCTEST_FRAMEWORKS" \
    -I "$XCTEST_MODULES" \
    -framework XCTest \
    -Xlinker -rpath \
    -Xlinker "$XCTEST_FRAMEWORKS" \
    -L "$XCTEST_MODULES" \
    -lXCTestSwiftSupport \
    -Xlinker -rpath \
    -Xlinker "$XCTEST_MODULES" \
    "$source" \
    "$test_source" \
    -o "$executable"
  "$executable"
}

run_expo() {
  run_test \
    expo-iap-log-tests \
    "$REPO_ROOT/libraries/expo-iap/ios/ExpoIapLog.swift" \
    "$REPO_ROOT/libraries/expo-iap/tests/ios/ExpoIapLogTests.swift"
}

run_react_native() {
  run_test \
    rn-iap-log-tests \
    "$REPO_ROOT/libraries/react-native-iap/ios/RnIapLog.swift" \
    "$REPO_ROOT/libraries/react-native-iap/tests/ios/RnIapLogTests.swift"
}

case "$TARGET" in
  expo)
    run_expo
    ;;
  react-native)
    run_react_native
    ;;
  all)
    run_expo
    run_react_native
    ;;
  *)
    echo "Usage: $0 [all|expo|react-native]" >&2
    exit 2
    ;;
esac
