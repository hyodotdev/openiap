# GodotIap Build System
# Usage:
#   make setup        - Download dependencies (godot-lib.aar)
#   make ios          - Build iOS plugin
#   make android      - Build Android plugin
#   make all          - Build everything
#   make clean        - Clean build artifacts
#   make run-android  - Export and run Android APK on device
#   make run-ios      - Export iOS project and open in Xcode

GODOT_VERSION ?= 4.7.1
SWIFT_GODOT_VERSION ?= v0.79.0
SWIFT_GODOT_COMMIT ?= 2b0e39dc1c23454408f83c0a83ddf9c2516624c0
# AndroidX Core 1.18.0 declares AGP 8.9.1 as its minimum consumer version.
ANDROID_EXPORT_AGP_VERSION ?= 8.9.1

# Directories
PROJECT_ROOT := $(shell pwd)
IOS_DIR := $(PROJECT_ROOT)/ios
IOS_GDEXT_DIR := $(PROJECT_ROOT)/ios-gdextension
ANDROID_DIR := $(PROJECT_ROOT)/android
EXAMPLE_DIR := $(PROJECT_ROOT)/Example
ADDON_DIR := $(PROJECT_ROOT)/addons/godot-iap
BIN_DIR := $(ADDON_DIR)/bin
IOS_EXPORT_DIR := $(EXAMPLE_DIR)/ios
APPLE_FRAMEWORK_INSTALLER := $(PROJECT_ROOT)/scripts/install_apple_framework.sh
GODOT_LIB_FETCHER := $(abspath $(PROJECT_ROOT)/../../scripts/fetch-godot-lib.sh)
GRADLE_WRAPPER_SHA256 := d3b261c2820e9e3d8d639ed084900f11f4a86050a8f83342ade7b6bc9b0d2bdd

# Godot executable
GODOT ?= /Applications/Godot.app/Contents/MacOS/Godot
MACOS_ARCHS ?= arm64 x86_64

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: all setup setup-swiftgodot ios ios-build macos macos-build android clean help run-android run-ios prepare-android-export-template export-ios export-android test-setup test-android test-ios export-test-android export-test-ios test

help:
	@echo "GodotIap Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make setup         - Download godot-lib.aar for Android development"
	@echo "  make setup-swiftgodot - Download the pinned SwiftGodot source only"
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
	@echo "  ANDROID_EXPORT_AGP_VERSION - Android export AGP floor (default: $(ANDROID_EXPORT_AGP_VERSION))"
	@echo "  MACOS_ARCHS    - macOS architectures for source builds (default: $(MACOS_ARCHS))"
	@echo "  RELEASE_TAG    - GitHub release tag to test (default: latest)"

# Download godot-lib.aar for Android builds
setup: setup-swiftgodot
	@echo "$(GREEN)Setting up build environment...$(NC)"
	@mkdir -p $(ANDROID_DIR)/libs
	@mkdir -p $(BIN_DIR)/ios
	@mkdir -p $(BIN_DIR)/ios-simulator
	@mkdir -p $(BIN_DIR)/macos
	@mkdir -p $(ADDON_DIR)/android
	@bash "$(GODOT_LIB_FETCHER)" "$(GODOT_VERSION)-stable" \
		"$(ANDROID_DIR)/libs/godot-lib.aar"
	@echo "$(GREEN)Installing git hooks...$(NC)"
	@$(PROJECT_ROOT)/scripts/install-hooks.sh
	@echo "$(GREEN)Setup complete!$(NC)"

setup-swiftgodot:
	@if [ ! -d "$(PROJECT_ROOT)/SwiftGodot" ]; then \
		echo "$(YELLOW)Cloning SwiftGodot ($(SWIFT_GODOT_VERSION))...$(NC)"; \
		git clone --depth 1 --branch $(SWIFT_GODOT_VERSION) https://github.com/migueldeicaza/SwiftGodot.git "$(PROJECT_ROOT)/SwiftGodot" || \
		(echo "$(RED)Failed to clone SwiftGodot$(NC)" && exit 1); \
		actual_commit="$$(git -C "$(PROJECT_ROOT)/SwiftGodot" rev-parse HEAD)"; \
		if [ "$$actual_commit" != "$(SWIFT_GODOT_COMMIT)" ]; then \
			echo "$(RED)SwiftGodot $(SWIFT_GODOT_VERSION) resolved to $$actual_commit; expected $(SWIFT_GODOT_COMMIT).$(NC)"; \
			exit 1; \
		fi; \
		echo "$(GREEN)✓ SwiftGodot $(SWIFT_GODOT_COMMIT) cloned$(NC)"; \
	else \
		actual_tag="$$(git -C "$(PROJECT_ROOT)/SwiftGodot" describe --tags --exact-match 2>/dev/null || true)"; \
		actual_commit="$$(git -C "$(PROJECT_ROOT)/SwiftGodot" rev-parse HEAD 2>/dev/null || true)"; \
		if [ "$$actual_tag" != "$(SWIFT_GODOT_VERSION)" ] || [ "$$actual_commit" != "$(SWIFT_GODOT_COMMIT)" ]; then \
			echo "$(RED)SwiftGodot checkout is $$actual_tag at $$actual_commit; expected $(SWIFT_GODOT_VERSION) at $(SWIFT_GODOT_COMMIT). Move it aside and rerun setup.$(NC)"; \
			exit 1; \
		fi; \
		echo "$(GREEN)✓ SwiftGodot $(SWIFT_GODOT_VERSION) at $(SWIFT_GODOT_COMMIT) already exists$(NC)"; \
	fi

# Build iOS plugin (automated with xcodebuild)
ios: setup ios-build
	@echo "$(GREEN)✓ iOS plugin built$(NC)"

# Build iOS frameworks using xcodebuild
ios-build:
	@echo "$(GREEN)Building iOS frameworks...$(NC)"
	@cd $(IOS_GDEXT_DIR) && xcodebuild \
		-scheme GodotIap \
		-sdk iphoneos \
		-destination 'generic/platform=iOS' \
		-configuration Release \
		CLANG_ENABLE_CODE_COVERAGE=NO \
		ENABLE_CODE_COVERAGE=NO \
		SWIFT_ENABLE_CODE_COVERAGE=NO \
		-derivedDataPath .build-xcode \
		clean build
	@echo "$(GREEN)Copying frameworks to addon...$(NC)"
	@$(APPLE_FRAMEWORK_INSTALLER) \
		$(IOS_GDEXT_DIR)/.build-xcode/Build/Products/Release-iphoneos/PackageFrameworks/SwiftGodotRuntime.framework \
		$(BIN_DIR)/ios/SwiftGodotRuntime.framework ios
	@$(APPLE_FRAMEWORK_INSTALLER) \
		$(IOS_GDEXT_DIR)/.build-xcode/Build/Products/Release-iphoneos/PackageFrameworks/GodotIap.framework \
		$(BIN_DIR)/ios/GodotIap.framework ios
	@echo "$(GREEN)✓ Frameworks copied$(NC)"

# Build macOS plugin (automated with xcodebuild)
macos: setup macos-build
	@echo "$(GREEN)✓ macOS plugin built$(NC)"

# Build macOS frameworks using xcodebuild
macos-build:
	@echo "$(GREEN)Building macOS frameworks...$(NC)"
	@cd "$(IOS_GDEXT_DIR)" && xcodebuild \
		-scheme GodotIap \
		-sdk macosx \
		-destination 'platform=macOS' \
		ARCHS="$(MACOS_ARCHS)" \
		PRODUCT_BUNDLE_IDENTIFIER="dev.hyo.godot-iap.GodotIap" \
		-configuration Release \
		CLANG_ENABLE_CODE_COVERAGE=NO \
		ENABLE_CODE_COVERAGE=NO \
		SWIFT_ENABLE_CODE_COVERAGE=NO \
		-derivedDataPath .build-xcode-macos \
		build
	@echo "$(GREEN)Copying frameworks to addon...$(NC)"
	@$(APPLE_FRAMEWORK_INSTALLER) \
		$(IOS_GDEXT_DIR)/.build-xcode-macos/Build/Products/Release/PackageFrameworks/SwiftGodotRuntime.framework \
		$(BIN_DIR)/macos/SwiftGodotRuntime.framework macos
	@$(APPLE_FRAMEWORK_INSTALLER) \
		$(IOS_GDEXT_DIR)/.build-xcode-macos/Build/Products/Release/PackageFrameworks/GodotIap.framework \
		$(BIN_DIR)/macos/GodotIap.framework macos
	@echo "$(GREEN)Updating macOS GDExtension metadata...$(NC)"
	@MACOS_X86_LIBRARY=""; \
	MACOS_X86_DEPENDENCY=""; \
	if lipo "$(BIN_DIR)/macos/GodotIap.framework/GodotIap" -verify_arch x86_64 >/dev/null 2>&1 && \
		lipo "$(BIN_DIR)/macos/SwiftGodotRuntime.framework/SwiftGodotRuntime" -verify_arch x86_64 >/dev/null 2>&1; then \
		MACOS_X86_LIBRARY='macos.x86_64 = "macos/GodotIap.framework/GodotIap"'; \
		MACOS_X86_DEPENDENCY='macos.x86_64 = {"macos/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}'; \
	fi; \
	{ \
		printf '%s\n' '[configuration]'; \
		printf '%s\n' 'entry_symbol = "godot_iap_entry_point"'; \
		printf '%s\n' 'compatibility_minimum = "4.3"'; \
		printf '%s\n' 'supported_platforms = ["ios", "macos"]'; \
		printf '\n%s\n' '[libraries]'; \
		printf '%s\n' 'ios.arm64 = "ios/GodotIap.framework/GodotIap"'; \
		printf '%s\n' 'macos.arm64 = "macos/GodotIap.framework/GodotIap"'; \
		if [ -n "$$MACOS_X86_LIBRARY" ]; then printf '%s\n' "$$MACOS_X86_LIBRARY"; fi; \
		printf '\n%s\n' '[dependencies]'; \
		printf '%s\n' 'ios.arm64 = {"ios/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}'; \
		printf '%s\n' 'macos.arm64 = {"macos/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}'; \
		if [ -n "$$MACOS_X86_DEPENDENCY" ]; then printf '%s\n' "$$MACOS_X86_DEPENDENCY"; fi; \
	} > "$(BIN_DIR)/godot_iap.gdextension"
	@echo "$(GREEN)✓ macOS frameworks copied$(NC)"

# Build Android plugin
android: setup gradle-wrapper
	@echo "$(GREEN)Building Android plugin...$(NC)"
	@# export-android runs --export-debug, and the export plugin embeds the
	@# debug AAR for debug exports. Refresh BOTH variants so a debug export can
	@# never ship a stale plugin while only the release AAR gets rebuilt.
	@cd $(ANDROID_DIR) && ./gradlew copyDebugAarToAddons copyReleaseAarToAddons
	@echo "$(GREEN)Generating GDAP file...$(NC)"
	@$(PROJECT_ROOT)/scripts/write-gdap.sh "$(ADDON_DIR)/android/GodotIap.gdap"
	@echo "$(GREEN)✓ Android plugin built$(NC)"
	@echo "Output: $(ADDON_DIR)/android/"
	@ls -la $(ADDON_DIR)/android/*.aar 2>/dev/null || echo "  (AAR files will appear after successful build)"

# Verify the tracked Gradle wrapper
gradle-wrapper:
	@echo "$(GRADLE_WRAPPER_SHA256)  $(ANDROID_DIR)/gradle/wrapper/gradle-wrapper.jar" | shasum -a 256 -c -

# Build everything
all: android ios macos
	@echo ""
	@echo "$(GREEN)All builds complete!$(NC)"

# Run GDScript unit tests and verify the tracked macOS native framework pair
test:
	@echo "$(GREEN)Running GDScript unit tests...$(NC)"
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --script tests/test_native_extension.gd
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --script tests/test_types_only.gd
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --script tests/test_api_surface.gd
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --script tests/test_envelope_parsing.gd
	@cd $(EXAMPLE_DIR) && $(GODOT) --headless --script tests/test_godot_iap.gd
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

# Install a clean source template before every export. This avoids stale
# resources when the local Godot version changes and applies the minimum AGP
# required by the AndroidX dependencies shipped through openiap-google.
prepare-android-export-template:
	@set -e; \
	version_output="$$($(GODOT) --version)" || { \
		echo "$(RED)Unable to run Godot to read its version.$(NC)"; \
		exit 1; \
	}; \
	actual_version="$$(printf '%s\n' "$$version_output" | cut -d. -f1-3)"; \
	if [ "$$actual_version" != "$(GODOT_VERSION)" ]; then \
		echo "$(RED)Godot $$actual_version found; $(GODOT_VERSION) is required for source exports.$(NC)"; \
		exit 1; \
	fi; \
	case "$$(uname -s)" in \
		Darwin) template_root="$$HOME/Library/Application Support/Godot" ;; \
		Linux) template_root="$${XDG_DATA_HOME:-$$HOME/.local/share}/godot" ;; \
		*) echo "$(RED)Unsupported host for Android export templates: $$(uname -s)$(NC)"; exit 1 ;; \
	esac; \
	template_zip="$$template_root/export_templates/$(GODOT_VERSION).stable/android_source.zip"; \
	if [ ! -f "$$template_zip" ]; then \
		echo "$(RED)Missing Godot $(GODOT_VERSION) Android source template: $$template_zip$(NC)"; \
		exit 1; \
	fi; \
	rm -rf "$(EXAMPLE_DIR)/android/build"; \
	mkdir -p "$(EXAMPLE_DIR)/android/build"; \
	unzip -q "$$template_zip" -d "$(EXAMPLE_DIR)/android/build"; \
	printf '%s\n' "$(GODOT_VERSION).stable" > "$(EXAMPLE_DIR)/android/.build_version"; \
	config="$(EXAMPLE_DIR)/android/build/config.gradle"; \
	perl -0pi -e "s/androidGradlePlugin:\\s*'[^']+'/androidGradlePlugin: '$(ANDROID_EXPORT_AGP_VERSION)'/" "$$config"; \
	grep -q "androidGradlePlugin: '$(ANDROID_EXPORT_AGP_VERSION)'" "$$config" || \
		(echo "$(RED)Failed to set Android export AGP $(ANDROID_EXPORT_AGP_VERSION).$(NC)" && exit 1)

# Export Android APK
export-android: android prepare-android-export-template
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
	@rm -rf $(IOS_EXPORT_DIR)
	@mkdir -p $(IOS_EXPORT_DIR)
	@touch $(IOS_EXPORT_DIR)/.gdignore
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
	@$(PROJECT_ROOT)/scripts/write-gdap.sh "$(TEST_ADDON_DIR)/android/GodotIap.gdap"
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
	@echo "$(GREEN)Copying GDExtension config...$(NC)"
	@cp "$(BIN_DIR)/godot_iap.gdextension" "$(TEST_ADDON_DIR)/bin/godot_iap.gdextension"
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

GODOT_IAP_VERSION ?= $(shell sed -n 's/^version="\([^"]*\)"/\1/p' $(ADDON_DIR)/plugin.cfg)
LATEST_GODOT_RELEASE_TAG := $(shell gh release list --repo hyodotdev/openiap --limit 50 --json tagName -q '.[] | select(.tagName | startswith("godot-iap-")) | .tagName' 2>/dev/null | head -n 1)
RELEASE_TAG ?= $(if $(LATEST_GODOT_RELEASE_TAG),$(LATEST_GODOT_RELEASE_TAG),godot-iap-$(GODOT_IAP_VERSION))
RELEASE_VERSION = $(patsubst godot-iap-%,%,$(RELEASE_TAG))
RELEASE_ZIP_NAME = godot-iap-$(RELEASE_VERSION).zip
RELEASE_ZIP_URL = https://github.com/hyodotdev/openiap/releases/download/$(RELEASE_TAG)/$(RELEASE_ZIP_NAME)

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
