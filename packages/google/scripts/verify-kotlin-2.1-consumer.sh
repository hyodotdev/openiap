#!/usr/bin/env bash
set -euo pipefail

google_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
repo_root=$(cd "$google_root/../.." && pwd)
consumer_root="$google_root/compatibility/kotlin-2.1-consumer"
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
for target in \
    "play:openiap-google" \
    "horizon:openiap-google-horizon" \
    "amazon:openiap-google-amazon"; do
    IFS=: read -r variant artifact <<< "$target"

    ./gradlew :openiap:publishMavenPublicationToMavenLocal \
        -POPENIAP_PUBLISH_VARIANT="$variant" \
        -Dmaven.repo.local="$local_repository" \
        --no-daemon

    ./gradlew -p "$consumer_root" compileDebugKotlin \
        -PopenIapRepository="$local_repository" \
        -PopenIapArtifact="$artifact" \
        -PopenIapVersion="$openiap_version" \
        -PconsumerBuildDirectory="$consumer_temp/build/$variant" \
        --project-cache-dir "$consumer_temp/project-cache/$variant" \
        --no-daemon
done
