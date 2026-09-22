#!/usr/bin/env bash
# Regression suite for the Android store resolver
# (packages/google/gradle/openiap-store.gradle).
#
# Every case below is a rule a release build depends on. They are asserted here
# rather than on a device because each one is decided at configuration time,
# and because a wrong store is only visible in the artifact, never at runtime
# on the machine that built it.
set -euo pipefail

google_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture="$google_root/compatibility/store-resolver"
gradlew="$google_root/gradlew"

fake_sdk=$(mktemp -d)
mkdir -p "$fake_sdk/platform-tools"
cp "$fixture/fake-adb" "$fake_sdk/platform-tools/adb"
chmod +x "$fake_sdk/platform-tools/adb"
trap 'rm -rf "$fake_sdk"' EXIT

passed=0
failed=0

# run <name> <expected> <gradle args...>
# <expected> is "store/source", or "fail:<substring of the error>".
run() {
    local name="$1" expected="$2"
    shift 2
    local output status=0
    output=$(cd "$fixture" && "$gradlew" --quiet --project-cache-dir "$fake_sdk/cache" "$@" 2>&1) || status=$?

    local actual
    if [[ "$expected" == fail:* ]]; then
        local needle="${expected#fail:}"
        if [[ $status -ne 0 && "$output" == *"$needle"* ]]; then
            actual="$expected"
        else
            actual="exit=$status ${output//$'\n'/ }"
        fi
    else
        actual=$(printf '%s\n' "$output" \
            | sed -n 's/.*FIXTURE store=\([a-z]*\) source=\([a-z]*\).*/\1\/\2/p' \
            | tail -1)
        [[ -n "$actual" ]] || actual="no resolution (exit=$status): ${output//$'\n'/ }"
    fi

    if [[ "$actual" == "$expected" ]]; then
        printf '  ok   %-58s %s\n' "$name" "$expected"
        passed=$((passed + 1))
    else
        printf '  FAIL %-58s expected %s, got %s\n' "$name" "$expected" "$actual"
        failed=$((failed + 1))
    fi
}

# A device the resolver should read as the given store.
with_device() {
    local serial="$1" features="$2" manufacturer="$3"
    local key
    key=$(printf '%s' "$serial" | tr -c 'A-Za-z0-9' '_')
    export ANDROID_HOME="$fake_sdk" FAKE_ADB_DEVICES="$serial"
    export "FAKE_ADB_${key}_FEATURES=$features"
    export "FAKE_ADB_${key}_MANUFACTURER=$manufacturer"
}

clear_device() {
    unset ANDROID_HOME ANDROID_SDK_ROOT ANDROID_SERIAL FAKE_ADB_DEVICES || true
}

echo "Store resolver regression suite"

echo "explicit pin"
clear_device
run "openiapStore=horizon"                 horizon/explicit assembleDebug -PopeniapStore=horizon
run "openiapStore=amazon"                  amazon/explicit  assembleDebug -PopeniapStore=amazon
run "openiapStore=play"                    play/explicit    assembleDebug -PopeniapStore=play
run "alias quest"                          horizon/explicit assembleDebug -PopeniapStore=quest
run "alias fire-os"                        amazon/explicit  assembleDebug -PopeniapStore=fire-os
run "alias googleplay"                     play/explicit    assembleDebug -PopeniapStore=googleplay
run "auto is not a pin"                    play/default     assembleDebug -PopeniapStore=auto
run "a value that names no store fails"    "fail:unknown openiapStore" assembleDebug -PopeniapStore=bogus

echo "legacy flags"
run "horizonEnabled=true"                  horizon/explicit assembleDebug -PhorizonEnabled=true
run "fireOsEnabled=true"                   amazon/explicit  assembleDebug -PfireOsEnabled=true
run "both legacy flags fail"               "fail:cannot both be true" assembleDebug -PhorizonEnabled=true -PfireOsEnabled=true
run "pin against a legacy flag fails"      "fail:conflicts with fireOsEnabled=true" assembleDebug -PopeniapStore=play -PfireOsEnabled=true
run "openiapPlatform only takes none"      "fail:only supports the opt-out" assembleDebug -PopeniapPlatform=horizon
run "none needs the opt-out to be allowed" "fail:is not supported by this library" assembleDebug -PopeniapStore=none
run "none where it is supported"           none/explicit    assembleDebug -PopeniapStore=none -PfixtureAllowNone=true

echo "task flavor"
run "assembleHorizonRelease"               horizon/variant  assembleHorizonRelease
run "assembleAmazonDebug"                  amazon/variant   assembleAmazonDebug
run "installPlayDebug"                     play/variant     installPlayDebug
run "two flavors in one invocation fail"   "fail:cannot tell which store" assembleHorizonRelease assembleAmazonDebug
run "a pin against another flavor fails"   "fail:conflicts with the horizon flavor" assembleHorizonRelease -PopeniapStore=play
run "a pin that agrees is kept"            horizon/explicit assembleHorizonRelease -PopeniapStore=horizon

echo "abbreviated task names"
# Gradle accepts these, so missing the flavor here links the wrong billing SDK.
run "aHR is assembleHorizonRelease"        horizon/variant  aHR
# `A` opens AndroidTest and All as readily as Amazon, so the abbreviation is
# not read as a store; the graph check turns that into a failed build.
run "aAR is too ambiguous to read"         "fail:but the requested tasks build amazon" aAR
run "aPD is assemblePlayDebug"             play/variant     aPD
run "aD names no flavor"                   play/default     aD
run "iHD is installHorizonDebug"           horizon/variant  iHD
run "AGP own segments are not stores"      play/default     cAT
run "a spelled-out caps flavor"            play/variant     assemblePLAYRelease
# An exact flavor plus an abbreviation of another still names two stores.
run "exact plus abbreviated fails"         "fail:build more than one store" assembleHorizonRelease aAR
run "abbreviated plus exact fails"         "fail:cannot tell which store" aHR assembleAmazonDebug
run "the same store twice is fine"         horizon/variant  assembleHorizonRelease aHR

echo "task graph"
# Gradle matches names case-insensitively and by prefix, which configuration
# time never sees; the graph does.
run "a lower-case task name is caught"     "fail:but the requested tasks build horizon" assemblehorizonrelease
run "a case-mixed name is caught"          "fail:but the requested tasks build horizon" assembleHorizonrelease
run "a prefix match is caught"             "fail:but the requested tasks build horizon" assemblehorizonr
# An anchor task builds every flavor of whatever it reaches, and an unqualified
# name reaches every project, so `flutter build apk` pulls in a source-included
# openiap-google and all three of its flavors. Only what the request selected
# can say which store this build links.
run "an anchor over flavors is allowed"    play/default     assembleEverything
run "a pin under an anchor is kept"        horizon/explicit assembleEverything -PopeniapStore=horizon
run "opting out ignores the graph"         none/explicit    assembleEverything -PopeniapStore=none -PfixtureAllowNone=true
run "a pin that the graph contradicts"     "fail:but the requested tasks build horizon" assemblehorizonrelease -PopeniapStore=play
# taskNames flattens task options; a filter naming a store is not a flavor.
run "a task option is not a store"         play/default     assembleDebug --tests com.app.AmazonTest

echo "connected device"
with_device QUEST1 "feature:oculus.hardware.standalone_vr" Oculus
run "a Quest selects horizon"              horizon/device   assembleDebug
run "a release build ignores the device"   play/default     assembleRelease
run "clean keeps it a debug build"         horizon/device   clean assembleDebug
run "the configuration cache skips it"     play/default     assembleDebug --configuration-cache
run "an explicit pin still wins"           play/explicit    assembleDebug -PopeniapStore=play
# An abbreviated debug task is still a debug build, so the device rule applies.
run "aD still reaches the device"          horizon/device   aD
run "aR still ignores it"                  play/default     aR
with_device GHOST1 "" ""
run "a device that stops answering"        play/default     assembleDebug

with_device FIRE1 "feature:amazon.hardware.fire_tv" Amazon
run "a Fire device selects amazon"         amazon/device    assembleDebug
with_device FIRE2 "" Amazon
run "Amazon without the TV feature"        amazon/device    assembleDebug
with_device PIXEL1 "feature:android.hardware.nfc" Google
run "anything else is play"                play/device      assembleDebug

export FAKE_ADB_DEVICES="QUEST1 PIXEL1"
export FAKE_ADB_QUEST1_FEATURES="feature:oculus.hardware.standalone_vr"
export FAKE_ADB_QUEST1_MANUFACTURER=Oculus
run "two devices select nothing"           play/default     assembleDebug
ANDROID_SERIAL=QUEST1 run "ANDROID_SERIAL picks one of them" horizon/device assembleDebug
ANDROID_SERIAL=ABSENT run "an absent serial selects nothing" play/default   assembleDebug
clear_device
run "no adb at all"                        play/default     assembleDebug

echo
echo "Store resolver: $passed passed, $failed failed"
[[ $failed -eq 0 ]]
