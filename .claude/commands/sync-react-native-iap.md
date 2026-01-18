# Sync Changes to react-native-iap

Synchronize OpenIAP changes to the [react-native-iap](https://github.com/hyochan/react-native-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/react-native-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/react-native-iap`

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
| 6. Run All Checks | **YES** | `yarn typecheck`, `yarn test` |
| 7. Write Blog Post | **YES** | Create release notes in `docs/blog/` |
| 8. Update llms.txt | **IF API CHANGED** | Update AI reference docs |
| 9. Commit & Push | **YES** | Create PR with proper format |

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
cd $IAP_REPOS_HOME/react-native-iap

git checkout -b feat/openiap-sync-<gql-version>
```

#### 9.2 Commit with Descriptive Message

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

#### 9.3 Push to Remote

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
