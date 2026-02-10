# Sync Changes to expo-iap

Synchronize OpenIAP changes to the [expo-iap](https://github.com/hyochan/expo-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/expo-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/expo-iap`

## Usage

```bash
/sync-expo-iap [--patch | --minor | --major]
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
| 3. Generate Types | **YES** | `bun run generate:types` |
| 4. Review Native Code | **YES** | Check if iOS/Android modules need updates |
| 5. Update API Exports | **IF NEEDED** | Add new functions to index.ts, useIAP.ts |
| 6. Run All Checks | **YES** | `bun run lint:ci`, `bun run test`, example tests |
| 7. **Write/Update Tests** | **YES** | MUST write tests for new types/features - DO NOT SKIP |
| 8. **Verify Example Code** | **YES** | Check `example/` app uses correct API patterns |
| 9. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 10. **Verify llms.txt** | **YES** | Always review and update AI reference docs |
| 11. Commit & Push | **YES** | Commit changes and push to remote |
| 12. **Create PR** | **YES** | Create PR with OpenIAP PR reference |

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
| `docs/blog/` | Release blog posts | NO |
| `docs/static/llms.txt` | AI reference (short) | NO |
| `docs/static/llms-full.txt` | AI reference (detailed) | NO |

---

## Sync Steps

### Step 0: Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap
git pull
```

---

### Step 1: Analyze OpenIAP Changes (REQUIRED)

**CRITICAL: Before syncing, understand what changed in the openiap monorepo.**

#### 1.1 Check Version Differences

```bash
echo "=== OpenIAP Monorepo Versions ==="
cat /Users/crossplatformkorea/Github/hyodotdev/openiap/openiap-versions.json

echo "=== expo-iap Current Versions ==="
cat /Users/crossplatformkorea/Github/hyochan/expo-iap/openiap-versions.json
```

#### 1.2 Analyze GQL Schema Changes (Types)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log --oneline packages/gql/ -10
```

Look for:
- New types/interfaces added
- New fields on existing types
- Breaking changes to type signatures

#### 1.3 Analyze Apple Package Changes (iOS Native)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log --oneline packages/apple/ -10
```

Check `packages/apple/Sources/` for:
- New public functions in `OpenIapModule.swift`
- New types in `Types.swift`
- Changes to serialization in `OpenIapSerialization.swift`

#### 1.4 Analyze Google Package Changes (Android Native)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log --oneline packages/google/ -10
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

Update expo-iap's version tracking file to match openiap monorepo.

**Edit `/Users/crossplatformkorea/Github/hyochan/expo-iap/openiap-versions.json`:**

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
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

# Download and regenerate types
bun run generate:types

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

You must verify that expo-iap's native code actually passes new options/fields to OpenIAP.

#### 4.1 iOS Native Code Review

**Location:** `ios/ExpoIapModule.swift`, `ios/ExpoIapHelper.swift`

**Verification steps:**

1. Check what new fields were added to `RequestPurchaseIosProps` in types:
   ```bash
   git diff src/types.ts | grep -A5 "RequestPurchaseIosProps\|RequestSubscriptionIosProps"
   ```

2. Verify expo-iap passes these fields to OpenIAP:
   ```bash
   # iOS uses OpenIapSerialization.decode which auto-handles new fields
   # BUT: Check if any explicit parameter passing exists that needs updating
   grep -n "requestPurchase\|RequestPurchase" ios/ExpoIapModule.swift
   ```

3. Check if new options fields (like `PurchaseOptions`) are passed:
   ```bash
   grep -n "getAvailableItems\|getAvailablePurchases" ios/ExpoIapModule.swift
   ```

**iOS typically auto-handles new fields via serialization, but verify!**

#### 4.2 Android Native Code Review

**Location:** `android/src/main/java/expo/modules/iap/ExpoIapModule.kt`

**Verification steps:**

1. Check what new fields were added to Android types:
   ```bash
   git diff src/types.ts | grep -A5 "Android"
   ```

2. **CRITICAL**: Check if expo-iap's native functions pass options to OpenIAP:
   ```bash
   # Look for functions that might need options parameter updates
   grep -n "openIap\." android/src/main/java/expo/modules/iap/ExpoIapModule.kt | head -20
   ```

3. Verify options are forwarded:
   ```bash
   # Check if getAvailablePurchases receives and passes options
   grep -A10 "getAvailableItems" android/src/main/java/expo/modules/iap/ExpoIapModule.kt
   ```

**Android often requires explicit option passing - don't assume it works!**

#### 4.3 TypeScript API Review

**Location:** `src/index.ts`, `src/modules/android.ts`, `src/modules/ios.ts`

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
- iOS Swift code doesn't include new field in the props struct

---

### Step 5: Update API Exports (IF NEEDED)

If new API functions were added to the native modules, expose them in TypeScript:

#### 5.1 Update `src/modules/ios.ts`

For iOS-specific functions with `IOS` suffix.

#### 5.2 Update `src/modules/android.ts`

For Android-specific functions with `Android` suffix.

#### 5.3 Update `src/index.ts`

Export new functions from the main entry point.

#### 5.4 Update `src/useIAP.ts`

If the new function should be available in the hook.

---

### Step 6: Run All Checks (REQUIRED)

**ALL checks must pass before proceeding.**

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

# Run full lint suite (tsc, eslint, prettier, ktlint)
bun run lint:ci

# Run library tests
bun run test

# Run example app tests
cd example && bun run test && cd ..
```

**If any check fails, fix before continuing.**

---

### Step 7: Write/Update Tests (REQUIRED)

**🚨 CRITICAL: You MUST write tests for any new types, fields, or features added in this sync. DO NOT SKIP this step - incomplete tests will cause the PR to fail review.**

> **Why this matters:** Tests ensure type serialization works correctly and prevent regressions. Every new field must be tested.

#### 7.1 Identify What Needs Tests

First, identify ALL new types/fields from the sync:

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

# See what types changed
git diff src/types.ts | grep "^+" | head -50
```

#### 7.2 Check Existing Tests

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

# List test files
ls -la src/__tests__/

# Check test coverage for changed types/features
grep -r "offerToken\|DiscountOffer\|SubscriptionOffer" src/__tests__/
```

#### 7.3 Required Test Coverage (MUST WRITE)

**You MUST write tests for ALL of the following:**

- **Type serialization/deserialization**: Test JSON roundtrips
- **Input field naming**: Test that input types use correct field names (no suffix for Android-specific input types)
- **Response field naming**: Test that response types use correct field names (with Android suffix for cross-platform types)
- **API integration**: Test that new fields are passed correctly to native code

#### 7.4 Write New Tests (MANDATORY)

**For EVERY new type or field, create tests like this:**

```typescript
// src/__tests__/standardized-offer-types.test.ts
describe('DiscountOffer', () => {
  it('should have correct structure with Android-specific fields', () => {
    const offer: DiscountOffer = {
      id: 'summer_sale',
      displayPrice: '$4.99',
      price: 4.99,
      currency: 'USD',
      type: 'one-time',
      offerTokenAndroid: 'token123', // Response field WITH suffix
    };
    expect(offer.offerTokenAndroid).toBe('token123');
  });
});

describe('RequestPurchaseAndroidProps', () => {
  it('should use simplified input field names', () => {
    // Input fields WITHOUT suffix (parent type indicates platform)
    const request: RequestPurchaseAndroidProps = {
      skus: ['sku1'],
      obfuscatedAccountId: 'account123', // NO suffix
      offerToken: 'token123',            // NO suffix
    };
    expect(request.offerToken).toBe('token123');
  });
});
```

#### 7.5 Run Tests (Verify Your New Tests Pass)

```bash
bun run test

# If tests fail, FIX THEM before proceeding
```

**⚠️ DO NOT proceed to Step 8 until ALL tests pass, including the new tests you just wrote.**

---

### Step 8: Verify Example Code (REQUIRED)

**CRITICAL: Example app MUST demonstrate correct API usage patterns. DO NOT SKIP.**

#### 8.1 Check Example App

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap/example

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
cd /Users/crossplatformkorea/Github/hyochan/expo-iap/example
bun install
bun run ios  # or bun run android
```

---

### Step 9: Write Blog Post (REQUIRED)

**Every sync MUST have a blog post documenting the changes.**

#### 9.1 Create Blog Post File

**Location:** `docs/blog/`

**Filename format:** `YYYY-MM-DD-<version>-<short-description>.md`

Example: `2026-01-18-3.5.0-winback-offers.md`

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
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

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
### One-Time Purchase Discounts (v3.x.x+, Android 7.0+)

```typescript
// Example usage for one-time purchase discount offers
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
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

git checkout -b feat/openiap-sync-<gql-version>
# Example: feat/openiap-sync-1.3.13
```

#### 11.2 Stage All Changes

```bash
git add .
```

#### 11.3 Commit with Descriptive Message

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

#### 11.4 Push to Remote

```bash
git push -u origin feat/openiap-sync-<gql-version>
```

---

### Step 12: Create Pull Request (REQUIRED)

**CRITICAL: You MUST create a PR after pushing. DO NOT skip this step.**

#### 12.1 Find Related OpenIAP PR (if applicable)

If this sync was triggered by an OpenIAP PR, include it in the PR description:

```bash
# Find recent OpenIAP PRs related to this sync
gh pr list --repo hyodotdev/openiap --state merged --limit 5
```

#### 12.2 Create PR with OpenIAP Reference

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

gh pr create --title "feat: sync with openiap v<gql-version>" --body "$(cat <<'EOF'
## Summary

- Sync with OpenIAP v<gql-version>
- <List specific new features/changes>

## Related

- OpenIAP PR: <openiap-pr-url-if-applicable>
- OpenIAP Release Notes: https://www.openiap.dev/docs/updates/notes#gql-<version>

## Changes

- Update openiap-versions.json (gql: <ver>, apple: <ver>, google: <ver>)
- Regenerate TypeScript types
- <List other changes>
- Add release blog post
- Update llms.txt

## Test Plan

- [ ] `bun run lint:ci` passes
- [ ] `bun run test` passes
- [ ] Example app tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

#### 12.3 Return PR URL

After creating the PR, note the URL to share with the user.

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
cd /Users/crossplatformkorea/Github/hyochan/expo-iap/docs

# Create a versioned snapshot (e.g., if current is 3.4, new minor will be 3.5)
# This copies current docs/ to versioned_docs/version-X.X/
npm run docusaurus docs:version <CURRENT_VERSION>

# Example: If bumping from 3.4 to 3.5
npm run docusaurus docs:version 3.4
```

This creates:
- `versioned_docs/version-3.4/` - Copy of current documentation
- `versioned_sidebars/version-3.4-sidebars.json` - Sidebar config for that version
- Updates `versions.json` with the new version entry

#### Step 2: Update docusaurus.config.ts

Add the new version to the versions config:

```typescript
// docs/docusaurus.config.ts
versions: {
  current: {
    label: '3.5 (Current)',  // Update to new version
    path: '',
  },
  '3.4': {                   // Add previous version
    label: '3.4',
    path: '3.4',
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

## Example Sync Session

Here's what a complete sync looks like:

```
1. git pull
2. Check versions: gql 1.3.12 → 1.3.13, apple 1.3.10 → 1.3.11, google 1.3.23 → 1.3.24
3. Analyze: Found new WinBackOfferInputIOS type, ProductStatusAndroid type
4. Update openiap-versions.json
5. bun run generate:types
6. Review types diff: +WinBackOfferInputIOS, +ProductStatusAndroid, +PromotionalOfferJwsInputIOS
7. Check native code: Types flow through automatically, no wrapper changes needed
8. bun run lint:ci ✓
9. bun run test ✓
10. cd example && bun run test ✓
11. Create docs/blog/2026-01-18-3.5.0-winback-offers.md
12. git checkout -b feat/openiap-sync-1.3.13
13. git add . && git commit
14. git push
```

---

## Naming Conventions

- **iOS-only:** `functionNameIOS` (e.g., `syncIOS`, `getPromotedProductIOS`)
- **Android-only:** `functionNameAndroid` (e.g., `consumePurchaseAndroid`)
- **Cross-platform:** No suffix (e.g., `fetchProducts`, `requestPurchase`)
- **Error codes:** kebab-case (e.g., `'user-cancelled'`)

---

## References

- **expo-iap CLAUDE.md:** `/Users/crossplatformkorea/Github/hyochan/expo-iap/CLAUDE.md`
- **OpenIAP Docs:** [openiap.dev/docs](https://openiap.dev/docs)
- **expo-iap Docs:** [hyochan.github.io/expo-iap](https://hyochan.github.io/expo-iap)
