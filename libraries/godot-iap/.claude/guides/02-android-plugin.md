# Android Plugin

## Build & Run

```bash
make run-android
```

This will:
1. Build AAR files (debug/release)
2. Copy to `Example/addons/godot-iap/bin/android/`
3. Export APK via Godot
4. Install and launch on connected device

## Manual Build

```bash
cd android
./gradlew assembleRelease
```

## Plugin Structure

- `GodotIap.kt` - Main plugin class extending `GodotPlugin`
- Uses `@UsedByGodot` annotation for GDScript-exposed methods
- Wraps `OpenIapModule` from openiap-google

## GDScript Usage

```gdscript
var iap = Engine.get_singleton("GodotIap")
iap.connect("purchase_updated", _on_purchase)
iap.initConnection()
```
