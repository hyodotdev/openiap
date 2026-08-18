#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "$script_dir/.." && pwd)"
example_root="$package_root/example"
ios_manifest="$package_root/ios/flutter_inapp_purchase/Package.swift"
macos_manifest="$package_root/macos/flutter_inapp_purchase/Package.swift"
tmp_root="$(mktemp -d)"

cleanup() {
  if [ -f "$tmp_root/ios-Package.swift" ]; then
    cp "$tmp_root/ios-Package.swift" "$ios_manifest"
  fi
  if [ -f "$tmp_root/macos-Package.swift" ]; then
    cp "$tmp_root/macos-Package.swift" "$macos_manifest"
  fi
  rm -rf "$tmp_root"
}
trap cleanup EXIT

cp "$ios_manifest" "$tmp_root/ios-Package.swift"
cp "$macos_manifest" "$tmp_root/macos-Package.swift"

xcode_version_output="$(xcodebuild -version)"
xcode_version="${xcode_version_output%%$'\n'*}"
expected_xcode_major="${EXPECTED_XCODE_MAJOR:-27}"
if [[ ! "$expected_xcode_major" =~ ^[0-9]+$ ]]; then
  echo "EXPECTED_XCODE_MAJOR must be numeric, found: $expected_xcode_major" >&2
  exit 1
fi
if [[ "$xcode_version" != "Xcode ${expected_xcode_major}"* ]]; then
  echo "Expected Xcode $expected_xcode_major, found: $xcode_version" >&2
  exit 1
fi

use_local_openiap() {
  local manifest="$1"
  local before
  before="$(shasum -a 256 "$manifest" | awk '{print $1}')"
  perl -0pi -e \
    's#\.package\(url: "https://github\.com/hyodotdev/openiap\.git", from: "3\.0\.0"\),#.package(name: "OpenIAP", path: "../../../../packages/apple"),#' \
    "$manifest"
  if [ "$before" = "$(shasum -a 256 "$manifest" | awk '{print $1}')" ]; then
    echo "Failed to select the local OpenIAP Apple package in $manifest" >&2
    exit 1
  fi
}

use_local_openiap "$ios_manifest"
use_local_openiap "$macos_manifest"

cd "$example_root"
flutter config --enable-swift-package-manager
flutter pub get
flutter build ios --config-only --simulator
flutter build macos --config-only

grep -Fq '"swift_package_manager_enabled":{"ios":true,"macos":true}' \
  .flutter-plugins-dependencies
grep -Fq "FlutterGeneratedPluginSwiftPackage" \
  ios/Runner.xcodeproj/project.pbxproj
grep -Fq "FlutterGeneratedPluginSwiftPackage" \
  macos/Runner.xcodeproj/project.pbxproj

if grep -Eq '(^|[[:space:]])openiap([[:space:]]|\\(|:)' ios/Podfile.lock 2>/dev/null; then
  echo "iOS SwiftPM build unexpectedly retained the OpenIAP CocoaPod" >&2
  exit 1
fi
if grep -Eq '(^|[[:space:]])openiap([[:space:]]|\\(|:)' macos/Podfile.lock 2>/dev/null; then
  echo "macOS SwiftPM build unexpectedly retained the OpenIAP CocoaPod" >&2
  exit 1
fi

cd "$example_root/ios"
xcodebuild build \
  -workspace Runner.xcworkspace \
  -scheme Runner \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO

cd "$example_root/macos"
xcodebuild build \
  -workspace Runner.xcworkspace \
  -scheme Runner \
  -configuration Debug \
  -destination "generic/platform=macOS" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO

cp "$tmp_root/ios-Package.swift" "$ios_manifest"
cp "$tmp_root/macos-Package.swift" "$macos_manifest"
if ! cmp -s "$tmp_root/ios-Package.swift" "$ios_manifest" ||
  ! cmp -s "$tmp_root/macos-Package.swift" "$macos_manifest"; then
  echo "SwiftPM verification did not restore package manifests" >&2
  exit 1
fi
