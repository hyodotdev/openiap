#!/usr/bin/env bash
# Regression suite for the OpenIAP Gradle plugin (packages/google/gradle-plugin).
#
# The resolver's rules are covered by verify-store-resolver.sh. This suite
# covers what the plugin adds: that the store it resolves reaches the published
# openiap-google and kmp-iap artifacts an app outside this repo links.
set -euo pipefail

google_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture="$google_root/compatibility/store-plugin"
# The same KMP modules on AGP 9, whose library plugin selects dependencies differently.
fixture_agp9="$google_root/compatibility/store-plugin-agp9"
case_fixture="$fixture"
gradlew="$google_root/gradlew"
# The fixture resolves published artifacts, so a network blip must not fail a case.
retry="$google_root/../../scripts/ci/retry-gradle.sh"

real_sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ ! -d "$real_sdk/platforms" ]]; then
    echo "Set ANDROID_HOME to an Android SDK; AGP needs one to configure the fixture." >&2
    exit 1
fi

# The real SDK with a fake adb, so each case declares the device it reports.
fake_sdk=$(mktemp -d)
trap 'rm -rf "$fake_sdk"' EXIT
for entry in "$real_sdk"/*; do
    [[ "$(basename "$entry")" == platform-tools ]] || ln -s "$entry" "$fake_sdk/"
done
mkdir -p "$fake_sdk/platform-tools"
cp "$google_root/compatibility/store-resolver/fake-adb" "$fake_sdk/platform-tools/adb"
chmod +x "$fake_sdk/platform-tools/adb"

passed=0
failed=0

# run <name> <expected> <gradle args...>
# <expected> is the FIXTURE line, or "fail:<substring of the error>".
run() {
    local name="$1" expected="$2"
    shift 2
    local output status=0
    output=$(cd "$case_fixture" && ANDROID_HOME="$fake_sdk" bash "$retry" "$gradlew" --quiet \
        --project-cache-dir "$fake_sdk/cache" "$@" 2>&1) || status=$?
    local actual
    if [[ "$expected" == fail:* ]]; then
        if [[ $status -ne 0 && "$output" == *"${expected#fail:}"* ]]; then
            actual="$expected"
        else
            actual="exit=$status ${output//$'\n'/ }"
        fi
    else
        actual=$(printf '%s\n' "$output" | sed -n 's/^FIXTURE //p' | tail -1)
        if [[ $status -ne 0 ]]; then
            actual="exit=$status ${output//$'\n'/ }"
        fi
    fi
    if [[ "$actual" == "$expected" ]]; then
        printf '  ok   %-44s %s\n' "$name" "$expected"
        passed=$((passed + 1))
    else
        printf '  FAIL %-44s expected %s, got %s\n' "$name" "$expected" "$actual"
        failed=$((failed + 1))
    fi
}

with_device() {
    local serial="$1" features="$2" manufacturer="$3"
    export FAKE_ADB_DEVICES="$serial"
    export "FAKE_ADB_${serial}_FEATURES=$features"
    export "FAKE_ADB_${serial}_MANUFACTURER=$manufacturer"
}

unset ANDROID_SERIAL ANDROID_SDK_ROOT FAKE_ADB_DEVICES || true

echo "Store plugin regression suite"

# kmp-iap publishes one Android variant per store, which an app with no
# platform dimension cannot choose between without the plugin.
run "no device links Play"                  "app:debugRuntimeClasspath=kmp-iap-android-play,openiap-google" :app:printDebugStores

with_device QUEST1 "feature:oculus.hardware.standalone_vr" Oculus
run "a Quest links Horizon"                 "app:debugRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :app:printDebugStores
run "a release build ignores it"            "app:releaseRuntimeClasspath=kmp-iap-android-play,openiap-google" :app:printReleaseStores
run "a pin outranks it"                     "app:debugRuntimeClasspath=kmp-iap-android-amazon,openiap-google-amazon" :app:printDebugStores -PopeniapStore=amazon
run "the KMP library plugin follows it"     "shared:androidRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :shared:printDebugStores
# The app module never names kmp-iap; applied in settings, the plugin still reaches it.
run "so does an app that only sees :shared"  "consumer:debugRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :consumer:printDebugStores
run "the configuration cache reads it"      "app:debugRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :app:printDebugStores --configuration-cache
# AGP 9 removed dependencyVariantSelection; without its replacement kmp-iap fails to resolve.
case_fixture="$fixture_agp9"
run "AGP 9's KMP library plugin follows it"  "shared:androidRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :shared:printDebugStores
run "and so does its consumer"              "consumer:debugRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :consumer:printDebugStores
case_fixture="$fixture"

with_device FIRE1 "feature:amazon.hardware.fire_tv" Amazon
run "a Fire device links Amazon"            "app:debugRuntimeClasspath=kmp-iap-android-amazon,openiap-google-amazon" :app:printDebugStores
run "and so does a classic KMP library"     "classic:debugRuntimeClasspath=kmp-iap-android-amazon,openiap-google-amazon" :classic:printDebugStores
# The entry the Quest case stored must not survive a different device.
run "and replaces the cached Quest answer"  "app:debugRuntimeClasspath=kmp-iap-android-amazon,openiap-google-amazon" :app:printDebugStores --configuration-cache

unset FAKE_ADB_DEVICES
# Its own platform flavors name the store. Were the pin applied there, its
# horizon flavor's openiap-google-horizon would conflict with amazon.
run "own platform flavors are left alone"   "flavored:horizonDebugRuntimeClasspath=kmp-iap-android-horizon,openiap-google-horizon" :flavored:printFlavorStores -PopeniapStore=amazon

# So is a platform the app requests itself, which the plugin must not replace.
run "a platform strategy that agrees is kept" "app:debugRuntimeClasspath=kmp-iap-android-play,openiap-google" :app:printDebugStores -PfixtureStrategy=play
run "and one that disagrees fails"          "fail:sets missingDimensionStrategy platform=horizon" :app:printDebugStores -PfixtureStrategy=horizon

# A store artifact declared directly is a second signal; it must agree.
run "a store artifact that disagrees fails" "fail:openiap-google-horizon is declared but this build's store is play" :mixed:printDebugStores
run "and one that agrees is kept"           "mixed:debugRuntimeClasspath=openiap-google-horizon" :mixed:printDebugStores -PopeniapStore=horizon
# The swap needs a version of its own; one borrowed from another edge is not it.
run "an unversioned openiap-google says so"  "fail:openiap-google is declared without a version" :unversioned:printDebugStores -PopeniapStore=horizon

echo
echo "Store plugin: $passed passed, $failed failed"
[[ $failed -eq 0 ]]
