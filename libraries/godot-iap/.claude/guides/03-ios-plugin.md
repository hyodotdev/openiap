# iOS Plugin

## Build & Run

```bash
make run-ios
```

This will:
1. Build iOS frameworks via xcodebuild
2. Copy `GodotIap.framework` and `SwiftGodotRuntime.framework` to addon
3. Export Xcode project via Godot
4. Patch project.pbxproj to embed frameworks
5. Open Xcode (then Cmd+R to run)

## Manual Build

```bash
cd ios-gdextension
make ios
```

## Plugin Structure

- `ios-gdextension/Sources/GodotIap/`
  - `GodotIap.swift` - Main plugin class with `@Godot` macro
  - `Binder.swift` - GDExtension entry point

## Framework Embedding

Godot export doesn't embed frameworks automatically. The `scripts/fix_ios_embed.sh` script patches `project.pbxproj` to:
1. Change `lastKnownFileType` to `wrapper.framework`
2. Add `CodeSignOnCopy` and `RemoveHeadersOnCopy` attributes
3. Add frameworks to "Embed Frameworks" build phase

## GDExtension Config

```ini
; Example/addons/godot-iap/bin/godot_iap.gdextension
[configuration]
entry_symbol = "godot_iap_entry_point"
compatibility_minimum = "4.3"
supported_platforms = ["ios", "macos"]

[libraries]
ios.arm64 = "ios/GodotIap.framework/GodotIap"
macos.arm64 = "macos/GodotIap.framework/GodotIap"
macos.x86_64 = "macos/GodotIap.framework/GodotIap"

[dependencies]
ios.arm64 = {"ios/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}
macos.arm64 = {"macos/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}
macos.x86_64 = {"macos/SwiftGodotRuntime.framework/SwiftGodotRuntime": ""}
```
