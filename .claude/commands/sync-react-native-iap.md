# Sync Changes to react-native-iap

Synchronize OpenIAP changes to the [react-native-iap](https://github.com/hyochan/react-native-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/react-native-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/react-native-iap`

## Usage

```bash
/sync-react-native-iap [--patch | --minor | --major]
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
| 3. Generate Types | **YES** | `yarn generate:types` |
| 4. Review Native Code | **YES** | Check if iOS/Android modules need updates |
| 5. Update API Exports | **IF NEEDED** | Add new functions to index.ts |
| 5.5. **Verify Nitro Modules** | **YES** | Check Nitro bridge spec and regenerate if needed |
| 6. Run All Checks | **YES** | `yarn typecheck`, `yarn test` |
| 7. **Write/Update Tests** | **YES** | MUST write tests for new types/features - DO NOT SKIP |
| 8. **Verify Example Code** | **YES** | Check `example/` app uses correct API patterns |
| 9. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 10. **Verify llms.txt** | **YES** | Always review and update AI reference docs |
| 11. Commit & Push | **YES** | Create PR with proper format |

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
| `docs/blog/` | Release blog posts | NO |
| `docs/static/llms.txt` | AI reference (short) | NO |
| `docs/static/llms-full.txt` | AI reference (detailed) | NO |

---

## Sync Steps

### Step 0: Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/react-native-iap
git pull
```

---

### Step 1: Analyze OpenIAP Changes (REQUIRED)

**CRITICAL: Before syncing, understand what changed in the openiap monorepo.**

#### 1.1 Check Version Differences

```bash
echo "=== OpenIAP Monorepo Versions ==="
cat /Users/crossplatformkorea/Github/hyodotdev/openiap/openiap-versions.json

echo "=== react-native-iap Current Versions ==="
cat $IAP_REPOS_HOME/react-native-iap/openiap-versions.json
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

Update react-native-iap's version tracking file to match openiap monorepo.

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
cd $IAP_REPOS_HOME/react-native-iap

# Download and regenerate types
yarn generate:types

# Review what changed
git diff src/types.ts
```

**Analyze the type diff carefully:**
- New interfaces/types?
- New fields on existing types?
- Changed field types?
- New enums or enum values?

---

### Step 4: Review Native Code (REQUIRED)

**CRITICAL: This step catches bugs that "type-only" syncs miss. DO NOT SKIP.**

You must verify that react-native-iap's native code actually passes new options/fields to OpenIAP.

#### 4.1 iOS Native Code Review

**Location:** `ios/HybridRnIap.swift`, `ios/RnIapHelper.swift`

**Verification steps:**

1. Check what new fields were added to request props in types:
   ```bash
   git diff src/types.ts | grep -A5 "RequestPurchaseIosProps\|RequestSubscriptionIosProps\|PurchaseOptions"
   ```

2. Verify react-native-iap passes these fields to OpenIAP:
   ```bash
   # Check if any explicit parameter passing exists that needs updating
   grep -n "requestPurchase\|getAvailablePurchases" ios/HybridRnIap.swift
   ```

**iOS typically auto-handles new fields via serialization, but verify!**

#### 4.2 Android Native Code Review

**Location:** `android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt`

**Verification steps:**

1. Check what new fields were added to Android types:
   ```bash
   git diff src/types.ts | grep -A5 "Android"
   ```

2. **CRITICAL**: Check if react-native-iap's native functions pass options to OpenIAP:
   ```bash
   # Look for functions that might need options parameter updates
   grep -n "openIap\." android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt | head -20
   ```

3. Verify options are forwarded:
   ```bash
   # Check if getAvailablePurchases receives and passes options
   grep -A10 "getAvailablePurchases\|getAvailableItems" android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt
   ```

**Android often requires explicit option passing - don't assume it works!**

#### 4.3 TypeScript API Review

**Location:** `src/index.ts`, `src/utils/type-bridge.ts`

Check if TypeScript API passes new options to native:

```bash
# Check if new options fields are included in the native call
grep -A20 "getAvailablePurchases" src/index.ts
```

**If a new option exists in types but isn't passed in the TS/native layer, IT WON'T WORK!**

#### 4.4 Decision Matrix (Updated)

| Change Type | Action Required |
|-------------|-----------------|
| New types only (response types) | NO code change - OpenIAP returns them automatically |
| New INPUT option fields | **CHECK** - verify native code passes the option |
| New API function | YES - add wrapper in both native + TS |
| Breaking type change | YES - check serialization compatibility |
| New platform feature | YES - add wrapper + expose to JS |

**Common mistakes to catch:**
- TypeScript has the option in types, but native code passes `null` instead of the options object
- Android native doesn't parse the new option from the params map
- Nitro bridge spec doesn't include new field

---

### Step 5: Update API Exports (IF NEEDED)

If new API functions were added to the native modules:

#### 5.1 Update Nitro Bridge Spec

**Location:** `src/specs/RnIap.nitro.ts`

If types changed that affect the bridge:
```bash
# Regenerate Nitro bridge files
yarn specs

# Verify bridge code
yarn prepare
```

#### 5.2 Update `src/index.ts`

Export new functions from the main entry point.

#### 5.3 Update `src/hooks/useIAP.ts`

If the new function should be available in the hook.

---

### Step 5.5: Verify Nitro Modules (REQUIRED)

**CRITICAL: react-native-iap uses Nitro Modules for native bridge. This step catches bridge-level bugs. DO NOT SKIP.**

#### 5.5.1 Check Nitro Bridge Spec

**Location:** `src/specs/RnIap.nitro.ts`

The Nitro bridge spec defines the interface between JavaScript and native code.

```bash
cd $IAP_REPOS_HOME/react-native-iap

# Review current Nitro spec
cat src/specs/RnIap.nitro.ts

# Check if new types need to be added to the spec
git diff src/types.ts | grep -A10 "interface.*Props\|type.*Props"
```

#### 5.5.2 Verify Type Mappings

For new types added in `src/types.ts`, verify they are correctly mapped in the Nitro spec:

1. **Request types** (inputs to native): Must be defined in the spec with correct TypeScript types
2. **Response types** (outputs from native): Must match what native code returns
3. **Optional fields**: Must use `?` or `| undefined` correctly

```typescript
// src/specs/RnIap.nitro.ts
// ✅ CORRECT: New request type includes new fields
interface RequestPurchaseAndroidSpec {
  skus: string[];
  offerToken?: string;       // New field from OpenIAP sync
  isOfferPersonalized?: boolean;  // New field from OpenIAP sync
}

// ❌ WRONG: Missing new fields in spec
interface RequestPurchaseAndroidSpec {
  skus: string[];
  // Missing offerToken and isOfferPersonalized!
}
```

#### 5.5.3 Regenerate Nitro Bridge Code

**ALWAYS regenerate after type changes:**

```bash
cd $IAP_REPOS_HOME/react-native-iap

# Regenerate Nitro bridge files from spec
yarn specs

# This runs nitrogen to generate:
# - nitrogen/generated/android/ (Kotlin bridge)
# - nitrogen/generated/ios/ (Swift bridge)
# - nitrogen/generated/shared/ (C++ bridge)

# Verify the generation was successful
yarn prepare
```

#### 5.5.4 Verify Generated Code

After regeneration, verify the generated files include new types:

```bash
# Check generated Android bridge
grep -n "offerToken\|isOfferPersonalized" nitrogen/generated/android/kotlin/**/*.kt 2>/dev/null

# Check generated iOS bridge
grep -n "offerToken\|isOfferPersonalized" nitrogen/generated/ios/swift/**/*.swift 2>/dev/null

# Check generated C++ bridge
grep -n "offerToken\|isOfferPersonalized" nitrogen/generated/shared/**/*.hpp 2>/dev/null
```

#### 5.5.5 Common Nitro Module Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| New field not in spec | TypeScript compiles but field is `undefined` at runtime | Add field to `src/specs/RnIap.nitro.ts` |
| Spec not regenerated | Old bridge code used, new features don't work | Run `yarn specs` then `yarn prepare` |
| Type mismatch | Runtime errors or silent data loss | Fix type in spec to match native expectation |
| Missing optional marker | Crash when field is null | Add `?` to optional fields in spec |

#### 5.5.6 Decision Matrix for Nitro Updates

| Change Type | Nitro Spec Update | Regenerate |
|-------------|-------------------|------------|
| New response type fields | NO (auto-mapped) | NO |
| New request type fields | **YES** - add to spec | **YES** |
| New API function | **YES** - add function to spec | **YES** |
| Type name change | **YES** - update spec | **YES** |
| Optional → Required | **YES** - update spec | **YES** |

---

### Step 6: Run All Checks (REQUIRED)

**ALL checks must pass before proceeding.**

```bash
cd $IAP_REPOS_HOME/react-native-iap

# TypeScript
yarn typecheck

# ESLint
yarn lint

# Prettier
yarn lint:prettier

# Tests
yarn test
```

**If any check fails, fix before continuing.**

---

### Step 7: Write/Update Tests (REQUIRED)

**🚨 CRITICAL: You MUST write tests for any new types, fields, or features added in this sync. DO NOT SKIP this step - incomplete tests will cause the PR to fail review.**

> **Why this matters:** Tests ensure type serialization works correctly and prevent regressions. Every new field must be tested.

#### 7.1 Identify What Needs Tests

First, identify ALL new types/fields from the sync:

```bash
cd $IAP_REPOS_HOME/react-native-iap

# See what types changed
git diff src/types.ts | grep "^+" | head -50
```

#### 7.2 Check Existing Tests

```bash
cd $IAP_REPOS_HOME/react-native-iap

# List test files
ls -la src/__tests__/

# Check test coverage for changed types/features
grep -r "offerToken\|DiscountOffer\|SubscriptionOffer" src/__tests__/
```

#### 7.3 Required Test Coverage (MUST WRITE)

**You MUST write tests for ALL of the following:**

- **Type serialization/deserialization**: Test `fromJson`/`toJson` roundtrips
- **Input field naming**: Test that input types use correct field names (no suffix for Android-specific input types)
- **Response field naming**: Test that response types use correct field names (with Android suffix for cross-platform types)
- **API integration**: Test that new fields are passed correctly to native code

#### 7.4 Write New Tests (MANDATORY)

**For EVERY new type or field, create tests like this:**

```typescript
// src/__tests__/standardized-offer-types.test.ts
describe('New Feature', () => {
  it('should have correct structure', () => {
    const offer: DiscountOffer = {
      id: 'test',
      displayPrice: '$4.99',
      price: 4.99,
      currency: 'USD',
      type: 'one-time',
      offerTokenAndroid: 'token123', // Response field WITH suffix
    };
    expect(offer.offerTokenAndroid).toBe('token123');
  });

  it('should use correct input field naming', () => {
    // Input fields WITHOUT suffix (parent type indicates platform)
    const request: RequestPurchaseAndroidProps = {
      skus: ['sku1'],
      offerToken: 'token123', // Input field NO suffix
    };
    expect(request.offerToken).toBe('token123');
  });
});
```

#### 7.5 Run Tests (Verify Your New Tests Pass)

```bash
yarn test

# If tests fail, FIX THEM before proceeding
```

**⚠️ DO NOT proceed to Step 8 until ALL tests pass, including the new tests you just wrote.**

---

### Step 8: Verify Example Code (REQUIRED)

**CRITICAL: Example app MUST demonstrate correct API usage patterns. DO NOT SKIP.**

#### 8.1 Check Example App

```bash
cd $IAP_REPOS_HOME/react-native-iap/example

# Check for usage of new features
grep -r "offerToken\|DiscountOffer\|subscriptionOffers" src/
```

#### 8.2 Verify API Patterns

Ensure example code follows correct patterns:

```typescript
// ✅ CORRECT: Input fields without Android suffix
const request = {
  apple: { sku: 'product_id' },
  google: {
    skus: ['product_id'],
    offerToken: offer.offerTokenAndroid, // Input: no suffix
    obfuscatedAccountId: 'account123',   // Input: no suffix
  },
};

// ❌ WRONG: Using Android suffix on input fields
const wrongRequest = {
  google: {
    offerTokenAndroid: offer.offerTokenAndroid, // WRONG!
  },
};
```

#### 8.3 Update Example If Needed

If example code uses deprecated patterns, update it:

**Location:** `example/src/App.tsx` or relevant screen components

#### 8.4 Build Example App

```bash
cd $IAP_REPOS_HOME/react-native-iap/example
yarn install
yarn ios  # or yarn android
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

```typescript
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
- **Type-only changes**: Still document, mention "TypeScript types updated"
- **Bug fixes**: List what was fixed
- **Always link**: Link to OpenIAP release notes

---

### Step 10: Verify and Update llms.txt (REQUIRED)

**CRITICAL: ALWAYS review and update AI reference docs. DO NOT SKIP even for "type-only" changes.**

**Location:** `docs/static/llms.txt` and `docs/static/llms-full.txt`

#### 10.1 Review Current llms.txt

```bash
cd $IAP_REPOS_HOME/react-native-iap

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
### New Feature Name (v14.x.x+)

```typescript
// Example usage for one-time purchase discounts
const product = products.find(p => p.id === 'premium_unlock');
const discountOffer = product?.discountOffers?.[0];

await requestPurchase({
  request: {
    apple: { sku: 'premium_unlock' },
    google: {
      skus: ['premium_unlock'],
      offerToken: discountOffer?.offerTokenAndroid,  // Apply discount
    },
  },
  type: 'in-app',
});
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
cd $IAP_REPOS_HOME/react-native-iap

git checkout -b feat/openiap-sync-<gql-version>
```

#### 11.2 Commit with Descriptive Message

```bash
git commit -m "$(cat <<'EOF'
feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <ver>, apple: <ver>, google: <ver>)
- Regenerate TypeScript types
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
cd $IAP_REPOS_HOME/react-native-iap/docs

# Create a versioned snapshot (e.g., if current is 14.5, new minor will be 14.6)
npm run docusaurus docs:version <CURRENT_VERSION>

# Example: If bumping from 14.5 to 14.6
npm run docusaurus docs:version 14.5
```

This creates:
- `versioned_docs/version-14.5/` - Copy of current documentation
- `versioned_sidebars/version-14.5-sidebars.json` - Sidebar config for that version
- Updates `versions.json` with the new version entry

#### Step 2: Update docusaurus.config.ts

Add the new version to the versions config:

```typescript
// docs/docusaurus.config.ts
versions: {
  current: {
    label: '14.6 (Current)',  // Update to new version
    path: '',
  },
  '14.5': {                   // Add previous version
    label: '14.5',
    path: '14.5',
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

- **iOS-only:** `functionNameIOS` (e.g., `clearTransactionIOS`)
- **Android-only:** `functionNameAndroid` (e.g., `acknowledgePurchaseAndroid`)
- **Cross-platform:** No suffix (e.g., `fetchProducts`)
- **iOS types:** `ProductIOS`, `PurchaseIOS`
- **ID fields:** `Id` not `ID` (e.g., `productId`, `transactionId`)

---

## References

- **CLAUDE.md:** `$IAP_REPOS_HOME/react-native-iap/CLAUDE.md`
- **OpenIAP Docs:** https://openiap.dev/docs
- **react-native-iap Docs:** https://react-native-iap.dooboolab.com
