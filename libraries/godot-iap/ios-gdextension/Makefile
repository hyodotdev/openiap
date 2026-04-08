.PHONY: build clean ios macos dist

CONFIG ?= Release
DERIVED_DATA ?= $(CURDIR)/.build-xcode
SCHEME ?= GodotIap
PROJECT_ROOT ?= $(CURDIR)/..
ADDON_DIR ?= $(PROJECT_ROOT)/Example/addons/godot_iap/bin

# Build for iOS
ios:
	@echo "=== Building GodotIap for iOS ==="
	xcodebuild \
		-scheme $(SCHEME) \
		-configuration $(CONFIG) \
		-destination "generic/platform=iOS" \
		-derivedDataPath "$(DERIVED_DATA)" \
		build
	@echo "=== iOS Build Complete ==="

# Build for macOS (arm64)
macos:
	@echo "=== Building GodotIap for macOS ==="
	xcodebuild \
		-scheme $(SCHEME) \
		-configuration $(CONFIG) \
		-destination "platform=macOS,arch=arm64" \
		-derivedDataPath "$(DERIVED_DATA)" \
		build
	@echo "=== macOS Build Complete ==="

# Build all platforms
build: ios macos

# Copy frameworks to addon directory
dist: build
	@echo "=== Creating distribution ==="
	mkdir -p "$(ADDON_DIR)/ios"
	mkdir -p "$(ADDON_DIR)/macos"

	# Copy iOS frameworks
	@if [ -d "$(DERIVED_DATA)/Build/Products/$(CONFIG)-iphoneos/PackageFrameworks/$(SCHEME).framework" ]; then \
		cp -r "$(DERIVED_DATA)/Build/Products/$(CONFIG)-iphoneos/PackageFrameworks/$(SCHEME).framework" "$(ADDON_DIR)/ios/"; \
		cp -r "$(DERIVED_DATA)/Build/Products/$(CONFIG)-iphoneos/PackageFrameworks/SwiftGodotRuntime.framework" "$(ADDON_DIR)/ios/"; \
		echo "Copied iOS frameworks"; \
	else \
		echo "iOS framework not found at expected path"; \
	fi

	# Copy macOS frameworks
	@if [ -d "$(DERIVED_DATA)/Build/Products/$(CONFIG)/PackageFrameworks/$(SCHEME).framework" ]; then \
		cp -r "$(DERIVED_DATA)/Build/Products/$(CONFIG)/PackageFrameworks/$(SCHEME).framework" "$(ADDON_DIR)/macos/"; \
		cp -r "$(DERIVED_DATA)/Build/Products/$(CONFIG)/PackageFrameworks/SwiftGodotRuntime.framework" "$(ADDON_DIR)/macos/"; \
		echo "Copied macOS frameworks"; \
	else \
		echo "macOS framework not found at expected path"; \
	fi

	@echo "=== Distribution Complete ==="
	@echo "Frameworks copied to: $(ADDON_DIR)"

# Clean build artifacts
clean:
	rm -rf "$(DERIVED_DATA)"
	rm -rf .build
	rm -rf "$(ADDON_DIR)/ios"
	rm -rf "$(ADDON_DIR)/macos"

# Quick build using swift build (for development)
swift-build:
	swift build -c release

# Show help
help:
	@echo "GodotIap Build Commands:"
	@echo "  make ios     - Build for iOS"
	@echo "  make macos   - Build for macOS"
	@echo "  make build   - Build for all platforms"
	@echo "  make dist    - Build and copy to addon directory"
	@echo "  make clean   - Clean build artifacts"
