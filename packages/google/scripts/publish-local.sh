#!/usr/bin/env bash
set -euo pipefail

echo "Starting local publish (Maven Central by default)..."

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Resolve properties file (env override or common locations)
PROP_FILE="${PUBLISH_LOCAL_PROPS:-}"
if [[ -z "$PROP_FILE" ]]; then
  for cand in \
    "$ROOT_DIR/local.properties" \
    "$ROOT_DIR/openiap/local.properties" \
    "$ROOT_DIR/Example/local.properties"; do
    if [[ -f "$cand" ]]; then PROP_FILE="$cand"; break; fi
  done
fi

if [[ -z "$PROP_FILE" || ! -f "$PROP_FILE" ]]; then
  echo "local.properties not found"
  echo "Create local.properties with Maven Central credentials (or set PUBLISH_LOCAL_PROPS=/path/to/local.properties)"
  exit 1
fi
echo "Using properties: $PROP_FILE"

# Read key=value from local.properties without sourcing (ignore unrelated keys like sdk.dir)
read_prop() {
  local key="$1"
  grep -E "^${key}=" "$PROP_FILE" | tail -n1 | cut -d'=' -f2- || true
}

mavenCentralUsername="$(read_prop mavenCentralUsername)"
mavenCentralPassword="$(read_prop mavenCentralPassword)"
signingInMemoryKeyPassword="$(read_prop signingInMemoryKeyPassword)"
signingInMemoryKeyId="$(read_prop signingInMemoryKeyId)"
signingInMemoryKeyFile="$(read_prop signingInMemoryKeyFile)"
signingInMemoryKey="$(read_prop signingInMemoryKey)"
openIapVersion="$(read_prop openIapVersion)"
openIapGroupId="$(read_prop OPENIAP_GROUP_ID)"

if [[ -z "$mavenCentralUsername" || -z "$mavenCentralPassword" ]]; then
  echo "Missing required keys in local.properties. Required: mavenCentralUsername, mavenCentralPassword"
  echo "Optional when GPG key has no passphrase: signingInMemoryKeyPassword"
  exit 1
fi

# Allow empty passphrase if the GPG key has none
signingInMemoryKeyPassword="${signingInMemoryKeyPassword:-}"

KEY_CONTENT=""
if [[ -n "$signingInMemoryKeyFile" ]]; then
  if [[ ! -f "$signingInMemoryKeyFile" ]]; then
    echo "signingInMemoryKeyFile not found: $signingInMemoryKeyFile"
    echo "Export ASCII key: gpg --armor --export-secret-keys YOUR_KEY_ID > gpg_key_content.asc"
    exit 1
  fi
  KEY_CONTENT="$(cat "$signingInMemoryKeyFile")"
fi

if [[ -z "$KEY_CONTENT" && -n "$signingInMemoryKey" ]]; then
  KEY_CONTENT="$signingInMemoryKey"
fi

if [[ -z "$KEY_CONTENT" ]]; then
  if [[ -f "gpg_key_content.gpg" ]]; then
    KEY_CONTENT="$(cat gpg_key_content.gpg)"
  else
    echo "No signing key content provided"
    exit 1
  fi
fi

export ORG_GRADLE_PROJECT_mavenCentralUsername="$mavenCentralUsername"
export ORG_GRADLE_PROJECT_mavenCentralPassword="$mavenCentralPassword"
export ORG_GRADLE_PROJECT_signingInMemoryKeyId="$signingInMemoryKeyId"
export ORG_GRADLE_PROJECT_signingInMemoryKeyPassword="$signingInMemoryKeyPassword"
export ORG_GRADLE_PROJECT_signingInMemoryKey="$KEY_CONTENT"

if [[ -n "$openIapVersion" ]]; then
  export ORG_GRADLE_PROJECT_openIapVersion="$openIapVersion"
fi

# Optional: override Maven groupId via local.properties OPENIAP_GROUP_ID
if [[ -n "$openIapGroupId" ]]; then
  export ORG_GRADLE_PROJECT_OPENIAP_GROUP_ID="$openIapGroupId"
fi

# Optional first argument can be "local" to publish to Maven Local for testing
MODE=${1:-central}

echo "Cleaning build..."
./gradlew clean --no-daemon --stacktrace

if [[ "$MODE" == "local" ]]; then
  echo "Publishing to Maven Local (for local testing)..."
  ./gradlew :openiap:publishToMavenLocal --no-daemon --stacktrace
  echo "Published to Maven Local."
  echo "Use dependency: ${openIapGroupId:-io.github.hyochan.openiap}:openiap-google:${openIapVersion:-<version-from-build>}"
  exit 0
fi

echo "Building and publishing to Maven Central..."
./gradlew :openiap:publishAndReleaseToMavenCentral --no-daemon --no-parallel --stacktrace

echo "Publishing completed."
echo "Check https://central.sonatype.com/publishing/deployments"
echo "Coordinates: ${openIapGroupId:-io.github.hyochan.openiap}:openiap-google:${openIapVersion:-<version-from-build>}"
