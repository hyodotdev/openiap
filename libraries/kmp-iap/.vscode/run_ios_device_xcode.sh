#!/bin/bash

# Simple iOS Device Run Script using Xcode
set -e

echo "🚀 Opening KMP-IAP Example in Xcode..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Navigate to example directory
cd example

# Build the shared framework
echo "🔨 Building shared framework..."
./gradlew build || {
    echo "⚠️  Build failed, but continuing to open Xcode..."
}

# Open in Xcode
echo -e "\n📱 Opening project in Xcode..."
open iosApp/iosApp.xcodeproj

echo -e "\n${GREEN}✅ Xcode is opening...${NC}"
echo -e "\n${YELLOW}📋 To run on your device:${NC}"
echo "  1. Select your device from the device list (next to the scheme)"
echo "  2. Make sure your team is selected in Signing & Capabilities"
echo "  3. Press the Run button (▶️) or Cmd+R"
echo ""
echo -e "${YELLOW}💡 First time setup:${NC}"
echo "  - You may need to trust your developer certificate on the device"
echo "  - Go to Settings > General > Device Management on your iPhone"
echo ""
echo -e "${GREEN}Happy testing! 🎉${NC}"