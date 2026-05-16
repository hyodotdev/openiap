#!/bin/bash

# Keep README.md free of release-specific version literals. The published
# release notes carry the exact version; the source README points users to
# Maven Central for the current coordinate.

set -euo pipefail

if ! grep -Fq 'implementation("io.github.hyochan:kmp-iap:<version>")' README.md; then
    echo "Error: README.md must keep the kmp-iap dependency snippet version-free"
    exit 1
fi

if ! grep -Fq 'https://central.sonatype.com/artifact/io.github.hyochan/kmp-iap' README.md; then
    echo "Error: README.md must link to the kmp-iap Maven Central page"
    exit 1
fi

echo "README.md keeps kmp-iap version selection delegated to Maven Central"
