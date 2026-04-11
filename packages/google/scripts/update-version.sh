#!/usr/bin/env bash
set -euo pipefail

# This script updates the version in README.md and openiap-versions.json
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
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
README_FILE="${REPO_ROOT}/README.md"
VERSIONS_FILE="${REPO_ROOT}/openiap-versions.json"

echo "Updating version to $VERSION"

# Update README.md
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS uses different sed syntax
    sed -i '' "s/openiap-google:[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*/openiap-google:$VERSION/g" "$README_FILE"
else
    # Linux
    sed -i "s/openiap-google:[0-9]\+\.[0-9]\+\.[0-9]\+/openiap-google:$VERSION/g" "$README_FILE"
fi

# Update openiap-versions.json (preserving spec version)
if command -v python3 &> /dev/null; then
    SPEC_VERSION=$(python3 -c "import json; print(json.load(open('$VERSIONS_FILE'))['spec'])" 2>/dev/null || echo "2.0.0")
else
    SPEC_VERSION=$(grep '"spec"' "$VERSIONS_FILE" | sed 's/.*"spec".*"\([^"]*\)".*/\1/')
fi

cat > "$VERSIONS_FILE" << EOF
{
  "spec": "$SPEC_VERSION",
  "google": "$VERSION"
}
EOF

echo "✅ Updated README.md and openiap-versions.json to version $VERSION"
echo ""
echo "Files modified:"
echo "  - $README_FILE"
echo "  - $VERSIONS_FILE"
echo ""
echo "To commit these changes:"
echo "  git add README.md openiap-versions.json"
echo "  git commit -m \"chore: update version to $VERSION\""