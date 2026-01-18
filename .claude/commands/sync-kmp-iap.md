# Sync Changes to kmp-iap

Synchronize OpenIAP changes to the [kmp-iap](https://github.com/hyochan/kmp-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/kmp-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/kmp-iap`

## CRITICAL: Mandatory Steps Checklist

**YOU MUST COMPLETE ALL THESE STEPS. DO NOT SKIP ANY.**

| Step | Required | Description |
|------|----------|-------------|
| 0. Pull Latest | **YES** | `git pull` before any work |
| 1. Analyze OpenIAP Changes | **YES** | Review what changed in openiap packages |
| 2. Sync Versions | **YES** | Update openiap-versions.json |
| 3. Generate Types | **YES** | `./scripts/generate-types.sh` |
| 4. Review Native Code | **YES** | Check if iOS/Android implementations need updates |
| 4.5. **Verify ObjC Bridge** | **YES (iOS)** | Check `OpenIapModule+ObjC.swift` matches Swift functions |
| 5. Update API Exports | **IF NEEDED** | Add new functions, type aliases, DSL builders |
| 6. Run All Checks | **YES** | `./gradlew build test detekt` |
| 7. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 8. Update llms.txt | **IF API CHANGED** | Update AI reference docs |
| 9. Commit & Push | **YES** | Create PR with proper format |

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
| `docs/blog/` | Release blog posts | NO |
| `docs/static/llms.txt` | AI reference (short) | NO |

---

## Sync Steps

### Step 0: Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/kmp-iap
git pull
```

---

### Step 1: Analyze OpenIAP Changes (REQUIRED)

**CRITICAL: Before syncing, understand what changed in the openiap monorepo.**

#### 1.1 Check Version Differences

```bash
echo "=== OpenIAP Monorepo Versions ==="
cat /Users/crossplatformkorea/Github/hyodotdev/openiap/openiap-versions.json

echo "=== kmp-iap Current Versions ==="
cat $IAP_REPOS_HOME/kmp-iap/openiap-versions.json
```

#### 1.2 Analyze GQL Schema Changes (Types)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log -10 --oneline -- packages/gql/
```

Look for:
- New types/interfaces added
- New fields on existing types
- Breaking changes to type signatures

#### 1.3 Analyze Apple Package Changes (iOS Native)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log -10 --oneline -- packages/apple/
```

Check `packages/apple/Sources/` for:
- New public functions in `OpenIapModule.swift`
- **CRITICAL: Corresponding updates in `OpenIapModule+ObjC.swift`** (see Step 4.5)
- New types in `Types.swift`
- Changes to serialization

#### 1.4 Analyze Google Package Changes (Android Native)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log -10 --oneline -- packages/google/
```

Check `packages/google/openiap/src/main/` for:
- New public functions in `OpenIapModule.kt`
- New types in `Types.kt`
- Changes to Billing Library integration

#### 1.5 Document Changes Found

Create a mental checklist:
- [ ] New types added?
- [ ] New API methods exposed?
- [ ] Breaking changes?
- [ ] Deprecations?
- [ ] Bug fixes?
- [ ] Platform version requirements changed?

---

### Step 2: Sync openiap-versions.json (REQUIRED)

Update kmp-iap's version tracking file to match openiap monorepo.

**Edit `openiap-versions.json`:**

```json
{
  "gql": "<match openiap's gql version>",
  "google": "<match openiap's google version>",
  "apple": "<match openiap's apple version>",
  "kmp-iap": "<current library version>"
}
```

---

### Step 3: Generate Types (REQUIRED)

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Download and regenerate types
./scripts/generate-types.sh

# Verify build
./gradlew :library:compileDebugKotlin
```

**Types Location:** `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt`

**Review what changed:**
```bash
git diff library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt | head -100
```

**Analyze the type diff carefully:**
- New data classes?
- New fields on existing classes?
- Changed field types?
- New enums or enum values?

---

### Step 4: Review Native Code (REQUIRED)

**CRITICAL: This step catches bugs that "type-only" syncs miss. DO NOT SKIP.**

You must verify that kmp-iap's implementations actually pass new options/fields to OpenIAP.

#### 4.1 Android Implementation Review

**Location:** `library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt`

**Verification steps:**

1. Check what new fields were added to request types:
   ```bash
   git diff library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt | grep -A5 "RequestPurchase\|PurchaseOptions"
   ```

2. **CRITICAL**: Check if kmp-iap's Android implementation passes options to OpenIAP:
   ```bash
   # Look for functions that might need options parameter updates
   grep -n "openIap\.\|getAvailablePurchases" library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt | head -20
   ```

3. Verify options are forwarded:
   ```bash
   # Check implementation methods
   grep -A10 "getAvailablePurchases\|suspend fun" library/src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt | head -50
   ```

**Android often requires explicit option passing - don't assume it works!**

#### 4.2 iOS Implementation Review

**Location:** `library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt`

**Verification steps:**

1. Check what new fields were added to iOS types:
   ```bash
   git diff library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt | grep -A5 "IOS"
   ```

2. Verify kmp-iap passes these fields to OpenIAP:
   ```bash
   # Check Swift interop calls
   grep -n "openIap\.\|requestPurchase\|getAvailable" library/src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt | head -20
   ```

3. Check cinterop if Swift API signature changed:
   ```bash
   # Review cinterop declarations
   cat library/src/nativeInterop/cinterop/*.def
   ```

#### 4.3 Common API Review

**Location:** `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/KmpIap.kt`

Check if common interface exposes new options:

```bash
# Check if new options fields are included in the interface
grep -A10 "getAvailablePurchases\|suspend fun" library/src/commonMain/kotlin/io/github/hyochan/kmpiap/KmpIap.kt
```

**If a new option exists in types but isn't passed in the implementation, IT WON'T WORK!**

#### 4.5 Objective-C Bridge Verification (CRITICAL for kmp-iap)

**kmp-iap uses the Objective-C bridge to call Swift functions from Kotlin via cinterop.**

**Location:** `packages/apple/Sources/OpenIapModule+ObjC.swift`

**This is the #1 cause of iOS sync failures in kmp-iap.**

**Verification steps:**

1. Compare Swift functions with ObjC bridge:
   ```bash
   # List all public Swift async functions
   grep -n "public func\|public static func" /Users/crossplatformkorea/Github/hyodotdev/openiap/packages/apple/Sources/OpenIapModule.swift | head -30

   # List all ObjC bridge functions
   grep -n "@objc func" /Users/crossplatformkorea/Github/hyodotdev/openiap/packages/apple/Sources/OpenIapModule+ObjC.swift | head -30
   ```

2. **For EACH new/modified Swift function**, verify:
   - [ ] ObjC wrapper exists in `OpenIapModule+ObjC.swift`
   - [ ] All parameters are forwarded correctly
   - [ ] Return type is serialized via `OpenIapSerialization.encode()`
   - [ ] New input options are passed (not hardcoded to `nil`)

3. Check for missing bridges:
   ```bash
   # Find Swift functions that might be missing ObjC bridges
   # Compare the counts - they should roughly match
   echo "Swift public functions:"
   grep -c "public func" /Users/crossplatformkorea/Github/hyodotdev/openiap/packages/apple/Sources/OpenIapModule.swift

   echo "ObjC bridge functions:"
   grep -c "@objc func" /Users/crossplatformkorea/Github/hyodotdev/openiap/packages/apple/Sources/OpenIapModule+ObjC.swift
   ```

**ObjC Bridge Pattern:**

```swift
// Swift async function (OpenIapModule.swift)
public func newFeatureIOS(option: NewOption?) async throws -> ResultType

// ObjC bridge wrapper (OpenIapModule+ObjC.swift) - MUST EXIST
@objc func newFeatureIOSWithOption(
    _ option: [String: Any]?,
    completion: @escaping (Any?, Error?) -> Void
) {
    Task {
        do {
            let parsedOption = option.flatMap { NewOption.from($0) }
            let result = try await newFeatureIOS(option: parsedOption)
            let dictionary = OpenIapSerialization.encode(result)
            completion(dictionary, nil)
        } catch {
            completion(nil, error)
        }
    }
}
```

**Common ObjC bridge issues:**
- New Swift function added but no ObjC wrapper → kmp-iap can't call it
- New parameter added to Swift but ObjC wrapper passes `nil` → feature doesn't work
- Swift signature changed but ObjC wrapper not updated → compile error or runtime crash

#### 4.6 Decision Matrix (Updated)

| Change Type | Action Required |
|-------------|-----------------|
| New types only (response types) | NO code change - OpenIAP returns them automatically |
| New Swift function | **CHECK ObjC bridge** - wrapper must exist |
| New INPUT option fields | **CHECK** - verify implementations pass the option |
| New API function | YES - add to interface + both platform implementations |
| Breaking type change | YES - check serialization compatibility |
| New platform feature | YES - add to interface + platform impl + DSL |

**Common mistakes to catch:**
- Interface has the option but Android/iOS implementation passes `null`
- Android implementation doesn't read the new option from params
- iOS cinterop doesn't map the new Swift parameter

---

### Step 5: Update API (IF NEEDED)

If new API functions or options were added:

#### 5.1 Update Type Aliases

**Location:** `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/KmpIap.kt`

```kotlin
typealias NewType = io.github.hyochan.kmpiap.openiap.NewType
```

#### 5.2 Update DSL Builders

**Location:** `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/dsl/PurchaseDsl.kt`

```kotlin
class NewRequestBuilder {
    // ...
}
```

#### 5.3 Update Error Mapping

**Location:** `library/src/commonMain/kotlin/io/github/hyochan/kmpiap/utils/ErrorMapping.kt`

If error codes changed.

---

### Step 6: Run All Checks (REQUIRED)

**ALL checks must pass before proceeding.**

```bash
cd $IAP_REPOS_HOME/kmp-iap

# All tests
./gradlew :library:test

# Full library build
./gradlew :library:build

# Code quality
./gradlew :library:detekt

# Or all at once
./gradlew :library:test :library:build :library:detekt
```

**If any check fails, fix before continuing.**

---

### Step 7: Write Blog Post (REQUIRED)

**Every sync MUST have a blog post documenting the changes.**

#### 7.1 Create Blog Post File

**Location:** `docs/blog/`

**Filename format:** `YYYY-MM-DD-<version>-<short-description>.md`

#### 7.2 Blog Post Template

```markdown
---
slug: <version>-<short-slug>
title: <version> - <Short Title>
authors: [hyochan]
tags: [release, openiap, kmp, <platform-tags>]
date: YYYY-MM-DD
---

# <version> Release Notes

This release syncs with [OpenIAP v<gql-version>](https://www.openiap.dev/docs/updates/notes#<anchor>).

## New Features

### <Feature Name> (<Platform> <Version>+)

<Description of the feature>

```kotlin
// Example usage
kmpIapInstance.requestSubscription {
    ios {
        sku = "premium_monthly"
        // new option
    }
}
```

## Bug Fixes

- <Fix description>

## OpenIAP Versions

| Package | Version |
|---------|---------|
| openiap-gql | <version> |
| openiap-google | <version> |
| openiap-apple | <version> |

For detailed changes, see the [OpenIAP Release Notes](https://www.openiap.dev/docs/updates/notes#<anchor>).
```

#### 7.3 Blog Post Guidelines

- **New features**: Explain what they do, show example code, note platform requirements
- **Breaking changes**: MUST have migration guide with before/after code
- **Type-only changes**: Still document, mention "Kotlin types updated"
- **Bug fixes**: List what was fixed
- **Always link**: Link to OpenIAP release notes

---

### Step 8: Update llms.txt (IF API CHANGED)

**Location:** `docs/static/llms.txt` and `docs/static/llms-full.txt`

Update if:
- New API functions added
- Function signatures changed
- New types developers need to know about
- DSL builders updated

---

### Step 9: Commit and Push (REQUIRED)

#### 9.1 Create Feature Branch

```bash
cd $IAP_REPOS_HOME/kmp-iap

git checkout -b feat/openiap-sync-<gql-version>
```

#### 9.2 Commit with Descriptive Message

```bash
git commit -m "$(cat <<'EOF'
feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <ver>, apple: <ver>, google: <ver>)
- Regenerate Kotlin types
- <List specific new features/changes>
- Add release blog post
- <Any other changes made>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

#### 9.3 Push to Remote

```bash
git push -u origin feat/openiap-sync-<gql-version>
```

---

## API Patterns

### Global Instance Pattern
```kotlin
val products = kmpIapInstance.fetchProducts {
    skus = listOf("product_id")
    type = ProductQueryType.InApp
}
```

### Platform-Specific DSL
```kotlin
val purchase = kmpIapInstance.requestPurchase {
    ios { sku = "product_id"; quantity = 1 }
    android { skus = listOf("product_id") }
}
```

---

## Naming Conventions

- **IAP suffix:** For types contrasting with iOS (e.g., `IapPurchase`)
- **ID fields:** Always `Id` (e.g., `productId`, `transactionId`)
- **iOS types:** `IOS` suffix when iOS-specific
- **Android types:** `Android` suffix when Android-specific

---

## References

- **CLAUDE.md:** `$IAP_REPOS_HOME/kmp-iap/CLAUDE.md`
- **CONVENTION.md:** `$IAP_REPOS_HOME/kmp-iap/CONVENTION.md`
- **OpenIAP Docs:** https://openiap.dev/docs
