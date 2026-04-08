#!/bin/bash

# KMP IAP Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up KMP IAP development environment..."

# Check if required commands exist
command -v java >/dev/null 2>&1 || { echo "❌ Java is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Java found: $(java -version 2>&1 | head -n 1)"

# Create local.properties if it doesn't exist
if [ ! -f "local.properties" ]; then
    echo "📝 Creating local.properties from template..."
    cp local.properties.template local.properties
    echo "⚠️  Please edit local.properties with your actual values"
else
    echo "✅ local.properties already exists"
fi

# Check if GPG is available
if command -v gpg >/dev/null 2>&1; then
    echo "✅ GPG found: $(gpg --version | head -n 1)"
    
    # Check if GPG key exists
    if gpg --list-secret-keys | grep -q "sec"; then
        echo "✅ GPG secret keys found"
    else
        echo "⚠️  No GPG secret keys found. See gpg-key-spec.md for setup instructions"
    fi
    
    # Create GPG key file if it doesn't exist
    if [ ! -f "gpg_key_content.gpg" ]; then
        echo "📝 Creating gpg_key_content.gpg from template..."
        cp gpg_key_content.gpg.template gpg_key_content.gpg
        echo "⚠️  Please replace gpg_key_content.gpg with your actual GPG private key"
    else
        echo "✅ gpg_key_content.gpg already exists"
    fi
else
    echo "⚠️  GPG not found. Install GPG for signing releases (optional for development)"
fi

# Check Android SDK
if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ]; then
    echo "✅ Android SDK found"
elif [ -d "$HOME/Library/Android/sdk" ]; then
    echo "✅ Android SDK found at default location"
    echo "💡 Consider setting ANDROID_HOME=$HOME/Library/Android/sdk"
elif [ -d "$HOME/Android/Sdk" ]; then
    echo "✅ Android SDK found at default location"
    echo "💡 Consider setting ANDROID_HOME=$HOME/Android/Sdk"
else
    echo "⚠️  Android SDK not found. Install Android Studio or set sdk.dir in local.properties"
fi

# Test Gradle wrapper
echo "🔨 Testing Gradle build..."
if ./gradlew --version >/dev/null 2>&1; then
    echo "✅ Gradle wrapper works"
else
    echo "❌ Gradle wrapper failed"
    exit 1
fi

# Try building the library
echo "🏗️  Building library..."
if ./gradlew :library:build -q; then
    echo "✅ Library builds successfully"
else
    echo "❌ Library build failed"
    echo "💡 Check the error messages above and ensure all dependencies are available"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit local.properties with your Maven Central and GPG credentials (for publishing)"
echo "2. Replace gpg_key_content.gpg with your actual GPG private key (for signing)"
echo "3. Open the project in VS Code to use the configured launch tasks"
echo "4. Run './gradlew :example:run' to test the example application"
echo ""
echo "📚 Documentation:"
echo "   - Development setup: docs/SETUP.md"
echo "   - Release guide: docs/RELEASE.md"
echo "   - GPG configuration: gpg-key-spec.md"