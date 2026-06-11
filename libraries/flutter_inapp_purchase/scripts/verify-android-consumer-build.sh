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

mkdir -p "$package_copy"

git -C "$repo_root" ls-files libraries/flutter_inapp_purchase | while IFS= read -r source_path; do
  relative_path="${source_path#libraries/flutter_inapp_purchase/}"
  mkdir -p "$package_copy/$(dirname "$relative_path")"
  cp -L "$repo_root/$source_path" "$package_copy/$relative_path"
done

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
    perl -0pi -e 's/ndkVersion = flutter\.ndkVersion/ndkVersion = "27.0.12077973"/' android/app/build.gradle.kts
  fi

  flutter build apk --debug
)
