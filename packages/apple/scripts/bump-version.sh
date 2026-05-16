#!/usr/bin/env bash

# Usage: ./scripts/bump-version.sh [major|minor|patch|x.x.x]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
VERSIONS_FILE="${REPO_ROOT}/openiap-versions.json"

# Get current version from openiap-versions.json
if [[ -f "${VERSIONS_FILE}" ]]; then
    if command -v jq &> /dev/null; then
        CURRENT_VERSION=$(jq -er '.apple | select(type == "string" and length > 0)' "${VERSIONS_FILE}")
    elif command -v python3 &> /dev/null; then
        CURRENT_VERSION=$(python3 - "${VERSIONS_FILE}" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as file:
    value = json.load(file).get("apple")

if not isinstance(value, str) or not value.strip():
    raise SystemExit(f"missing apple in {path}")

print(value.strip())
PY
)
    else
        echo "❌ Error: jq or python3 is required to read openiap-versions.json"
        exit 1
    fi
else
    echo "❌ Error: openiap-versions.json not found"
    exit 1
fi

echo "Current version: $CURRENT_VERSION"

# Parse version components
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Determine new version
if [[ -z "${1:-}" ]]; then
    echo "Usage: $0 [major|minor|patch|x.x.x]"
    exit 1
fi

case "$1" in
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    minor)
        NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
        ;;
    patch)
        NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
        ;;
    *)
        # Direct version number provided
        NEW_VERSION="$1"
        ;;
esac

echo "New version: $NEW_VERSION"

# Update openiap-versions.json
if command -v jq &> /dev/null; then
    tmp_file="${VERSIONS_FILE}.tmp"
    jq --arg version "$NEW_VERSION" '.apple = $version' "$VERSIONS_FILE" > "$tmp_file"
    mv "$tmp_file" "$VERSIONS_FILE"
    echo "✅ Updated openiap-versions.json"
elif command -v python3 &> /dev/null; then
    VERSION="$NEW_VERSION" VERSIONS_FILE="$VERSIONS_FILE" python3 - <<'PY'
import json
import os

versions_file = os.environ["VERSIONS_FILE"]
with open(versions_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
data['apple'] = os.environ["VERSION"]
with open(versions_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PY
    echo "✅ Updated openiap-versions.json (using python3)"
else
    echo "❌ Error: jq or python3 is required to update openiap-versions.json"
    exit 1
fi

"$REPO_ROOT/scripts/sync-versions.sh"

# openiap.podspec reads the Apple version from openiap-versions.json.

# Commit changes
cd "$REPO_ROOT"
git add openiap-versions.json packages/*/openiap-versions.json
git add packages/gql/package.json packages/docs/package.json packages/google/package.json packages/apple/package.json
git commit -m "chore(apple): bump version to $NEW_VERSION"

# Push commits
git pull --rebase origin main
git push origin HEAD:main

# Create and push tag (with check)
if git rev-parse "refs/tags/$NEW_VERSION" >/dev/null 2>&1; then
    echo "ℹ️  Tag $NEW_VERSION already exists locally. Reusing existing tag."
elif git ls-remote --exit-code --tags origin "refs/tags/$NEW_VERSION" >/dev/null 2>&1; then
    echo "ℹ️  Tag $NEW_VERSION already exists on remote. Reusing existing tag."
else
    git tag "$NEW_VERSION"
    git push origin "$NEW_VERSION"
    echo "✅ Tag $NEW_VERSION pushed successfully"
fi

echo "✅ Version bumped to $NEW_VERSION and pushed!"
echo "📦 Ready to create a GitHub Release with tag $NEW_VERSION"
