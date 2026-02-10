# Sync OpenIAP Changes to All Platforms

Master workflow to synchronize OpenIAP changes across all platform SDKs.

## Usage

```bash
/sync-all-platforms [--patch | --minor | --major]
```

### Version Bump Arguments

| Argument | Description | Versioned Docs Required |
|----------|-------------|-------------------------|
| `--patch` | Patch version bump (x.x.+1) - Bug fixes, type-only changes | NO |
| `--minor` | Minor version bump (x.+1.0) - New features, non-breaking | **YES** |
| `--major` | Major version bump (+1.0.0) - Breaking changes | **YES** |

**Default:** If no argument provided, you will be prompted to choose the version bump type.

### When to Use Each

| Change Type | Version Bump |
|-------------|--------------|
| Type-only changes (no new API) | `--patch` |
| Bug fixes | `--patch` |
| New fields on existing types | `--patch` |
| New API functions | `--minor` |
| New features (non-breaking) | `--minor` |
| Breaking API changes | `--major` |
| Removed/renamed functions | `--major` |

---

## CRITICAL: The #1 Mistake to Avoid

**The most common sync mistake is updating types without verifying native code passes new options.**

Example: A new `includeSuspendedAndroid` option is added to `PurchaseOptions`. You:
1. Update types ✓
2. Run tests ✓
3. Push PR ✓

**BUT**: The native code still passes `null` instead of the options object. The feature doesn't work.

**ALWAYS verify native code actually passes new input fields to OpenIAP.**

## Environment Setup

Set these environment variables before running sync commands:

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export IAP_REPOS_HOME="/Users/crossplatformkorea/Github/hyochan"   # Parent directory of platform SDKs
export OPENIAP_HOME="/Users/crossplatformkorea/Github/hyodotdev"   # Parent directory of openiap monorepo
```

## Target Repositories

| Platform | Repository | Location |
|----------|------------|----------|
| Expo | expo-iap | `$IAP_REPOS_HOME/expo-iap` |
| React Native | react-native-iap | `$IAP_REPOS_HOME/react-native-iap` |
| Kotlin Multiplatform | kmp-iap | `$IAP_REPOS_HOME/kmp-iap` |
| Godot | godot-iap | `$IAP_REPOS_HOME/godot-iap` |
| Flutter | flutter_inapp_purchase | `$IAP_REPOS_HOME/flutter_inapp_purchase` |

## Pre-Sync: Pull All Repositories (REQUIRED)

**Always pull the latest code from all repositories before starting sync:**

```bash
# Pull all platform SDKs
cd $IAP_REPOS_HOME/expo-iap && git pull
cd $IAP_REPOS_HOME/react-native-iap && git pull
cd $IAP_REPOS_HOME/kmp-iap && git pull
cd $IAP_REPOS_HOME/godot-iap && git pull
cd $IAP_REPOS_HOME/flutter_inapp_purchase && git pull

# Return to openiap
cd $OPENIAP_HOME/openiap
```

## Pre-Sync: Generate Types in OpenIAP

```bash
cd $OPENIAP_HOME/openiap/packages/gql

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
cd $IAP_REPOS_HOME/expo-iap

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
cd $IAP_REPOS_HOME/react-native-iap

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
cd $IAP_REPOS_HOME/kmp-iap

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
cd $IAP_REPOS_HOME/godot-iap

# Types are generated in openiap
# Copy from openiap
cp $OPENIAP_HOME/openiap/packages/gql/src/generated/types.gd \
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
cd $IAP_REPOS_HOME/flutter_inapp_purchase

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

## Native Code Modification Checklist (CRITICAL)

**This is the most important section. DO NOT SKIP.**

### Change Type Decision Matrix

| Change Type | Action Required |
|-------------|-----------------|
| New response types only | NO code change - OpenIAP returns them automatically |
| New INPUT option fields | **CHECK** - verify native code passes the option |
| New API function | YES - add wrapper in native + expose to JS/Dart/Kotlin |
| Breaking type change | YES - check serialization compatibility |
| New platform feature | YES - full implementation needed |

### How to Verify INPUT Options Are Passed

**For each new input field (e.g., `includeSuspendedAndroid`, `winBackOffer`):**

1. **Find where the option is used in OpenIAP native SDK:**
   ```bash
   # Example: Check how OpenIAP uses the option
   grep -rn "includeSuspendedAndroid" packages/google/
   ```

2. **Check if platform SDK passes the option to OpenIAP:**
   ```bash
   # Example: Check expo-iap
   grep -A10 "getAvailableItems\|getAvailablePurchases" android/src/main/java/expo/modules/iap/ExpoIapModule.kt
   ```

3. **If native code passes `null` or doesn't read the option, IT WON'T WORK.**

### iOS Native Code Updates

For each platform SDK, check:

1. **New API Methods**
   - [ ] Method signature matches OpenIAP spec
   - [ ] Return types correctly mapped
   - [ ] Error handling follows pattern
   - [ ] Async/await properly used (StoreKit 2)

2. **New INPUT Options**
   - [ ] Options are read from the params/arguments
   - [ ] Options are forwarded to OpenIAP SDK
   - [ ] Not passing `null` when options exist

3. **Type Conversions**
   - [ ] New types have conversion functions
   - [ ] Optional fields handled correctly
   - [ ] Platform-specific fields mapped

4. **Error Handling**
   - [ ] New error codes mapped
   - [ ] Error messages localized if needed
   - [ ] Proper error propagation

5. **Objective-C Bridge (CRITICAL for kmp-iap)**
   - [ ] **New Swift functions have ObjC wrappers** in `OpenIapModule+ObjC.swift`
   - [ ] **ObjC wrappers forward ALL parameters** (not hardcoded to `nil`)
   - [ ] **Serialization uses `OpenIapSerialization.encode()`**

   **Why this matters:** kmp-iap uses Kotlin/Native cinterop which requires Objective-C compatible APIs. Swift async functions are NOT directly callable from Kotlin - they need completion handler wrappers.

   **Verification:**
   ```bash
   # Compare Swift functions vs ObjC wrappers
   grep -c "public func" packages/apple/Sources/OpenIapModule.swift
   grep -c "@objc func" packages/apple/Sources/OpenIapModule+ObjC.swift
   # Counts should roughly match
   ```

### Android Native Code Updates

1. **New API Methods**
   - [ ] Method signature matches OpenIAP spec
   - [ ] Coroutines/suspend functions properly used
   - [ ] BillingClient callbacks handled

2. **New INPUT Options (MOST COMMONLY MISSED)**
   - [ ] Options are parsed from the params Map/HashMap
   - [ ] `PurchaseOptions.fromJson(options)` or equivalent is called
   - [ ] Options are passed to `openIap.getAvailablePurchases(options)` not `null`

3. **Type Conversions**
   - [ ] New types have conversion functions
   - [ ] Nullable fields handled correctly
   - [ ] Platform-specific fields mapped

4. **Error Handling**
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
cd $OPENIAP_HOME/openiap/packages/google

# Build Horizon flavor
./gradlew :openiap:assembleHorizonDebug
./gradlew :openiap:assembleHorizonRelease

# Run Horizon tests
./gradlew :openiap:testHorizonDebugUnitTest
```

#### expo-iap

```bash
cd $IAP_REPOS_HOME/expo-iap/example

# Enable Horizon in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Build with Horizon
npx expo run:android

# Remember to revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

#### react-native-iap

```bash
cd $IAP_REPOS_HOME/react-native-iap/example

# Enable Horizon in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Build with Horizon
yarn android

# Remember to revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

#### flutter_inapp_purchase

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase/example

# Build with Horizon flavor
flutter build apk --flavor horizon

# Or run with Horizon
flutter run --flavor horizon
```

---

## Documentation Updates (REQUIRED)

After code changes, update documentation in each platform SDK repo.

### Documentation Checklist Per Platform

For each new feature synced to a platform SDK:

- [ ] **CHANGELOG** - Entry for the new version
- [ ] **API docs** - Function added to docs/docs/api/ with signature, params, return type
- [ ] **Type docs** - New types documented with all fields explained
- [ ] **Example apps** - Working examples demonstrating new features
- [ ] **Code examples** - Inline code examples in documentation
- [ ] **Platform notes** - Version requirements (e.g., "iOS 18+", "Billing 8.0+")
- [ ] **llms.txt** - AI-friendly documentation updated

### Documentation Locations by Platform

| Platform | API Docs | Type Docs | Examples | llms.txt |
|----------|----------|-----------|----------|----------|
| expo-iap | `docs/docs/api/` | `docs/docs/types/` | `example/app/` | `docs/static/` |
| react-native-iap | `docs/docs/api/` | `docs/docs/types/` | `example/src/` | `docs/static/` |
| kmp-iap | `docs/docs/api/` | `docs/docs/types/` | `example/composeApp/` | `docs/static/` |
| godot-iap | `docs/` or `README.md` | - | `examples/` | `docs/static/` |
| flutter_inapp_purchase | `docs/docs/api/` | `docs/docs/types/` | `example/lib/src/screens/` | `docs/static/` |
| openiap (docs) | `src/pages/docs/apis/` | `src/pages/docs/types/` | `packages/*/Example/` | `public/` |

### Example App Updates (REQUIRED)

Update example apps in each platform SDK to demonstrate new features:

| Platform | Example Location | Key Files |
|----------|------------------|-----------|
| expo-iap | `example/app/` | `purchase-flow.tsx`, `subscription-flow.tsx` |
| react-native-iap | `example/src/screens/` | `PurchaseFlow.tsx`, `SubscriptionFlow.tsx` |
| kmp-iap | `example/composeApp/` | Compose Multiplatform UI |
| godot-iap | `examples/` | GDScript scenes |
| flutter_inapp_purchase | `example/lib/src/screens/` | `purchase_flow_screen.dart` |

**Example Code Guidelines:**
- Demonstrate ALL new API features with working code
- Show both success and error handling
- Include comments explaining the feature
- Use realistic SKU names and user flows
- Test on actual devices/simulators before committing

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

## Version Bump & Versioned Docs

### Versioned Docs (REQUIRED for Minor/Major)

**CRITICAL: For `--minor` or `--major` version bumps, you MUST create versioned documentation in EACH platform SDK.**

Docusaurus versioned docs preserve documentation for previous versions so users on older SDK versions can reference the correct API.

### Create Versioned Docs for All Platforms

For each platform SDK, run the following:

```bash
# expo-iap
cd $IAP_REPOS_HOME/expo-iap/docs
npm run docusaurus docs:version <CURRENT_VERSION>

# react-native-iap
cd $IAP_REPOS_HOME/react-native-iap/docs
npm run docusaurus docs:version <CURRENT_VERSION>

# flutter_inapp_purchase
cd $IAP_REPOS_HOME/flutter_inapp_purchase/docs
npm run docusaurus docs:version <CURRENT_VERSION>

# kmp-iap
cd $IAP_REPOS_HOME/kmp-iap/docs
npm run docusaurus docs:version <CURRENT_VERSION>

# godot-iap
cd $IAP_REPOS_HOME/godot-iap/docs
npm run docusaurus docs:version <CURRENT_VERSION>
```

### Versioned Docs Structure

Each platform SDK uses Docusaurus versioned docs:

```
docs/
├── docs/                    # Current (next) version docs
├── versioned_docs/
│   ├── version-X.X/         # Snapshot of docs at version X.X
│   └── version-Y.Y/         # Snapshot of docs at version Y.Y
├── versioned_sidebars/
│   ├── version-X.X-sidebars.json
│   └── version-Y.Y-sidebars.json
├── versions.json            # List of all versions
└── docusaurus.config.ts     # Version labels and paths
```

### Update docusaurus.config.ts

After creating versioned docs, update each platform's `docusaurus.config.ts`:

```typescript
versions: {
  current: {
    label: '<NEW_VERSION> (Current)',  // Update to new version
    path: '',
  },
  '<PREVIOUS_VERSION>': {              // Add previous version
    label: '<PREVIOUS_VERSION>',
    path: '<PREVIOUS_VERSION>',
  },
  // ... older versions
},
```

### Version Bump Checklist (All Platforms)

| Bump Type | Create Versioned Docs | Update docusaurus.config.ts | Update Current Docs |
|-----------|----------------------|----------------------------|---------------------|
| `--patch` | NO | NO | If API docs changed |
| `--minor` | **YES** (all platforms) | **YES** (all platforms) | **YES** (all platforms) |
| `--major` | **YES** (all platforms) | **YES** (all platforms) | **YES** (all platforms) |

### Platform-Specific Versioned Docs Notes

| Platform | Docs Location | Version Format |
|----------|---------------|----------------|
| expo-iap | `docs/` | `X.Y` (e.g., 3.4) |
| react-native-iap | `docs/` | `X.Y` (e.g., 14.5) |
| flutter_inapp_purchase | `docs/` | `X.Y` (e.g., 8.3) |
| kmp-iap | `docs/` | `X.Y` (e.g., 1.2) |
| godot-iap | `docs/` | `X.Y` (e.g., 1.0) |

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

## Create Pull Requests (REQUIRED)

**CRITICAL: You MUST create a PR for each platform SDK after pushing. DO NOT skip this step.**

### Find Related OpenIAP PR

If this sync was triggered by an OpenIAP PR, include it in PR descriptions:

```bash
# Find recent OpenIAP PRs related to this sync
gh pr list --repo hyodotdev/openiap --state merged --limit 5
```

### Create PRs for All Platforms

For each platform, create a PR with the OpenIAP PR reference:

```bash
# expo-iap
cd $IAP_REPOS_HOME/expo-iap
gh pr create --title "feat: sync with openiap v<gql-version>" --body "$(cat <<'EOF'
## Summary
- Sync with OpenIAP v<gql-version>

## Related
- OpenIAP PR: <openiap-pr-url>
- OpenIAP Release Notes: https://www.openiap.dev/docs/updates/notes#gql-<version>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

# react-native-iap
cd $IAP_REPOS_HOME/react-native-iap
gh pr create --title "feat: sync with openiap v<gql-version>" --body "..."

# flutter_inapp_purchase
cd $IAP_REPOS_HOME/flutter_inapp_purchase
gh pr create --title "feat: sync with openiap v<gql-version>" --body "..."

# kmp-iap
cd $IAP_REPOS_HOME/kmp-iap
gh pr create --title "feat: sync with openiap v<gql-version>" --body "..."

# godot-iap
cd $IAP_REPOS_HOME/godot-iap
gh pr create --title "feat: sync with openiap v<gql-version>" --body "..."
```

### PR Body Template

Use this template for all platform PRs:

```markdown
## Summary

- Sync with OpenIAP v<gql-version>
- <List specific new features/changes>

## Related

- OpenIAP PR: <openiap-pr-url-if-applicable>
- OpenIAP Release Notes: https://www.openiap.dev/docs/updates/notes#gql-<version>

## Changes

- Update openiap-versions.json (gql: <ver>, apple: <ver>, google: <ver>)
- Regenerate types
- <List other changes>
- Add release blog post
- Update llms.txt

## Test Plan

- [ ] Lint/analyze passes
- [ ] Tests pass
- [ ] Example app builds successfully

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Return PR URLs

After creating all PRs, note the URLs to share with the user.

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
cd $IAP_REPOS_HOME/expo-iap && bun run generate:types && bun run test

# react-native-iap
cd $IAP_REPOS_HOME/react-native-iap && yarn generate:types && yarn test

# kmp-iap
cd $IAP_REPOS_HOME/kmp-iap && ./scripts/generate-types.sh && ./gradlew :library:test

# godot-iap
cp $OPENIAP_HOME/openiap/packages/gql/src/generated/types.gd $IAP_REPOS_HOME/godot-iap/addons/openiap/types.gd

# flutter_inapp_purchase
cd $IAP_REPOS_HOME/flutter_inapp_purchase && ./scripts/generate-type.sh && flutter test
```
