#!/bin/bash

# Usage: ./scripts/bump-version.sh [major|minor|patch|x.x.x]

set -e

VERSIONS_FILE="openiap-versions.json"

# Get current version from openiap-versions.json
if [ -f "${VERSIONS_FILE}" ]; then
    if command -v jq &> /dev/null; then
        CURRENT_VERSION=$(jq -r '.apple' "${VERSIONS_FILE}")
    elif command -v python3 &> /dev/null; then
        CURRENT_VERSION=$(python3 -c "import json; print(json.load(open('${VERSIONS_FILE}'))['apple'])")
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
if [ -z "$1" ]; then
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
if [ -f "openiap-versions.json" ]; then
    if command -v jq &> /dev/null; then
        # Use jq to update JSON
        jq --arg version "$NEW_VERSION" '.apple = $version' openiap-versions.json > openiap-versions.json.tmp && \
        mv openiap-versions.json.tmp openiap-versions.json
        echo "✅ Updated openiap-versions.json"
    elif command -v python3 &> /dev/null; then
        # Use python3 as fallback
        python3 -c "
import json
with open('openiap-versions.json', 'r') as f:
    data = json.load(f)
data['apple'] = '$NEW_VERSION'
with open('openiap-versions.json', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
        echo "✅ Updated openiap-versions.json (using python3)"
    else
        echo "⚠️  Warning: jq and python3 not available. Skipping openiap-versions.json update"
    fi
fi

# Update OpenIapVersion.swift fallback version
if [ -f "Sources/OpenIapVersion.swift" ]; then
    sed -i '' "s/return \"[0-9.]*\"/return \"$NEW_VERSION\"/" Sources/OpenIapVersion.swift
    echo "✅ Updated OpenIapVersion.swift fallback"
fi

# Note: openiap.podspec now reads version from openiap-versions.json automatically

# Update README.md - CocoaPods installation
sed -i '' "s/pod 'openiap', '~> [0-9.]*'/pod 'openiap', '~> $NEW_VERSION'/" README.md

# Update README.md - Swift Package Manager
sed -i '' "s/.package(url: \"https:\/\/github.com\/hyodotdev\/openiap-apple.git\", from: \"[0-9.]*\")/.package(url: \"https:\/\/github.com\/hyodotdev\/openiap-apple.git\", from: \"$NEW_VERSION\")/" README.md

# Commit changes
git add README.md openiap-versions.json Sources/OpenIapVersion.swift
git commit -m "chore: bump version to $NEW_VERSION"

# Push commits
git push origin main

# Create and push tag (with check)
if git rev-parse "refs/tags/$NEW_VERSION" >/dev/null 2>&1; then
    echo "⚠️  Tag $NEW_VERSION already exists locally, deleting and recreating..."
    git tag -d "$NEW_VERSION"
fi

git tag "$NEW_VERSION"

# Try to push tag, ignore error if already exists
if ! git push origin "$NEW_VERSION" 2>/dev/null; then
    echo "ℹ️  Tag $NEW_VERSION already exists on remote (probably from CocoaPods release)"
else
    echo "✅ Tag $NEW_VERSION pushed successfully"
fi

echo "✅ Version bumped to $NEW_VERSION and pushed!"
echo "📦 Ready to create a GitHub Release with tag $NEW_VERSION"