#!/usr/bin/env bash

set -euo pipefail

FRAMEWORK_ROOT="${1:-addons/godot-iap/bin/ios}"
EXPECTED_SDK_VERSION="${APP_STORE_SDK_VERSION:-26.5}"
EXPECTED_LD_VERSION="${APP_STORE_LD_VERSION:-1267.0}"

for binary in \
  "$FRAMEWORK_ROOT/GodotIap.framework/GodotIap" \
  "$FRAMEWORK_ROOT/SwiftGodotRuntime.framework/SwiftGodotRuntime"; do
  if [[ ! -f "$binary" ]]; then
    echo "::error::Missing tracked iOS framework binary: $binary"
    exit 1
  fi

  build_info="$(xcrun vtool -show-build "$binary")"
  echo "$build_info"

  if ! awk -v expected="$EXPECTED_SDK_VERSION" \
    '$1 == "sdk" && $2 == expected { found = 1 } END { exit found ? 0 : 1 }' \
    <<<"$build_info"; then
    echo "::error::$binary was not built with the expected App Store SDK $EXPECTED_SDK_VERSION."
    exit 1
  fi

  if ! awk -v expected="$EXPECTED_LD_VERSION" \
    '$1 == "version" && $2 == expected { found = 1 } END { exit found ? 0 : 1 }' \
    <<<"$build_info"; then
    echo "::error::$binary was not linked by the expected stable linker $EXPECTED_LD_VERSION."
    echo "::error::Rebuild with Xcode 26.6 / iPhoneOS SDK $EXPECTED_SDK_VERSION before release."
    exit 1
  fi

  if otool -l "$binary" | grep -Eq '__LLVM_COV|__llvm_prf_'; then
    echo "::error::$binary contains code-coverage instrumentation and is not a release artifact."
    exit 1
  fi
done
