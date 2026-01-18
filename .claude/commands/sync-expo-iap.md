# Sync Changes to expo-iap

Synchronize OpenIAP changes to the [expo-iap](https://github.com/hyochan/expo-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/expo-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/expo-iap`

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
| 7. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 8. Update llms.txt | **IF API CHANGED** | Update AI reference docs |
| 9. Commit & Push | **YES** | Create PR with proper format |

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

### Step 7: Write Blog Post (REQUIRED)

**Every sync MUST have a blog post documenting the changes.**

#### 7.1 Create Blog Post File

**Location:** `docs/blog/`

**Filename format:** `YYYY-MM-DD-<version>-<short-description>.md`

Example: `2026-01-18-3.5.0-winback-offers.md`

#### 7.2 Blog Post Template

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

#### 7.3 Blog Post Guidelines

- **New features**: Explain what they do, show example code, note platform requirements
- **Breaking changes**: MUST have migration guide with before/after code
- **Type-only changes**: Still document, mention "TypeScript types updated"
- **Bug fixes**: List what was fixed
- **Always link**: Link to OpenIAP release notes

---

### Step 8: Update llms.txt (IF API CHANGED)

**Location:** `docs/static/llms.txt` and `docs/static/llms-full.txt`

Update if:
- New API functions added
- Function signatures changed
- New types developers need to know about
- Usage patterns updated

---

### Step 9: Commit and Push (REQUIRED)

#### 9.1 Create Feature Branch

```bash
cd /Users/crossplatformkorea/Github/hyochan/expo-iap

git checkout -b feat/openiap-sync-<gql-version>
# Example: feat/openiap-sync-1.3.13
```

#### 9.2 Stage All Changes

```bash
git add .
```

#### 9.3 Commit with Descriptive Message

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

#### 9.4 Push to Remote

```bash
git push -u origin feat/openiap-sync-<gql-version>
```

---

## Version Bump Guidelines

After sync, the expo-iap version should be bumped:

| Change Type | Version Bump |
|-------------|--------------|
| Type-only changes (no API) | PATCH (x.x.+1) |
| New features (non-breaking) | MINOR (x.+1.0) |
| Breaking changes | MAJOR (+1.0.0) |

**Note:** Version bump is typically done separately after PR merge.

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
