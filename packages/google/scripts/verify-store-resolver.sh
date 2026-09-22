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
        if [[ -z "$actual" ]]; then
            actual="no resolution (exit=$status): ${output//$'\n'/ }"
        elif [[ $status -ne 0 ]]; then
            # The resolution is printed during configuration, so a case that
            # only greps it passes even when the build fails.
            actual="$actual but exit=$status: ${output//$'\n'/ }"
        fi
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
run "a legacy flag that agrees is kept"    horizon/explicit assembleDebug -PopeniapStore=horizon -PhorizonEnabled=true
# Opting out links nothing, so a store flavor kept for packaging is no conflict.
run "none beside a store flavor"           none/explicit    assembleAmazonRelease -PopeniapStore=none -PfixtureAllowNone=true
run "the legacy opt-out beside one too"    none/explicit    assembleAmazonRelease -PopeniapPlatform=none -PfixtureAllowNone=true
run "a pin is trimmed and lower-cased"     horizon/explicit assembleDebug "-PopeniapStore= Horizon "

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
run "bHR is bundleHorizonRelease"          horizon/variant  bHR
# Gradle matches an abbreviation with fewer humps than the task name has.
run "aH is assembleHorizonRelease"         horizon/variant  aH

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
run "AGP's own assemble anchor is allowed" play/default     assemble
run "no task at all"                       play/default
run "a pin under an anchor is kept"        horizon/explicit assembleEverything -PopeniapStore=horizon
run "opting out ignores the graph"         none/explicit    assembleEverything -PopeniapStore=none -PfixtureAllowNone=true
run "a pin that the graph contradicts"     "fail:but the requested tasks build horizon" assemblehorizonrelease -PopeniapStore=play
# taskNames flattens task options; a filter naming a store is not a flavor, and
# the graph guard sees the value too but it matches no task.
run "a task option is not a store"         play/default     testDebugUnitTest --tests com.app.AmazonTest
# A whole invocation arrives as one flat list, so a task written after another
# task's option still has to be read, and in either order.
run "a task after an option is read"       horizon/variant  help --task clean assembleHorizonRelease
run "a task before its own option"         horizon/variant  assembleHorizonRelease testDebugUnitTest --tests com.app.Foo
run "a task after another task's option"   horizon/variant  testDebugUnitTest --tests com.app.Foo assembleHorizonRelease
# An option's value is not a task, even when it names or prefixes one that the
# requested anchor pulled into the graph.
run "an option value naming a real task"   play/default     assembleEverything help --task assembleAmazonDebug
run "an option value prefixing tasks"      play/default     assemble testDebugUnitTest --tests ass
run "an option value before a task"        play/default     help --task assemb assemble
# A flag takes no value, so the task after it is still a task. Reading it as a
# value linked play and shipped a horizon build, quietly.
run "a flag does not eat the next task"    horizon/variant  testDebugUnitTest --fail-fast assembleHorizonRelease
run "a flag after the task it belongs to"  horizon/variant  assembleHorizonRelease testDebugUnitTest --fail-fast
# --option=value is one token and carries its own value.
run "an inline option value"               horizon/variant  testDebugUnitTest --tests=com.app.Foo assembleHorizonRelease
# A value that spells a store is still a value. Reading it as a task picked
# amazon for a build that never named one.
run "an option value spelling a store"     play/default     properties --property amazon
run "the same value after an anchor"       play/default     assemble properties --property amazon

echo "connected device"
with_device QUEST1 "feature:oculus.hardware.standalone_vr" Oculus
run "a Quest selects horizon"              horizon/device   assembleDebug
run "a release build ignores the device"   play/default     assembleRelease
run "a flavor outranks the device"         amazon/variant   assembleAmazonDebug
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

# The list of value-taking options was twice written from memory, and twice
# wrong: once naming an option Gradle does not have, once missing one whose
# value spelled a store. Ask Gradle instead.
echo "value-option drift"
# Gradle prints a `--no-` twin for a flag and not for a value option. `--rerun`
# is the one built-in flag it appends to every task without a twin, so a new
# twinless flag reads as a value option here. Confirm whether it takes one by
# running the task with the option and nothing after it, then add a flag to
# this line rather than to openIapValueOptions, where it would drop the task
# written after it.
twinless_flags="--rerun"
# `--args` needs a JavaExec task and `--component` / `--format` belong to
# Gradle 8 tasks that Gradle 9 removed, so no single Gradle shows all three.
# They come from the same derivation run by hand on each major. Naming them
# here detects a change to the list; it cannot tell whether the list was right
# to begin with, which only a second Gradle could.
undetectable_options="--args --component --format"

declared=$(sed -n '/openIapValueOptions = \[/,/\] as Set/p' \
    "$google_root/gradle/openiap-store.gradle" \
    | grep -oE "'--[a-z0-9-]+'" | tr -d "'" | sort -u)
# A task prints as `name` or `name - description`. Every heading and banner
# carries a space without that separator, so neither form matches one.
fixture_tasks=$(cd "$fixture" && "$gradlew" --quiet tasks --all 2>/dev/null \
    | sed -nE 's/^:?([a-zA-Z][A-Za-z0-9_.:-]*)( - .*)?[[:space:]]*$/\1/p' | sort -u)
published=$(
    cd "$fixture" || exit
    printf '%s\n' "$fixture_tasks" | while IFS= read -r task; do
        [[ -n "$task" ]] || continue
        "$gradlew" --quiet help --task "$task" 2>/dev/null \
            | grep -oE '^[[:space:]]+--[a-z0-9-]+' | tr -d '[:blank:]'
    done | sort -u
)

# A derivation that saw little agrees with almost any list, and every per-task
# failure is swallowed, so name one described task and one undescribed one --
# the parser has already dropped the undescribed kind once.
if ! printf '%s\n' "$fixture_tasks" | grep -qx help \
    || ! printf '%s\n' "$fixture_tasks" | grep -qx testDebugUnitTest; then
    drift="derivation saw no tasks"
elif ! printf '%s\n' "$published" | grep -qx -- --task \
    || ! printf '%s\n' "$published" | grep -qx -- --property \
    || ! printf '%s\n' "$published" | grep -qx -- --tests; then
    drift="derivation saw no options"
else
    drift=$(
        printf '%s\n' "$published" | while IFS= read -r option; do
            [[ -n "$option" ]] || continue
            # Balanced parens: inside $( ) an unmatched `)` ends the substitution.
            case "$option" in (--no-*) continue ;; esac
            case " $twinless_flags " in (*" $option "*) continue ;; esac
            if printf '%s\n' "$published" | grep -qx -- "--no-${option#--}"; then
                printf '%s\n' "$declared" | grep -qx -- "$option" \
                    && printf 'now-a-flag:%s ' "$option"
                continue
            fi
            printf '%s\n' "$declared" | grep -qx -- "$option" \
                || printf 'unlisted:%s ' "$option"
        done
        for option in $undetectable_options; do
            printf '%s\n' "$declared" | grep -qx -- "$option" \
                || printf 'dropped:%s ' "$option"
        done
        # Listing a flag is the mistake the comments warn about, and the loop
        # above skips flags before it can notice one.
        for option in $twinless_flags; do
            printf '%s\n' "$declared" | grep -qx -- "$option" \
                && printf 'flag-listed:%s ' "$option"
        done
        # A `--no-` name is a flag by construction, and the loop above skips
        # every `--no-` before it can say so.
        # `|| :` so a no-match does not leave the pipeline failing under pipefail.
        { printf '%s\n' "$declared" | grep -E '^--no-' || :; } \
            | while IFS= read -r option; do printf 'flag-listed:%s ' "$option"; done
        # An option Gradle does not publish anywhere was once listed from
        # memory; Gradle rejects it before a build, so it only hides a typo.
        printf '%s\n' "$declared" | while IFS= read -r option; do
            [[ -n "$option" ]] || continue
            printf '%s\n' "$published" | grep -qx -- "$option" && continue
            case " $undetectable_options " in (*" $option "*) continue ;; esac
            printf 'unpublished:%s ' "$option"
        done
    )
fi

if [[ -z "$drift" ]]; then
    printf '  ok   %-58s %s\n' "the list matches what Gradle publishes" \
        "$(printf '%s\n' "$declared" | wc -l | tr -d ' ') listed"
    passed=$((passed + 1))
else
    printf '  FAIL %-58s %s\n' "the list drifted from Gradle" "$drift"
    failed=$((failed + 1))
fi

echo
echo "Store resolver: $passed passed, $failed failed"
[[ $failed -eq 0 ]]
