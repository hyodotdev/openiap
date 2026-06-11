#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "$script_dir/.." && pwd)"
repo_root="$(git -C "$package_root" rev-parse --show-toplevel)"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_root"
}
trap cleanup EXIT

package_copy="$tmp_root/flutter_inapp_purchase"
consumer_app="$tmp_root/openiap_consumer_smoke"

cp -R "$package_root" "$tmp_root/"
rm -rf \
  "$package_copy/.build" \
  "$package_copy/.dart_tool" \
  "$package_copy/android/.gradle" \
  "$package_copy/android/build" \
  "$package_copy/build" \
  "$package_copy/example/.dart_tool" \
  "$package_copy/example/android/.gradle" \
  "$package_copy/example/android/build" \
  "$package_copy/example/build"

if [ -L "$package_copy/openiap-versions.json" ]; then
  rm "$package_copy/openiap-versions.json"
  cp "$repo_root/openiap-versions.json" "$package_copy/openiap-versions.json"
fi

flutter create --platforms=android -t app --project-name openiap_consumer_smoke "$consumer_app"

(
  cd "$consumer_app"
  flutter pub add flutter_inapp_purchase --path "$package_copy"

  # Match the bundled example when that NDK is installed; this avoids local
  # Flutter defaults selecting a partially installed newer NDK.
  android_sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [ -z "$android_sdk_root" ] && [ -d "$HOME/Library/Android/sdk" ]; then
    android_sdk_root="$HOME/Library/Android/sdk"
  elif [ -z "$android_sdk_root" ] && [ -d "$HOME/Android/Sdk" ]; then
    android_sdk_root="$HOME/Android/Sdk"
  fi

  if [ -n "$android_sdk_root" ] &&
    [ -d "$android_sdk_root/ndk/27.0.12077973" ] &&
    [ -f android/app/build.gradle.kts ]; then
    perl -0pi -e 's/ndkVersion\s*=\s*flutter\.ndkVersion/ndkVersion = "27.0.12077973"/' android/app/build.gradle.kts
  fi

  flutter build apk --debug
)
