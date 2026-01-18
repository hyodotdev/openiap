# Sync Changes to godot-iap

Synchronize OpenIAP changes to the [godot-iap](https://github.com/hyochan/godot-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/godot-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))

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

## Type Generation Source

**OpenIAP has a built-in GDScript type generator:**

- **Generator:** `$OPENIAP_HOME/openiap/packages/gql/scripts/generate-gdscript-types.mjs`
- **Output:** `$OPENIAP_HOME/openiap/packages/gql/src/generated/types.gd`

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/godot-iap
git pull
```

### 1. Sync openiap-versions.json (REQUIRED)

**IMPORTANT:** Before generating types, sync version numbers from openiap monorepo.

```bash
cd $IAP_REPOS_HOME/godot-iap

# Check current versions in openiap monorepo
cat $OPENIAP_HOME/openiap/openiap-versions.json

# Update godot-iap's openiap-versions.json to match:
# - "gql": should match openiap's "gql" version
# - "apple": should match openiap's "apple" version
# - "google": should match openiap's "google" version
```

**Version fields to sync:**
| Field | Source | Purpose |
|-------|--------|---------|
| `gql` | `$OPENIAP_HOME/openiap/openiap-versions.json` | GDScript types version |
| `apple` | `$OPENIAP_HOME/openiap/openiap-versions.json` | iOS native SDK version |
| `google` | `$OPENIAP_HOME/openiap/openiap-versions.json` | Android native SDK version |

### 2. Generate Types in OpenIAP

```bash
cd $OPENIAP_HOME/openiap/packages/gql

# Run GDScript type generation
npm run generate:gdscript

# Or run all generators
npm run generate
```

### 3. Copy Types to godot-iap

```bash
# Copy generated types
cp $OPENIAP_HOME/openiap/packages/gql/src/generated/types.gd \
   $IAP_REPOS_HOME/godot-iap/addons/openiap/types.gd
```

### 4. Verify Version Tracking

Confirm `openiap-versions.json` in godot-iap matches openiap:

```json
{
  "gql": "1.3.11",
  "apple": "1.3.9",
  "google": "1.3.21"
}
```

### 5. Native Code Modifications

#### iOS Native Code (GDExtension)

**Location:** `ios/` or `gdextension/ios/`

Key files to update:

- Swift/Objective-C bridge to StoreKit 2
- GDExtension bindings for iOS

**When to modify:**

- New iOS-specific API methods added to OpenIAP
- StoreKit 2 API changes
- Type conversion changes

#### Android Native Code (GDExtension)

**Location:** `android/` or `gdextension/android/`

Key files to update:

- Kotlin/Java bridge to Play Billing
- GDExtension bindings for Android

**When to modify:**

- New Android-specific API methods added to OpenIAP
- Play Billing API changes
- Type conversion changes

### 6. Update GDScript Implementation

If API changes, update:

- `addons/openiap/iap.gd` - Core module
- `addons/openiap/store.gd` - Store abstraction

### 7. Build & Test

#### Editor Test

```bash
cd $IAP_REPOS_HOME/godot-iap

# Open project in Godot 4.x
godot --editor .

# Check for GDScript errors in Output panel
# Run test scenes from editor
```

#### iOS Build Test

```bash
cd $IAP_REPOS_HOME/godot-iap

# Export iOS build from Godot Editor
# Project > Export > iOS
# Or use CLI:
godot --headless --export-release "iOS" build/ios/godot-iap.ipa
```

#### Android Build Test

```bash
cd $IAP_REPOS_HOME/godot-iap

# Export Android build from Godot Editor
# Project > Export > Android
# Or use CLI:
godot --headless --export-release "Android" build/android/godot-iap.apk
```

#### Unit Tests (GDUnit4)

```bash
# Run GDUnit4 tests
godot --headless -s addons/gdunit4/test_runner.gd

# Or run from editor: GDUnit4 panel > Run Tests
```

### 8. Update Example Code (REQUIRED)

**Location:** `examples/`

- Example Godot scenes demonstrating purchase flows
- Sample GDScript code

**Example Code Guidelines:**
- Demonstrate ALL new API features with working code
- Show both success and error handling
- Include comments explaining the feature
- Use realistic SKU names and user flows

**Example for new iOS feature (e.g., Win-Back Offer):**
```gdscript
# In example scene script
func _on_winback_button_pressed():
    var request = RequestSubscriptionIosProps.new()
    request.sku = "premium_monthly"
    request.win_back_offer = WinBackOfferInputIOS.new()
    request.win_back_offer.offer_id = "winback_50_off"  # iOS 18+

    var result = await iap.request_subscription_ios(request)
    print("Win-back applied: ", result)
```

**Example for new Android feature (e.g., Product Status):**
```gdscript
# In example scene script
for product in products:
    if product.product_status_android != null:
        match product.product_status_android:
            ProductStatusAndroid.OK:
                # Show product
                pass
            ProductStatusAndroid.NOT_FOUND:
                # Show error
                pass
            ProductStatusAndroid.NO_OFFERS_AVAILABLE:
                # Show ineligible message
                pass
```

### 9. Update Documentation (REQUIRED)

**Location:** `docs/` or `README.md`

**Documentation Checklist:**

For each new feature synced from openiap:

- [ ] **CHANGELOG.md** - Add entry for new version
- [ ] **API reference** - Function added with signature, params, return type
- [ ] **Type reference** - New types documented with all fields explained
- [ ] **Example code** - Working examples in documentation
- [ ] **Platform notes** - Version requirements (e.g., "iOS 18+", "Billing 8.0+")
- [ ] **Migration notes** - Breaking changes documented

**Example Documentation Entry:**
```markdown
## request_subscription_ios

### Win-Back Offers (iOS 18+)

Win-back offers re-engage churned subscribers:

```gdscript
var request = RequestSubscriptionIosProps.new()
request.sku = "premium_monthly"
request.win_back_offer = WinBackOfferInputIOS.new()
request.win_back_offer.offer_id = "winback_50_off"

var result = await iap.request_subscription_ios(request)
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
- GDScript patterns updated
- Error codes changed

**Content to sync:**

1. Installation (Godot Asset Library)
2. Core API reference (IAP module, Store class)
3. Key types (ProductIOS, PurchaseAndroid, etc.)
4. Signal patterns for purchase events
5. Platform-specific notes (StoreKit 2, Play Billing)
6. Error handling examples

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

## Naming Conventions (GDScript)

- **Classes:** PascalCase (e.g., `ProductIOS`, `RequestPurchaseResult`)
- **Methods:** snake_case (e.g., `from_dict()`, `to_dict()`)
- **Fields:** snake_case (e.g., `product_id`, `display_name`)
- **Enums:** UPPER_CASE (e.g., `ErrorCode.USER_CANCELLED`)
- **iOS types:** `IOS` suffix
- **Android types:** `Android` suffix

## Deprecation Check

```bash
cd $IAP_REPOS_HOME/godot-iap
grep -r "deprecated" addons/
grep -r "DEPRECATED" addons/
```

## Platform-Specific Notes

**iOS:**
- Uses StoreKit 2 via Swift bridge
- Check Apple-specific types in generated code

**Android:**
- Uses Google Play Billing via Java/Kotlin bridge
- Check Android-specific types in generated code

## Pre-commit Checklist

1. Types generated and copied
2. Implementation updated for new types
3. Examples updated
4. Tests passing
5. Documentation updated

**Full Sync Checklist:**

- [ ] openiap-versions.json synced
- [ ] Types regenerated and copied (`types.gd`)
- [ ] GDScript implementation updated (`iap.gd`, `store.gd`)
- [ ] GDExtension native code updated if needed
- [ ] Example code demonstrates new features
- [ ] Tests pass (GDUnit4)
- [ ] Documentation updated
- [ ] llms.txt files updated

### 11. Commit and Push

After completing all sync steps, create a branch and commit the changes:

```bash
cd $IAP_REPOS_HOME/godot-iap

# Create feature branch with version number
git checkout -b feat/openiap-sync-<gql-version>

# Example: feat/openiap-sync-1.3.12

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <version>, apple: <version>, google: <version>)
- Regenerate GDScript types
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

## Commit Message Format

```
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **OpenIAP GDScript Generator:** `$OPENIAP_HOME/openiap/packages/gql/scripts/generate-gdscript-types.mjs`
- **OpenIAP Docs:** https://openiap.dev/docs
- **Godot IAP Docs:** Check README.md
