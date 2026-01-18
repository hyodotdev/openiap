# Sync Changes to kmp-iap

Synchronize OpenIAP changes to the [kmp-iap](https://github.com/hyochan/kmp-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/kmp-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))

## Project Overview

- **Build Tool:** Gradle (Kotlin Multiplatform)
- **Framework:** Kotlin Multiplatform (KMP)
- **Targets:** Android, iOS (arm64, x64, simulator-arm64)
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `library/src/commonMain/.../openiap/Types.kt` | Kotlin types from OpenIAP | YES |
| `library/src/commonMain/.../KmpIap.kt` | Main interface & type aliases | NO |
| `library/src/androidMain/.../InAppPurchaseAndroid.kt` | Android implementation | NO |
| `library/src/iosMain/.../InAppPurchaseIOS.kt` | iOS implementation | NO |
| `library/src/commonMain/.../dsl/PurchaseDsl.kt` | DSL builders | NO |
| `library/src/commonMain/.../utils/ErrorMapping.kt` | Error code mapping | NO |
| `openiap-versions.json` | Version tracking | NO |

## Version File Structure

```json
{
  "gql": "1.2.5",         // GraphQL schema version (for Types.kt)
  "google": "1.3.7",      // Android openiap-google version
  "apple": "1.2.39",      // iOS openiap pod version
  "kmp-iap": "1.0.0-rc.6" // This library version
}
```

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/kmp-iap
git pull
```

### 1. Sync openiap-versions.json (REQUIRED)

**IMPORTANT:** Before generating types, sync version numbers from openiap monorepo.

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Check current versions in openiap monorepo
cat $OPENIAP_HOME/openiap/openiap-versions.json

# Update kmp-iap's openiap-versions.json to match:
# - "gql": should match openiap's "gql" version
# - "apple": should match openiap's "apple" version
# - "google": should match openiap's "google" version
```

**Version fields to sync:**
| Field | Source | Purpose |
|-------|--------|---------|
| `gql` | `$OPENIAP_HOME/openiap/openiap-versions.json` | Kotlin types version |
| `apple` | `$OPENIAP_HOME/openiap/openiap-versions.json` | iOS native SDK version |
| `google` | `$OPENIAP_HOME/openiap/openiap-versions.json` | Android native SDK version |

### 2. Type Synchronization

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Download and regenerate types (uses versions from openiap-versions.json)
./scripts/generate-types.sh

# Verify build
./gradlew :library:compileDebugKotlin
```

**Types Location:** `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt`

### 3. Native Code Modifications

#### Android Implementation

**Location:** `library/src/androidMain/kotlin/io/github/hyochan/kmpiap/`

Key files to update:

- `InAppPurchaseAndroid.kt` (879 lines) - Main Android implementation
- `Helper.kt` (312 lines) - Android utility functions
- `Platform.kt` - Platform detection
- `KmpIAP.android.kt` - Android entry point

**When to modify:**

- New Android-specific API methods added to OpenIAP
- Play Billing API changes
- Type mapping changes

**Update workflow:**

```bash
cd $IAP_REPOS_HOME/kmp-iap

# 1. Update google version in openiap-versions.json
# 2. Review openiap/packages/google/openiap/src/main/ for changes
# 3. Update library/src/androidMain/.../InAppPurchaseAndroid.kt
# 4. Update Helper.kt for new type conversions
```

#### iOS Implementation

**Location:** `library/src/iosMain/kotlin/io/github/hyochan/kmpiap/`

Key files to update:

- `InAppPurchaseIOS.kt` (880 lines) - Main iOS implementation
- `Platform.kt` - Platform detection
- `KmpIAP.ios.kt` - iOS entry point
- `nativeInterop/cinterop/` - C-Interop declarations for Swift

**When to modify:**

- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API changes
- Swift interop changes

**Update workflow:**

```bash
cd $IAP_REPOS_HOME/kmp-iap

# 1. Update apple version in openiap-versions.json
# 2. Review openiap/packages/apple/Sources/ for changes
# 3. Update library/src/iosMain/.../InAppPurchaseIOS.kt
# 4. Update cinterop if Swift API signature changed
```

### 4. Build & Test Native Code

#### Android Build Test

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Compile Android library
./gradlew :library:compileDebugKotlin
./gradlew :library:compileReleaseKotlin

# Build example app
./gradlew :example:composeApp:assembleDebug

# Run Android tests
./gradlew :library:testDebugUnitTest

# Run on emulator (from Android Studio)
# Open in Android Studio, run example/composeApp
```

#### iOS Build Test

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Build iOS framework
./gradlew :library:linkDebugFrameworkIosSimulatorArm64
./gradlew :library:linkReleaseFrameworkIosArm64

# Build example iOS app
cd example/iosApp
pod install --repo-update

# Build via Xcode
xcodebuild -workspace iosApp.xcworkspace \
  -scheme iosApp \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build

# Or open in Xcode and build
open iosApp.xcworkspace
```

#### Full Build Matrix

```bash
cd $IAP_REPOS_HOME/kmp-iap

# All tests
./gradlew :library:test

# Full library build
./gradlew :library:build

# Code quality
./gradlew :library:detekt

# Publish locally for testing
./gradlew publishToMavenLocal
```

### 5. Update Type Aliases

If new types added, update `KmpIap.kt`:
```kotlin
typealias NewType = io.github.hyochan.kmpiap.openiap.NewType
```

### 6. Update DSL Builders

If new request types added, update `dsl/PurchaseDsl.kt`:
```kotlin
class NewRequestBuilder {
    // ...
}
```

### 7. Update Example Code (REQUIRED)

**Location:** `example/composeApp/`
- Compose Multiplatform shared UI
- iOS app: `example/iosApp/`

**Example Code Guidelines:**
- Demonstrate ALL new API features with working code
- Show both success and error handling
- Include comments explaining the feature
- Use realistic SKU names and user flows

**Example for new iOS feature (e.g., Win-Back Offer):**
```kotlin
// In Example app Compose UI
Button(onClick = {
    scope.launch {
        val result = kmpIapInstance.requestSubscription {
            ios {
                sku = "premium_monthly"
                winBackOffer = WinBackOfferInputIOS(offerId = "winback_50_off")  // iOS 18+
            }
        }
        println("Win-back applied: $result")
    }
}) {
    Text("Apply Win-Back Offer")
}
```

**Example for new Android feature (e.g., Product Status):**
```kotlin
// In Example app Compose UI
products.forEach { product ->
    product.productStatusAndroid?.let { status ->
        when (status) {
            ProductStatusAndroid.Ok -> { /* Show product */ }
            ProductStatusAndroid.NotFound -> { /* Show error */ }
            ProductStatusAndroid.NoOffersAvailable -> { /* Show ineligible message */ }
            else -> { /* Handle unknown */ }
        }
    }
}
```

### 8. Update Tests

**Location:** `library/src/commonTest/`

```bash
./gradlew :library:test
./gradlew :library:build
```

### 9. Update Documentation (REQUIRED)

**Location:** `docs/`
- `docs/docs/api/` - API documentation
- `docs/docs/types/` - Type definitions
- `docs/docs/examples/` - Code examples
- `docs/docs/guides/` - Usage guides

**Documentation Checklist:**

For each new feature synced from openiap:

- [ ] **CHANGELOG.md** - Add entry for new version
- [ ] **API docs** - Function added with signature, params, return type
- [ ] **Type docs** - New types documented with all fields explained
- [ ] **Example code** - Working examples in documentation
- [ ] **Platform notes** - Version requirements (e.g., "iOS 18+", "Billing 8.0+")
- [ ] **Migration notes** - Breaking changes documented

**Example Documentation Entry:**
```mdx
## requestSubscription

### Win-Back Offers (iOS 18+)

Win-back offers re-engage churned subscribers:

```kotlin
kmpIapInstance.requestSubscription {
    ios {
        sku = "premium_monthly"
        winBackOffer = WinBackOfferInputIOS(offerId = "winback_50_off")
    }
}
```
```

### 10. Update llms.txt Files

**Location:** `docs/static/`

Update AI-friendly documentation files when APIs or types change:

- `docs/static/llms.txt` - Quick reference for AI assistants
- `docs/static/llms-full.txt` - Detailed AI reference

**When to update:**

- New API functions added
- Function signatures changed
- New types or enums added
- DSL builders updated
- Error codes changed

**Content to sync:**

1. Installation (Gradle dependencies)
2. Core API reference (KmpIAP interface, DSL patterns)
3. Key types (Product, Purchase, ErrorCode)
4. Platform-specific patterns (ios/android DSL blocks)
5. Error handling examples

### 11. Pre-commit Checklist

```bash
./gradlew :library:test
./gradlew :library:build
./gradlew :library:detekt
```

**Full Sync Checklist:**

- [ ] openiap-versions.json synced
- [ ] Types regenerated (`./scripts/generate-types.sh`)
- [ ] Type aliases updated in `KmpIap.kt`
- [ ] DSL builders updated if new request types
- [ ] Native implementations updated (iOS/Android)
- [ ] Example code demonstrates new features
- [ ] Tests pass
- [ ] Documentation updated
- [ ] llms.txt files updated

### 12. Commit and Push

After completing all sync steps, create a branch and commit the changes:

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Create feature branch with version number
git checkout -b feat/openiap-sync-<gql-version>

# Example: feat/openiap-sync-1.3.12

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <version>, apple: <version>, google: <version>)
- Regenerate Kotlin types
- Update example code for new types
- Update documentation and llms.txt
- Add/update tests for new features

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push to remote
git push -u origin feat/openiap-sync-<gql-version>
```

**Branch naming conventions:**
- Feature sync: `feat/openiap-sync-<version>` (e.g., `feat/openiap-sync-1.3.12`)
- Specific feature: `feat/<feature-name>` (e.g., `feat/discount-offer-types`)
- Bug fix: `fix/<issue-description>` (e.g., `fix/subscription-offer-parsing`)

## API Patterns

### Global Instance Pattern
```kotlin
val products = kmpIapInstance.fetchProducts {
    skus = listOf("product_id")
    type = ProductQueryType.InApp
}
```

### Constructor Pattern (for testing)
```kotlin
val kmpIAP = KmpIAP()
kmpIAP.initConnection()
```

### Platform-Specific DSL
```kotlin
val purchase = kmpIapInstance.requestPurchase {
    ios { sku = "product_id"; quantity = 1 }
    android { skus = listOf("product_id") }
}
```

## Naming Conventions

- **IAP suffix:** For types contrasting with iOS (e.g., `IapPurchase`)
- **ID fields:** Always `Id` (e.g., `productId`, `transactionId`)
- **iOS types:** `IOS` suffix when iOS-specific
- **Android types:** `Android` suffix when Android-specific

## Deprecation Check

```bash
cd $IAP_REPOS_HOME/kmp-iap
grep -r "@Deprecated" library/src/
grep -r "DEPRECATED" library/src/
```

## Build Commands

```bash
# Type generation
./scripts/generate-types.sh

# Building
./gradlew :library:build
./gradlew :library:compileDebugKotlin
./gradlew :example:composeApp:assembleDebug

# Testing
./gradlew :library:test

# Publishing
./gradlew publishAllPublicationsToMavenCentral
```

## Commit Message Format

```
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **CLAUDE.md:** `$IAP_REPOS_HOME/kmp-iap/CLAUDE.md`
- **CONVENTION.md:** `$IAP_REPOS_HOME/kmp-iap/CONVENTION.md`
- **OpenIAP Docs:** https://openiap.dev/docs
