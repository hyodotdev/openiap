# Sync Changes to react-native-iap

Synchronize OpenIAP changes to the [react-native-iap](https://github.com/hyochan/react-native-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/react-native-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))

## Project Overview

- **Package Manager:** Yarn 3 (workspace)
- **Framework:** React Native with Nitro Modules
- **Current Version:** Check `package.json`
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `src/types.ts` | TypeScript types from OpenIAP | YES |
| `src/specs/RnIap.nitro.ts` | Nitro bridge spec | NO |
| `src/utils/type-bridge.ts` | Type converters | NO |
| `src/index.ts` | Public API | NO |
| `src/hooks/useIAP.ts` | React hook | NO |
| `ios/HybridRnIap.swift` | iOS implementation | NO |
| `android/.../HybridRnIap.kt` | Android implementation | NO |
| `nitrogen/generated/` | Nitro bridge code | YES |
| `openiap-versions.json` | Version tracking | NO |

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/react-native-iap
git pull
```

### 1. Sync openiap-versions.json (REQUIRED)

**IMPORTANT:** Before generating types, sync version numbers from openiap monorepo.

```bash
cd $IAP_REPOS_HOME/react-native-iap

# Check current versions in openiap monorepo
cat $OPENIAP_HOME/openiap/openiap-versions.json

# Update react-native-iap's openiap-versions.json to match:
# - "gql": should match openiap's "gql" version
# - "apple": should match openiap's "apple" version
# - "google": should match openiap's "google" version
```

**Version fields to sync:**
| Field | Source | Purpose |
|-------|--------|---------|
| `gql` | `$OPENIAP_HOME/openiap/openiap-versions.json` | TypeScript types version |
| `apple` | `$OPENIAP_HOME/openiap/openiap-versions.json` | iOS native SDK version |
| `google` | `$OPENIAP_HOME/openiap/openiap-versions.json` | Android native SDK version |

### 2. Type Synchronization

```bash
cd $IAP_REPOS_HOME/react-native-iap

# Download and regenerate types (uses versions from openiap-versions.json)
yarn generate:types

# Verify types
yarn typecheck
```

### 3. Native Code Modifications

#### iOS Native Code

**Location:** `ios/`

Key files to update:

- `ios/HybridRnIap.swift` - Main iOS implementation (wraps OpenIAP Swift)
- `ios/RnIapHelper.swift` - Helper utilities
- `ios/RnIapLog.swift` - Logging utilities
- `NitroIap.podspec` - CocoaPods spec

**When to modify:**

- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API signature changes
- Type conversion between Swift and Nitro

**Update workflow:**

```bash
cd $IAP_REPOS_HOME/react-native-iap

# 1. Update apple version in openiap-versions.json
# 2. Review openiap/packages/apple/Sources/ for changes
# 3. Update ios/HybridRnIap.swift accordingly
# 4. Update type-bridge.ts if new types need conversion

# Install updated pod
cd example/ios && bundle exec pod install --repo-update
```

#### Android Native Code

**Location:** `android/src/main/java/com/margelo/nitro/iap/`

Key files to update:

- `HybridRnIap.kt` - Main Android implementation (wraps OpenIAP Kotlin)
- `RnIapLog.kt` - Logging utilities

**When to modify:**

- New Android-specific API methods added to OpenIAP
- Play Billing API changes
- Type conversion between Kotlin and Nitro

**Update workflow:**

```bash
cd $IAP_REPOS_HOME/react-native-iap

# 1. Update google version in openiap-versions.json
# 2. Review openiap/packages/google/openiap/src/main/ for changes
# 3. Update android/.../HybridRnIap.kt accordingly
# 4. Update type-bridge.ts if new types need conversion
```

### 4. Nitro Bridge Updates

If types changed that affect the bridge:
```bash
# Regenerate Nitro bridge files
yarn specs

# Verify bridge code
yarn prepare
```

### 5. Build & Test Native Code

#### iOS Build Test

```bash
cd $IAP_REPOS_HOME/react-native-iap

# Install dependencies
yarn install

# Install pods for example
cd example/ios && bundle exec pod install --repo-update && cd ../..

# Build and run on simulator
yarn workspace rn-iap-example ios

# Or build via Xcode
open example/ios/RnIapExample.xcworkspace
# Build: Cmd+B, Run: Cmd+R
```

#### Android Build Test

```bash
cd $IAP_REPOS_HOME/react-native-iap

# Build and run on emulator
yarn workspace rn-iap-example android

# Or build via Android Studio
# Open example/android/ in Android Studio
# Build > Make Project
# Run > Run 'app'
```

#### Expo Example Test

```bash
cd $IAP_REPOS_HOME/react-native-iap/example-expo

bun setup
bun ios      # iOS simulator
bun android  # Android emulator
```

#### Android Horizon Build (Meta Quest)

```bash
cd $IAP_REPOS_HOME/react-native-iap/example

# Enable Horizon flavor in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Build with Horizon
yarn android

# Revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

### 6. Update Example Code

**React Native Example:** `example/`

Key screens to update:

- `example/src/screens/` - Main app screens
- `example/navigation/` - Navigation setup

**Expo Example:** `example-expo/app/`

### 7. Update Tests

**Location:** `src/__tests__/`

```bash
yarn test              # Unit tests
yarn test:all          # Library + example tests
yarn test:ci           # CI environment
yarn test:plugin       # Expo plugin tests
```

### 8. Update Documentation

**Location:** `docs/`
- Docusaurus site
- Package manager: Bun

### 9. Update llms.txt Files

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

### 10. Pre-commit Checklist

```bash
yarn typecheck        # TypeScript
yarn lint             # ESLint
yarn lint:prettier    # Prettier
yarn test             # Tests
```

## Type Conversion Flow

```
OpenIAP Types (openiap/packages/gql)
    ↓ (downloaded via update-types.mjs)
src/types.ts (auto-generated)
    ↓ (imported and type-aliased)
src/specs/RnIap.nitro.ts (Nitro spec)
    ↓ (generated by nitrogen tool)
nitrogen/generated/ (C++ bridge code)
    ↓ (converted by type-bridge utilities)
src/utils/type-bridge.ts (conversion functions)
    ↓ (exported as public API)
src/index.ts (cross-platform API)
```

## Naming Conventions

- **iOS-only:** `functionNameIOS` (e.g., `clearTransactionIOS`)
- **Android-only:** `functionNameAndroid` (e.g., `acknowledgePurchaseAndroid`)
- **Cross-platform:** No suffix (e.g., `fetchProducts`)
- **iOS types:** `ProductIOS`, `PurchaseIOS`
- **ID fields:** `Id` not `ID` (e.g., `productId`, `transactionId`)

## Deprecation Check

```bash
cd $IAP_REPOS_HOME/react-native-iap
grep -r "@deprecated" src/
grep -r "DEPRECATED" src/
```

## Error Handling

**Key files:**
- `src/utils/error.ts` - Error parsing
- `src/utils/errorMapping.ts` - Native error code mapping

Update if `ErrorCode` enum changes in OpenIAP.

## Commit Message Format

```
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **CLAUDE.md:** `$IAP_REPOS_HOME/react-native-iap/CLAUDE.md`
- **OpenIAP Docs:** https://openiap.dev/docs
- **react-native-iap Docs:** https://react-native-iap.dooboolab.com
