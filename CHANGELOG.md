# Changelog

All notable changes to the OpenIAP monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [openiap-gql 1.3.2] - 2025-12-11

### Added

#### Google Play Billing Library 8.1.0 Support

- **`SubscriptionProductReplacementParamsAndroid`**: New type for per-product subscription replacement configuration
  - `oldProductId`: The product ID being replaced
  - `replacementMode`: The replacement mode enum value
- **`SubscriptionReplacementModeAndroid.KeepExisting`**: New replacement mode (8.1.0+) to keep the existing payment schedule unchanged

#### Google Play Billing Library 8.2.0 Support (Billing Programs API)

- **`BillingProgramAndroid`**: Enum for billing program types
  - `ExternalContentLink`: For apps linking to external content (reader apps, music streaming)
  - `ExternalOffer`: For apps offering alternative payment options
  - `Unspecified`: Default/unspecified value
- **`BillingProgramAvailabilityResultAndroid`**: Result type for billing program availability checks
  - `billingProgram`: The program that was checked
  - `isAvailable`: Whether the program is available
- **`BillingProgramReportingDetailsAndroid`**: Reporting details for external transactions
  - `billingProgram`: The billing program used
  - `externalTransactionToken`: Token for reporting to Google Play
- **`LaunchExternalLinkParamsAndroid`**: Parameters for launching external links
  - `billingProgram`: Which billing program to use
  - `launchMode`: How to launch the link
  - `linkType`: Type of external link
  - `linkUri`: The URI to launch
- **`ExternalLinkLaunchModeAndroid`**: Enum for external link launch modes
  - `LaunchInExternalBrowserOrApp`: Launch in external browser or app
  - `CallerWillLaunchLink`: Caller handles the link launch
  - `Unspecified`: Default value
- **`ExternalLinkTypeAndroid`**: Enum for external link types
  - `LinkToDigitalContentOffer`: Link to digital content offer
  - `LinkToAppDownload`: Link to app download
  - `Unspecified`: Default value

### Changed

- Updated `RequestSubscriptionAndroidProps` to include optional `subscriptionProductReplacementParams` field

---

## [openiap-google 1.3.12] - 2025-12-11

### Added

#### Google Play Billing Library 8.1.0 APIs

- **`applySubscriptionProductReplacementParams()`**: Apply per-product replacement params to subscription upgrades/downgrades
  - Enables `KeepExisting` replacement mode (only available via this API)
  - More granular control over subscription replacements at the product level

#### Google Play Billing Library 8.2.0 APIs (Billing Programs)

- **`enableBillingProgram(program: BillingProgramAndroid)`**: Enable a billing program before `initConnection()`
  - Must be called before connecting to configure the BillingClient
  - Available via both `OpenIapModule` and `OpenIapStore`
- **`isBillingProgramAvailable(program: BillingProgramAndroid)`**: Check if a billing program is available
  - Replaces deprecated `checkAlternativeBillingAvailability()` for external offers
  - Returns `BillingProgramAvailabilityResultAndroid` with availability status
- **`createBillingProgramReportingDetails(program: BillingProgramAndroid)`**: Create reporting details for external transactions
  - Replaces deprecated `createAlternativeBillingReportingToken()`
  - Returns `BillingProgramReportingDetailsAndroid` with `externalTransactionToken`
- **`launchExternalLink(activity: Activity, params: LaunchExternalLinkParamsAndroid)`**: Launch external link for external offers
  - Replaces deprecated `showAlternativeBillingInformationDialog()`
  - Supports configurable launch modes and link types

### Deprecated

The following APIs are deprecated in favor of the new Billing Programs API (8.2.0+):

- `checkAlternativeBillingAvailability()` → Use `isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer)`
- `showAlternativeBillingInformationDialog()` → Use `launchExternalLink(activity, params)`
- `createAlternativeBillingReportingToken()` → Use `createBillingProgramReportingDetails(BillingProgramAndroid.ExternalOffer)`

### Changed

- **Example App (`AlternativeBillingScreen`)**: Updated to demonstrate all three billing modes:
  - Billing Programs (8.2.0+) - Recommended
  - Alternative Billing Only (Legacy 6.2+)
  - User Choice Billing (Legacy 7.0+)
- **Error Handling**: Improved exception propagation in Proxy handlers using `resumeWithException()`
- **Null Safety**: Added null-safe activity handling to prevent potential NPE

### Fixed

- Empty catch blocks now properly log errors and display status messages to users
- Exception handling in coroutine Proxy handlers now correctly propagates exceptions

### Documentation

- Updated `external-purchase.tsx` with Billing Programs API (8.2.0+) documentation
- Added API Migration Guide table for legacy to new API mapping
- Updated Implementation Flow section with new step-by-step guide
- Added code examples for TypeScript, Kotlin, and Dart

---

## [openiap-gql 1.3.1 / openiap-google 1.3.11] - 2025-12-10

### Added

#### One-Time Purchase Discount Offers (Google Play Billing 7.0+)

- **`oneTimePurchaseOfferDetailsAndroid`**: Changed from single object to array to support multiple discount offers
- **`DiscountDisplayInfoAndroid`**: Discount display information
  - `discountPercent`: Percentage off
  - `discountAmount`: Discount amount details
- **`DiscountAmountAndroid`**: Discount amount with currency
- **`ValidTimeWindowAndroid`**: Start and end time for limited-time offers
- **`LimitedQuantityInfoAndroid`**: Limited quantity information
- **`RentalDetailsAndroid`**: Rental product metadata

#### Google Play Billing 8.1.0 Support

- **`PreorderDetailsAndroid`**: Pre-order product details
  - `preorderPresaleEndTimeMillis`: Presale end time
  - `preorderReleaseTimeMillis`: Release time
- **`isSuspendedAndroid`**: Detect suspended subscriptions due to payment failures

### Changed

- **Upgraded Google Play Billing Library**: 8.0.0 → 8.1.0
- **Increased minSdk**: 21 → 23 (Android 6.0)
- **Upgraded Kotlin**: 2.0.21 → 2.2.0

### Breaking Changes

- **`oneTimePurchaseOfferDetailsAndroid`** type changed from single object to array
  - Before: `product.oneTimePurchaseOfferDetailsAndroid?.formattedPrice`
  - After: `product.oneTimePurchaseOfferDetailsAndroid?.firstOrNull()?.formattedPrice`

### Documentation

- Added comprehensive "Discounts (Android)" documentation
- Updated types page with new Android fields

---

## [openiap-gql 1.3.0 / openiap-google 1.3.0 / openiap-apple 1.3.0] - 2025-12-08

### Added

- **`IapStore` enum**: Unified store identification
  - `Unknown`: Unknown store
  - `Apple`: Apple App Store
  - `Google`: Google Play Store
  - `Horizon`: Meta Horizon Store
- **`store` field**: Added to `PurchaseCommon` interface for consistent store identification
- **`verifyPurchaseWithProvider()`**: Server-side purchase verification API

### Changed

- **Renamed request props**: `ios`/`android` → `apple`/`google` in request payloads
  - `RequestPurchasePropsByPlatforms`: `ios` → `apple`, `android` → `google`
  - `RequestSubscriptionPropsByPlatforms`: `ios` → `apple`, `android` → `google`

### Deprecated

- **`platform` field**: Use `store` field instead
- **`ios`/`android` props**: Use `apple`/`google` props in request payloads

### Migration Guide

**Request props migration:**
```typescript
// Before (deprecated)
requestPurchase({
  request: {
    ios: { sku: 'product_id' },
    android: { skus: ['product_id'] }
  }
});

// After (recommended)
requestPurchase({
  request: {
    apple: { sku: 'product_id' },
    google: { skus: ['product_id'] }
  }
});
```

**Platform field migration:**
```typescript
// Before (deprecated)
if (purchase.platform === 'ios') { ... }

// After (recommended)
if (purchase.store === 'Apple') { ... }
```

---

## [1.2.2] - 2025-10-16

### Added

#### Monorepo Integration

- **Unified monorepo structure**: Consolidated all OpenIAP packages into a single monorepo for better maintainability and version synchronization
- **Centralized version management**: Single `openiap-versions.json` at root manages versions across all packages
- **Unified agent guidelines**: Consolidated `CLAUDE.md` with symlinks for `AGENTS.md` and `GEMINI.md` to provide consistent AI agent guidelines

#### Documentation

- **Enhanced documentation site** (`packages/docs`):
  - Improved API reference with consistent naming conventions
  - Platform-specific function documentation (iOS/Android suffixes)
  - Updated component architecture and code examples

#### Type Generation

- **Improved type generation workflow** (`packages/gql`):
  - Multi-platform type generation (TypeScript, Swift, Kotlin, Dart)
  - Automatic synchronization to platform packages
  - Streamlined generation scripts

#### Deployment

- **Automated deployment workflow**:
  - `npm run deploy <version>` command for production deployments
  - Local Vercel deployment for documentation site
  - GitHub Actions workflow for release artifacts and tagging
  - Automated artifact generation for all platforms (TypeScript, Dart, Kotlin, Swift)

#### Platform Libraries

- **Google (Android)** (`packages/google`):
  - Updated to version 1.2.12
  - Improved Kotlin type generation
  - Better Gradle build configuration

- **Apple (iOS/macOS)** (`packages/apple`):
  - Updated to version 1.2.23
  - Enhanced Swift type generation
  - Improved Package.swift configuration

### Changed

#### Repository Structure

- Migrated from separate repositories to unified monorepo
- All packages now share common tooling and CI/CD workflows
- Centralized dependency management

#### Version Management

- Changed from separate version files to unified `openiap-versions.json`
- All packages reference the root version file via symlinks
- Simplified version bumping and synchronization

#### CI/CD

- Updated GitHub Actions workflows for monorepo structure
- Separate workflows for platform-specific releases
- Unified release workflow for type artifacts

### Migration Notes

**For maintainers:**

- The monorepo is now the source of truth for all OpenIAP packages
- Version updates should be made in the root `openiap-versions.json`
- All agent guidelines are centralized in root `CLAUDE.md`

**For contributors:**

- Clone the monorepo instead of individual package repositories
- Run `bun install` at the root to install all dependencies
- Use workspace commands to work with specific packages (e.g., `bun run --filter docs build`)

**For consumers:**

- No breaking changes to public APIs
- Continue using platform-specific packages as before
- Artifacts are now available from the monorepo releases

---

## Pre-1.2.2 (Historical)

Prior to version 1.2.2, OpenIAP packages were maintained in separate repositories:

- `openiap-gql`: GraphQL schema and type generation
- `openiap-google`: Android library
- `openiap-apple`: iOS/macOS library
- `openiap.dev`: Documentation site

These have been consolidated into this monorepo as of version 1.2.2.

---

[1.2.2]: https://github.com/hyodotdev/openiap/releases/tag/v1.2.2
