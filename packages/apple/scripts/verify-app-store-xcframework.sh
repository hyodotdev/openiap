#!/usr/bin/env bash

set -euo pipefail

XCFRAMEWORK_ROOT="${1:-packages/apple/.build/xcframework/OpenIAP.xcframework}"
EXPECTED_XCODE_VERSION="${APP_STORE_XCODE_VERSION:-26.6}"
EXPECTED_SDK_VERSION="${APP_STORE_SDK_VERSION:-26.5}"
EXPECTED_LD_VERSION="${APP_STORE_LD_VERSION:-1267.0}"

active_xcode="$(xcodebuild -version | sed -n '1p')"
active_sdk="$(xcrun --sdk iphoneos --show-sdk-version)"

if [[ "$active_xcode" != "Xcode $EXPECTED_XCODE_VERSION" ]]; then
  echo "::error::App Store artifacts must be built with Xcode $EXPECTED_XCODE_VERSION; active toolchain is $active_xcode."
  exit 1
fi

if [[ "$active_sdk" != "$EXPECTED_SDK_VERSION" ]]; then
  echo "::error::App Store artifacts must be built with iPhoneOS SDK $EXPECTED_SDK_VERSION; active SDK is $active_sdk."
  exit 1
fi

found=0
failed=0

while IFS= read -r -d '' binary; do
  found=1
  build_info="$(xcrun vtool -show-build "$binary")"
  echo "==> $binary"
  echo "$build_info"

  if grep -Eq 'version[[:space:]]+27[0-9]+([.][0-9]+)?' <<<"$build_info"; then
    echo "::error::$binary was linked by an Xcode 27 toolchain that is not accepted for App Store submissions."
    failed=1
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
    failed=1
  fi

  if otool -l "$binary" | grep -Eq '__LLVM_COV|__llvm_prf_'; then
    echo "::error::$binary contains code-coverage instrumentation and is not a release artifact."
    failed=1
  fi

  saw_sdk=0
  while IFS= read -r sdk_version; do
    [[ -z "$sdk_version" ]] && continue
    saw_sdk=1
    if [[ "$sdk_version" != "$EXPECTED_SDK_VERSION" ]]; then
      echo "::error::$binary records SDK $sdk_version; expected $EXPECTED_SDK_VERSION."
      failed=1
    fi
  done < <(awk '$1 == "sdk" { print $2 }' <<<"$build_info")

  if [[ "$saw_sdk" -eq 0 ]]; then
    echo "::error::$binary has no LC_BUILD_VERSION SDK entry."
    failed=1
  fi
done < <(
  find "$XCFRAMEWORK_ROOT" \
    \( -path '*/OpenIAP.framework/OpenIAP' -o -path '*/OpenIAP.framework/Versions/*/OpenIAP' \) \
    -type f \
    -print0
)

if [[ "$found" -eq 0 ]]; then
  echo "::error::No OpenIAP.framework binaries found in $XCFRAMEWORK_ROOT."
  exit 1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "Verified App Store toolchain: Xcode $EXPECTED_XCODE_VERSION / SDK $EXPECTED_SDK_VERSION / LD $EXPECTED_LD_VERSION."
