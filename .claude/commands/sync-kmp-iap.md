# Sync Changes to kmp-iap

Synchronize OpenIAP changes to the [kmp-iap](https://github.com/hyochan/kmp-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/kmp-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/kmp-iap`

## Usage

```bash
/sync-kmp-iap [--patch | --minor | --major]
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
| 7. **Verify Tests** | **YES** | Ensure tests cover new features/field changes |
| 8. **Verify Example Code** | **YES** | Check example app uses correct API patterns |
| 9. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 10. **Verify llms.txt** | **YES** | Always review and update AI reference docs |
| 11. Commit & Push | **YES** | Create PR with proper format |

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

### Step 7: Verify Tests (REQUIRED)

**CRITICAL: All tests must cover new features and field name changes. DO NOT SKIP.**

#### 7.1 Check Existing Test Coverage

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Find all test files
find . -name "*Test.kt" -o -name "*Tests.kt"

# Check test coverage for types
grep -rn "fun.*test" library/src/commonTest/ library/src/androidTest/ library/src/iosTest/ 2>/dev/null
```

#### 7.2 Verify New Features Are Tested

For each new type or field added in the sync:

1. **Check if tests exist for new types:**
   ```kotlin
   // Example: If RequestPurchaseAndroidProps got new field 'offerToken'
   // Test file should have:
   @Test
   fun `test RequestPurchaseAndroidProps with offerToken`() {
       val props = RequestPurchaseAndroidProps(
           sku = "test_sku",
           offerToken = "test_token"  // New field must be tested
       )
       assertNotNull(props.offerToken)
   }
   ```

2. **Check if serialization is tested:**
   ```kotlin
   @Test
   fun `test type serialization round trip`() {
       val original = NewType(newField = "value")
       val json = Json.encodeToString(original)
       val restored = Json.decodeFromString<NewType>(json)
       assertEquals(original.newField, restored.newField)
   }
   ```

#### 7.3 Add Missing Tests

If tests don't exist for new features:

1. Create test file in `library/src/commonTest/kotlin/`
2. Add tests for:
   - Type instantiation with new fields
   - JSON serialization includes new fields
   - JSON deserialization parses new fields
   - Default values for optional fields
   - Platform-specific DSL builders

#### 7.4 Run All Tests

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Run all tests
./gradlew :library:test

# Verify all tests pass
./gradlew :library:check
```

**If tests fail, fix before continuing.**

---

### Step 8: Verify Example Code (REQUIRED)

**CRITICAL: Example app must demonstrate correct API usage. DO NOT SKIP.**

#### 8.1 Check Example App

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Find example app code
find . -path "*/sample/*" -name "*.kt" -o -path "*/example/*" -name "*.kt"

# Check how API is used
grep -rn "kmpIapInstance\|requestPurchase\|fetchProducts" sample/ example/ 2>/dev/null
```

#### 8.2 Verify API Patterns

Check that example code uses correct patterns:

```kotlin
// CORRECT - Uses new field names (simplified naming)
kmpIapInstance.requestPurchase {
    android {
        skus = listOf("premium_upgrade")
        offerToken = selectedOffer.offerToken  // Input field: NO suffix
        isOfferPersonalized = true              // Input field: NO suffix
    }
}

// INCORRECT - Old naming convention
kmpIapInstance.requestPurchase {
    android {
        offerTokenAndroid = token  // WRONG: input fields don't have suffix
    }
}
```

#### 8.3 Update Outdated Examples

If examples use outdated patterns:

1. Update to use new field names
2. Add KDoc comments explaining new features
3. Verify example compiles without errors

#### 8.4 Build Example App

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Build sample/example app
./gradlew :sample:build 2>/dev/null || ./gradlew :example:build 2>/dev/null

# Verify no compilation errors
```

---

### Step 9: Write Blog Post (REQUIRED)

**Every sync MUST have a blog post documenting the changes.**

#### 9.1 Create Blog Post File

**Location:** `docs/blog/`

**Filename format:** `YYYY-MM-DD-<version>-<short-description>.md`

#### 9.2 Blog Post Template

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

#### 9.3 Blog Post Guidelines

- **New features**: Explain what they do, show example code, note platform requirements
- **Breaking changes**: MUST have migration guide with before/after code
- **Type-only changes**: Still document, mention "Kotlin types updated"
- **Bug fixes**: List what was fixed
- **Always link**: Link to OpenIAP release notes

---

### Step 10: Verify and Update llms.txt (REQUIRED)

**CRITICAL: Always review and update AI reference documentation. DO NOT SKIP.**

**Location:** `docs/static/llms.txt` and `docs/static/llms-full.txt`

#### 10.1 Check Current llms.txt

```bash
cd $IAP_REPOS_HOME/kmp-iap

# Review current AI reference docs
cat docs/static/llms.txt 2>/dev/null || echo "llms.txt not found"
cat docs/static/llms-full.txt 2>/dev/null || echo "llms-full.txt not found"
```

#### 10.2 Verify Documentation Accuracy

Check that llms.txt includes:

1. **All public API functions:**
   ```bash
   # List public functions in KmpIap interface
   grep -n "suspend fun\|fun " library/src/commonMain/kotlin/io/github/hyochan/kmpiap/KmpIap.kt

   # Compare with llms.txt
   grep -c "fun" docs/static/llms.txt
   ```

2. **Correct type definitions:**
   - New types added in this sync
   - Updated field names (input fields NO suffix, response fields WITH suffix)
   - Correct method signatures

3. **Updated DSL examples:**
   - Examples use new field names
   - Examples demonstrate new features
   - Platform-specific builders are documented

#### 10.3 Update llms.txt Content

If API changed, update:
- Function signatures
- Type definitions
- DSL builder patterns
- Usage examples
- Platform-specific notes

#### 10.4 Sync llms.txt and llms-full.txt

Ensure both files are consistent:
- `llms.txt`: Concise API reference
- `llms-full.txt`: Detailed documentation with examples

---

### Step 11: Commit and Push (REQUIRED)

#### 11.1 Create Feature Branch

```bash
cd $IAP_REPOS_HOME/kmp-iap

git checkout -b feat/openiap-sync-<gql-version>
```

#### 11.2 Commit with Descriptive Message

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

#### 11.3 Push to Remote

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

## Version Bump & Versioned Docs

### Automatic Version Determination

Based on the `--patch`, `--minor`, or `--major` argument passed to the sync command.

### Versioned Docs (REQUIRED for Minor/Major)

**CRITICAL: For `--minor` or `--major` version bumps, you MUST create versioned documentation.**

Docusaurus versioned docs preserve documentation for previous versions so users on older SDK versions can reference the correct API.

#### Step 1: Create Version Snapshot

Before updating docs for the new version, snapshot the current docs:

```bash
cd $IAP_REPOS_HOME/kmp-iap/docs

# Create a versioned snapshot (e.g., if current is 1.2, new minor will be 1.3)
npm run docusaurus docs:version <CURRENT_VERSION>

# Example: If bumping from 1.2 to 1.3
npm run docusaurus docs:version 1.2
```

This creates:
- `versioned_docs/version-1.2/` - Copy of current documentation
- `versioned_sidebars/version-1.2-sidebars.json` - Sidebar config for that version
- Updates `versions.json` with the new version entry

#### Step 2: Update docusaurus.config.ts

Add the new version to the versions config:

```typescript
// docs/docusaurus.config.ts
versions: {
  current: {
    label: '1.3 (Current)',  // Update to new version
    path: '',
  },
  '1.2': {                   // Add previous version
    label: '1.2',
    path: '1.2',
  },
  // ... older versions
},
```

#### Step 3: Update Current Docs

Now update `docs/docs/` with new API documentation for the new version.

#### When NOT to Create Versioned Docs

- `--patch` version bumps (bug fixes, type-only changes)
- Changes that don't affect user-facing API documentation

### Version Bump Checklist

| Bump Type | Create Versioned Docs | Update docusaurus.config.ts | Update Current Docs |
|-----------|----------------------|----------------------------|---------------------|
| `--patch` | NO | NO | If API docs changed |
| `--minor` | **YES** | **YES** | **YES** |
| `--major` | **YES** | **YES** | **YES** |

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
