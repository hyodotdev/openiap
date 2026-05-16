#!/bin/bash

# Local Maven Central Publishing Script
# This script publishes the library to Maven Central using local credentials

set -euo pipefail

echo "🚀 Starting local Maven Central publishing..."

# Check if local.properties exists
if [ ! -f "local.properties" ]; then
    echo "❌ local.properties not found!"
    echo "Please create local.properties with your Maven Central credentials"
    exit 1
fi

# Read key=value pairs without sourcing the file. Android local.properties
# commonly contains dotted keys such as sdk.dir.
read_prop() {
    local key="$1"
    grep -E "^${key}=" local.properties | tail -n1 | cut -d'=' -f2- || true
}

mavenCentralUsername="$(read_prop mavenCentralUsername)"
mavenCentralPassword="$(read_prop mavenCentralPassword)"
signingInMemoryKeyId="$(read_prop signingInMemoryKeyId)"
signingInMemoryKeyPassword="$(read_prop signingInMemoryKeyPassword)"
signingInMemoryKeyFile="$(read_prop signingInMemoryKeyFile)"
signingInMemoryKey="$(read_prop signingInMemoryKey)"

if [ -z "$mavenCentralUsername" ] || [ -z "$mavenCentralPassword" ]; then
    echo "❌ Missing mavenCentralUsername or mavenCentralPassword in local.properties"
    exit 1
fi

if [ -z "$signingInMemoryKey" ] && [ -z "$signingInMemoryKeyFile" ]; then
    if [ ! -f "gpg_key_content.gpg" ]; then
        echo "❌ gpg_key_content.gpg not found!"
        echo "Please export your GPG private key:"
        echo "gpg --armor --export-secret-keys YOUR_KEY_ID > gpg_key_content.gpg"
        exit 1
    fi
    signingInMemoryKeyFile="gpg_key_content.gpg"
fi

# Export environment variables for Gradle
export ORG_GRADLE_PROJECT_mavenCentralUsername="$mavenCentralUsername"
export ORG_GRADLE_PROJECT_mavenCentralPassword="$mavenCentralPassword"
export ORG_GRADLE_PROJECT_signingInMemoryKeyId="$signingInMemoryKeyId"
export ORG_GRADLE_PROJECT_signingInMemoryKeyPassword="$signingInMemoryKeyPassword"
if [ -n "$signingInMemoryKey" ]; then
    export ORG_GRADLE_PROJECT_signingInMemoryKey="$signingInMemoryKey"
fi
if [ -n "$signingInMemoryKeyFile" ]; then
    export ORG_GRADLE_PROJECT_signingInMemoryKeyFile="$signingInMemoryKeyFile"
fi

echo "✅ Environment variables set"
echo "📦 Username: $mavenCentralUsername"
echo "🔑 GPG Key ID: $signingInMemoryKeyId"

# Clean and build
echo "🧹 Cleaning previous build..."
./gradlew clean

echo "🔨 Building and publishing to Maven Central..."
./gradlew :library:publishAndReleaseToMavenCentral --no-daemon --no-parallel

echo ""
echo "🎉 Publishing completed successfully!"
echo ""
echo "Check Maven Central Portal: https://central.sonatype.com/publishing/deployments"
CURRENT_VERSION=$(grep '^libraryVersion=' gradle.properties | cut -d'=' -f2)
echo "Current version: $CURRENT_VERSION"
echo "Maven coordinates: io.github.hyochan:kmp-iap:$CURRENT_VERSION"
