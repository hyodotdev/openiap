#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "$script_dir/.." && pwd)"
tmp_root="$(mktemp -d)"

cleanup() {
  if [ -n "${tmp_root:-}" ] && [ -d "$tmp_root" ]; then
    rm -rf "$tmp_root"
  fi
}
trap cleanup EXIT

consumer_app="$tmp_root/openiap_cocoapods_consumer"
podspec="$package_root/ios/flutter_inapp_purchase.podspec"
minimum_ios_version="$(
  sed -nE \
    "s/^[[:space:]]*s\\.ios\\.deployment_target = '([^']+)'.*/\\1/p" \
    "$podspec" | head -n 1
)"
if [ -z "$minimum_ios_version" ]; then
  echo "Failed to read the minimum iOS version from $podspec" >&2
  exit 1
fi

# Keep this fallback check independent from the developer's global Flutter
# configuration and from the tracked example's SwiftPM integration.
export XDG_CONFIG_HOME="$tmp_root/flutter-config"
mkdir -p "$XDG_CONFIG_HOME"
flutter config --no-enable-swift-package-manager

flutter create \
  --empty \
  --platforms=ios \
  --org dev.hyo \
  --project-name openiap_cocoapods_consumer \
  "$consumer_app"

flutter pub add \
  "flutter_inapp_purchase@{path: $package_root}" \
  --directory "$consumer_app"

podfile="$consumer_app/ios/Podfile"
xcode_project="$consumer_app/ios/Runner.xcodeproj/project.pbxproj"

perl -0pi -e \
  "s/# platform :ios, '[0-9.]+'/platform :ios, '$minimum_ios_version'/" \
  "$podfile"
if ! grep -Fq "platform :ios, '$minimum_ios_version'" "$podfile"; then
  echo "Failed to set the CocoaPods consumer deployment target" >&2
  exit 1
fi

deployment_target_count="$(grep -Ec 'IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;' "$xcode_project")"
if [ "$deployment_target_count" -eq 0 ]; then
  echo "Generated Xcode project has no deployment targets" >&2
  exit 1
fi
perl -0pi -e \
  "s/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = $minimum_ios_version;/g" \
  "$xcode_project"
configured_target_count="$(
  grep -Fc \
    "IPHONEOS_DEPLOYMENT_TARGET = $minimum_ios_version;" \
    "$xcode_project"
)"
if [ "$configured_target_count" -ne "$deployment_target_count" ]; then
  echo "Failed to set the Xcode consumer deployment target" >&2
  exit 1
fi

if grep -Eq \
  'FlutterGeneratedPluginSwiftPackage|XCLocalSwiftPackageReference' \
  "$xcode_project"; then
  echo "CocoaPods consumer unexpectedly contains SwiftPM package references" >&2
  exit 1
fi

(
  cd "$consumer_app"
  flutter build ios --simulator --debug --no-codesign
)

podfile_lock="$consumer_app/ios/Podfile.lock"
grep -Eq '^[[:space:]]+- flutter_inapp_purchase ' "$podfile_lock"
grep -Eq '^[[:space:]]+- openiap ' "$podfile_lock"
