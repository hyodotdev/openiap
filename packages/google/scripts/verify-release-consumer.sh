#!/usr/bin/env bash
set -euo pipefail

# No other build here runs R8. Build a minified release app per store from the
# published artifacts and check which store SDK it linked and what R8 kept.

google_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
repo_root=$(cd "$google_root/../.." && pwd)
consumer_root="$google_root/compatibility/release-consumer"
consumer_temp=$(mktemp -d)

cleanup() {
    find "$consumer_temp" -type f -delete
    find "$consumer_temp" -type l -delete
    find "$consumer_temp" -depth -type d -empty -delete
}
trap cleanup EXIT

openiap_version=$(node -e \
    "const versions = require(process.argv[1]); process.stdout.write(versions.google)" \
    "$repo_root/openiap-versions.json")
local_repository="$consumer_temp/repository"

# store, openiap artifact, store SDK module, and the SDK's class prefix
stores=(
    "play openiap-google com.android.billingclient:billing com.android.billingclient."
    "horizon openiap-google-horizon com.meta.horizon.billingclient.api:horizon-billing-compatibility com.meta.horizon.billingclient."
    "amazon openiap-google-amazon com.amazon.device:amazon-appstore-sdk com.amazon.device.iap."
)

cd "$google_root"
for entry in "${stores[@]}"; do
    ./gradlew :openiap:publishMavenPublicationToMavenLocal \
        -POPENIAP_PUBLISH_VARIANT="${entry%% *}" \
        -Dmaven.repo.local="$local_repository" \
        --no-daemon
done

failures=0

fail() {
    echo "FAIL [$1] $2" >&2
    failures=$((failures + 1))
}

# Class lines in R8's mapping start at column one with the original name.
mapping_has_package() {
    awk -v prefix="$2" 'index($0, prefix) == 1 { found = 1; exit } END { exit !found }' "$1"
}

# The Play module reaches newer Play Billing APIs by name so it runs on older
# billing versions; reading those names from its source checks each new lookup.
play_source=$(find "$google_root/openiap/src/play" -name '*.kt' -exec cat {} + | tr -s '[:space:]' ' ')
play_classes=$(grep -oE 'Class\.forName\( ?"com\.android\.billingclient\.api\.[^"]+"' <<< "$play_source" \
    | sed -E 's/.*"(.*)"/\1/; s/\\\$/$/g' | sort -u || true)
play_methods=$(grep -oE 'get(Declared)?Method\( ?"[A-Za-z0-9_]+"|method\.name == "[A-Za-z0-9_]+"' <<< "$play_source" \
    | sed -E 's/.*"(.*)"/\1/' | sort -u || true)
if [ -z "$play_classes" ] || [ -z "$play_methods" ]; then
    echo "Found no Play Billing lookups in the Play module; update this check." >&2
    exit 1
fi

dexdump=$(find "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}/build-tools" -name dexdump -type f 2>/dev/null \
    | sort -V | tail -n 1 || true)
if [ -z "$dexdump" ]; then
    echo "No dexdump under \$ANDROID_HOME/build-tools to read the Play APK with." >&2
    exit 1
fi

# Prints each looked-up Play Billing class or method that the APK lacks.
missing_play_lookups() {
    local defined name
    defined=$("$dexdump" "$1" | awk -F "'" '
        /^  Class descriptor/ { c = substr($2, 2, length($2) - 2); gsub("/", ".", c); print "class " c; next }
        /^  (Direct|Virtual) methods/ { m = 1; next }
        /^  (Static|Instance) fields/ { m = 0; next }
        m && /^      name +:/ { print "method " c " " $2 }')
    for name in $play_classes; do
        grep -qxF "class $name" <<< "$defined" || echo "$name"
    done
    for name in $play_methods; do
        grep -qE "^method com\.android\.billingclient\.api\.[^ ]+ $name\$" <<< "$defined" || echo "$name()"
    done
}

# check <case> <store> <source> [gradle args...]
check() {
    local name=$1 store=$2 source=$3
    shift 3
    local build="$consumer_temp/build/$name"
    local log="$consumer_temp/$name.log"
    local mapping="$build/outputs/mapping/release/mapping.txt"
    local failures_before=$failures
    echo "== $name: expecting store=$store (source=$source)"

    if ! "$repo_root/scripts/ci/retry-gradle.sh" ./gradlew -p "$consumer_root" \
        dependencies --configuration releaseRuntimeClasspath assembleRelease \
        -PopenIapRepository="$local_repository" \
        -PopenIapVersion="$openiap_version" \
        -PconsumerBuildDirectory="$build" \
        --project-cache-dir "$consumer_temp/project-cache/$name" \
        --no-daemon "$@" > "$log" 2>&1; then
        tail -n 80 "$log" >&2
        fail "$name" "the minified release build failed"
        return 0
    fi

    if ! grep -qF "openiap: store=$store (source=$source;" "$log"; then
        grep -F "openiap: store=" "$log" >&2 || true
        fail "$name" "the resolver did not pick $store from $source"
    fi
    if [ ! -f "$mapping" ]; then
        fail "$name" "R8 wrote no mapping at $mapping"
        return 0
    fi

    local entry other artifact sdk package linked kept
    for entry in "${stores[@]}"; do
        read -r other artifact sdk package <<< "$entry"
        if [ "$other" = "$store" ]; then
            linked=$artifact kept=$package
            if ! grep -qF "io.github.hyochan.openiap:$artifact:$openiap_version" "$log"; then
                fail "$name" "releaseRuntimeClasspath lacks $artifact:$openiap_version"
            fi
            if ! grep -qF "$sdk:" "$log"; then
                fail "$name" "releaseRuntimeClasspath lacks $sdk"
            fi
            if ! mapping_has_package "$mapping" "$package"; then
                fail "$name" "R8 kept no $package class"
            fi
        else
            if grep -qF "io.github.hyochan.openiap:$artifact:" "$log"; then
                fail "$name" "releaseRuntimeClasspath also links $artifact"
            fi
            if grep -qF "$sdk:" "$log"; then
                fail "$name" "releaseRuntimeClasspath also links $sdk"
            fi
            if mapping_has_package "$mapping" "$package"; then
                fail "$name" "the release APK carries $package classes"
            fi
        fi
    done

    # The Appstore SDK finds and fills its own classes by their com.amazon. names,
    # and the Appstore broadcasts to its receiver by name. R8's own synthesized
    # classes are not the SDK's.
    if [ "$store" = amazon ]; then
        local renamed
        renamed=$(awk '/^com\.amazon\./ && !index($1, "$$ExternalSynthetic") && $1 ":" != $3 { print $1; exit }' "$mapping")
        if [ -n "$renamed" ]; then
            fail "$name" "R8 renamed Amazon SDK classes such as $renamed"
        fi
    fi

    if [ "$store" = play ]; then
        local apk missing
        apk=("$build"/outputs/apk/release/*.apk)
        missing=$(missing_play_lookups "${apk[0]}")
        if [ -n "$missing" ]; then
            fail "$name" "the release APK lacks Play Billing names the Play module looks up: $(echo $missing)"
        fi
    fi

    if [ "$failures" -eq "$failures_before" ]; then
        echo "   ok: $name linked $linked and R8 kept $kept"
    fi
}

# No pin and no store flavor: Play.
check play play default
check horizon horizon explicit -PopeniapStore=horizon
# The channel CI and EAS builds use.
ORG_GRADLE_PROJECT_openiapStore=amazon check amazon amazon explicit

if [ "$failures" -gt 0 ]; then
    echo "$failures release-build check(s) failed" >&2
    exit 1
fi
echo "Minified release builds link the resolved store for play, horizon, and amazon."
