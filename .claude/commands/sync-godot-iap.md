# Sync Changes to godot-iap

Synchronize OpenIAP changes to the [godot-iap](https://github.com/hyochan/godot-iap) repository.

**Target Repository:** `/Users/hyo/Github/hyochan/godot-iap`

## Project Overview

- **Engine:** Godot 4.x
- **Language:** GDScript
- **Framework:** Godot Plugin/Addon
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `addons/openiap/types.gd` | GDScript types from OpenIAP | YES |
| `addons/openiap/iap.gd` | Core IAP module | NO |
| `addons/openiap/store.gd` | SwiftUI-like store | NO |
| `plugin.cfg` | Plugin configuration | NO |
| `openiap-versions.json` | Version tracking | NO |

## Type Generation Source

**OpenIAP has a built-in GDScript type generator:**

- **Generator:** `/Users/hyo/Github/hyodotdev/openiap/packages/gql/scripts/generate-gdscript-types.mjs`
- **Output:** `/Users/hyo/Github/hyodotdev/openiap/packages/gql/src/generated/types.gd`

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd /Users/hyo/Github/hyochan/godot-iap
git pull
```

### 1. Generate Types in OpenIAP

```bash
cd /Users/hyo/Github/hyodotdev/openiap/packages/gql

# Run GDScript type generation
npm run generate:gdscript

# Or run all generators
npm run generate
```

### 2. Copy Types to godot-iap

```bash
# Copy generated types
cp /Users/hyo/Github/hyodotdev/openiap/packages/gql/src/generated/types.gd \
   /Users/hyo/Github/hyochan/godot-iap/addons/openiap/types.gd
```

### 3. Update Version Tracking

Edit `openiap-versions.json` in godot-iap:

```json
{
  "gql": "1.3.11",
  "godot": "1.0.0"
}
```

### 4. Native Code Modifications

#### iOS Native Code (GDExtension)

**Location:** `ios/` or `gdextension/ios/`

Key files to update:

- Swift/Objective-C bridge to StoreKit 2
- GDExtension bindings for iOS

**When to modify:**

- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API changes
- Type conversion changes

#### Android Native Code (GDExtension)

**Location:** `android/` or `gdextension/android/`

Key files to update:

- Kotlin/Java bridge to Play Billing
- GDExtension bindings for Android

**When to modify:**

- New Android-specific API methods added to OpenIAP
- Play Billing API changes
- Type conversion changes

### 5. Update GDScript Implementation

If API changes, update:

- `addons/openiap/iap.gd` - Core module
- `addons/openiap/store.gd` - Store abstraction

### 6. Build & Test

#### Editor Test

```bash
cd /Users/hyo/Github/hyochan/godot-iap

# Open project in Godot 4.x
godot --editor .

# Check for GDScript errors in Output panel
# Run test scenes from editor
```

#### iOS Build Test

```bash
cd /Users/hyo/Github/hyochan/godot-iap

# Export iOS build from Godot Editor
# Project > Export > iOS
# Or use CLI:
godot --headless --export-release "iOS" build/ios/godot-iap.ipa
```

#### Android Build Test

```bash
cd /Users/hyo/Github/hyochan/godot-iap

# Export Android build from Godot Editor
# Project > Export > Android
# Or use CLI:
godot --headless --export-release "Android" build/android/godot-iap.apk
```

#### Unit Tests (GDUnit4)

```bash
# Run GDUnit4 tests
godot --headless -s addons/gdunit4/test_runner.gd

# Or run from editor: GDUnit4 panel > Run Tests
```

### 7. Update Example Code

**Location:** `examples/`

- Example Godot scenes demonstrating purchase flows
- Sample GDScript code

### 8. Update Documentation

**Location:** `docs/` or `README.md`

### 9. Update llms.txt Files

**Location:** `docs/static/`

Update AI-friendly documentation files when APIs or types change:

- `docs/static/llms.txt` - Quick reference for AI assistants
- `docs/static/llms-full.txt` - Detailed AI reference

**When to update:**

- New API functions added
- Function signatures changed
- New types or enums added
- GDScript patterns updated
- Error codes changed

**Content to sync:**

1. Installation (Godot Asset Library)
2. Core API reference (IAP module, Store class)
3. Key types (ProductIOS, PurchaseAndroid, etc.)
4. Signal patterns for purchase events
5. Platform-specific notes (StoreKit 2, Play Billing)
6. Error handling examples

## Generated Type Structure

```gdscript
# Enums
enum ErrorCode {
    UNKNOWN,
    USER_CANCELLED,
    # ... more codes
}

# Classes
class ProductIOS:
    var product_id: String
    var display_name: String
    # ... more fields

    static func from_dict(data: Dictionary) -> ProductIOS:
        # JSON deserialization
        pass

    func to_dict() -> Dictionary:
        # JSON serialization
        pass
```

## Naming Conventions (GDScript)

- **Classes:** PascalCase (e.g., `ProductIOS`, `RequestPurchaseResult`)
- **Methods:** snake_case (e.g., `from_dict()`, `to_dict()`)
- **Fields:** snake_case (e.g., `product_id`, `display_name`)
- **Enums:** UPPER_CASE (e.g., `ErrorCode.USER_CANCELLED`)
- **iOS types:** `IOS` suffix
- **Android types:** `Android` suffix

## Deprecation Check

```bash
cd /Users/hyo/Github/hyochan/godot-iap
grep -r "deprecated" addons/
grep -r "DEPRECATED" addons/
```

## Platform-Specific Notes

**iOS:**
- Uses StoreKit 2 via Swift bridge
- Check Apple-specific types in generated code

**Android:**
- Uses Google Play Billing via Java/Kotlin bridge
- Check Android-specific types in generated code

## Pre-commit Checklist

1. Types generated and copied
2. Implementation updated for new types
3. Examples updated
4. Tests passing
5. Documentation updated

## Commit Message Format

```
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **OpenIAP GDScript Generator:** `/Users/hyo/Github/hyodotdev/openiap/packages/gql/scripts/generate-gdscript-types.mjs`
- **OpenIAP Docs:** https://openiap.dev/docs
- **Godot IAP Docs:** Check README.md
