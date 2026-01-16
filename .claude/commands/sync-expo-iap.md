# Sync Changes to expo-iap

Synchronize OpenIAP changes to the [expo-iap](https://github.com/hyochan/expo-iap) repository.

**Target Repository:** `/Users/hyo/Github/hyochan/expo-iap`

## Project Overview

- **Package Manager:** Bun
- **Framework:** Expo Module (React Native)
- **Current Version:** Check `package.json`
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `src/types.ts` | TypeScript types from OpenIAP | YES |
| `src/index.ts` | Main API exports | NO |
| `src/useIAP.ts` | React Hook for IAP | NO |
| `src/modules/ios.ts` | iOS-specific functions | NO |
| `src/modules/android.ts` | Android-specific functions | NO |
| `openiap-versions.json` | Version tracking | NO |

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd /Users/hyo/Github/hyochan/expo-iap
git pull
```

### 1. Type Synchronization

```bash
cd /Users/hyo/Github/hyochan/expo-iap

# Update version in openiap-versions.json
# Edit "gql" field to new version

# Download and regenerate types
bun run generate:types

# Verify types
bun run typecheck
```

### 2. Native Code Modifications

#### iOS Native Code

**Location:** `ios/`

Key files to update:
- `ios/ExpoIapModule.swift` - Main Expo module implementation
- `ios/ExpoIap.podspec` - CocoaPods spec (update `apple` version dependency)

**When to modify:**
- New iOS-specific API methods added to OpenIAP
- Type conversion changes needed
- StoreKit 2 API changes

**Update workflow:**
```bash
cd /Users/hyo/Github/hyochan/expo-iap

# 1. Update apple version in openiap-versions.json
# 2. Review openiap/packages/apple/Sources/ for changes
# 3. Update ios/ExpoIapModule.swift accordingly

# Install updated pod
cd example/ios && pod install --repo-update
```

#### Android Native Code

**Location:** `android/src/main/java/`

Key files to update:
- `ExpoIapModule.kt` - Main Expo module implementation
- `build.gradle` - Dependencies (auto-reads `google` version)

**When to modify:**
- New Android-specific API methods added to OpenIAP
- Type conversion changes needed
- Play Billing API changes

**Update workflow:**
```bash
cd /Users/hyo/Github/hyochan/expo-iap

# 1. Update google version in openiap-versions.json
# 2. Review openiap/packages/google/openiap/src/main/ for changes
# 3. Update android/src/main/java/ accordingly

# Gradle auto-syncs on build
```

### 3. Build & Test Native Code

#### iOS Build Test

```bash
cd /Users/hyo/Github/hyochan/expo-iap/example

# Clean and prebuild
npx expo prebuild --clean --platform ios

# Install pods
cd ios && pod install --repo-update && cd ..

# Build for simulator
npx expo run:ios --device "iPhone 15 Pro"

# Or build via Xcode
open ios/expoiapexample.xcworkspace
# Build: Cmd+B, Run: Cmd+R
```

#### Android Build Test

```bash
cd /Users/hyo/Github/hyochan/expo-iap/example

# Clean and prebuild
npx expo prebuild --clean --platform android

# Build debug APK
npx expo run:android

# Or build via Android Studio
# Open android/ folder in Android Studio
# Build > Make Project
```

#### Android Horizon Build (Meta Quest)

```bash
cd /Users/hyo/Github/hyochan/expo-iap/example

# Enable Horizon flavor in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Prebuild and build with Horizon
npx expo prebuild --clean --platform android
npx expo run:android

# Revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

#### Full Build Matrix

```bash
cd /Users/hyo/Github/hyochan/expo-iap

# TypeScript build
bun run build

# iOS build
cd example && npx expo run:ios

# Android build (Play Store)
cd example && npx expo run:android

# Android build (Horizon)
cd example && echo "horizonEnabled=true" >> android/gradle.properties && npx expo run:android

# All tests
bun run test
cd example && bun run test
```

### 3. Update Example Code

**Location:** `example/app/`

Key example screens:
- `index.tsx` - Home/Overview
- `purchase-flow.tsx` - Purchase flow demo
- `subscription-flow.tsx` - Subscription demo
- `alternative-billing.tsx` - Android alt billing
- `offer-code.tsx` - Promo code redemption

### 4. Update Tests

**Library Tests:** `src/__tests__/`
**Example Tests:** `example/__tests__/`

```bash
# Run all tests
bun run test

# Run example tests
cd example && bun run test
```

### 5. Update Documentation

**Location:** `docs/`
- `docs/api/` - API reference
- `docs/guides/` - Usage guides
- `docs/examples/` - Code examples

### 6. Update llms.txt Files

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
1. Installation commands
2. Core API reference (useIAP hook, direct functions)
3. Key types (Product, Purchase, ErrorCode)
4. Common usage patterns
5. Platform-specific APIs (iOS/Android suffixes)
6. Error handling examples

### 7. Pre-commit Checklist

```bash
bun run lint           # ESLint
bun run typecheck      # TypeScript
bun run test           # Jest
cd example && bun run test  # Example app tests
```

## Naming Conventions

- **iOS-only:** `functionNameIOS` (e.g., `syncIOS`, `getPromotedProductIOS`)
- **Android-only:** `functionNameAndroid` (e.g., `validateReceiptAndroid`)
- **Cross-platform:** No suffix (e.g., `fetchProducts`, `requestPurchase`)
- **Error codes:** kebab-case (e.g., `'user-cancelled'`)

## Deprecation Check

Search for deprecated patterns:
```bash
cd /Users/hyo/Github/hyochan/expo-iap
grep -r "@deprecated" src/
grep -r "DEPRECATED" src/
```

Known deprecated functions:
- `requestProducts` -> Use `fetchProducts`
- `validateReceipt` -> Use `verifyPurchase`
- `validateReceiptIOS` -> Use `verifyPurchase`

## Commit Message Format

```
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **CLAUDE.md:** `/Users/hyo/Github/hyochan/expo-iap/CLAUDE.md`
- **OpenIAP Docs:** https://openiap.dev/docs
- **expo-iap Docs:** https://expo-iap.vercel.app
