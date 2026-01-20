# Sync Changes to flutter_inapp_purchase

Synchronize OpenIAP changes to the [flutter_inapp_purchase](https://github.com/hyochan/flutter_inapp_purchase) repository.

**Target Repository:** `$IAP_REPOS_HOME/flutter_inapp_purchase`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/flutter_inapp_purchase`

## Usage

```bash
/sync-flutter-iap [--patch | --minor | --major]
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
| 3. Generate Types | **YES** | `./scripts/generate-type.sh` |
| 4. Review Native Code | **YES** | Check if iOS/Android plugins need updates |
| 5. Update API Exports | **IF NEEDED** | Add new functions to main class |
| 6. Run All Checks | **YES** | `flutter analyze`, `flutter test` |
| 7. **Verify Tests** | **YES** | Ensure tests cover new features/field changes |
| 8. **Verify Example Code** | **YES** | Check `example/` app uses correct API patterns |
| 9. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 10. **Verify llms.txt** | **YES** | Always review and update AI reference docs |
| 11. Commit & Push | **YES** | Create PR with proper format |

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
| `ios/Classes/FlutterInappPurchasePlugin.swift` | iOS implementation | NO |
| `android/.../FlutterInappPurchasePlugin.kt` | Android implementation | NO |
| `openiap-versions.json` | Version tracking | NO |
| `docs/blog/` | Release blog posts | NO |
| `docs/static/llms.txt` | AI reference (short) | NO |
| `docs/static/llms-full.txt` | AI reference (detailed) | NO |

---

## Sync Steps

### Step 0: Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase
git pull
```

---

### Step 1: Analyze OpenIAP Changes (REQUIRED)

**CRITICAL: Before syncing, understand what changed in the openiap monorepo.**

#### 1.1 Check Version Differences

```bash
echo "=== OpenIAP Monorepo Versions ==="
cat /Users/crossplatformkorea/Github/hyodotdev/openiap/openiap-versions.json

echo "=== flutter_inapp_purchase Current Versions ==="
cat $IAP_REPOS_HOME/flutter_inapp_purchase/openiap-versions.json
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

Update flutter_inapp_purchase's version tracking file to match openiap monorepo.

**Edit `openiap-versions.json`:**

```json
{
  "apple": "<match openiap's apple version>",
  "google": "<match openiap's google version>",
  "gql": "<match openiap's gql version>"
}
```

---

### Step 3: Generate Types (REQUIRED)

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase

# Download and regenerate types
./scripts/generate-type.sh

# Verify
flutter analyze
```

**Types Location:** `lib/types.dart` (4,325+ lines, auto-generated)

**Review what changed:**
```bash
git diff lib/types.dart | head -100
```

**Analyze the type diff carefully:**
- New classes?
- New fields on existing classes?
- Changed field types?
- New enums or enum values?

---

### Step 4: Review Native Code (REQUIRED)

**CRITICAL: This step catches bugs that "type-only" syncs miss. DO NOT SKIP.**

You must verify that flutter_inapp_purchase's native code actually passes new options/fields to OpenIAP.

#### 4.1 iOS Native Code Review

**Location:** `ios/Classes/FlutterInappPurchasePlugin.swift`

**Verification steps:**

1. Check what new fields were added to request types:
   ```bash
   git diff lib/types.dart | grep -A5 "RequestPurchaseIosProps\|RequestSubscriptionIosProps\|PurchaseOptions"
   ```

2. Verify flutter plugin passes these fields to OpenIAP:
   ```bash
   # Check method channel handlers
   grep -n "requestPurchase\|getAvailablePurchases" ios/Classes/FlutterInappPurchasePlugin.swift
   ```

**When to modify:**
- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API changes
- Type conversion between Swift and Dart
- New method channels needed

#### 4.2 Android Native Code Review

**Location:** `android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/FlutterInappPurchasePlugin.kt`

**Verification steps:**

1. Check what new fields were added to Android types:
   ```bash
   git diff lib/types.dart | grep -A5 "Android"
   ```

2. **CRITICAL**: Check if flutter plugin's native functions pass options to OpenIAP:
   ```bash
   # Look for functions that might need options parameter updates
   grep -n "openIap\.\|getAvailablePurchases" android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/FlutterInappPurchasePlugin.kt | head -20
   ```

3. Verify options are forwarded:
   ```bash
   # Check method channel handlers
   grep -A10 "getAvailablePurchases\|when.*call.method" android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/FlutterInappPurchasePlugin.kt
   ```

**Android often requires explicit option passing - don't assume it works!**

#### 4.3 Dart API Review

**Location:** `lib/flutter_inapp_purchase.dart`, `lib/helpers.dart`

Check if Dart API passes new options to native:

```bash
# Check if new options fields are included in the method channel call
grep -A20 "getAvailablePurchases" lib/flutter_inapp_purchase.dart
```

**If a new option exists in types but isn't passed in the Dart/native layer, IT WON'T WORK!**

#### 4.4 Decision Matrix (Updated)

| Change Type | Action Required |
|-------------|-----------------|
| New types only (response types) | NO code change - OpenIAP returns them automatically |
| New INPUT option fields | **CHECK** - verify native code passes the option |
| New API function | YES - add method channel in both native + Dart |
| Breaking type change | YES - check serialization compatibility |
| New platform feature | YES - add method channel + expose to Dart |

**Common mistakes to catch:**
- Dart has the option in types, but native code doesn't read it from the method call arguments
- Android native doesn't parse the new option from the HashMap
- Method channel name mismatch

---

### Step 5: Update API (IF NEEDED)

If new API functions were added:

#### 5.1 Update `lib/flutter_inapp_purchase.dart`

Add new methods to the main class.

#### 5.2 Update `lib/helpers.dart`

Add type conversion for new types:
- JSON to object conversions
- Platform-specific logic
- Type transformations

#### 5.3 Update `lib/errors.dart`

If error codes changed:
- Platform error code mappings
- Exception classes

---

### Step 6: Run All Checks (REQUIRED)

**ALL checks must pass before proceeding.**

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase

# Format (excludes types.dart)
git ls-files '*.dart' | grep -v '^lib/types.dart$' | xargs dart format --page-width 80 --output=none --set-exit-if-changed

# Lint
flutter analyze

# Test
flutter test

# Or run all checks
./scripts/pre-commit-checks.sh
```

**If any check fails, fix before continuing.**

---

### Step 7: Verify Tests (REQUIRED)

**CRITICAL: Tests MUST cover any new features or field name changes. DO NOT SKIP.**

#### 7.1 Check Existing Tests

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase

# List test files
ls -la test/

# Check test coverage for changed types/features
grep -r "offerToken\|DiscountOffer\|SubscriptionOffer" test/
```

#### 7.2 Required Test Coverage

For new features or field changes, verify or add tests for:

- **Type serialization/deserialization**: Test `fromJson`/`toJson` roundtrips
- **Input field naming**: Test that input types use correct field names (no suffix for Android-specific input types)
- **Response field naming**: Test that response types use correct field names (with Android suffix for cross-platform types)
- **Builder patterns**: Test that builders use correct field names

#### 7.3 Add Missing Tests

If tests don't exist for new features:

```dart
// test/standardized_offer_types_test.dart
void main() {
  group('DiscountOffer', () {
    test('should have correct structure with Android-specific fields', () {
      final offer = DiscountOffer(
        id: 'summer_sale',
        displayPrice: '\$4.99',
        price: 4.99,
        currency: 'USD',
        type: DiscountOfferType.OneTime,
        offerTokenAndroid: 'token123', // Response field WITH suffix
      );
      expect(offer.offerTokenAndroid, 'token123');
    });
  });

  group('RequestPurchaseAndroidProps', () {
    test('should use simplified input field names', () {
      // Input fields WITHOUT suffix (parent type indicates platform)
      final request = RequestPurchaseAndroidProps(
        skus: ['sku1'],
        obfuscatedAccountId: 'account123', // NO suffix
        offerToken: 'token123',            // NO suffix
      );
      expect(request.offerToken, 'token123');
    });
  });
}
```

#### 7.4 Run Tests

```bash
flutter test
```

---

### Step 8: Verify Example Code (REQUIRED)

**CRITICAL: Example app MUST demonstrate correct API usage patterns. DO NOT SKIP.**

#### 8.1 Check Example App

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase/example

# Check for usage of new features
grep -r "offerToken\|DiscountOffer\|subscriptionOffers" lib/
```

#### 8.2 Verify API Patterns

Ensure example code follows correct patterns:

```dart
// ✅ CORRECT: Input fields without Android suffix
final props = RequestPurchaseProps.inApp((
  apple: RequestPurchaseIosProps(sku: 'product_id'),
  google: RequestPurchaseAndroidProps(
    skus: ['product_id'],
    offerToken: offer.offerTokenAndroid, // Input: no suffix
    obfuscatedAccountId: 'account123',   // Input: no suffix
  ),
  useAlternativeBilling: null,
));

// ❌ WRONG: Using Android suffix on input fields (old naming)
final wrongProps = RequestPurchaseAndroidProps(
  skus: ['product_id'],
  offerTokenAndroid: 'token', // WRONG! Old naming
  obfuscatedAccountIdAndroid: 'account', // WRONG! Old naming
);
```

#### 8.3 Update Example If Needed

If example code uses deprecated patterns, update it:

**Location:** `example/lib/main.dart` or relevant screen files

#### 8.4 Build Example App

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase/example
flutter pub get
flutter run  # or flutter build ios / flutter build apk
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
tags: [release, openiap, <platform-tags>]
date: YYYY-MM-DD
---

# <version> Release Notes

This release syncs with [OpenIAP v<gql-version>](https://www.openiap.dev/docs/updates/notes#<anchor>).

## New Features

### <Feature Name> (<Platform> <Version>+)

<Description of the feature>

```dart
// Example usage
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
- **Type-only changes**: Still document, mention "Dart types updated"
- **Bug fixes**: List what was fixed
- **Always link**: Link to OpenIAP release notes

---

### Step 10: Verify and Update llms.txt (REQUIRED)

**CRITICAL: ALWAYS review and update AI reference docs. DO NOT SKIP even for "type-only" changes.**

**Location:** `docs/static/llms.txt` and `docs/static/llms-full.txt`

#### 10.1 Review Current llms.txt

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase

# Check current AI reference docs
cat docs/static/llms.txt | head -100
cat docs/static/llms-full.txt | head -200
```

#### 10.2 What MUST Be Updated

**Always update llms.txt for:**

| Change Type | Update Required |
|-------------|-----------------|
| New API functions | **YES** - Add function signature and example |
| New types (input/response) | **YES** - Add type definition |
| New fields on existing types | **YES** - Update type definition |
| Field name changes | **YES** - Update field names in examples |
| Deprecations | **YES** - Add deprecation notice |
| Breaking changes | **YES** - Add migration example |
| Bug fixes | IF affects usage patterns |

#### 10.3 llms.txt Update Template

For new features, add sections like:

```markdown
### One-Time Purchase Discounts (v8.3+, Android 7.0+)

```dart
// Example usage for one-time purchase discount offers
final products = await iap.fetchProducts<Product>(
  skus: ['premium_unlock'],
  type: ProductQueryType.InApp,
);

final product = products.firstWhere((p) => p.id == 'premium_unlock');
if (product is ProductAndroid) {
  final discountOffer = product.discountOffers?.firstOrNull;

  await iap.requestPurchase(
    RequestPurchaseProps.inApp((
      apple: RequestPurchaseIosProps(sku: 'premium_unlock'),
      google: RequestPurchaseAndroidProps(
        skus: ['premium_unlock'],
        offerToken: discountOffer?.offerTokenAndroid, // Apply discount
      ),
      useAlternativeBilling: null,
    )),
  );
}
```
```

#### 10.4 Verify llms.txt Is Complete

Check that llms.txt includes:
- [ ] All public API functions
- [ ] All major types with their fields
- [ ] Usage examples for common patterns
- [ ] Platform-specific notes (iOS/Android)
- [ ] Version requirements for new features

---

### Step 11: Commit and Push (REQUIRED)

#### 11.1 Create Feature Branch

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase

git checkout -b feat/openiap-sync-<gql-version>
```

#### 11.2 Commit with Descriptive Message

```bash
git commit -m "$(cat <<'EOF'
feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <ver>, apple: <ver>, google: <ver>)
- Regenerate Dart types
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

## Version Bump & Versioned Docs

### Automatic Version Determination

Based on the `--patch`, `--minor`, or `--major` argument passed to the sync command.

### Versioned Docs (REQUIRED for Minor/Major)

**CRITICAL: For `--minor` or `--major` version bumps, you MUST create versioned documentation.**

Docusaurus versioned docs preserve documentation for previous versions so users on older SDK versions can reference the correct API.

#### Step 1: Create Version Snapshot

Before updating docs for the new version, snapshot the current docs:

```bash
cd $IAP_REPOS_HOME/flutter_inapp_purchase/docs

# Create a versioned snapshot (e.g., if current is 8.3, new minor will be 8.4)
npm run docusaurus docs:version <CURRENT_VERSION>

# Example: If bumping from 8.3 to 8.4
npm run docusaurus docs:version 8.3
```

This creates:
- `versioned_docs/version-8.3/` - Copy of current documentation
- `versioned_sidebars/version-8.3-sidebars.json` - Sidebar config for that version
- Updates `versions.json` with the new version entry

#### Step 2: Update docusaurus.config.ts

Add the new version to the versions config:

```typescript
// docs/docusaurus.config.ts
versions: {
  current: {
    label: '8.4 (Current)',  // Update to new version
    path: '',
  },
  '8.3': {                   // Add previous version
    label: '8.3',
    path: '8.3',
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

- **iOS types:** `IOS` suffix (e.g., `PurchaseIOS`, `SubscriptionOfferIOS`)
- **Android types:** `Android` suffix (e.g., `PurchaseAndroid`)
- **IAP codes:** `Iap` when not final suffix (e.g., `IapPurchase`)
- **ID fields:** Always `Id` (e.g., `productId`, `subscriptionGroupIdIOS`)

---

## References

- **CLAUDE.md:** `$IAP_REPOS_HOME/flutter_inapp_purchase/CLAUDE.md`
- **CONVENTION.md:** `$IAP_REPOS_HOME/flutter_inapp_purchase/CONVENTION.md`
- **OpenIAP Docs:** https://openiap.dev/docs
- **flutter_inapp_purchase Docs:** https://hyochan.github.io/flutter_inapp_purchase
