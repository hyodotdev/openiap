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

# Update openiap-versions.json without dropping other version fields
if command -v jq &> /dev/null; then
    tmp_file="${VERSIONS_FILE}.tmp"
    jq --arg version "$VERSION" '.google = $version' "$VERSIONS_FILE" > "$tmp_file"
    mv "$tmp_file" "$VERSIONS_FILE"
elif command -v python3 &> /dev/null; then
    VERSION="$VERSION" VERSIONS_FILE="$VERSIONS_FILE" python3 - <<'PY'
import json
import os

versions_file = os.environ["VERSIONS_FILE"]
with open(versions_file, "r", encoding="utf-8") as f:
    data = json.load(f)
data["google"] = os.environ["VERSION"]
with open(versions_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
else
    echo "Error: jq or python3 is required to update openiap-versions.json" >&2
    exit 1
fi

"$REPO_ROOT/scripts/sync-versions.sh"

echo "✅ Updated openiap-versions.json to version $VERSION"
echo ""
echo "Files modified:"
echo "  - $VERSIONS_FILE"
echo "  - $REPO_ROOT/packages/*/openiap-versions.json"
echo "  - $REPO_ROOT/packages/{gql,docs,google,apple}/package.json"
echo ""
echo "To commit these changes:"
echo "  git add openiap-versions.json packages/*/openiap-versions.json"
echo "  git add packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json"
echo "  git commit -m \"chore(google): update version to $VERSION\""
