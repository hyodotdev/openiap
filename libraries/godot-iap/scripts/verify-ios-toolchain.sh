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

  if ! awk -v expected="$EXPECTED_LD_VERSION" '
    function finish_build() {
      if (in_build && (!saw_ld || bad_ld)) {
        failed = 1
      }
    }

    $1 == "cmd" && $2 == "LC_BUILD_VERSION" {
      finish_build()
      in_build = 1
      builds += 1
      saw_ld = 0
      bad_ld = 0
      expect_ld_version = 0
      next
    }

    in_build && $1 == "tool" {
      expect_ld_version = ($2 == "LD")
      next
    }

    in_build && $1 == "version" && expect_ld_version {
      saw_ld = 1
      if ($2 != expected) {
        bad_ld = 1
      }
      expect_ld_version = 0
    }

    END {
      finish_build()
      exit (builds > 0 && !failed) ? 0 : 1
    }
  ' <<<"$build_info"; then
    echo "::error::$binary was not linked by the expected stable linker $EXPECTED_LD_VERSION."
    echo "::error::Rebuild with Xcode 26.6 / iPhoneOS SDK $EXPECTED_SDK_VERSION before release."
    exit 1
  fi

  if otool -l "$binary" | grep -Eq '__LLVM_COV|__llvm_prf_'; then
    echo "::error::$binary contains code-coverage instrumentation and is not a release artifact."
    exit 1
  fi
done
