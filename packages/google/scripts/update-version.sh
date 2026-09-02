#!/usr/bin/env bash
set -euo pipefail

# This script updates the Google version in openiap-versions.json and synced metadata.
# Usage: ./scripts/update-version.sh <version>

if [ $# -ne 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.2.7"
    exit 1
fi

VERSION="$1"
# Trim leading 'v' if present
VERSION="${VERSION#v}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
VERSIONS_FILE="${REPO_ROOT}/openiap-versions.json"

echo "Updating version to $VERSION"

if [[ ! -f "$VERSIONS_FILE" ]]; then
    echo "Error: openiap-versions.json not found at $VERSIONS_FILE" >&2
    exit 1
fi

# Update the native key and derived spec floor atomically.
node "$REPO_ROOT/scripts/release-branch-policy.mjs" \
    update-native google "$VERSION"

"$REPO_ROOT/scripts/sync-versions.sh"

echo "✅ Updated openiap-versions.json to version $VERSION"
echo ""
echo "Files modified:"
echo "  - $VERSIONS_FILE"
echo "  - $REPO_ROOT/packages/*/openiap-versions.json"
echo "  - $REPO_ROOT/specs/openiap/client/package.json"
echo "  - $REPO_ROOT/packages/{docs,google,apple}/package.json"
echo ""
echo "To commit these changes:"
echo "  git add openiap-versions.json packages/*/openiap-versions.json"
echo "  git add specs/openiap/client/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json"
echo "  git commit -m \"chore(release): openiap-google@$VERSION\""
