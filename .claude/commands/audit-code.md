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
- Check for new features in latest version (currently 8.x)
- Key areas: one-time products, subscription offers, billing programs

**Apple StoreKit 2:**
- Search: "StoreKit 2 updates site:developer.apple.com"
- Check WWDC announcements for new features
- Key areas: win-back offers, advanced commerce, offer codes

**Meta Horizon Billing:**
- Search: "Meta Horizon Billing Compatibility SDK release notes site:developers.meta.com"
- Check compatibility with Google Play Billing Library version
- Key areas: billing compatibility SDK version, API parity with Play flavor

### 3. Analyze Codebase

Check each package against internal rules AND latest API capabilities:

**Packages to analyze:**
- `packages/apple/Sources/` - iOS/macOS Swift code
- `packages/google/openiap/src/main/` - Android Kotlin code
- `packages/gql/src/` - GraphQL schema (API definitions)

**Rules to check (from knowledge/internal/):**
- `01-naming-conventions.md` - Function naming (IOS suffix, no Android suffix in google package)
- `02-architecture.md` - Code organization, file structure
- `03-coding-style.md` - Explicit return types, error handling
- `04-platform-packages.md` - Package-specific rules

### 4. Feature Gap Analysis

Compare current implementation against latest platform APIs:

**Google Play Billing (check packages/gql/src/api-android.graphql):**

| Feature | Version | Check |
|---------|---------|-------|
| One-time products with multiple offers | 8.0 | Is it in schema? |
| Product-level status codes | 8.0 | Returned in fetchProducts? |
| Suspended subscriptions (isSuspended) | 8.1 | Purchase type has it? |
| includeSuspended parameter | 8.1 | getAvailablePurchases supports it? |
| Billing Programs API | 8.2 | isBillingProgramAvailable implemented? |

**StoreKit 2 (check packages/gql/src/api-ios.graphql):**

| Feature | Version | Check |
|---------|---------|-------|
| Win-back offers | iOS 18 | Supported in schema? |
| Consumable transaction history | iOS 18 | getPendingTransactionsIOS returns them? |
| Billing issue messages | iOS 18 | Event listener exists? |
| Advanced Commerce API | iOS 18.4 | AdvancedCommerceProduct type? |
| appTransactionID | iOS 18.4 | In AppTransaction type? |
| Expanded offer codes | iOS 18.4 | For consumables/non-consumables? |

**Meta Horizon (check packages/google/openiap/src/horizon/):**

| Feature | Check |
|---------|-------|
| horizon-billing-compatibility version | Is it latest? (currently 1.1.1) |
| API parity with Play flavor | Same APIs available in both? |
| Shared code compatibility | Uses only Billing 7.0 APIs? |
| getAvailableItems (Horizon-only) | Implemented? |
| verifyPurchase S2S | verify_entitlement endpoint? |

**Version Compatibility (CRITICAL):**

| Check | Expected |
|-------|----------|
| Play flavor Billing version | 8.x |
| Horizon SDK compatible with | Billing 7.0 API |
| Shared code uses | Only 7.0-compatible APIs |
| react-native-iap requires | v14+, RN 0.79+, Kotlin 2.0+ |

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
- [ ] Both Play and Horizon flavors compile
- [ ] Shared code uses only Billing 7.0 APIs

packages/gql (GraphQL):
- [ ] Async operations have `# Future` comment
- [ ] Generated types are not manually edited
- [ ] Platform-specific APIs have correct suffix

**Latest API Coverage:**
- [ ] Google Play Billing 8.x features implemented
- [ ] StoreKit 2 iOS 18+ features implemented
- [ ] Meta Horizon Billing SDK up to date
- [ ] External API docs updated with new features

**Version Compatibility:**
- [ ] horizon-billing-compatibility matches latest
- [ ] Shared code avoids Billing 8.x-only APIs
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

#### 7b. User Documentation (packages/docs/)

Update the documentation site for users:

**Release Notes (REQUIRED):**
- `src/pages/docs/updates/notes.tsx` - Add release notes for next patch version
- Check current version in `openiap-versions.json` and increment patch
- Document ALL changes: new features, bug fixes, breaking changes
- Add entry at the TOP of `allNotes` array (newest first)

Example notes.tsx entry:
```typescript
// Add to TOP of allNotes array in notes.tsx
{
  id: 'gql-1-3-13-google-1-3-24-apple-1-3-11',  // kebab-case id
  date: new Date('2026-01-20'),
  element: (
    <div key="gql-1-3-13-google-1-3-24-apple-1-3-11" style={noteCardStyle}>
      <AnchorLink id="gql-1-3-13-google-1-3-24-apple-1-3-11" level="h4">
        📅 openiap-gql v1.3.13 / openiap-google v1.3.24 / openiap-apple v1.3.11 - Feature Name
      </AnchorLink>

      <p><strong>iOS - Win-Back Offers (iOS 18+):</strong></p>
      <ul>
        <li><code>winBackOffer</code> - New field in RequestSubscriptionIosProps</li>
        <li>Re-engage churned subscribers with discounts</li>
      </ul>

      <p><strong>Android - Product Status Codes (Billing 8.0+):</strong></p>
      <ul>
        <li><code>ProductStatusAndroid</code> - New enum (OK, NOT_FOUND, NO_OFFERS_AVAILABLE)</li>
        <li><code>productStatusAndroid</code> - New field on ProductAndroid</li>
      </ul>

      <p><strong>References:</strong></p>
      <ul>
        <li><a href="/docs/types/product">Product Types Documentation</a></li>
      </ul>
    </div>
  ),
},
```

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

- [ ] **Release notes** - Entry added to `notes.tsx` with next patch version
- [ ] **API docs** - Function added to correct API page with signature, params, return type
- [ ] **Type docs** - New types documented with all fields explained
- [ ] **Example apps** - Working examples in iOS and Android example apps
- [ ] **Code examples** - Inline code examples in documentation
- [ ] **Platform notes** - Version requirements (e.g., "iOS 18+", "Billing 8.0+")
- [ ] **Cross-references** - Links between related functions/types
- [ ] **Search** - New items added to search index

#### 7e. Documentation Examples

**New Function (e.g., win-back offer):**
```mdx
## requestSubscription

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sku | string | ✅ | Product SKU |
| winBackOffer | WinBackOfferInputIOS | ❌ | Win-back offer (iOS 18+) |

### Win-Back Offers (iOS 18+)

Win-back offers re-engage churned subscribers:

```typescript
await requestSubscription({
  sku: 'premium_monthly',
  winBackOffer: { offerId: 'winback_50_off' }
});
```
```

**New Type:**
```mdx
## ProductStatusAndroid

Product fetch status codes (Billing 8.0+).

| Value | Description |
|-------|-------------|
| OK | Product fetched successfully |
| NOT_FOUND | SKU doesn't exist |
| NO_OFFERS_AVAILABLE | User not eligible |
```

### 8. Final Verification

```bash
# Type check all packages
cd packages/apple && swift build
cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin && ./gradlew :openiap:compileHorizonDebugKotlin
cd packages/gql && bun run typecheck
```

**Important**: Always test BOTH Google flavors (Play and Horizon).

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
> "Audit the codebase including latest Google Play Billing 8.x features"
> "Check implementation against latest StoreKit 2 iOS 18.4 APIs"

## Output

After running audit, you should have:

1. **Rule Violations Report** - List of internal rule violations found and fixed
2. **Feature Gap Report** - Missing platform features with implementation status
3. **Updated Knowledge Base** - knowledge/external/ updated with latest API info
4. **Updated User Docs** - packages/docs/ updated:
   - `notes.tsx` - Release notes for next version
   - API reference pages updated
   - Type documentation updated
5. **Updated Example Apps** - packages/*/Example/ updated:
   - iOS example demonstrating new features
   - Android example demonstrating new features
6. **Roadmap Items** - New features to implement (if any)
