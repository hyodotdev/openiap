#!/usr/bin/env bash
# Regression suite for the MAUI store selection (buildTransitive/OpenIap.Maui.targets),
# using the resolver suite's fake adb and Java dependency verification per store.
# Needs the three store AARs, the MAUI facade AAR, an Android SDK and the
# maui-android workload.
set -euo pipefail

maui_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
example="$maui_root/example/OpenIap.Maui.Example/OpenIap.Maui.Example.csproj"

fake_sdk=$(mktemp -d)
trap 'rm -rf "$fake_sdk"' EXIT
cp "$maui_root/../../packages/google/compatibility/store-resolver/fake-adb" "$fake_sdk/adb"
chmod +x "$fake_sdk/adb"

dotnet restore "$example" -p:TargetFrameworks=net10.0-android --nologo >/dev/null

passed=0
failed=0

# run <name> <expected> <target> <msbuild args...>
# <expected> is "store:maven-artifact,...", or "fail:<substring of the error>".
# Prefix warns=<text> to also expect that warning.
run() {
    local name="$1" expected="$2" target="$3" want_warns="${warns:-}"
    # sh keeps a prefix assignment after a function returns; do not let it leak.
    unset warns
    shift 3
    local output status=0 actual
    output=$(dotnet msbuild "$example" -nologo -p:TargetFramework=net10.0-android \
        "-t:$target" -getProperty:OpenIapLinkedStore -getItem:AndroidMavenLibrary "$@" 2>&1) || status=$?
    if [[ "$expected" == fail:* ]]; then
        if [[ $status -ne 0 && "$output" == *"${expected#fail:}"* ]]; then
            actual="$expected"
        else
            actual="exit=$status ${output//$'\n'/ }"
        fi
    elif [[ $status -ne 0 ]]; then
        actual="exit=$status ${output//$'\n'/ }"
    else
        actual=$(printf '%s' "$output" | python3 -c '
import json, sys
raw = sys.stdin.read()
data = json.loads(raw[raw.index("{"):])
maven = sorted(i["Identity"].split(":")[1] for i in data["Items"].get("AndroidMavenLibrary", []))
print(data["Properties"]["OpenIapLinkedStore"] + ":" + ",".join(maven))')
    fi
    if [[ -n "$want_warns" ]]; then
        expected+=" warns:$want_warns"
        [[ "$output" == *"$want_warns"* ]] && actual+=" warns:$want_warns"
    fi
    if [[ "$actual" == "$expected" ]]; then
        printf '  ok   %-42s %s\n' "$name" "$expected"
        passed=$((passed + 1))
    else
        printf '  FAIL %-42s expected %s, got %s\n' "$name" "$expected" "$actual"
        failed=$((failed + 1))
    fi
}

with_device() {
    local serial="$1" features="$2" manufacturer="$3"
    export FAKE_ADB_DEVICES="$serial"
    export "FAKE_ADB_${serial}_FEATURES=$features"
    export "FAKE_ADB_${serial}_MANUFACTURER=$manufacturer"
}

play="play:billing"
horizon="horizon:core-kotlin,horizon-billing-compatibility,iap-kotlin,user-age-category-kotlin"
amazon="amazon:amazon-appstore-sdk"
link=_OpenIapLinkAndroidStore
adb="-p:AdbToolPath=$fake_sdk/"
deprecated="openiap: OpenIapAndroidStore is deprecated and will be removed in the next major release; use OpenIapStore="
unset ANDROID_SERIAL FAKE_ADB_DEVICES warns || true

echo "MAUI store selection suite"

echo "explicit"
run "OpenIapStore=play"                  "$play"    $link -p:OpenIapStore=play
run "alias quest"                        "$horizon" $link -p:OpenIapStore=quest
run "alias fire-os"                      "$amazon"  $link -p:OpenIapStore=fire-os
# Gradle lower-cases a pin, so MSBuild must accept any case too.
run "a pin ignores case"                  "$horizon" $link -p:OpenIapStore=Horizon
warns="${deprecated}horizon" run "and so does the alias" "$horizon" $link -p:OpenIapAndroidStore=QUEST
warns="${deprecated}horizon" run "OpenIapAndroidStore pins, with a warning" "$horizon" $link -p:OpenIapAndroidStore=meta
warns="${deprecated}amazon" run "and may agree with OpenIapStore" "$amazon" $link -p:OpenIapStore=amazon -p:OpenIapAndroidStore=fire
run "but not disagree" "fail:openiap: OpenIapStore=amazon conflicts with OpenIapAndroidStore=horizon" $link -p:OpenIapStore=amazon -p:OpenIapAndroidStore=horizon
warns="${deprecated}horizon" run "OpenIapStore=auto defers to it" "$horizon" $link -p:OpenIapStore=auto -p:OpenIapAndroidStore=quest
run "a value that names no store fails"  "fail:OpenIapStore='bogus' is not a store" $link -p:OpenIapStore=bogus
run "and names the alias when it was set" "fail:OpenIapAndroidStore='bogus' is not a store" $link -p:OpenIapAndroidStore=bogus
run "even beside a valid OpenIapStore"   "fail:OpenIapAndroidStore='bogus' is not a store" $link -p:OpenIapStore=play -p:OpenIapAndroidStore=bogus

echo "community provider"
run "external pair selects the neutral core" "community-fixture:" $link -p:OpenIapStore=community-fixture -p:OpenIapProvider=community.fixture:provider:1.0.0
# Gradle lower-cases the id before matching, so a cased community id selects too.
run "a community id ignores case" "community-fixture:" $link -p:OpenIapStore=Community-Fixture -p:OpenIapProvider=community.fixture:provider:1.0.0
run "external id needs coordinates" "fail:OpenIapStore='community-fixture' is not a store" $link -p:OpenIapStore=community-fixture
run "official selection rejects an external pair" "fail:OpenIapProvider requires a community OpenIapStore id" $link -p:OpenIapStore=play -p:OpenIapProvider=community.fixture:provider:1.0.0
run "provider version must be fixed" "fail:OpenIapProvider must be fixed group:artifact:version coordinates" $link -p:OpenIapStore=community-fixture -p:OpenIapProvider=community.fixture:provider:+
run "official coordinates cannot pose as external" "fail:OpenIapProvider must name a community artifact" $link -p:OpenIapStore=community-fixture -p:OpenIapProvider=io.github.hyochan.openiap:openiap-google:3.6.2

echo "connected device"
with_device QUEST1 "feature:oculus.hardware.standalone_vr" Oculus
run "a Quest links Horizon"              "$horizon" $link "$adb"
run "a release build ignores it"         "$play"    $link "$adb" -p:Configuration=Release
run "a pin outranks it"                  "$amazon"  $link "$adb" -p:OpenIapStore=amazon
with_device FIRE1 "feature:amazon.hardware.fire_tv" Amazon
run "a Fire device links Amazon"         "$amazon"  $link "$adb"
with_device FIRE2 "" Amazon
run "Amazon without the TV feature"      "$amazon"  $link "$adb"
with_device GHOST1 "" ""
run "a device that stops answering"      "$play"    $link "$adb"
with_device PIXEL1 "feature:android.hardware.nfc" Google
run "anything else is Play"              "$play"    $link "$adb"
export FAKE_ADB_DEVICES="QUEST1 PIXEL1"
run "two devices select nothing"         "$play"    $link "$adb"
run "AdbTarget picks one of them"        "$horizon" $link "$adb" "-p:AdbTarget=-s QUEST1"
ANDROID_SERIAL=QUEST1 run "so does ANDROID_SERIAL" "$horizon" $link "$adb"
ANDROID_SERIAL=ABSENT run "an unattached ANDROID_SERIAL is Play" "$play" $link "$adb"
unset FAKE_ADB_DEVICES
run "no adb at all"                      "$play"    $link -p:AdbToolPath=/nonexistent/

echo "dependency verification"
run "Play's Maven SDKs verify"           "$play"    _CategorizeAndroidLibraries -p:OpenIapStore=play
run "Horizon's Maven SDKs verify"        "$horizon" _CategorizeAndroidLibraries -p:OpenIapStore=horizon
run "Amazon's Maven SDKs verify"         "$amazon"  _CategorizeAndroidLibraries -p:OpenIapStore=amazon
bash "$maui_root/scripts/verify-community-provider.sh"

# --apk also builds the whole example per store and checks what its APK links:
# manifest merge, D8 and packaging are past the stage the cases above reach.
if [[ "${1:-}" == "--apk" ]]; then
    echo "full builds"
    dexdump=""
    for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
        [[ -n "$sdk" ]] || continue
        dexdump=$(ls "$sdk"/build-tools/*/dexdump 2>/dev/null | sort -V | tail -1 || true)
        [[ -n "$dexdump" ]] && break
    done
    if [[ -z "$dexdump" ]]; then
        echo "No dexdump found; set ANDROID_HOME to an Android SDK with build-tools." >&2
        exit 1
    fi
    apk="$maui_root/example/OpenIap.Maui.Example/bin/Debug/net10.0-android/dev.hyo.martie-Signed.apk"
    for store in play horizon amazon; do
        rm -f "$apk"
        dotnet build "$example" -p:TargetFrameworks=net10.0-android -p:OpenIapStore=$store --nologo >/dev/null 2>&1 || true
        if [[ ! -f "$apk" ]]; then
            printf '  FAIL %-42s no APK\n' "$store APK"
            failed=$((failed + 1))
            continue
        fi
        dex_dir=$(mktemp -d)
        (cd "$dex_dir" && unzip -q -o "$apk" 'classes*.dex')
        classes=$(for dex in "$dex_dir"/classes*.dex; do "$dexdump" "$dex" | grep "Class descriptor"; done)
        rm -rf "$dex_dir"
        linked=""
        grep -q "Lcom/android/billingclient/" <<<"$classes" && linked+="play,"
        grep -q "Lcom/meta/horizon/" <<<"$classes" && linked+="horizon,"
        grep -q "Lcom/amazon/device/iap/" <<<"$classes" && linked+="amazon,"
        if [[ "$linked" == "$store," ]]; then
            printf '  ok   %-42s %s\n' "$store APK links only its store" "$store"
            passed=$((passed + 1))
        else
            printf '  FAIL %-42s expected %s, got %s\n' "$store APK links only its store" "$store" "${linked%,}"
            failed=$((failed + 1))
        fi
    done
fi

echo
echo "MAUI store selection: $passed passed, $failed failed"
[[ $failed -eq 0 ]]
