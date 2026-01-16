# Sync Changes to flutter_inapp_purchase

Synchronize OpenIAP changes to the [flutter_inapp_purchase](https://github.com/hyochan/flutter_inapp_purchase) repository.

**Target Repository:** `/Users/hyo/Github/hyochan/flutter_inapp_purchase`

## Project Overview

- **Framework:** Flutter Plugin
- **Language:** Dart
- **Platforms:** iOS, Android, macOS
- **Current Version:** Check `pubspec.yaml`
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `lib/types.dart` | Dart types from OpenIAP | YES |
| `lib/flutter_inapp_purchase.dart` | Main API class | NO |
| `lib/helpers.dart` | Type conversion utilities | NO |
| `lib/errors.dart` | Error handling & codes | NO |
| `lib/builders.dart` | Request builder DSL | NO |
| `lib/enums.dart` | Custom enums | NO |
| `ios/Classes/FlutterInappPurchasePlugin.swift` | iOS implementation | NO |
| `android/.../FlutterInappPurchasePlugin.kt` | Android implementation | NO |
| `openiap-versions.json` | Version tracking | NO |

## Version File Structure

```json
{
  "apple": "1.3.5",
  "google": "1.3.14",
  "gql": "1.3.5"
}
```

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase
git pull
```

### 1. Type Synchronization

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# Update version in openiap-versions.json
# Edit "gql" field to new version

# Download and regenerate types
./scripts/generate-type.sh

# Verify
flutter analyze
```

**Types Location:** `lib/types.dart` (4,325+ lines, auto-generated)

### 2. Native Code Modifications

#### iOS Native Code

**Location:** `ios/Classes/`

Key files to update:

- `FlutterInappPurchasePlugin.swift` - Main Flutter plugin implementation
- Method channel handlers for iOS-specific APIs

**When to modify:**

- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API changes
- Type conversion between Swift and Dart
- New method channels needed

**Update workflow:**

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# 1. Update apple version in openiap-versions.json
# 2. Review openiap/packages/apple/Sources/ for changes
# 3. Update ios/Classes/FlutterInappPurchasePlugin.swift
# 4. Update lib/helpers.dart for new type conversions
```

#### Android Native Code

**Location:** `android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/`

Key files to update:

- `FlutterInappPurchasePlugin.kt` - Main Flutter plugin implementation
- Method channel handlers for Android-specific APIs

**When to modify:**

- New Android-specific API methods added to OpenIAP
- Play Billing API changes
- Type conversion between Kotlin and Dart
- New method channels needed

**Update workflow:**

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# 1. Update google version in openiap-versions.json
# 2. Review openiap/packages/google/openiap/src/main/ for changes
# 3. Update android/.../FlutterInappPurchasePlugin.kt
# 4. Update lib/helpers.dart for new type conversions
```

#### macOS Native Code

**Location:** `macos/Classes/`

- Shares implementation pattern with iOS
- Update alongside iOS changes

### 3. Build & Test Native Code

#### iOS Build Test

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# Build iOS (no code sign for testing)
flutter build ios --no-codesign

# Run on simulator
cd example
flutter run -d "iPhone 15 Pro"

# Or build via Xcode
open example/ios/Runner.xcworkspace
# Build: Cmd+B, Run: Cmd+R
```

#### Android Build Test

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# Build APK
flutter build apk --debug

# Run on emulator
cd example
flutter run -d emulator-5554

# Or build via Android Studio
# Open example/android/ in Android Studio
# Build > Make Project
```

#### macOS Build Test

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# Build macOS
flutter build macos

# Run
cd example
flutter run -d macos
```

#### Android Horizon Build (Meta Quest)

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# Build with Horizon flavor
flutter build apk --flavor horizon

# Run example with Horizon
cd example
flutter run --flavor horizon
```

#### Full Build Matrix

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# All platforms
flutter build ios --no-codesign
flutter build apk                    # Play Store
flutter build apk --flavor horizon   # Horizon Store
flutter build macos

# All tests
flutter test

# Example app tests
cd example && flutter test
```

### 3. Update Helper Functions

If types change, update `lib/helpers.dart`:
- JSON to object conversions
- Platform-specific logic
- Type transformations

### 4. Update Error Handling

If error codes change, update `lib/errors.dart`:
- Platform error code mappings
- Exception classes

### 5. Update Example Code

**Location:** `example/lib/src/screens/`

Key screens:
- `purchase_flow_screen.dart` - Purchase flow demo
- `subscription_flow_screen.dart` - Subscription demo
- `alternative_billing_screen.dart` - Android alt billing
- `offer_code_screen.dart` - Code redemption
- `builder_demo_screen.dart` - DSL demonstration

### 6. Update Tests

**Unit Tests:** `test/`
**Example Tests:** `example/test/`

```bash
# Run all tests
flutter test

# With coverage (excludes types.dart)
flutter test --coverage
```

### 7. Update Documentation

**Location:** `docs/`
- Docusaurus site
- `docs/docs/api/` - API reference
- `docs/docs/guides/` - Usage guides
- `docs/docs/examples/` - Code examples

### 8. Update llms.txt Files

**Location:** `docs/static/`

Update AI-friendly documentation files when APIs or types change:

- `docs/static/llms.txt` - Quick reference for AI assistants
- `docs/static/llms-full.txt` - Detailed AI reference

**When to update:**

- New API functions added
- Function signatures changed
- New types or enums added
- Usage patterns updated
- Error codes changed

**Content to sync:**

1. Installation (pubspec.yaml)
2. Core API reference (FlutterInappPurchase class)
3. Key types (Product, Purchase, ErrorCode)
4. Common usage patterns (fetch, purchase, finish)
5. Platform-specific APIs (iOS/Android suffixes)
6. Error handling examples

### 9. Pre-commit Checklist

```bash
# Format (excludes types.dart)
git ls-files '*.dart' | grep -v '^lib/types.dart$' | xargs dart format --page-width 80 --output=none --set-exit-if-changed

# Lint
flutter analyze

# Test
flutter test

# Final format check
dart format --set-exit-if-changed .

# Or run all checks
./scripts/pre-commit-checks.sh
```

## API Patterns

### Generic Fetch
```dart
final products = await FlutterInappPurchase.instance.fetchProducts<Product>(
  productIds: ['product_id'],
);
```

### Request Purchase
```dart
final result = await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseParams(
    sku: 'product_id',
    // platform-specific options
  ),
);
```

### Handler Typedefs
```dart
// Use QueryHandlers, MutationHandlers with typed callbacks
QueryHandlers handlers = QueryHandlers(
  onProducts: (List<Product> products) { ... },
);
```

## Naming Conventions

- **iOS types:** `IOS` suffix (e.g., `PurchaseIOS`, `SubscriptionOfferIOS`)
- **Android types:** `Android` suffix (e.g., `PurchaseAndroid`)
- **IAP codes:** `Iap` when not final suffix (e.g., `IapPurchase`)
- **ID fields:** Always `Id` (e.g., `productId`, `subscriptionGroupIdIOS`)

## Deprecation Check

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase
grep -r "@deprecated" lib/
grep -r "@Deprecated" lib/
grep -r "DEPRECATED" lib/
```

Known deprecations:
- `getPurchaseHistories()` -> Use `getAvailablePurchases()`

## Commit Message Format

```
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **CLAUDE.md:** `/Users/hyo/Github/hyochan/flutter_inapp_purchase/CLAUDE.md`
- **CONVENTION.md:** `/Users/hyo/Github/hyochan/flutter_inapp_purchase/CONVENTION.md`
- **OpenIAP Docs:** https://openiap.dev/docs
- **flutter_inapp_purchase Docs:** https://hyochan.github.io/flutter_inapp_purchase
