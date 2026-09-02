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
  local version
  version="$(sed -nE "s/.*id\\(\"${plugin_id}\"\\) version \"([^\"]+)\".*/\\1/p" "$google_root_build" | head -n 1)"
  if [ -z "$version" ]; then
    echo "Failed to read Gradle plugin version for $plugin_id from $google_root_build" >&2
    return 1
  fi
  printf '%s\n' "$version"
}

replace_once() {
  local file="$1"
  local expression="$2"
  local description="$3"
  local before_file
  before_file="$(mktemp "$tmp_root/perl-before.XXXXXX")"
  cp "$file" "$before_file"
  perl -0pi -e "$expression" "$file"
  if cmp -s "$before_file" "$file"; then
    echo "Failed to update $description in $file" >&2
    rm -f "$before_file"
    return 1
  fi
  rm -f "$before_file"
}

android_library_version="$(read_google_plugin_version "com.android.library")"
compose_plugin_version="$(read_google_plugin_version "org.jetbrains.kotlin.plugin.compose")"
maven_publish_version="$(read_google_plugin_version "com.vanniktech.maven.publish")"

if [ -f "$consumer_app/android/settings.gradle.kts" ]; then
  settings_file="$consumer_app/android/settings.gradle.kts"
  replace_once "$settings_file" "s/plugins \\{\\n/plugins {\\n    id(\"com.android.library\") version \"$android_library_version\" apply false\\n    id(\"org.jetbrains.kotlin.plugin.compose\") version \"$compose_plugin_version\" apply false\\n    id(\"com.vanniktech.maven.publish\") version \"$maven_publish_version\" apply false\\n/" "Gradle plugin versions"
  cat >> "$settings_file" <<'EOF'

include(":openiap")
project(":openiap").projectDir = file("../../packages/google/openiap")
EOF
elif [ -f "$consumer_app/android/settings.gradle" ]; then
  settings_file="$consumer_app/android/settings.gradle"
  replace_once "$settings_file" "s/plugins \\{\\n/plugins {\\n    id 'com.android.library' version '$android_library_version' apply false\\n    id 'org.jetbrains.kotlin.plugin.compose' version '$compose_plugin_version' apply false\\n    id 'com.vanniktech.maven.publish' version '$maven_publish_version' apply false\\n/" "Gradle plugin versions"
  cat >> "$settings_file" <<'EOF'

include ':openiap'
project(':openiap').projectDir = file('../../packages/google/openiap')
EOF
else
  echo "Failed to locate generated Android settings.gradle(.kts) in $consumer_app/android" >&2
  exit 1
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
      replace_once android/app/build.gradle.kts "s/ndkVersion\\s*=\\s*flutter\\.ndkVersion/ndkVersion = \"$preferred_ndk_version\"/" "NDK version"
    elif [ -f android/app/build.gradle ]; then
      replace_once android/app/build.gradle "s/ndkVersion\\s*=?\\s*flutter\\.ndkVersion/ndkVersion = \"$preferred_ndk_version\"/" "NDK version"
    fi
  fi

  if [ -f android/app/build.gradle.kts ]; then
    replace_once android/app/build.gradle.kts 's/defaultConfig \{\n/defaultConfig {\n        missingDimensionStrategy("platform", "play")\n/' "OpenIAP platform flavor"
  elif [ -f android/app/build.gradle ]; then
    replace_once android/app/build.gradle 's/defaultConfig \{\n/defaultConfig {\n        missingDimensionStrategy "platform", "play"\n/' "OpenIAP platform flavor"
  fi

  flutter build apk --debug

  printf '\nopeniapPlatform=none\n' >> android/gradle.properties
  flutter clean
  flutter pub get
  flutter build apk --debug

  dependency_report="$tmp_root/none-debug-runtime-classpath.txt"
  ./android/gradlew -p android :app:dependencies \
    --configuration debugRuntimeClasspath > "$dependency_report"
  billing_dependency_pattern='^[-[:space:]|+\\]*project :openiap([[:space:]]|\(|\*|$)|io\.github\.hyochan\.openiap:openiap-google|com\.android\.billingclient|com\.amazon\.device\.iap'
  if grep -Eq "$billing_dependency_pattern" "$dependency_report"; then
    echo "Android none build retained a store billing dependency" >&2
    grep -En "$billing_dependency_pattern" "$dependency_report" >&2
    exit 1
  fi

  merged_manifest="$(find build/app/intermediates -type f -path '*merged_manifest*' -path '*debug*' -name AndroidManifest.xml -print -quit)"
  if [ -z "$merged_manifest" ] || [ ! -f "$merged_manifest" ]; then
    echo "Failed to locate the Android none merged manifest" >&2
    exit 1
  fi
  if grep -Eq 'com\.android\.vending\.BILLING|com\.amazon\.(sdktestclient|venezia|inapp\.purchasing)' "$merged_manifest"; then
    echo "Android none build retained a store billing manifest entry" >&2
    exit 1
  fi

  ./android/gradlew -p android :flutter_inapp_purchase:testDebugUnitTest
)
