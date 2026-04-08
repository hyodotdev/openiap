#!/bin/bash

# Script to update the version in README.md based on local.properties

# Get the version from local.properties
VERSION=$(grep "libraryVersion=" local.properties | cut -d'=' -f2)

if [ -z "$VERSION" ]; then
    echo "Error: Could not find libraryVersion in local.properties"
    exit 1
fi

echo "Updating README.md with version: $VERSION"

# Update the version in README.md
# This will replace the version in the dependency block
sed -i '' "s/implementation(\"io.github.hyochan:kmp-iap:.*\")/implementation(\"io.github.hyochan:kmp-iap:$VERSION\")/" README.md

echo "README.md updated successfully with version $VERSION"