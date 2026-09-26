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

cd "$google_root"
for variant in play horizon amazon; do
    ./gradlew :openiap:publishMavenPublicationToMavenLocal \
        -POPENIAP_PUBLISH_VARIANT="$variant" \
        -Dmaven.repo.local="$local_repository" \
        --no-daemon
done

stores=(play horizon amazon)
declare -A artifact=(
    [play]=openiap-google
    [horizon]=openiap-google-horizon
    [amazon]=openiap-google-amazon
)
declare -A sdk=(
    [play]=com.android.billingclient:billing
    [horizon]=com.meta.horizon.billingclient.api:horizon-billing-compatibility
    [amazon]=com.amazon.device:amazon-appstore-sdk
)
declare -A sdk_package=(
    [play]=com.android.billingclient.
    [horizon]=com.meta.horizon.billingclient.
    [amazon]=com.amazon.device.iap.
)

failures=0

fail() {
    echo "FAIL [$1] $2" >&2
    failures=$((failures + 1))
}

# Class lines in R8's mapping start at column one with the original name.
mapping_has_package() {
    awk -v prefix="$2" 'index($0, prefix) == 1 { found = 1; exit } END { exit !found }' "$1"
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

    local other
    for other in "${stores[@]}"; do
        if [ "$other" = "$store" ]; then
            if ! grep -qF "io.github.hyochan.openiap:${artifact[$other]}:$openiap_version" "$log"; then
                fail "$name" "releaseRuntimeClasspath lacks ${artifact[$other]}:$openiap_version"
            fi
            if ! grep -qF "${sdk[$other]}:" "$log"; then
                fail "$name" "releaseRuntimeClasspath lacks ${sdk[$other]}"
            fi
            if ! mapping_has_package "$mapping" "${sdk_package[$other]}"; then
                fail "$name" "R8 kept no ${sdk_package[$other]} class"
            fi
        else
            if grep -qF "io.github.hyochan.openiap:${artifact[$other]}:" "$log"; then
                fail "$name" "releaseRuntimeClasspath also links ${artifact[$other]}"
            fi
            if grep -qF "${sdk[$other]}:" "$log"; then
                fail "$name" "releaseRuntimeClasspath also links ${sdk[$other]}"
            fi
            if mapping_has_package "$mapping" "${sdk_package[$other]}"; then
                fail "$name" "the release APK carries ${sdk_package[$other]} classes"
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

    if [ "$failures" -eq "$failures_before" ]; then
        echo "   ok: $name linked ${artifact[$store]} and R8 kept ${sdk_package[$store]}"
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
