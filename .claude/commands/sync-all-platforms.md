# Sync OpenIAP Changes to All Platforms

Master workflow to synchronize OpenIAP changes across all platform SDKs.

## Target Repositories

| Platform | Repository | Location |
|----------|------------|----------|
| Expo | expo-iap | `/Users/hyo/Github/hyochan/expo-iap` |
| React Native | react-native-iap | `/Users/hyo/Github/hyochan/react-native-iap` |
| Kotlin Multiplatform | kmp-iap | `/Users/hyo/Github/hyochan/kmp-iap` |
| Godot | godot-iap | `/Users/hyo/Github/hyochan/godot-iap` |
| Flutter | flutter_inapp_purchase | `/Users/hyo/Github/hyochan/flutter_inapp_purchase` |

## Pre-Sync: Pull All Repositories (REQUIRED)

**Always pull the latest code from all repositories before starting sync:**

```bash
# Pull all platform SDKs
cd /Users/hyo/Github/hyochan/expo-iap && git pull
cd /Users/hyo/Github/hyochan/react-native-iap && git pull
cd /Users/hyo/Github/hyochan/kmp-iap && git pull
cd /Users/hyo/Github/hyochan/godot-iap && git pull
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase && git pull

# Return to openiap
cd /Users/hyo/Github/hyodotdev/openiap
```

## Pre-Sync: Generate Types in OpenIAP

```bash
cd /Users/hyo/Github/hyodotdev/openiap/packages/gql

# Generate all platform types
bun run generate

# Or generate specific platforms
bun run generate:ts        # TypeScript
bun run generate:swift     # Swift
bun run generate:kotlin    # Kotlin
bun run generate:dart      # Dart
bun run generate:gdscript  # GDScript
```

## Change Detection Checklist

Before syncing, identify what changed:

### 1. Type Changes (GraphQL Schema)
- [ ] New types added
- [ ] Existing types modified
- [ ] Types deprecated/removed
- [ ] New enums/enum values
- [ ] Field name changes
- [ ] Optional/required field changes

### 2. API Changes
- [ ] New functions added
- [ ] Function signatures changed
- [ ] Functions deprecated
- [ ] Error codes changed

### 3. Native SDK Changes
- [ ] iOS SDK (`packages/apple`) updated
- [ ] Android SDK (`packages/google`) updated
- [ ] Breaking changes in native APIs

---

## Platform-Specific Sync

### 1. expo-iap

```bash
cd /Users/hyo/Github/hyochan/expo-iap

# Update versions
# Edit openiap-versions.json: gql, apple, google

# Sync types
bun run generate:types

# Native iOS
cd ios
# Review changes needed in Swift code
pod install

# Native Android
# Review android/src/main/java/ for needed updates

# Build & Test
bun run typecheck
bun run lint
bun run test
cd example && bun run test

# Build example apps
cd example
npx expo prebuild --clean
cd ios && pod install
npx expo run:ios
npx expo run:android
```

### 2. react-native-iap

```bash
cd /Users/hyo/Github/hyochan/react-native-iap

# Update versions
# Edit openiap-versions.json: gql, apple, google

# Sync types
yarn generate:types

# Native iOS (ios/HybridRnIap.swift)
# - Update Swift implementation for new APIs
# - Handle new types in type conversion

# Native Android (android/.../HybridRnIap.kt)
# - Update Kotlin implementation for new APIs
# - Handle new types in type conversion

# Regenerate Nitro bridge if needed
yarn specs

# Build & Test
yarn typecheck
yarn lint
yarn test

# Build example apps
yarn workspace rn-iap-example ios
yarn workspace rn-iap-example android

# Expo example
cd example-expo
bun setup
bun ios
bun android
```

### 3. kmp-iap

```bash
cd /Users/hyo/Github/hyochan/kmp-iap

# Update versions
# Edit openiap-versions.json: gql, google, apple

# Sync types
./scripts/generate-types.sh

# Common code updates (library/src/commonMain/)
# - Update KmpIap.kt type aliases for new types
# - Update dsl/PurchaseDsl.kt for new request builders
# - Update utils/ErrorMapping.kt for new error codes

# Native Android (library/src/androidMain/)
# - Update InAppPurchaseAndroid.kt for new APIs
# - Update Helper.kt for new conversions

# Native iOS (library/src/iosMain/)
# - Update InAppPurchaseIOS.kt for new APIs
# - C-Interop updates if Swift API changed

# Build & Test
./gradlew :library:test
./gradlew :library:build
./gradlew :library:detekt

# Build example
./gradlew :example:composeApp:assembleDebug

# iOS build test
cd example/iosApp
pod install
xcodebuild -workspace iosApp.xcworkspace -scheme iosApp -sdk iphonesimulator
```

### 4. godot-iap

```bash
cd /Users/hyo/Github/hyochan/godot-iap

# Types are generated in openiap
# Copy from openiap
cp /Users/hyo/Github/hyodotdev/openiap/packages/gql/src/generated/types.gd \
   addons/openiap/types.gd

# Update implementation
# - addons/openiap/iap.gd for new APIs
# - addons/openiap/store.gd for store changes

# Update openiap-versions.json

# Test in Godot Editor
# Open project in Godot 4.x
# Run test scenes
# Check for GDScript errors

# Run GDUnit4 tests if available
godot --headless -s addons/gdunit4/test_runner.gd
```

### 5. flutter_inapp_purchase

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase

# Update versions
# Edit openiap-versions.json: gql, apple, google

# Sync types
./scripts/generate-type.sh

# Update Dart implementation
# - lib/flutter_inapp_purchase.dart for new APIs
# - lib/helpers.dart for type conversions
# - lib/errors.dart for error codes
# - lib/builders.dart for new request builders

# Native iOS (ios/Classes/FlutterInappPurchasePlugin.swift)
# - Update Swift implementation
# - Handle new method channels

# Native Android (android/.../FlutterInappPurchasePlugin.kt)
# - Update Kotlin implementation
# - Handle new method channels

# Build & Test
flutter analyze
flutter test

# Build example
cd example
flutter build ios --no-codesign
flutter build apk

# Run example
flutter run -d ios
flutter run -d android
```

---

## Native Code Modification Checklist

### iOS Native Code Updates

For each platform SDK, check:

1. **New API Methods**
   - [ ] Method signature matches OpenIAP spec
   - [ ] Return types correctly mapped
   - [ ] Error handling follows pattern
   - [ ] Async/await properly used (StoreKit 2)

2. **Type Conversions**
   - [ ] New types have conversion functions
   - [ ] Optional fields handled correctly
   - [ ] Platform-specific fields mapped

3. **Error Handling**
   - [ ] New error codes mapped
   - [ ] Error messages localized if needed
   - [ ] Proper error propagation

### Android Native Code Updates

1. **New API Methods**
   - [ ] Method signature matches OpenIAP spec
   - [ ] Coroutines/suspend functions properly used
   - [ ] BillingClient callbacks handled

2. **Type Conversions**
   - [ ] New types have conversion functions
   - [ ] Nullable fields handled correctly
   - [ ] Platform-specific fields mapped

3. **Error Handling**
   - [ ] BillingResponseCode mapping updated
   - [ ] Error messages consistent

---

## Build Test Matrix

| Platform | iOS Build | Android Build | Horizon Build | Tests | Example |
|----------|-----------|---------------|---------------|-------|---------|
| expo-iap | `npx expo run:ios` | `npx expo run:android` | See Horizon section | `bun run test` | `example/` |
| react-native-iap | `yarn workspace ... ios` | `yarn workspace ... android` | See Horizon section | `yarn test` | `example/` |
| kmp-iap | `xcodebuild` | `./gradlew assembleDebug` | N/A | `./gradlew test` | `example/` |
| godot-iap | Xcode export | Gradle export | N/A | GDUnit4 | `examples/` |
| flutter_inapp_purchase | `flutter build ios` | `flutter build apk` | See Horizon section | `flutter test` | `example/` |

### Android Horizon Build (Meta Quest)

OpenIAP supports Meta Horizon Store via build flavors. When syncing, verify Horizon builds work:

#### openiap (packages/google)

```bash
cd /Users/hyo/Github/hyodotdev/openiap/packages/google

# Build Horizon flavor
./gradlew :openiap:assembleHorizonDebug
./gradlew :openiap:assembleHorizonRelease

# Run Horizon tests
./gradlew :openiap:testHorizonDebugUnitTest
```

#### expo-iap

```bash
cd /Users/hyo/Github/hyochan/expo-iap/example

# Enable Horizon in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Build with Horizon
npx expo run:android

# Remember to revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

#### react-native-iap

```bash
cd /Users/hyo/Github/hyochan/react-native-iap/example

# Enable Horizon in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Build with Horizon
yarn android

# Remember to revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

#### flutter_inapp_purchase

```bash
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase/example

# Build with Horizon flavor
flutter build apk --flavor horizon

# Or run with Horizon
flutter run --flavor horizon
```

---

## Documentation Updates

After code changes, update documentation in each repo:

1. **API Reference** - New/changed methods
2. **Type Definitions** - New/changed types
3. **Migration Guide** - Breaking changes
4. **Examples** - Updated usage patterns
5. **CHANGELOG** - Version history
6. **llms.txt Files** - AI-friendly documentation

### llms.txt Update Locations

| Platform | llms.txt Location |
|----------|-------------------|
| expo-iap | `docs/static/llms.txt`, `docs/static/llms-full.txt` |
| react-native-iap | `docs/static/llms.txt`, `docs/static/llms-full.txt` |
| kmp-iap | `docs/static/llms.txt`, `docs/static/llms-full.txt` |
| godot-iap | `docs/static/llms.txt`, `docs/static/llms-full.txt` |
| flutter_inapp_purchase | `docs/static/llms.txt`, `docs/static/llms-full.txt` |
| openiap (docs) | `packages/docs/public/llms.txt`, `packages/docs/public/llms-full.txt` |

**When to update llms.txt:**

- New API functions added
- Function signatures changed
- New types or enums added
- Usage patterns updated
- Error codes changed
- Platform-specific APIs added

---

## Deprecation Handling

When deprecating APIs:

1. **Mark deprecated in types** - Add `@deprecated` annotations
2. **Add migration notes** - Document replacement API
3. **Update examples** - Remove deprecated usage
4. **Log warnings** - Runtime deprecation warnings
5. **Set removal timeline** - Specify when fully removed

---

## Commit Strategy

For each platform:

```bash
# Feature addition
git add .
git commit -m "feat: sync with openiap v1.x.x - add discount offers"

# Breaking change
git commit -m "feat!: sync with openiap v1.x.x - update purchase API

BREAKING CHANGE: requestPurchase now requires DiscountOfferInput for iOS"

# Documentation only
git commit -m "docs: sync with openiap v1.x.x - update API docs"
```

---

## Post-Sync Verification

1. **All platforms build successfully**
2. **All tests pass**
3. **Example apps run on simulators/devices**
4. **Documentation is updated**
5. **No deprecated API usage in examples**
6. **Version numbers updated**

## Quick Reference Commands

```bash
# expo-iap
cd /Users/hyo/Github/hyochan/expo-iap && bun run generate:types && bun run test

# react-native-iap
cd /Users/hyo/Github/hyochan/react-native-iap && yarn generate:types && yarn test

# kmp-iap
cd /Users/hyo/Github/hyochan/kmp-iap && ./scripts/generate-types.sh && ./gradlew :library:test

# godot-iap
cp /Users/hyo/Github/hyodotdev/openiap/packages/gql/src/generated/types.gd /Users/hyo/Github/hyochan/godot-iap/addons/openiap/types.gd

# flutter_inapp_purchase
cd /Users/hyo/Github/hyochan/flutter_inapp_purchase && ./scripts/generate-type.sh && flutter test
```
