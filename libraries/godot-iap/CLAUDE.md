# CLAUDE.md - Godot IAP Project Guidelines

This document outlines conventions and guidelines for the godot-iap project.

## Project Overview

godot-iap is a Godot 4.x plugin for in-app purchases following the [OpenIAP](https://openiap.dev) specification.

### Architecture

```text
godot-iap/
├── addons/godot-iap/  # Plugin files (for Asset Library)
│   ├── bin/           # Pre-built binaries (iOS/Android)
│   ├── android/       # Android AAR files
│   └── *.gd           # GDScript files
├── android/           # Android plugin (Kotlin)
│   ├── src/main/
│   │   ├── java/      # Kotlin sources
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── ios-gdextension/   # iOS plugin (Swift GDExtension)
│   ├── Sources/
│   └── Package.swift
├── Example/           # Godot example project
│   ├── addons -> ../addons  # Symlink to root addons
│   ├── main.gd
│   └── project.godot
└── .vscode/           # Development tools
```

## Naming Conventions

### Acronym Usage

1. **IAP (In-App Purchase)**:
   - When final suffix: Use `IAP` (e.g., `GodotIAP`)
   - When followed by other words: Use `Iap` (e.g., `IapManager`)

2. **ID (Identifier)**:
   - Always use `Id` (e.g., `productId`, `transactionId`)

3. **Platform-specific suffixes**:
   - iOS: `IOS` suffix (e.g., `PurchaseIOS`)
   - Android: `Android` suffix (e.g., `PurchaseAndroid`)

### GDScript Conventions

```gdscript
# Load OpenIAP types
const Types = preload("res://addons/godot-iap/types.gd")

# Class names: PascalCase
class_name IapManager

# Function names: snake_case
# Use typed parameters and return types from Types
func init_connection() -> bool:
    pass

func fetch_products(request: Types.ProductRequest) -> Array:
    # Returns Array of Types.ProductAndroid or Types.ProductIOS
    pass

func request_purchase(props: Types.RequestPurchaseProps) -> Variant:
    # Returns Types.PurchaseAndroid or Types.PurchaseIOS, or null
    pass

func finish_transaction(purchase: Types.PurchaseInput, is_consumable: bool) -> Types.VoidResult:
    pass

# Signal names: snake_case
signal purchase_updated(purchase: Dictionary)
signal purchase_error(error: Dictionary)

# Constants: SCREAMING_SNAKE_CASE
const PRODUCT_PREMIUM := "com.example.premium"
```

### Types (auto-generated from OpenIAP GraphQL schema)

Types are generated from `openiap/packages/gql` and should not be modified manually:
- `scripts/generate-types.sh` - Downloads latest `types.gd` from openiap releases
- `Example/addons/godot-iap/types.gd` - Auto-generated type definitions

Key types:
- `Types.ProductRequest` - Input for `fetch_products()`
- `Types.ProductAndroid`, `Types.ProductIOS` - Product info
- `Types.RequestPurchaseProps` - Input for `request_purchase()`
- `Types.PurchaseAndroid`, `Types.PurchaseIOS` - Purchase info
- `Types.PurchaseInput` - Input for `finish_transaction()`
- `Types.VoidResult` - Result with `success` boolean

### Platform-Specific Return Types (Sealed Class Pattern)

GDScript doesn't support Union types like Dart's `sealed class` or TypeScript's `|` operator.
For functions that return platform-specific types, we use `-> Array` or `-> Variant`:

```gdscript
# Dart equivalent: List<Product> where Product is sealed (ProductAndroid | ProductIOS)
# GDScript: Returns Array containing Types.ProductAndroid OR Types.ProductIOS
func fetch_products(request: Types.ProductRequest) -> Array

# Dart equivalent: Purchase? where Purchase is sealed (PurchaseAndroid | PurchaseIOS)
# GDScript: Returns Types.PurchaseAndroid OR Types.PurchaseIOS OR null
func request_purchase(props: Types.RequestPurchaseProps) -> Variant
```

**When to use each pattern:**

| Return Type | When to Use | Example Types |
|-------------|-------------|---------------|
| `-> Array` | Multiple items, platform-specific types | `ProductAndroid[]`, `ProductIOS[]`, `PurchaseAndroid[]`, `PurchaseIOS[]` |
| `-> Variant` | Single item OR null, platform-specific | `PurchaseAndroid?`, `PurchaseIOS?`, `VerifyPurchaseResultAndroid?` |
| `-> Types.X` | Single type, same on all platforms | `VoidResult`, `BoolResult` |

**Usage example:**
```gdscript
# fetch_products returns Array of typed objects
var products: Array = GodotIapPlugin.fetch_products(request)
for product in products:
    # On Android: product is Types.ProductAndroid
    # On iOS: product is Types.ProductIOS
    # Both have common properties: id, title, display_price
    print(product.id, " - ", product.display_price)

# request_purchase returns Variant (typed object or null)
var purchase = GodotIapPlugin.request_purchase(props)
if purchase:
    # On Android: purchase is Types.PurchaseAndroid
    # On iOS: purchase is Types.PurchaseIOS
    print("Purchased: ", purchase.product_id)
```

## Dependencies

### Version Management

Dependency versions are centralized and synced via `scripts/sync-versions.sh`:

| Dependency | Source | Synced To |
|------------|--------|-----------|
| openiap-apple | `openiap-versions.json` | `ios-gdextension/Package.swift` |
| openiap-google | `openiap-versions.json` | `godot_iap_plugin.gd` |
| kotlinx-coroutines | `android/gradle.properties` | `godot_iap_plugin.gd`, `build.gradle.kts` |

To update versions:
1. Edit `openiap-versions.json` or `android/gradle.properties`
2. Run `./scripts/sync-versions.sh`

### Android (openiap-google)

```kotlin
// build.gradle.kts - reads from openiap-versions.json
dependencies {
    implementation("io.github.hyochan.openiap:openiap-google:$openiapGoogleVersion")
}
```

### iOS (openiap-apple)

```swift
// Package.swift - generated from template by sync script
dependencies: [
    .package(url: "https://github.com/hyodotdev/openiap.git", from: "1.3.0")
]
```

## OpenIAP Specification

All implementations must follow OpenIAP standards:

- **APIs**: <https://openiap.dev/docs/apis>
- **Types**: <https://openiap.dev/docs/types>
- **Events**: <https://openiap.dev/docs/events>
- **Errors**: <https://openiap.dev/docs/errors>

### Core Methods

| Method | Description |
|--------|-------------|
| `initConnection()` | Initialize store connection |
| `endConnection()` | Close connection |
| `fetchProducts(skus)` | Get product info |
| `requestPurchase(params)` | Start purchase |
| `finishTransaction(purchase, isConsumable)` | Complete transaction |
| `restorePurchases()` | Restore purchases |

### Signals/Events

| Signal | Payload |
|--------|---------|
| `purchase_updated` | `{ productId, purchaseState, ... }` |
| `purchase_error` | `{ code, message, ... }` |

## Build & Testing

### Android

```bash
cd android
./gradlew assembleRelease

# Output: android/build/outputs/aar/
```

### iOS

```bash
cd ios-gdextension
swift build -c release

# For device:
xcodebuild -scheme GodotIap -destination 'generic/platform=iOS' -configuration Release
```

### Running Example

```bash
# Open Godot editor
/Applications/Godot.app/Contents/MacOS/Godot --editor --path Example

# Or use VSCode launch configurations
```

## VSCode Development

Use the provided launch configurations:

- **🎮 Godot: Open Editor** - Open Godot editor with Example project
- **🔨 Build: Android** - Build Android plugin
- **🔨 Build: iOS** - Build iOS plugin
- **📱 Xcode: Open Example** - Open exported iOS project

## Pre-Commit Checklist

1. Code compiles without errors
2. GDScript passes linting
3. Android: `./gradlew build` succeeds
4. iOS: `swift build` succeeds
5. Example project runs in editor

## Contributing

1. Follow naming conventions above
2. Test on both platforms when possible
3. Update documentation for API changes
4. Reference OpenIAP spec for new features
