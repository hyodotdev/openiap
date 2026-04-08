#!/bin/bash

# Local Maven Central Publishing Script
# This script publishes the library to Maven Central using local credentials

set -e

echo "🚀 Starting local Maven Central publishing..."

# Check if local.properties exists
if [ ! -f "local.properties" ]; then
    echo "❌ local.properties not found!"
    echo "Please create local.properties with your Maven Central credentials"
    exit 1
fi

# Check if GPG key file exists
if [ ! -f "gpg_key_content.gpg" ]; then
    echo "❌ gpg_key_content.gpg not found!"
    echo "Please export your GPG private key:"
    echo "gpg --export-secret-keys YOUR_KEY_ID > gpg_key_content.gpg"
    exit 1
fi

# Read credentials from local.properties
source local.properties

# Export environment variables for Gradle
export ORG_GRADLE_PROJECT_mavenCentralUsername="$mavenCentralUsername"
export ORG_GRADLE_PROJECT_mavenCentralPassword="$mavenCentralPassword"
export ORG_GRADLE_PROJECT_signingInMemoryKeyId="$signingInMemoryKeyId"
export ORG_GRADLE_PROJECT_signingInMemoryKeyPassword="$signingInMemoryKeyPassword"
export ORG_GRADLE_PROJECT_signingInMemoryKeyFile="$signingInMemoryKeyFile"
export ORG_GRADLE_PROJECT_sonatypeRepositoryId="$sonatypeRepositoryId"
export ORG_GRADLE_PROJECT_sonatypeAutomaticRelease="$sonatypeAutomaticRelease"

echo "✅ Environment variables set"
echo "📦 Username: $mavenCentralUsername"
echo "🔑 GPG Key ID: $signingInMemoryKeyId"

# Clean and build
echo "🧹 Cleaning previous build..."
./gradlew clean

echo "🔨 Building and publishing to Maven Central..."
./gradlew publishToMavenCentral

echo ""
echo "🎉 Publishing completed successfully!"
echo ""
echo "Check Maven Central Portal: https://central.sonatype.com/publishing/deployments"
echo "Current version: $(grep 'version = ' library/build.gradle.kts | cut -d'"' -f2)"
echo "Maven coordinates: io.github.hyochan:kmp-iap:$(grep 'version = ' library/build.gradle.kts | cut -d'"' -f2)"