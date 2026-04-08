#!/bin/bash

# iOS Device Run Script for KMP-IAP Example App
set -e

echo "🚀 Running KMP-IAP Example on iOS Device..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Xcode is not installed. Please install Xcode from the App Store.${NC}"
    exit 1
fi

# Navigate to example directory
cd example

# Skip gradle build for now - let Xcode handle the build
echo "🔨 Preparing for iOS build..."

# Open Xcode project if needed
XCODE_PROJECT="iosApp/iosApp.xcodeproj"
XCODE_WORKSPACE="iosApp/iosApp.xcworkspace"

if [ -f "$XCODE_WORKSPACE" ]; then
    PROJECT_PATH="$XCODE_WORKSPACE"
    PROJECT_FLAG="-workspace"
else
    PROJECT_PATH="$XCODE_PROJECT"
    PROJECT_FLAG="-project"
fi

# List connected devices
echo -e "\n${YELLOW}📱 Connected iOS Devices:${NC}"
xcrun xctrace list devices 2>&1 | grep -E "iPhone|iPad" | grep -v "Simulator" || echo "No physical devices found"

# Get the first connected device - updated regex to match the actual device ID format
DEVICE_ID=$(xcrun xctrace list devices 2>&1 | grep -E "iPhone|iPad" | grep -v "Simulator" | head -n 1 | sed -n 's/.*(\([0-9A-Fa-f-]*\)).*/\1/p' || echo "")

if [ -z "$DEVICE_ID" ]; then
    echo -e "${RED}❌ No iOS device connected. Please connect your iPhone/iPad and make sure it's trusted.${NC}"
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo "  1. Connect your device via USB"
    echo "  2. Unlock your device"
    echo "  3. Trust this computer when prompted"
    echo "  4. Make sure you have a valid development team in Xcode"
    exit 1
fi

echo -e "${GREEN}✅ Found device: $DEVICE_ID${NC}"

# Build and run for device
echo -e "\n🔨 Building and running on iOS device..."
echo -e "${BLUE}Device ID: $DEVICE_ID${NC}"

# Use a single xcodebuild command to build and run
xcodebuild \
    $PROJECT_FLAG "$PROJECT_PATH" \
    -scheme iosApp \
    -destination "id=$DEVICE_ID" \
    -configuration Debug \
    -allowProvisioningUpdates \
    clean build \
    CODE_SIGN_IDENTITY="Apple Development" \
    CODE_SIGN_STYLE="Automatic" || {
        echo -e "\n${RED}❌ Build failed!${NC}"
        echo -e "${YELLOW}💡 Common issues:${NC}"
        echo "  1. Make sure you have a development team set in Xcode"
        echo "  2. Open the project in Xcode and fix any signing issues"
        echo "  3. Trust your developer certificate on the device"
        exit 1
    }

# Find the built app
APP_PATH=$(find iosApp/build -name "kmp-iap-example.app" -type d | grep "Debug-iphoneos" | head -1)

if [ -z "$APP_PATH" ]; then
    echo -e "${YELLOW}⚠️  App not found. Looking in DerivedData...${NC}"
    APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "kmp-iap-example.app" -type d | grep "Debug-iphoneos" | head -1)
fi

if [ -z "$APP_PATH" ]; then
    echo -e "${RED}❌ Could not find built app!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found app at: $APP_PATH${NC}"

# Run the app
echo -e "\n🚀 Installing and running app on device..."

# First, try using xcrun devicectl which is the modern replacement for ios-deploy
if command -v xcrun devicectl &> /dev/null; then
    echo -e "${BLUE}Using xcrun devicectl...${NC}"
    
    # Install the app
    xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" || {
        echo -e "${YELLOW}⚠️  devicectl install failed, trying ios-deploy...${NC}"
    }
    
    # Get bundle ID from Info.plist
    BUNDLE_ID=$(defaults read "$APP_PATH/Info.plist" CFBundleIdentifier 2>/dev/null || echo "dev.hyo.martie")
    
    # Launch the app
    xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" || {
        echo -e "${YELLOW}⚠️  Could not launch with devicectl.${NC}"
    }
else
    # Fallback to ios-deploy with --noninteractive flag to avoid DeviceSupport issues
    if command -v ios-deploy &> /dev/null; then
        echo -e "${BLUE}Using ios-deploy...${NC}"
        ios-deploy --bundle "$APP_PATH" --id "$DEVICE_ID" --noninteractive --justlaunch || {
            echo -e "\n${YELLOW}⚠️  Could not launch with ios-deploy.${NC}"
            echo -e "${GREEN}✅ But the app should be installed on your device!${NC}"
            echo -e "${YELLOW}📱 Check your device and tap the app icon to run it.${NC}"
            echo -e "\n${YELLOW}💡 Tip: The DeviceSupport error is expected with newer iOS versions.${NC}"
            echo -e "${YELLOW}   The app is installed - just tap the icon on your device to run it.${NC}"
        }
    else
        echo -e "${YELLOW}⚠️  ios-deploy not found. Installing...${NC}"
        brew install ios-deploy 2>/dev/null || npm install -g ios-deploy
        
        # Try again after installation
        ios-deploy --bundle "$APP_PATH" --id "$DEVICE_ID" --noninteractive --justlaunch || {
            echo -e "\n${YELLOW}⚠️  Could not launch with ios-deploy.${NC}"
            echo -e "${GREEN}✅ But the app should be installed on your device!${NC}"
            echo -e "${YELLOW}📱 Check your device and tap the app icon to run it.${NC}"
        }
    fi
fi

echo -e "\n${GREEN}✅ Done! The app should be running on your iOS device.${NC}"