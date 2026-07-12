# Audit Code Against Knowledge Rules

Automated workflow to check and fix code based on knowledge rules and latest platform APIs.

## Workflow

```text
1. Compile knowledge (re-index)
         ↓
2. Fetch latest API docs (WebSearch)
         ↓
3. Analyze code for rule violations
         ↓
4. Identify missing features
         ↓
5. Fix issues found
         ↓
6. Update documentation
         ↓
7. Verify fixes
```

## Steps

### 1. Re-compile Knowledge

First, re-index the knowledge base to ensure latest rules are applied:

```bash
cd scripts/agent && bun run compile:ai
```

### 2. Fetch Latest API Documentation

Use WebSearch to get the latest platform API information:

**Google Play Billing Library:**

- Search: "Google Play Billing Library release notes site:developer.android.com"
- Read the configured version from `packages/google/openiap/build.gradle.kts`
  and compare it with the latest stable version in the official release notes
- Key areas: one-time products, subscription offers, billing programs, Billing Choice, in-app messages

**Apple StoreKit 2:**

- Search: "StoreKit 2 updates site:developer.apple.com"
- Check WWDC announcements for new features
- Key areas: win-back offers, advanced commerce, offer codes

**Meta Horizon Billing:**

- Search: "Meta Horizon Billing Compatibility SDK release notes site:developers.meta.com"
- Check compatibility with Google Play Billing Library version
- Key areas: billing compatibility SDK version, API parity with Play flavor

**Amazon Appstore SDK:**

- Search: "Amazon Appstore SDK release notes site:developer.amazon.com"
- Compare the configured dependency in `packages/google/openiap/build.gradle.kts`
  with the latest official release
- Key areas: pending purchases, fulfillment results, add-on subscriptions

### 3. Analyze Codebase

Check each package against internal rules AND latest API capabilities:

**Packages to analyze:**

- `packages/apple/Sources/` - iOS/macOS Swift code
- `packages/google/openiap/src/{main,play,horizon,amazon}/` - Android Kotlin code
- `packages/gql/src/` - GraphQL schema (API definitions)

**Rules to check (from knowledge/internal/):**

- `01-naming-conventions.md` - Function naming (IOS suffix, no Android suffix in google package)
- `02-architecture.md` - Code organization, file structure
- `03-coding-style.md` - Explicit return types, error handling
- `04-platform-packages.md` - Package-specific rules

### 4. Feature Gap Analysis

Compare current implementation against latest platform APIs:

**Google Play Billing (check packages/gql/src/api-android.graphql):**

| Feature                                | Version | Check                                  |
| -------------------------------------- | ------- | -------------------------------------- |
| One-time products with multiple offers | 8.0     | Is it in schema?                       |
| Product-level status codes             | 8.0     | Returned in fetchProducts?             |
| BillingResult sub-response codes       | 8.0     | Preserved through every wrapper?       |
| Suspended subscriptions (isSuspended)  | 8.1     | Purchase type has it?                  |
| includeSuspended parameter             | 8.1     | getAvailablePurchases supports it?     |
| Billing Programs API                   | 8.2     | isBillingProgramAvailable implemented? |
| External Payments                      | 8.3     | Developer billing fields wired?        |
| Nullable developer billing link URI    | 9.0     | Null and empty URI handled safely?     |
| Opt-in price increase in-app messages  | 9.0     | showInAppMessagesAndroid implemented?  |
| Billing Choice                         | 9.1     | Info, dialog, and choice type wired?   |

**StoreKit 2 (check packages/gql/src/api-ios.graphql):**

| Feature                        | Version                            | Check                                    |
| ------------------------------ | ---------------------------------- | ---------------------------------------- |
| Win-back offers                | iOS 18                             | Supported in schema?                     |
| Consumable transaction history | iOS 18                             | getAllTransactionsIOS returns them?      |
| Billing issue messages         | iOS/Mac Catalyst 16.4, visionOS 1.0 | Event listener exists and messages still display? |
| Advanced Commerce API          | iOS 18.4                           | AdvancedCommerceProduct type?            |
| appTransactionID               | iOS 18.4                           | In AppTransaction type?                  |
| Expanded offer codes           | iOS 18.4                           | For consumables/non-consumables?         |
| Monthly annual commitments     | iOS 26.4+ runtime / Xcode 26.5 SDK | Pricing terms and purchase option wired? |
| Verified offer-code redemption | Xcode 27 beta                      | New result/options API represented?      |
| Group purchase seats           | WWDC 26                            | Seat-count request support or roadmap?   |

**Meta Horizon (check packages/google/openiap/src/horizon/):**

| Feature                               | Check                                       |
| ------------------------------------- | ------------------------------------------- |
| horizon-billing-compatibility version | Compare configured value with official docs |
| API parity with Play flavor           | Same APIs available in both?                |
| Shared code compatibility             | Uses only Billing 7.0 APIs?                 |
| getAvailableItems (Horizon-only)      | Implemented?                                |
| verifyPurchase S2S                    | verify_entitlement endpoint?                |

**Amazon Appstore (check packages/google/openiap/src/amazon/):**

| Feature              | Check                                       |
| -------------------- | ------------------------------------------- |
| Appstore SDK version | Compare configured value with official docs |
| Pending purchases    | Enabled before starting a purchase?         |
| Fulfillment          | Receipts reported with the correct result?  |
| Add-on subscriptions | Supported only when explicitly contracted?  |

**Version Compatibility (CRITICAL):**

| Check                       | Expected                             |
| --------------------------- | ------------------------------------ |
| Play flavor Billing version | Read from the Google build script    |
| Horizon SDK compatible with | Billing 7.0 API                      |
| Amazon Appstore SDK         | Latest audited stable version        |
| Shared code uses            | No flavor-specific store SDK APIs    |
| Framework requirements      | Read package metadata and setup docs |

### 5. Analysis Checklist

**Internal Rules Compliance:**

packages/apple (Swift):

- [ ] iOS-specific functions end with `IOS` suffix
- [ ] Cross-platform functions have NO suffix
- [ ] Acronyms follow Swift conventions (IapManager, not IAPManager)
- [ ] Types match OpenIAP specification

packages/google (Kotlin):

- [ ] Functions do NOT have `Android` suffix (it's Android-only package)
- [ ] Cross-platform functions have NO suffix
- [ ] Types.kt is not manually edited (auto-generated)
- [ ] Play, Horizon, and Amazon flavors compile
- [ ] Shared code is store-agnostic; Play-only APIs stay in `src/play`

packages/gql (GraphQL):

- [ ] Async operations have `# Future` comment
- [ ] Generated types are not manually edited
- [ ] Platform-specific APIs have correct suffix

**Latest API Coverage:**

- [ ] Configured Google Play Billing features implemented end-to-end
- [ ] StoreKit 2 iOS 18+ features implemented
- [ ] Meta Horizon Billing SDK up to date
- [ ] Amazon Appstore SDK up to date
- [ ] External API docs updated with new features
- [ ] New API comments lead with OpenIAP spec/package versions, then list the
      upstream platform SDK requirement

**Version Compatibility:**

- [ ] horizon-billing-compatibility matches latest
- [ ] Amazon Appstore SDK matches the latest audited stable release
- [ ] Shared code avoids flavor-specific SDK APIs
- [ ] react-native-iap/expo-iap compatible versions documented

### 6. Fix Issues

After identifying issues:

1. Read the relevant knowledge file for the rule
2. Read the violating code file
3. Fix the code to comply with the rule
4. For missing features: add to roadmap or implement

### 7. Update Documentation

When new features are implemented or APIs change, update ALL relevant documentation:

#### 7a. Knowledge Base (knowledge/external/)

Update external API reference docs:

- `google-billing-api.md` - Add new Google Play Billing features
- `storekit2-api.md` - Add new StoreKit 2 features
- `horizon-api.md` - Add new Meta Horizon Billing features, version compatibility
- `amazon-iap-api.md` - Add Amazon Appstore SDK features and version compatibility

#### 7b. User Documentation (packages/docs/)

Update the documentation site for users:

**Stable Release Notes:**

- `src/pages/docs/updates/releases.tsx` - Add release notes for the affected release
- Do not add RC or npm `next` publications from the `next` branch. Preserve the
  change evidence and add one grouped entry when the train reaches stable `main`.
- Verify every package version from its real metadata before writing the release list:
  `openiap-versions.json` only for `spec`, `google`, and `apple`;
  framework versions come from each library's package metadata
- Derive planned versions from the explicit release plan and stable metadata;
  release workflows own package-version commits
- Add GitHub Release links only after `gh release view <tag>` confirms the tag exists
- Document ALL changes: new features, bug fixes, breaking changes
- Add entry at the TOP of `allNotes` array (newest first)

Follow the current top entry and the package-grouping rules in
`knowledge/internal/05-docs-patterns.md`; do not copy historical version or tag
formats from older entries.

**API Reference Pages:**

- `src/pages/docs/apis/*.tsx` - Update function signatures, parameters, return types
- Add new functions to appropriate API pages (index.tsx, ios.tsx, android.tsx, etc.)
- Update deprecated function notices

**Type Documentation:**

- `src/pages/docs/types/*.tsx` - Update type definitions
- Add new types (enums, interfaces, input types)
- Document new fields on existing types
- Key files: product.tsx, purchase.tsx, offer.tsx, alternative.tsx, etc.

**Feature Documentation:**

- `src/pages/docs/features/*.tsx` - Add new feature pages if implementing major functionality
- Update existing feature pages with new options/parameters
- Include code examples for new features

#### 7c. Example Apps (REQUIRED)

Update example apps to demonstrate new features:

**iOS Example** (`packages/apple/Example/OpenIapExample/`):

- `Screens/` - Add new screens or update existing ones
- `Screens/uis/` - Add UI components for new features
- Key files:
  - `PurchaseFlowScreen.swift` - Purchase flow examples
  - `SubscriptionFlowScreen.swift` - Subscription examples
  - `AlternativeBillingScreen.swift` - External purchase examples
  - `AvailablePurchasesScreen.swift` - Purchase history examples

**Android Example** (`packages/google/Example/src/main/java/dev/hyo/martie/`):

- `screens/` - Add new screens or update existing ones
- `screens/uis/` - Add UI components for new features
- Key files:
  - `PurchaseFlowScreen.kt` - Purchase flow examples
  - `SubscriptionFlowScreen.kt` - Subscription examples
  - `AlternativeBillingScreen.kt` - External purchase examples
  - `AvailablePurchasesScreen.kt` - Purchase history examples

**Example Code Guidelines:**

- Demonstrate ALL new API features with working code
- Show both success and error handling
- Include comments explaining the feature
- Use realistic SKU names and user flows
- Test on actual devices before committing

**Example for Win-Back Offer (iOS):**

```swift
// In SubscriptionFlowScreen.swift
Button("Apply Win-Back Offer") {
    Task {
        let props = RequestSubscriptionIosProps(
            sku: "premium_monthly",
            winBackOffer: WinBackOfferInputIOS(offerId: "winback_50_off")
        )
        // ... purchase flow
    }
}
```

**Example for Product Status (Android):**

```kotlin
// In AllProductsScreen.kt
product.productStatusAndroid?.let { status ->
    when (status) {
        ProductStatusAndroid.Ok -> { /* Show product */ }
        ProductStatusAndroid.NotFound -> { /* Show error */ }
        ProductStatusAndroid.NoOffersAvailable -> { /* Show ineligible message */ }
        else -> { /* Handle unknown */ }
    }
}
```

#### 7d. Documentation Checklist

For each new feature implemented:

- [ ] **Release notes** - Entry added to `releases.tsx` with package versions
      verified from package metadata / release tags
- [ ] **API docs** - Function added to correct API page with signature, params, return type
- [ ] **Type docs** - New types documented with all fields explained
- [ ] **Example apps** - Working examples in iOS and Android example apps
- [ ] **Code examples** - Inline code examples in documentation
- [ ] **Platform notes** - Version requirements (e.g., "iOS 18+", "Billing 9.1+")
- [ ] **Cross-references** - Links between related functions/types
- [ ] **Search** - New items added to search index

#### 7e. Documentation Examples

**New Function (e.g., win-back offer):**

````mdx
## requestSubscription

### Parameters

| Name         | Type                 | Required | Description              |
| ------------ | -------------------- | -------- | ------------------------ |
| sku          | string               | ✅       | Product SKU              |
| winBackOffer | WinBackOfferInputIOS | ❌       | Win-back offer (iOS 18+) |

### Win-Back Offers (iOS 18+)

Win-back offers re-engage churned subscribers:

```typescript
await requestSubscription({
  sku: "premium_monthly",
  winBackOffer: { offerId: "winback_50_off" },
});
```
````

**New Type:**

```mdx
## ProductStatusAndroid

Product fetch status codes (Billing 8.0+).

| Value               | Description                  |
| ------------------- | ---------------------------- |
| OK                  | Product fetched successfully |
| NOT_FOUND           | SKU doesn't exist            |
| NO_OFFERS_AVAILABLE | User not eligible            |
```

### 8. Final Verification

Run the complete, fail-fast native matrix in
[`verify-all.md` step 1](verify-all.md#1-build-verification) without omitting its
consumer builds. That matrix is the verification SSOT and includes:

- React Native Nitrogen generation plus Android Gradle and iOS Xcode builds
- Expo clean native prebuilds plus Android Gradle and iOS Xcode builds
- Flutter Android and iOS consumer builds
- Godot Android and iOS bridge builds
- KMP tests and all three Android example flavors
- MAUI Android bindings for Play, Amazon, and Horizon, plus iOS/macCatalyst
  bindings and platform TFMs (the shared `net9.0`/`net10.0` TFMs are not a
  substitute)

After that matrix passes, rerun the audit-specific consistency gates:

```bash
set -euo pipefail

# Recompile agent-facing knowledge and verify docs/API parity.
(cd scripts/agent && bun run compile:ai && bun test && bun run typecheck)
(cd packages/docs && bun run format:check && bun run build)
bun run audit:parity
bun run audit:docs
git diff --check
```

**Important**: Always test ALL THREE Google flavors (Play, Horizon, and Amazon).

## Quick Commands

```bash
# Full audit (compile + analyze + report)
cd scripts/agent && bun run compile:ai
```

Then ask Claude to:

- "Search for latest Google Play Billing Library features and compare with our implementation"
- "Search for latest StoreKit 2 iOS 18 features and identify gaps"
- "Analyze packages/apple for naming convention violations and fix them"
- "Check all packages against internal knowledge rules and create fixes"

## Example Usage

Ask Claude Code:

> "Run /audit-code with latest API check"
> "Audit the configured Google Play Billing version against official release notes"
> "Check StoreKit implementation against the latest official APIs"

## Output

After running audit, you should have:

1. **Rule Violations Report** - List of internal rule violations found and fixed
2. **Feature Gap Report** - Missing platform features with implementation status
3. **Updated Knowledge Base** - knowledge/external/ updated with latest API info
4. **Updated User Docs** - packages/docs/ updated:
   - `releases.tsx` - Stable release notes when applicable, with package versions verified from metadata / release tags
   - API reference pages updated
   - Type documentation updated
5. **Updated Example Apps** - packages/\*/Example/ updated:
   - iOS example demonstrating new features
   - Android example demonstrating new features
6. **Roadmap Items** - New features to implement (if any)
