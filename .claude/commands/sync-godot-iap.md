# Sync Changes to godot-iap

Synchronize OpenIAP changes to the [godot-iap](https://github.com/hyochan/godot-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/godot-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))
>
> **Default Path:** `/Users/crossplatformkorea/Github/hyochan/godot-iap`

## Usage

```bash
/sync-godot-iap
```

> **Note:** godot-iap version is managed automatically by CI/CD. Do NOT manually bump versions.
> The CI will determine the appropriate version based on semantic-release conventions.

## CRITICAL: Mandatory Steps Checklist

**YOU MUST COMPLETE ALL THESE STEPS. DO NOT SKIP ANY.**

| Step | Required | Description |
|------|----------|-------------|
| 0. Pull Latest | **YES** | `git pull` before any work |
| 1. Analyze OpenIAP Changes | **YES** | Review what changed in openiap packages |
| 2. Sync Versions | **YES** | Update openiap-versions.json |
| 3. Generate Types | **YES** | Generate in openiap, copy to godot-iap |
| 4. Review Native Code | **YES** | Check if GDExtension code needs updates |
| 5. Update GDScript API | **IF NEEDED** | Add new functions to `iap.gd`, `store.gd` |
| 6. Run All Checks | **YES** | Editor test, GDUnit4 tests |
| 7. **Write/Update Tests** | **YES** | MUST write tests for new types/features - DO NOT SKIP |
| 8. **Verify Example Code** | **YES** | Check example scenes use correct API patterns |
| 9. Write Blog Post | **YES** | Create release notes |
| 10. **Verify llms.txt** | **YES** | Always review and update AI reference docs |
| 11. Commit & Push | **YES** | Create PR with proper format |

## Project Overview

- **Engine:** Godot 4.x
- **Language:** GDScript
- **Framework:** Godot Plugin/Addon
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `addons/openiap/types.gd` | GDScript types from OpenIAP | YES |
| `addons/openiap/iap.gd` | Core IAP module | NO |
| `addons/openiap/store.gd` | SwiftUI-like store | NO |
| `plugin.cfg` | Plugin configuration | NO |
| `openiap-versions.json` | Version tracking | NO |
| `docs/blog/` | Release blog posts | NO |
| `docs/static/llms.txt` | AI reference | NO |

## Type Generation Source

**OpenIAP has a built-in GDScript type generator (IR-based):**

- **Generator:** `/Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql/codegen/plugins/gdscript.ts`
- **Entry Point:** `/Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql/codegen/index.ts`
- **Output:** `/Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql/src/generated/types.gd`

---

## Sync Steps

### Step 0: Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/godot-iap
git pull
```

---

### Step 1: Analyze OpenIAP Changes (REQUIRED)

**CRITICAL: Before syncing, understand what changed in the openiap monorepo.**

#### 1.1 Check Version Differences

```bash
echo "=== OpenIAP Monorepo Versions ==="
cat /Users/crossplatformkorea/Github/hyodotdev/openiap/openiap-versions.json

echo "=== godot-iap Current Versions ==="
cat $IAP_REPOS_HOME/godot-iap/openiap-versions.json
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
- Changes that need GDExtension bridge updates

#### 1.4 Analyze Google Package Changes (Android Native)

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap
git log -10 --oneline -- packages/google/
```

Check `packages/google/openiap/src/main/` for:
- New public functions in `OpenIapModule.kt`
- New types in `Types.kt`
- Changes that need GDExtension bridge updates

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

Update godot-iap's version tracking file to match openiap monorepo.

**Edit `openiap-versions.json`:**

```json
{
  "gql": "<match openiap's gql version>",
  "apple": "<match openiap's apple version>",
  "google": "<match openiap's google version>"
}
```

---

### Step 3: Generate and Copy Types (REQUIRED)

#### 3.1 Generate Types in OpenIAP

```bash
cd /Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql

# Run GDScript type generation
npm run generate:gdscript

# Or run all generators
npm run generate
```

#### 3.2 Copy Types to godot-iap

```bash
# Copy generated types
cp /Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql/src/generated/types.gd \
   $IAP_REPOS_HOME/godot-iap/addons/openiap/types.gd
```

#### 3.3 Review Changes

```bash
cd $IAP_REPOS_HOME/godot-iap
git diff addons/openiap/types.gd | head -100
```

**Analyze the type diff carefully:**
- New classes?
- New fields on existing classes?
- Changed field types?
- New enums or enum values?

---

### Step 4: Review Native Code (REQUIRED)

**CRITICAL: This step catches bugs that "type-only" syncs miss. DO NOT SKIP.**

You must verify that godot-iap's GDExtension code actually passes new options/fields to OpenIAP.

#### 4.1 iOS GDExtension Review

**Location:** `ios/` or `gdextension/ios/`

**Verification steps:**

1. Check what new fields were added to iOS types:
   ```bash
   git diff addons/openiap/types.gd | grep -A5 "IOS\|ios"
   ```

2. Check if GDExtension bridge exposes new fields:
   ```bash
   # Check Swift/Objective-C bridge
   grep -rn "getAvailablePurchases\|requestPurchase" ios/ gdextension/ios/ 2>/dev/null
   ```

**When to modify:**
- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API changes
- Type conversion changes

#### 4.2 Android GDExtension Review

**Location:** `android/` or `gdextension/android/`

**Verification steps:**

1. Check what new fields were added to Android types:
   ```bash
   git diff addons/openiap/types.gd | grep -A5 "Android\|android"
   ```

2. **CRITICAL**: Check if GDExtension bridge passes options to OpenIAP:
   ```bash
   # Check Kotlin/Java bridge
   grep -rn "getAvailablePurchases\|requestPurchase" android/ gdextension/android/ 2>/dev/null
   ```

**Android often requires explicit option passing - don't assume it works!**

#### 4.3 GDScript API Review

**Location:** `addons/openiap/iap.gd`, `addons/openiap/store.gd`

Check if GDScript API passes new options to native:

```bash
# Check if new options fields are included in native calls
grep -A10 "get_available_purchases\|request_purchase" addons/openiap/iap.gd
```

**If a new option exists in types but isn't passed in the GDScript/native layer, IT WON'T WORK!**

#### 4.4 Decision Matrix (Updated)

| Change Type | Action Required |
|-------------|-----------------|
| New types only (response types) | NO code change - OpenIAP returns them automatically |
| New INPUT option fields | **CHECK** - verify GDExtension passes the option |
| New API function | YES - add to GDExtension + GDScript wrapper |
| Breaking type change | YES - check serialization compatibility |
| New platform feature | YES - add GDExtension + GDScript + signals |

**Common mistakes to catch:**
- GDScript has the option in types, but GDExtension doesn't read it
- Android GDExtension doesn't parse the new option
- Signal not emitted for new purchase states

---

### Step 5: Update GDScript API (IF NEEDED)

If new API functions were added:

#### 5.1 Update `addons/openiap/iap.gd`

Add new methods to the core module.

#### 5.2 Update `addons/openiap/store.gd`

Add new methods to the store abstraction.

#### 5.3 Add Signals

For new asynchronous events, add signals.

---

### Step 6: Run All Checks (REQUIRED)

**ALL checks must pass before proceeding.**

#### 6.1 Editor Test

```bash
cd $IAP_REPOS_HOME/godot-iap

# Open project in Godot 4.x
godot --editor .

# Check for GDScript errors in Output panel
# Run test scenes from editor
```

#### 6.2 GDUnit4 Tests

```bash
# Run GDUnit4 tests
godot --headless -s addons/gdunit4/test_runner.gd

# Or run from editor: GDUnit4 panel > Run Tests
```

**If any check fails, fix before continuing.**

---

### Step 7: Write/Update Tests (REQUIRED)

**🚨 CRITICAL: You MUST write tests for any new types, fields, or features added in this sync. DO NOT SKIP this step - incomplete tests will cause the PR to fail review.**

> **Why this matters:** Tests ensure type serialization works correctly and prevent regressions. Every new field must be tested.

#### 7.1 Identify What Needs Tests

First, identify ALL new types/fields from the sync:

```bash
cd $IAP_REPOS_HOME/godot-iap

# See what types changed
git diff addons/openiap/types.gd | grep "^+" | head -50
```

#### 7.2 Check Existing Test Coverage

```bash
cd $IAP_REPOS_HOME/godot-iap

# Find all test files
find . -name "*test*.gd" -o -name "*_test.gd"

# Check what's being tested
grep -rn "func test_" test/ 2>/dev/null || grep -rn "func test_" . --include="*test*.gd"
```

#### 7.3 Required Test Coverage (MUST WRITE)

**You MUST write tests for ALL new types/fields. Examples:**

1. **Check if tests exist for new types:**
   ```gdscript
   # Example: If RequestPurchaseAndroidProps got new field 'offer_token'
   # Test file should have:
   func test_request_purchase_android_with_offer_token():
       var props = RequestPurchaseAndroidProps.new()
       props.sku = "test_sku"
       props.offer_token = "test_token"  # New field must be tested
       assert_not_null(props.to_dict()["offer_token"])
   ```

2. **Check if field serialization is tested:**
   ```gdscript
   func test_type_serialization():
       var props = NewType.new()
       props.new_field = "value"
       var dict = props.to_dict()
       var restored = NewType.from_dict(dict)
       assert_eq(restored.new_field, "value")
   ```

#### 7.4 Write New Tests (MANDATORY)

**For EVERY new type or field, you MUST create tests:**

1. Create test file in appropriate location (e.g., `test/unit/test_new_types.gd`)
2. **REQUIRED tests for each new type:**
   - Type instantiation with new fields
   - Serialization (`to_dict()`) includes new fields
   - Deserialization (`from_dict()`) parses new fields
   - Default values for optional fields

```gdscript
# test/unit/test_new_feature.gd
extends GutTest

func test_new_type_instantiation():
    var obj = NewType.new()
    obj.new_field = "test_value"
    assert_eq(obj.new_field, "test_value")

func test_new_type_serialization():
    var obj = NewType.new()
    obj.new_field = "test_value"
    var dict = obj.to_dict()
    assert_true(dict.has("new_field"))
    assert_eq(dict["new_field"], "test_value")

func test_new_type_deserialization():
    var dict = {"new_field": "test_value"}
    var obj = NewType.from_dict(dict)
    assert_eq(obj.new_field, "test_value")
```

#### 7.5 Run All Tests (Verify Your New Tests Pass)

```bash
# Run GDUnit4 tests
godot --headless -s addons/gdunit4/test_runner.gd

# Verify all tests pass
```

**⚠️ DO NOT proceed to Step 8 until ALL tests pass, including the new tests you just wrote.**

---

### Step 8: Verify Example Code (REQUIRED)

**CRITICAL: Example scenes must demonstrate correct API usage. DO NOT SKIP.**

#### 8.1 Check Example Scenes

```bash
cd $IAP_REPOS_HOME/godot-iap

# Find example scenes
find . -name "*.tscn" -path "*/example/*" -o -name "*.tscn" -path "*/demo/*"

# Find example scripts
find . -name "*.gd" -path "*/example/*" -o -name "*.gd" -path "*/demo/*"
```

#### 8.2 Verify API Patterns

Check that example code uses correct patterns:

```gdscript
# CORRECT - Uses new field names (simplified naming)
var props = RequestPurchaseAndroidProps.new()
props.sku = "premium_upgrade"
props.offer_token = offer.offer_token  # Input field: NO suffix
props.is_offer_personalized = true      # Input field: NO suffix

# INCORRECT - Old naming convention
var props = RequestPurchaseAndroidProps.new()
props.offer_token_android = token       # WRONG: input fields don't have suffix
```

#### 8.3 Update Outdated Examples

If examples use outdated patterns:

1. Update to use new field names
2. Add comments explaining new features
3. Test the example runs without errors

#### 8.4 Run Example in Editor

```bash
# Open Godot editor and run example scenes
godot --editor .

# In editor: Run each example scene to verify no errors
```

---

### Step 9: Write Blog Post (REQUIRED)

**Every sync MUST have a blog post documenting the changes.**

> **IMPORTANT:** godot-iap version is determined by CI/CD automatically. Do NOT predict or specify the version in filenames or content. Use OpenIAP gql version for reference instead.

#### 9.1 Create Blog Post File

**Location:** `docs/blog/` or `README.md` changelog section

**Filename format:** `YYYY-MM-DD-openiap-<gql-version>.md` (use OpenIAP gql version, NOT godot-iap version)

#### 9.2 Blog Post Template

```markdown
---
slug: openiap-sync-<gql-version>
title: OpenIAP Sync <gql-version>
authors: [hyochan]
tags: [release, openiap, godot, <platform-tags>]
date: YYYY-MM-DD
---

# OpenIAP Sync

This release syncs with [OpenIAP v<gql-version>](https://www.openiap.dev/docs/updates/notes#<anchor>).

## New Features

### <Feature Name> (<Platform> <Version>+)

<Description of the feature>

```gdscript
# Example usage
var request = RequestSubscriptionIosProps.new()
request.sku = "premium_monthly"
# new option
var result = await iap.request_subscription_ios(request)
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
- **Type-only changes**: Still document, mention "GDScript types updated"
- **Bug fixes**: List what was fixed
- **Always link**: Link to OpenIAP release notes

---

### Step 10: Verify and Update llms.txt (REQUIRED)

**CRITICAL: Always review and update AI reference documentation. DO NOT SKIP.**

**Location:** `docs/static/llms.txt` and `docs/static/llms-full.txt`

#### 10.1 Check Current llms.txt

```bash
cd $IAP_REPOS_HOME/godot-iap

# Review current AI reference docs
cat docs/static/llms.txt 2>/dev/null || echo "llms.txt not found"
cat docs/static/llms-full.txt 2>/dev/null || echo "llms-full.txt not found"
```

#### 10.2 Verify Documentation Accuracy

Check that llms.txt includes:

1. **All public API functions:**
   ```bash
   # List public functions in iap.gd
   grep -n "^func " addons/openiap/iap.gd | grep -v "^func _"

   # Compare with llms.txt
   grep -c "func" docs/static/llms.txt
   ```

2. **Correct type definitions:**
   - New types added in this sync
   - Updated field names (input fields NO suffix, response fields WITH suffix)
   - Correct method signatures

3. **Updated examples:**
   - Examples use new field names
   - Examples demonstrate new features

#### 10.3 Update llms.txt Content

If API changed, update:
- Function signatures
- Type definitions
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
cd $IAP_REPOS_HOME/godot-iap

git checkout -b feat/openiap-sync-<gql-version>
```

#### 11.2 Commit with Descriptive Message

```bash
git commit -m "$(cat <<'EOF'
feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <ver>, apple: <ver>, google: <ver>)
- Regenerate GDScript types
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

## Generated Type Structure

```gdscript
# Enums
enum ErrorCode {
    UNKNOWN,
    USER_CANCELLED,
    # ... more codes
}

# Classes
class ProductIOS:
    var product_id: String
    var display_name: String
    # ... more fields

    static func from_dict(data: Dictionary) -> ProductIOS:
        # JSON deserialization
        pass

    func to_dict() -> Dictionary:
        # JSON serialization
        pass
```

---

## Versioning

### Automatic Version Management

**IMPORTANT:** godot-iap version is managed automatically by CI/CD using semantic-release.

- **DO NOT** manually bump versions in `plugin.cfg` or any other files
- **DO NOT** predict or specify godot-iap version in blog posts or filenames
- **DO** use OpenIAP gql version for blog post references (e.g., `openiap-sync-1.3.16`)

The CI will automatically determine the appropriate version based on:
- Commit message conventions (feat:, fix:, etc.)
- Breaking change indicators

### Versioned Docs (For Major API Changes)

If there are significant API changes, you may need to create versioned documentation.

Docusaurus versioned docs preserve documentation for previous versions so users on older SDK versions can reference the correct API.

#### When to Create Versioned Docs

- New API functions added
- Breaking API changes
- Significant feature additions

#### How to Create Versioned Docs

```bash
cd $IAP_REPOS_HOME/godot-iap/docs

# Create a versioned snapshot of current docs
npm run docusaurus docs:version <CURRENT_VERSION>
```

This creates:
- `versioned_docs/version-X.X/` - Copy of current documentation
- `versioned_sidebars/version-X.X-sidebars.json` - Sidebar config for that version
- Updates `versions.json` with the new version entry

---

## Naming Conventions (GDScript)

- **Classes:** PascalCase (e.g., `ProductIOS`, `RequestPurchaseResult`)
- **Methods:** snake_case (e.g., `from_dict()`, `to_dict()`)
- **Fields:** snake_case (e.g., `product_id`, `display_name`)
- **Enums:** UPPER_CASE (e.g., `ErrorCode.USER_CANCELLED`)
- **iOS types:** `IOS` suffix
- **Android types:** `Android` suffix

---

## References

- **OpenIAP GDScript Generator:** `/Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql/codegen/plugins/gdscript.ts`
- **OpenIAP Codegen Entry:** `/Users/crossplatformkorea/Github/hyodotdev/openiap/packages/gql/codegen/index.ts`
- **OpenIAP Docs:** https://openiap.dev/docs
- **Godot IAP Docs:** Check README.md
