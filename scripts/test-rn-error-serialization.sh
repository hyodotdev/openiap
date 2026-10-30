#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
XCODE_PLATFORM="$(xcrun --sdk macosx --show-sdk-platform-path)"
XCTEST_FRAMEWORKS="$XCODE_PLATFORM/Developer/Library/Frameworks"
XCTEST_MODULES="$XCODE_PLATFORM/Developer/usr/lib"
trap 'rm -rf "$BUILD_DIR"' EXIT

# Compile the generated contract itself so the bridge test cannot use stale model stubs.
xcrun --sdk macosx swiftc \
  -emit-library -emit-module -module-name OpenIAP \
  "$REPO_ROOT/packages/apple/Sources/Models/Types.swift" \
  "$REPO_ROOT/packages/apple/Sources/Helpers/TypesConformance.swift" \
  -emit-module-path "$BUILD_DIR/OpenIAP.swiftmodule" \
  -o "$BUILD_DIR/libOpenIAP.dylib"

xcrun --sdk macosx swiftc \
  -emit-executable \
  -F "$XCTEST_FRAMEWORKS" \
  -I "$XCTEST_MODULES" -I "$BUILD_DIR" \
  -L "$XCTEST_MODULES" -L "$BUILD_DIR" \
  -framework XCTest -lXCTestSwiftSupport -lOpenIAP \
  -Xlinker -rpath -Xlinker "$XCTEST_FRAMEWORKS" \
  -Xlinker -rpath -Xlinker "$XCTEST_MODULES" \
  -Xlinker -rpath -Xlinker "$BUILD_DIR" \
  "$REPO_ROOT/libraries/react-native-iap/ios/OpenIapException.swift" \
  "$REPO_ROOT/libraries/react-native-iap/ios/RequestPurchaseErrorObservation.swift" \
  "$REPO_ROOT/libraries/react-native-iap/tests/ios/RequestPurchaseErrorObservationTests.swift" \
  "$REPO_ROOT/libraries/react-native-iap/tests/ios/OpenIapExceptionTests.swift" \
  -o "$BUILD_DIR/rn-iap-error-tests"

"$BUILD_DIR/rn-iap-error-tests"
