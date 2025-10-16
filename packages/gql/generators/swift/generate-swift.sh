#!/usr/bin/env bash
# Swift code generation helper using Apollo iOS CLI
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA_DIR="${SCRIPT_DIR}/../../src"
OUTPUT_DIR="${SCRIPT_DIR}/Generated"
MODULE_NAME="OpenIAPGraphQL"

mkdir -p "$OUTPUT_DIR"

if ! command -v apollo-ios-cli >/dev/null 2>&1; then
  echo "apollo-ios-cli is not installed. Install it via 'brew install apollo-ios-cli' or 'mint install apollographql/apollo-ios-cli'." >&2
  exit 1
fi

SCHEMA_ARGS=()
while IFS= read -r -d '' file; do
  SCHEMA_ARGS+=("--schema-paths" "$file")
done < <(find "$SCHEMA_DIR" -maxdepth 1 -name '*.graphql' -print0)

apollo-ios-cli generate \
  "${SCHEMA_ARGS[@]}" \
  --module-type embeddedInTarget \
  --target-name "$MODULE_NAME" \
  --output-dir "$OUTPUT_DIR"
