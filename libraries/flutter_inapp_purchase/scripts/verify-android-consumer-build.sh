#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "$script_dir/.." && pwd)"
repo_root="$(git -C "$package_root" rev-parse --show-toplevel)"
tmp_root="$(mktemp -d)"

cleanup() {
  if [ -n "${tmp_root:-}" ] && [ -d "$tmp_root" ]; then
    rm -rf "$tmp_root"
  fi
}
trap cleanup EXIT

package_copy="$tmp_root/flutter_inapp_purchase"
local_google_copy="$tmp_root/packages/google/openiap"
consumer_app="$tmp_root/openiap_consumer_smoke"

cp -R "$package_root" "$tmp_root/"
mkdir -p "$(dirname "$local_google_copy")"
cp -R "$repo_root/packages/google/openiap" "$local_google_copy"
rm -rf \
  "$package_copy/.build" \
  "$package_copy/.dart_tool" \
  "$package_copy/android/.gradle" \
  "$package_copy/android/build" \
  "$package_copy/build" \
  "$package_copy/example/.dart_tool" \
  "$package_copy/example/android/.gradle" \
  "$package_copy/example/android/build" \
  "$package_copy/example/build" \
  "$local_google_copy/.gradle" \
  "$local_google_copy/build"

rm -f "$package_copy/openiap-versions.json"
cp "$repo_root/openiap-versions.json" "$package_copy/openiap-versions.json"
cp "$repo_root/openiap-versions.json" "$tmp_root/openiap-versions.json"

flutter create --platforms=android -t app --project-name openiap_consumer_smoke "$consumer_app"

google_root_build="$repo_root/packages/google/build.gradle.kts"
read_google_plugin_version() {
  local plugin_id="$1"
  sed -nE "s/.*id\\(\"${plugin_id}\"\\) version \"([^\"]+)\".*/\\1/p" "$google_root_build" | head -n 1
}

android_library_version="$(read_google_plugin_version "com.android.library")"
compose_plugin_version="$(read_google_plugin_version "org.jetbrains.kotlin.plugin.compose")"
maven_publish_version="$(read_google_plugin_version "com.vanniktech.maven.publish")"

if [ -f "$consumer_app/android/settings.gradle.kts" ]; then
  settings_file="$consumer_app/android/settings.gradle.kts"
  perl -0pi -e "s/plugins \\{\\n/plugins {\\n    id(\"com.android.library\") version \"$android_library_version\" apply false\\n    id(\"org.jetbrains.kotlin.plugin.compose\") version \"$compose_plugin_version\" apply false\\n    id(\"com.vanniktech.maven.publish\") version \"$maven_publish_version\" apply false\\n/" "$settings_file"
  cat >> "$settings_file" <<'EOF'

include(":openiap")
project(":openiap").projectDir = file("../../packages/google/openiap")
EOF
elif [ -f "$consumer_app/android/settings.gradle" ]; then
  settings_file="$consumer_app/android/settings.gradle"
  perl -0pi -e "s/plugins \\{\\n/plugins {\\n    id 'com.android.library' version '$android_library_version' apply false\\n    id 'org.jetbrains.kotlin.plugin.compose' version '$compose_plugin_version' apply false\\n    id 'com.vanniktech.maven.publish' version '$maven_publish_version' apply false\\n/" "$settings_file"
  cat >> "$settings_file" <<'EOF'

include ':openiap'
project(':openiap').projectDir = file('../../packages/google/openiap')
EOF
fi

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
    [ -d "$android_sdk_root/ndk/28.2.13676358" ]; then
    preferred_ndk_version="28.2.13676358"
  elif [ -n "$android_sdk_root" ] &&
    [ -d "$android_sdk_root/ndk/27.0.12077973" ]; then
    preferred_ndk_version="27.0.12077973"
  else
    preferred_ndk_version=""
  fi

  if [ -n "$preferred_ndk_version" ]; then
    if [ -f android/app/build.gradle.kts ]; then
      perl -pi -e "s/ndkVersion\\s*=\\s*flutter\\.ndkVersion/ndkVersion = \"$preferred_ndk_version\"/" android/app/build.gradle.kts
    elif [ -f android/app/build.gradle ]; then
      perl -pi -e "s/ndkVersion\\s*=?\\s*flutter\\.ndkVersion/ndkVersion = \"$preferred_ndk_version\"/" android/app/build.gradle
    fi
  fi

  if [ -f android/app/build.gradle.kts ]; then
    perl -0pi -e 's/defaultConfig \{\n/defaultConfig {\n        missingDimensionStrategy("platform", "play")\n/' android/app/build.gradle.kts
  elif [ -f android/app/build.gradle ]; then
    perl -0pi -e 's/defaultConfig \{\n/defaultConfig {\n        missingDimensionStrategy "platform", "play"\n/' android/app/build.gradle
  fi

  flutter build apk --debug
)
