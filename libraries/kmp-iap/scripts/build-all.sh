#!/bin/bash
set -e

echo "🔨 Building KMP-IAP Library"
echo "=========================="

# Clean previous builds
echo "📧 Cleaning previous builds..."
./gradlew clean

# Run spotless check
echo "✨ Running code formatting check..."
./gradlew spotlessCheck

# Build all targets
echo "🏗️ Building all targets..."
./gradlew :library:build

# Run all tests
echo "🧪 Running all tests..."
./gradlew :library:allTests

# Build example app
echo "📱 Building example app..."
./gradlew :example:build

# Generate documentation
echo "📚 Generating documentation..."
./gradlew :library:dokkaHtml

echo "✅ Build completed successfully!"
echo ""
echo "Build outputs:"
echo "- Library: library/build/outputs/"
echo "- Documentation: library/build/dokka/"
echo "- Example: example/build/outputs/"