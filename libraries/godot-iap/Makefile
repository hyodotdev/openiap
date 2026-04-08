# GodotIap Build System
# Usage:
#   make setup        - Download dependencies (godot-lib.aar)
#   make ios          - Build iOS plugin
#   make android      - Build Android plugin
#   make all          - Build everything
#   make clean        - Clean build artifacts
#   make run-android  - Export and run Android APK on device
#   make run-ios      - Export iOS project and open in Xcode

GODOT_VERSION ?= 4.3
GODOT_LIB_URL = https://github.com/godotengine/godot/releases/download/$(GODOT_VERSION)-stable/godot-lib.$(GODOT_VERSION).stable.template_release.aar
SWIFT_GODOT_VERSION ?= v0.74.0

# Directories
PROJECT_ROOT := $(shell pwd)
IOS_DIR := $(PROJECT_ROOT)/ios
IOS_GDEXT_DIR := $(PROJECT_ROOT)/ios-gdextension
ANDROID_DIR := $(PROJECT_ROOT)/android
EXAMPLE_DIR := $(PROJECT_ROOT)/Example
ADDON_DIR := $(PROJECT_ROOT)/addons/godot-iap
BIN_DIR := $(ADDON_DIR)/bin
IOS_EXPORT_DIR := $(EXAMPLE_DIR)/ios

# Godot executable
GODOT ?= /Applications/Godot.app/Contents/MacOS/Godot

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: all setup ios ios-build macos macos-build android clean help run-android run-ios export-ios export-android test-setup test-android test-ios export-test-android export-test-ios test

help:
	@echo "GodotIap Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make setup         - Download godot-lib.aar for Android development"
	@echo "  make ios           - Build iOS plugin (uses xcodebuild)"
	@echo "  make macos         - Build macOS plugin (uses xcodebuild)"
	@echo "  make android       - Build Android plugin"
	@echo "  make all           - Build everything"
	@echo "  make clean         - Clean all build artifacts"
	@echo ""
	@echo "Run commands (Example - development):"
	@echo "  make run-android   - Build, export APK and install on connected device"
	@echo "  make run-ios       - Export iOS project and open in Xcode"
	@echo "  make export-ios    - Export iOS Xcode project only"
	@echo "  make export-android - Export Android APK only"
	@echo ""
	@echo "Unit test commands:"
	@echo "  make test          - Run GDScript unit tests (headless)"
	@echo ""
	@echo "Test commands (TestProject - local build testing):"
	@echo "  make test-android  - Copy local binaries to TestProject and run on Android"
	@echo "  make test-ios      - Copy local binaries to TestProject and open in Xcode"
	@echo ""
	@echo "Release commands (TestProject - GitHub Release testing):"
	@echo "  make release-android - Download release zip, export and run on Android"
	@echo "  make release-ios     - Download release zip, export and open in Xcode"
	@echo "  make release-setup   - Download release zip and setup TestProject only"
	@echo ""
	@echo "Environment variables:"
	@echo "  GODOT_VERSION  - Godot version to use (default: $(GODOT_VERSION))"
	@echo "  GODOT          - Path to Godot executable (default: $(GODOT))"
	@echo "  RELEASE_TAG    - GitHub release tag to test (default: latest)"

# Download godot-lib.aar for Android builds
setup:
	@echo "$(GREEN)Setting up build environment...$(NC)"
	@mkdir -p $(ANDROID_DIR)/libs
	@mkdir -p $(BIN_DIR)/ios
	@mkdir -p $(BIN_DIR)/ios-simulator
	@mkdir -p $(BIN_DIR)/macos
	@mkdir -p $(ADDON_DIR)/android
	@if [ ! -f "$(ANDROID_DIR)/libs/godot-lib.aar" ]; then \
		echo "$(YELLOW)Downloading godot-lib.aar ($(GODOT_VERSION))...$(NC)"; \
		curl -L -o "$(ANDROID_DIR)/libs/godot-lib.aar" "$(GODOT_LIB_URL)" || \
		(echo "$(RED)Failed to download. Try manually from: $(GODOT_LIB_URL)$(NC)" && exit 1); \
		echo "$(GREEN)✓ godot-lib.aar downloaded$(NC)"; \
	else \
		echo "$(GREEN)✓ godot-lib.aar already exists$(NC)"; \
	fi
	@if [ ! -d "$(PROJECT_ROOT)/SwiftGodot" ]; then \
		echo "$(YELLOW)Cloning SwiftGodot ($(SWIFT_GODOT_VERSION))...$(NC)"; \
		git clone --depth 1 --branch $(SWIFT_GODOT_VERSION) https://github.com/migueldeicaza/SwiftGodot.git "$(PROJECT_ROOT)/SwiftGodot" || \
		(echo "$(RED)Failed to clone SwiftGodot$(NC)" && exit 1); \
		echo "$(GREEN)✓ SwiftGodot cloned$(NC)"; \
	else \
		echo "$(GREEN)✓ SwiftGodot already exists$(NC)"; \
	fi
	@echo "$(GREEN)Installing git hooks...$(NC)"
	@$(PROJECT_ROOT)/scripts/install-hooks.sh
	@echo "$(GREEN)Setup complete!$(NC)"

# Build iOS plugin (automated with xcodebuild)
ios: setup ios-build
	@echo "$(GREEN)✓ iOS plugin built$(NC)"

# Build iOS frameworks using xcodebuild
ios-build:
	@echo "$(GREEN)Building iOS frameworks...$(NC)"
	@cd $(IOS_GDEXT_DIR) && xcodebuild -scheme GodotIap -sdk iphoneos -destination 'generic/platform=iOS' -configuration Release -derivedDataPath .build-xcode build
	@echo "$(GREEN)Copying frameworks to addon...$(NC)"
	@rm -rf $(BIN_DIR)/ios/*.framework
	@cp -R $(IOS_GDEXT_DIR)/.build-xcode/Build/Products/Release-iphoneos/PackageFrameworks/GodotIap.framework $(BIN_DIR)/ios/
	@cp -R $(IOS_GDEXT_DIR)/.build-xcode/Build/Products/Release-iphoneos/PackageFrameworks/SwiftGodotRuntime.framework $(BIN_DIR)/ios/
	@echo "$(GREEN)✓ Frameworks copied$(NC)"

# Build macOS plugin (automated with xcodebuild)
macos: setup macos-build
	@echo "$(GREEN)✓ macOS plugin built$(NC)"

# Build macOS frameworks using xcodebuild (universal binary: arm64 + x86_64)
macos-build:
	@echo "$(GREEN)Building macOS frameworks (universal binary)...$(NC)"
	@cd $(IOS_GDEXT_DIR) && xcodebuild -scheme GodotIap -sdk macosx -destination 'platform=macOS' ARCHS="arm64 x86_64" PRODUCT_BUNDLE_IDENTIFIER="dev.hyo.godot-iap.GodotIap" -configuration Release -derivedDataPath .build-xcode-macos build
	@echo "$(GREEN)Copying frameworks to addon...$(NC)"
	@rm -rf $(BIN_DIR)/macos/*.framework
	@cp -R $(IOS_GDEXT_DIR)/.build-xcode-macos/Build/Products/Release/PackageFrameworks/GodotIap.framework $(BIN_DIR)/macos/
	@cp -R $(IOS_GDEXT_DIR)/.build-xcode-macos/Build/Products/Release/PackageFrameworks/SwiftGodotRuntime.framework $(BIN_DIR)/macos/
	@echo "$(GREEN)Fixing macOS framework rpaths...$(NC)"
	@install_name_tool -add_rpath @loader_path/../../../ $(BIN_DIR)/macos/GodotIap.framework/Versions/A/GodotIap
	@echo "$(GREEN)✓ macOS frameworks copied$(NC)"

# Build Android plugin
android: setup gradle-wrapper
	@echo "$(GREEN)Building Android plugin...$(NC)"
	@cd $(ANDROID_DIR) && ./gradlew copyReleaseAarToAddons
	@echo "$(GREEN)Generating GDAP file...$(NC)"
	@OPENIAP_VERSION=$$(python3 -c "import json; print(json.load(open('$(PROJECT_ROOT)/openiap-versions.json'))['google'])"); \
	printf '%s\n' \
		'[config]' \
		'name="GodotIap"' \
		'binary_type="local"' \
		'binary="GodotIap.release.aar"' \
		'' \
		'[dependencies]' \
		'local=[]' \
		"remote=[\"com.android.billingclient:billing:7.1.1\", \"io.github.hyochan.openiap:openiap-google:$$OPENIAP_VERSION\"]" \
	> $(ADDON_DIR)/android/GodotIap.gdap
	@echo "$(GREEN)✓ Android plugin built$(NC)"
	@echo "Output: $(ADDON_DIR)/android/"
	@ls -la $(ADDON_DIR)/android/*.aar 2>/dev/null || echo "  (AAR files will appear after successful build)"

# Ensure Gradle wrapper exists
gradle-wrapper:
	@if [ ! -f "$(ANDROID_DIR)/gradle/wrapper/gradle-wrapper.jar" ]; then \
		echo "$(YELLOW)Downloading Gradle wrapper...$(NC)"; \
		mkdir -p $(ANDROID_DIR)/gradle/wrapper; \
		curl -L -o $(ANDROID_DIR)/gradle/wrapper/gradle-wrapper.jar \
			"https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar"; \
		echo "$(GREEN)✓ Gradle wrapper downloaded$(NC)"; \
	fi

# Build everything
all: android ios macos
	@echo ""
	@echo "$(GREEN)All builds complete!$(NC)"

# Run GDScript unit tests (types only - no native plugin required)
test:
	@echo "$(GREEN)Running GDScript unit tests...$(NC)"
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --script tests/test_types_only.gd
	@echo "$(GREEN)✓ Tests complete$(NC)"

# Clean build artifacts
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf $(IOS_GDEXT_DIR)/.build
	@rm -rf $(IOS_GDEXT_DIR)/.swiftpm
	@rm -rf $(ANDROID_DIR)/build
	@rm -rf $(ANDROID_DIR)/.gradle
	@rm -f $(ADDON_DIR)/android/*.aar
	@echo "$(GREEN)✓ Clean complete$(NC)"

# Deep clean - also removes downloaded dependencies
clean-all: clean
	@echo "$(YELLOW)Removing downloaded dependencies...$(NC)"
	@rm -f $(ANDROID_DIR)/libs/godot-lib.aar
	@rm -rf $(IOS_GDEXT_DIR)/Package.resolved
	@echo "$(GREEN)✓ Deep clean complete$(NC)"

# Export Android APK
export-android: android
	@echo "$(GREEN)Exporting Android APK...$(NC)"
	@mkdir -p $(EXAMPLE_DIR)/android
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --export-debug "Android" android/Martie.apk
	@echo "$(GREEN)✓ APK exported to $(EXAMPLE_DIR)/android/Martie.apk$(NC)"

# Run Android - Build, export and install on device
run-android: export-android
	@echo "$(GREEN)Installing APK on device...$(NC)"
	@~/Library/Android/sdk/platform-tools/adb install -r $(EXAMPLE_DIR)/android/Martie.apk
	@echo "$(GREEN)✓ APK installed$(NC)"
	@echo "$(GREEN)Launching app...$(NC)"
	@~/Library/Android/sdk/platform-tools/adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1
	@echo "$(GREEN)✓ App launched$(NC)"

# Export iOS Xcode project
export-ios: ios
	@echo "$(GREEN)Exporting iOS Xcode project...$(NC)"
	@mkdir -p $(IOS_EXPORT_DIR)
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --export-debug "iOS" ios/Martie.xcodeproj
	@echo "$(GREEN)Fixing iOS frameworks...$(NC)"
	@cp $(BIN_DIR)/ios/GodotIap.framework/Info.plist $(IOS_EXPORT_DIR)/Martie/addons/godot-iap/bin/ios/GodotIap.framework/ 2>/dev/null || true
	@cp $(BIN_DIR)/ios/SwiftGodotRuntime.framework/Info.plist $(IOS_EXPORT_DIR)/Martie/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework/ 2>/dev/null || true
	@$(MAKE) patch-ios-project
	@echo "$(GREEN)✓ iOS project exported to $(IOS_EXPORT_DIR)$(NC)"

# Patch Xcode project to embed frameworks
patch-ios-project:
	@echo "$(GREEN)Patching Xcode project to embed frameworks...$(NC)"
	@$(PROJECT_ROOT)/scripts/fix_ios_embed.sh
	@echo "$(GREEN)✓ Xcode project patched$(NC)"

# Run iOS - Build, export and open in Xcode
run-ios: export-ios
	@echo "$(GREEN)Opening Xcode...$(NC)"
	@open $(IOS_EXPORT_DIR)/Martie.xcodeproj
	@echo ""
	@echo "$(YELLOW)In Xcode:$(NC)"
	@echo "  1. Select your connected iOS device"
	@echo "  2. Press Cmd+R to build and run"
	@echo "  3. Trust the developer certificate on your device if needed"

# ============================================
# TestProject - Release Testing
# ============================================

TEST_PROJECT_DIR := $(PROJECT_ROOT)/TestProject
TEST_ADDON_DIR := $(TEST_PROJECT_DIR)/addons/godot-iap
TEST_IOS_EXPORT_DIR := $(TEST_PROJECT_DIR)/ios

# Prepare TestProject addon directory with built binaries (mimics release zip structure)
# Uses existing iOS frameworks from Example (skip slow iOS build)
# Always resets TestProject from Example to ensure clean state
test-setup: android
	@echo "$(GREEN)Setting up TestProject with built binaries...$(NC)"
	@echo "$(YELLOW)Resetting TestProject from Example...$(NC)"
	@rm -rf $(TEST_PROJECT_DIR)
	@mkdir -p $(TEST_PROJECT_DIR)
	@mkdir -p $(TEST_ADDON_DIR)/android
	@mkdir -p $(TEST_ADDON_DIR)/bin/ios
	@echo "$(GREEN)Copying project files from Example...$(NC)"
	@cp $(EXAMPLE_DIR)/project.godot $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/main.gd $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/main.tscn $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/iap_manager.gd $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/*.svg $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/export_presets.cfg $(TEST_PROJECT_DIR)/
	@cp -R $(EXAMPLE_DIR)/player.tscn $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@cp -R $(EXAMPLE_DIR)/obstacle.tscn $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@cp -R $(EXAMPLE_DIR)/player.gd $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@cp -R $(EXAMPLE_DIR)/obstacle.gd $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@sed -i '' 's/config\/name=.*/config\/name="GodotIap TestProject"/' $(TEST_PROJECT_DIR)/project.godot
	@echo "$(GREEN)Copying Android build template...$(NC)"
	@mkdir -p $(TEST_PROJECT_DIR)/android
	@if [ -d "$(EXAMPLE_DIR)/android/build" ]; then \
		cp -R $(EXAMPLE_DIR)/android/build $(TEST_PROJECT_DIR)/android/; \
		cp $(EXAMPLE_DIR)/android/.build_version $(TEST_PROJECT_DIR)/android/ 2>/dev/null || true; \
	fi
	@echo "$(GREEN)Copying GDScript files...$(NC)"
	@cp $(ADDON_DIR)/*.gd $(TEST_ADDON_DIR)/
	@cp $(ADDON_DIR)/plugin.cfg $(TEST_ADDON_DIR)/
	@echo "$(GREEN)Copying Android AARs...$(NC)"
	@cp $(ANDROID_DIR)/build/outputs/aar/godot-iap-release.aar $(TEST_ADDON_DIR)/android/GodotIap.release.aar
	@cp $(ANDROID_DIR)/build/outputs/aar/godot-iap-debug.aar $(TEST_ADDON_DIR)/android/GodotIap.debug.aar 2>/dev/null || \
		(cd $(ANDROID_DIR) && ./gradlew assembleDebug && cp build/outputs/aar/godot-iap-debug.aar $(TEST_ADDON_DIR)/android/GodotIap.debug.aar)
	@echo "$(GREEN)Creating GDAP file...$(NC)"
	@OPENIAP_VERSION=$$(cat $(PROJECT_ROOT)/openiap-versions.json | grep '"google"' | cut -d'"' -f4); \
	echo "[config]" > $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo 'name="GodotIap"' >> $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo 'binary_type="local"' >> $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo 'binary="GodotIap.release.aar"' >> $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo "" >> $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo "[dependencies]" >> $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo "local=[]" >> $(TEST_ADDON_DIR)/android/GodotIap.gdap; \
	echo "remote=[\"com.android.billingclient:billing:7.1.1\", \"io.github.hyochan.openiap:openiap-google:$$OPENIAP_VERSION\"]" >> $(TEST_ADDON_DIR)/android/GodotIap.gdap
	@echo "$(GREEN)Copying iOS frameworks from Example...$(NC)"
	@if [ -d "$(BIN_DIR)/ios/GodotIap.framework" ]; then \
		cp -R $(BIN_DIR)/ios/GodotIap.framework $(TEST_ADDON_DIR)/bin/ios/; \
		cp -R $(BIN_DIR)/ios/SwiftGodotRuntime.framework $(TEST_ADDON_DIR)/bin/ios/; \
	else \
		echo "$(RED)iOS frameworks not found. Run 'make ios' first.$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)Copying macOS frameworks from Example...$(NC)"
	@mkdir -p $(TEST_ADDON_DIR)/bin/macos
	@if [ -d "$(BIN_DIR)/macos/GodotIap.framework" ]; then \
		cp -R $(BIN_DIR)/macos/GodotIap.framework $(TEST_ADDON_DIR)/bin/macos/; \
		cp -R $(BIN_DIR)/macos/SwiftGodotRuntime.framework $(TEST_ADDON_DIR)/bin/macos/; \
	else \
		echo "$(YELLOW)macOS frameworks not found. Run 'make macos' to build them.$(NC)"; \
	fi
	@echo "$(GREEN)Creating GDExtension config...$(NC)"
	@echo '[configuration]' > $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'entry_symbol = "godot_iap_entry_point"' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'compatibility_minimum = "4.3"' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'supported_platforms = ["ios", "macos"]' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo '' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo '[libraries]' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'ios.arm64 = "ios/GodotIap.framework/GodotIap"' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'macos.arm64 = "macos/GodotIap.framework/GodotIap"' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'macos.x86_64 = "macos/GodotIap.framework/GodotIap"' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo '' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo '[dependencies]' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'ios.arm64 = {"ios/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'macos.arm64 = {"macos/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo 'macos.x86_64 = {"macos/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}' >> $(TEST_ADDON_DIR)/bin/godot_iap.gdextension
	@echo "$(GREEN)✓ TestProject ready$(NC)"

# Export TestProject Android APK
export-test-android: test-setup
	@echo "$(GREEN)Exporting TestProject Android APK...$(NC)"
	@mkdir -p $(TEST_PROJECT_DIR)/android
	@cd $(TEST_PROJECT_DIR) && $(GODOT) --headless --export-debug "Android" android/Martie.apk
	@echo "$(GREEN)✓ APK exported to $(TEST_PROJECT_DIR)/android/Martie.apk$(NC)"

# Test Android - Build, copy to TestProject, export and run
test-android: export-test-android
	@echo "$(GREEN)Installing APK on device...$(NC)"
	@~/Library/Android/sdk/platform-tools/adb install -r $(TEST_PROJECT_DIR)/android/Martie.apk
	@echo "$(GREEN)✓ APK installed$(NC)"
	@echo "$(GREEN)Launching app...$(NC)"
	@~/Library/Android/sdk/platform-tools/adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1
	@echo "$(GREEN)✓ App launched$(NC)"

# Export TestProject iOS Xcode project
export-test-ios: test-setup
	@echo "$(GREEN)Exporting TestProject iOS Xcode project...$(NC)"
	@mkdir -p $(TEST_IOS_EXPORT_DIR)
	@cd $(TEST_PROJECT_DIR) && $(GODOT) --headless --export-debug "iOS" ios/Martie.xcodeproj
	@echo "$(GREEN)Fixing iOS frameworks...$(NC)"
	@cp $(TEST_ADDON_DIR)/bin/ios/GodotIap.framework/Info.plist $(TEST_IOS_EXPORT_DIR)/Martie/addons/godot-iap/bin/ios/GodotIap.framework/ 2>/dev/null || true
	@cp $(TEST_ADDON_DIR)/bin/ios/SwiftGodotRuntime.framework/Info.plist $(TEST_IOS_EXPORT_DIR)/Martie/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework/ 2>/dev/null || true
	@IOS_EXPORT_DIR=$(TEST_IOS_EXPORT_DIR) $(PROJECT_ROOT)/scripts/fix_ios_embed.sh
	@echo "$(GREEN)✓ iOS project exported to $(TEST_IOS_EXPORT_DIR)$(NC)"

# Test iOS - Build, copy to TestProject, export and open in Xcode
test-ios: export-test-ios
	@echo "$(GREEN)Opening Xcode...$(NC)"
	@open $(TEST_IOS_EXPORT_DIR)/Martie.xcodeproj
	@echo ""
	@echo "$(YELLOW)In Xcode:$(NC)"
	@echo "  1. Select your connected iOS device"
	@echo "  2. Press Cmd+R to build and run"
	@echo "  3. Trust the developer certificate on your device if needed"

# ============================================
# Release Testing (from GitHub Release zip)
# ============================================

RELEASE_TAG ?= $(shell gh release view --repo hyochan/godot-iap --json tagName -q '.tagName' 2>/dev/null || echo "1.0.0-beta.1")
RELEASE_ZIP_NAME = godot-iap-$(RELEASE_TAG).zip
RELEASE_ZIP_URL = https://github.com/hyochan/godot-iap/releases/download/$(RELEASE_TAG)/$(RELEASE_ZIP_NAME)

# Download and extract release zip to TestProject (simulates Asset Library install)
release-setup:
	@echo "$(GREEN)Setting up TestProject from GitHub Release...$(NC)"
	@echo "$(YELLOW)Release: $(RELEASE_TAG)$(NC)"
	@rm -rf $(TEST_PROJECT_DIR)
	@mkdir -p $(TEST_PROJECT_DIR)
	@echo "$(GREEN)Downloading release zip...$(NC)"
	@curl -L -o /tmp/$(RELEASE_ZIP_NAME) "$(RELEASE_ZIP_URL)" || \
		(echo "$(RED)Failed to download release. Check if $(RELEASE_TAG) exists.$(NC)" && exit 1)
	@echo "$(GREEN)Extracting addons...$(NC)"
	@unzip -q /tmp/$(RELEASE_ZIP_NAME) -d $(TEST_PROJECT_DIR)/
	@rm /tmp/$(RELEASE_ZIP_NAME)
	@echo "$(GREEN)Copying project files from Example...$(NC)"
	@cp $(EXAMPLE_DIR)/project.godot $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/main.gd $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/main.tscn $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/iap_manager.gd $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/*.svg $(TEST_PROJECT_DIR)/
	@cp $(EXAMPLE_DIR)/export_presets.cfg $(TEST_PROJECT_DIR)/
	@cp -R $(EXAMPLE_DIR)/player.tscn $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@cp -R $(EXAMPLE_DIR)/obstacle.tscn $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@cp -R $(EXAMPLE_DIR)/player.gd $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@cp -R $(EXAMPLE_DIR)/obstacle.gd $(TEST_PROJECT_DIR)/ 2>/dev/null || true
	@sed -i '' 's/config\/name=.*/config\/name="GodotIap Release Test"/' $(TEST_PROJECT_DIR)/project.godot
	@echo "$(GREEN)Copying Android build template...$(NC)"
	@mkdir -p $(TEST_PROJECT_DIR)/android
	@if [ -d "$(EXAMPLE_DIR)/android/build" ]; then \
		cp -R $(EXAMPLE_DIR)/android/build $(TEST_PROJECT_DIR)/android/; \
		cp $(EXAMPLE_DIR)/android/.build_version $(TEST_PROJECT_DIR)/android/ 2>/dev/null || true; \
	fi
	@echo "$(GREEN)✓ TestProject ready with release $(RELEASE_TAG)$(NC)"
	@echo ""
	@echo "$(YELLOW)Addon contents:$(NC)"
	@ls -la $(TEST_ADDON_DIR)/ 2>/dev/null || true

# Export release TestProject Android APK
export-release-android: release-setup
	@echo "$(GREEN)Exporting Release TestProject Android APK...$(NC)"
	@mkdir -p $(TEST_PROJECT_DIR)/android
	@cd $(TEST_PROJECT_DIR) && $(GODOT) --headless --export-debug "Android" android/Martie.apk
	@echo "$(GREEN)✓ APK exported to $(TEST_PROJECT_DIR)/android/Martie.apk$(NC)"

# Test release Android - Download release, export and run
release-android: export-release-android
	@echo "$(GREEN)Installing APK on device...$(NC)"
	@~/Library/Android/sdk/platform-tools/adb install -r $(TEST_PROJECT_DIR)/android/Martie.apk
	@echo "$(GREEN)✓ APK installed$(NC)"
	@echo "$(GREEN)Launching app...$(NC)"
	@~/Library/Android/sdk/platform-tools/adb shell monkey -p dev.hyo.martie -c android.intent.category.LAUNCHER 1
	@echo "$(GREEN)✓ App launched$(NC)"

# Export release TestProject iOS Xcode project
export-release-ios: release-setup
	@echo "$(GREEN)Exporting Release TestProject iOS Xcode project...$(NC)"
	@mkdir -p $(TEST_IOS_EXPORT_DIR)
	@cd $(TEST_PROJECT_DIR) && $(GODOT) --headless --export-debug "iOS" ios/Martie.xcodeproj
	@echo "$(GREEN)Fixing iOS frameworks...$(NC)"
	@cp $(TEST_ADDON_DIR)/bin/ios/GodotIap.framework/Info.plist $(TEST_IOS_EXPORT_DIR)/Martie/addons/godot-iap/bin/ios/GodotIap.framework/ 2>/dev/null || true
	@cp $(TEST_ADDON_DIR)/bin/ios/SwiftGodotRuntime.framework/Info.plist $(TEST_IOS_EXPORT_DIR)/Martie/addons/godot-iap/bin/ios/SwiftGodotRuntime.framework/ 2>/dev/null || true
	@IOS_EXPORT_DIR=$(TEST_IOS_EXPORT_DIR) $(PROJECT_ROOT)/scripts/fix_ios_embed.sh
	@echo "$(GREEN)✓ iOS project exported to $(TEST_IOS_EXPORT_DIR)$(NC)"

# Test release iOS - Download release, export and open in Xcode
release-ios: export-release-ios
	@echo "$(GREEN)Opening Xcode...$(NC)"
	@open $(TEST_IOS_EXPORT_DIR)/Martie.xcodeproj
	@echo ""
	@echo "$(YELLOW)In Xcode:$(NC)"
	@echo "  1. Select your connected iOS device"
	@echo "  2. Press Cmd+R to build and run"
	@echo "  3. Trust the developer certificate on your device if needed"
