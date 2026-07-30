#!/usr/bin/env bash

set -euo pipefail

FRAMEWORK_ROOT="${1:-addons/godot-iap/bin/ios}"

for binary in \
  "$FRAMEWORK_ROOT/GodotIap.framework/GodotIap" \
  "$FRAMEWORK_ROOT/SwiftGodotRuntime.framework/SwiftGodotRuntime"; do
  if [[ ! -f "$binary" ]]; then
    echo "::error::Missing tracked iOS framework binary: $binary"
    exit 1
  fi

  build_info="$(xcrun vtool -show-build "$binary")"
  echo "$build_info"

  if ! grep -Eq 'version[[:space:]]+27[0-9]+([.][0-9]+)?' <<<"$build_info"; then
    echo "::error::$binary was not linked by the Xcode 27 toolchain."
    echo "::error::Rebuild with DEVELOPER_DIR pointing at Xcode 27 before release."
    exit 1
  fi
done
