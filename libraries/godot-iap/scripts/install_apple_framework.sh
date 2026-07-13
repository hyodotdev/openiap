#!/bin/sh

set -eu

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <source.framework> <destination.framework> <ios|macos>" >&2
    exit 2
fi

SOURCE_FRAMEWORK=$1
DESTINATION_FRAMEWORK=$2
PLATFORM=$3

case "$PLATFORM" in
    ios|macos) ;;
    *)
        echo "Unsupported Apple platform: $PLATFORM" >&2
        exit 2
        ;;
esac

case "$SOURCE_FRAMEWORK:$DESTINATION_FRAMEWORK" in
    *.framework:*.framework) ;;
    *)
        echo "Source and destination must both be .framework paths" >&2
        exit 2
        ;;
esac

FRAMEWORK_NAME=$(basename "$SOURCE_FRAMEWORK" .framework)
DESTINATION_NAME=$(basename "$DESTINATION_FRAMEWORK" .framework)

if [ "$FRAMEWORK_NAME" != "$DESTINATION_NAME" ]; then
    echo "Source and destination framework names must match: $FRAMEWORK_NAME != $DESTINATION_NAME" >&2
    exit 2
fi

if [ -f "$SOURCE_FRAMEWORK/$FRAMEWORK_NAME" ]; then
    SOURCE_BINARY="$SOURCE_FRAMEWORK/$FRAMEWORK_NAME"
elif [ -f "$SOURCE_FRAMEWORK/Versions/A/$FRAMEWORK_NAME" ]; then
    SOURCE_BINARY="$SOURCE_FRAMEWORK/Versions/A/$FRAMEWORK_NAME"
else
    echo "Framework binary not found: $SOURCE_FRAMEWORK" >&2
    exit 1
fi

if [ -f "$SOURCE_FRAMEWORK/Info.plist" ]; then
    SOURCE_INFO_PLIST="$SOURCE_FRAMEWORK/Info.plist"
elif [ -f "$SOURCE_FRAMEWORK/Versions/A/Resources/Info.plist" ]; then
    SOURCE_INFO_PLIST="$SOURCE_FRAMEWORK/Versions/A/Resources/Info.plist"
else
    echo "Framework Info.plist not found: $SOURCE_FRAMEWORK" >&2
    exit 1
fi

# Keep the checked-in plist when rebuilding an existing framework. Xcode writes
# machine- and SDK-specific metadata into generated plists even when the bundle
# contract is unchanged, which otherwise creates unrelated binary churn.
PRESERVED_INFO_PLIST=""
cleanup() {
    if [ -n "$PRESERVED_INFO_PLIST" ]; then
        rm -f "$PRESERVED_INFO_PLIST"
    fi
}
trap cleanup EXIT HUP INT TERM

if [ -f "$DESTINATION_FRAMEWORK/Info.plist" ]; then
    PRESERVED_INFO_PLIST=$(mktemp "${TMPDIR:-/tmp}/godot-iap-info.XXXXXX")
    cp "$DESTINATION_FRAMEWORK/Info.plist" "$PRESERVED_INFO_PLIST"
fi

# Normalize both unversioned iOS frameworks and Xcode's versioned macOS
# frameworks to the flat layout referenced by godot_iap.gdextension.
rm -rf "$DESTINATION_FRAMEWORK"
mkdir -p "$DESTINATION_FRAMEWORK"
cp "$SOURCE_BINARY" "$DESTINATION_FRAMEWORK/$FRAMEWORK_NAME"
chmod 755 "$DESTINATION_FRAMEWORK/$FRAMEWORK_NAME"

if [ -n "$PRESERVED_INFO_PLIST" ]; then
    cp "$PRESERVED_INFO_PLIST" "$DESTINATION_FRAMEWORK/Info.plist"
else
    cp "$SOURCE_INFO_PLIST" "$DESTINATION_FRAMEWORK/Info.plist"
    plutil -convert xml1 "$DESTINATION_FRAMEWORK/Info.plist"
fi

if [ "$PLATFORM" = "macos" ]; then
    DESTINATION_BINARY="$DESTINATION_FRAMEWORK/$FRAMEWORK_NAME"
    install_name_tool -id "@rpath/$FRAMEWORK_NAME.framework/$FRAMEWORK_NAME" "$DESTINATION_BINARY"

    VERSIONED_RUNTIME="@rpath/SwiftGodotRuntime.framework/Versions/A/SwiftGodotRuntime"
    FLAT_RUNTIME="@rpath/SwiftGodotRuntime.framework/SwiftGodotRuntime"
    if otool -L "$DESTINATION_BINARY" | grep -Fq "$VERSIONED_RUNTIME"; then
        install_name_tool -change "$VERSIONED_RUNTIME" "$FLAT_RUNTIME" "$DESTINATION_BINARY"
    fi

    if [ "$FRAMEWORK_NAME" = "GodotIap" ]; then
        install_name_tool -delete_rpath "@loader_path/../../../" "$DESTINATION_BINARY" 2>/dev/null || true
        install_name_tool -delete_rpath "@loader_path/../" "$DESTINATION_BINARY" 2>/dev/null || true
        install_name_tool -add_rpath "@loader_path/../" "$DESTINATION_BINARY"
    fi

    codesign --force --deep --sign - --timestamp=none "$DESTINATION_FRAMEWORK"
    codesign --verify --deep --strict --verbose=2 "$DESTINATION_FRAMEWORK"
fi
