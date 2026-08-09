# StoreKit 2 API Reference

This document provides external API reference for Apple's StoreKit 2 framework.

## Recent StoreKit Features

| Feature                                                        | iOS Version                           | Description                                                                                         |
| -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Win-back offers                                                | iOS 18.0                              | Re-engage churned subscribers                                                                       |
| `Product.SubscriptionInfo.RenewalInfo.eligibleWinBackOfferIDs` | iOS 18.0                              | Query win-back offer eligibility before purchase                                                    |
| Consumable transaction history                                 | iOS 18.0                              | Opt-in via `SKIncludeConsumableInAppPurchaseHistory` Info.plist key                                 |
| StoreKit `Message.billingIssue`                                | iOS / Mac Catalyst 16.4, visionOS 1.0 | Listener for subscription billing issues (`Message` is unavailable on macOS, tvOS, and watchOS)     |
| UI context for purchases                                       | iOS 18.2                              | Required for proper payment sheet display                                                           |
| External purchase notice                                       | iOS 17.4                              | `ExternalPurchase.presentNoticeSheet()`                                                             |
| `appTransactionID`                                             | iOS 18.4                              | Globally unique app transaction identifier (back-deployed to iOS 15)                                |
| `originalPlatform`                                             | iOS 18.4                              | Original purchase platform (back-deployed to iOS 15)                                                |
| `Transaction.offerPeriod`                                      | iOS 18.4                              | Offer period information on Transaction                                                             |
| `Transaction.advancedCommerceInfo`                             | iOS 18.4                              | Advanced Commerce API data on Transaction                                                           |
| `Transaction.appTransactionID`                                 | iOS 18.4                              | Per-Apple-Account identifier on Transaction                                                         |
| Expanded offer codes                                           | iOS 18.4                              | Offer codes for consumables/non-consumables                                                         |
| JWS promotional offers                                         | WWDC 2025                             | New `promotionalOffer` purchase option with JWS format                                              |
| `introductoryOfferEligibility`                                 | WWDC 2025                             | Set eligibility via purchase option                                                                 |
| `SubscriptionStatus` by Transaction ID                         | WWDC 2025                             | `status(for: transactionID:)`                                                                       |
| Monthly subscriptions with a 12-month commitment               | iOS 26.4+ runtime / Xcode 26.5 SDK    | Monthly billing option for annual auto-renewable subscriptions                                      |
| Subscription Bundles and Suites                                | Apple 27 / Xcode 27 beta SDK          | Read-only product, bundled-subscription, transaction, and renewal metadata                          |
| Bundle ownership and revocation metadata                       | Xcode 27 beta SDK                     | Back-deployed assigned ownership, bundle-upgrade reason, assignment revocation, and unbundling data |
| `AppTransaction.storeType`, `revocationDate`                   | Xcode 27 beta SDK                     | App-acquisition channel and back-deployed revocation timestamp                                      |
| `AppTransaction.all`                                           | Apple 27 / Xcode 27 beta SDK          | Async sequence of app-acquisition records; not exported as an OpenIAP 3 operation                   |
| `AppStore.Platform.managed`                                    | Xcode 27 beta SDK                     | Back-deployed managed-distribution acquisition platform                                             |
| Advanced Commerce item partners                                | Apple 27 / Xcode 27 beta SDK          | Partner identifiers and names in each item-details JSON payload                                     |
| Group purchases and volume purchasing                          | Announced at WWDC 2026                | Group Purchases are planned for later in 2026; Xcode 27 beta 4 has no public StoreKit group API     |
| Retention Messaging                                            | WWDC 2026                             | Cancellation-flow messaging and offers, including real-time server decisioning                      |
| Retention offer type                                           | WWDC 2026                             | Signed transaction / renewal info can report offer type `5` for retention offers                    |
| Offer codes for all IAP types                                  | 2026                                  | Offer codes expand beyond auto-renewable subscriptions; IAP promo-code creation ends March 26, 2026 |

### StoreKit Message presentation

Iterating `Message.messages` transfers presentation control to the app. A
listener that only inspects `Message.Reason.billingIssue` must not silently
discard other reasons such as price-increase consent or win-back offers. Display
each message with `message.display(in:)` unless the app intentionally implements
and documents a custom delay or suppression policy. OpenIAP preserves StoreKit's
default presentation while additionally emitting its cross-platform billing
issue event.

### WWDC 2025 Updates

- **SubscriptionStatus by Transaction ID**: `SubscriptionInfo.Status.status(for: transactionID:)` accepts any transaction ID, not just SKU.
- **JWS-based promotional offers**: New `promotionalOffer` purchase option with compact JWS string.
- **Introductory offer eligibility**: Override eligibility check with `introductoryOfferEligibility` purchase option.
- Both new purchase options are back-deployed to iOS 15.

### WWDC 2026 Updates

- **Monthly subscriptions with a 12-month commitment**: The Xcode 26.5 SDK adds a monthly billing plan for one-year auto-renewable subscriptions. Customers can subscribe on iOS, iPadOS, macOS, tvOS, and visionOS 26.4+.
- **Subscription Bundles and Suites**: The Xcode 27 beta SDK exposes read-only product types, component-subscription metadata, bundle transaction identifiers, and renewal unbundling state. OpenIAP maps these fields without inventing enrollment, seat, or management operations.
- **Bundle ownership and revocation metadata**: StoreKit can report assigned ownership, a bundle-upgrade revocation reason, assignment revocation type, and an unbundled expiration reason. OpenIAP preserves these values without adding assignment-management operations.
- **App acquisition and Advanced Commerce metadata**: `AppTransaction.storeType` reports the acquisition channel, `revocationDate` reports a revoked app acquisition, `AppStore.Platform.managed` identifies managed distribution, and Advanced Commerce item details expose partner identifiers and names.
- **App-acquisition history**: StoreKit exposes `AppTransaction.all` as an async sequence. OpenIAP 3 does not export it because app-acquisition history is a different contract from the in-app transaction history returned by `getAllTransactionsIOS`.
- **Presentation and refund errors**: The Xcode 27 SDK adds `StoreKitError.invalidPresentationContext` and `RefundRequestError.ineligible`. OpenIAP keeps these inside its canonical `PurchaseError` boundary instead of expanding the cross-platform error enum with Apple-only cases.
- **Group purchases and volume purchasing**: Apple announced multi-seat subscriptions and an Apple-managed invitation flow. Group Purchases are scheduled for later in 2026 and Xcode 27 beta 4 does not expose a public StoreKit group-purchase contract. Volume purchasing is managed through Apple Business Manager and Apple School Manager.
- **Volume pricing**: App Store Connect can configure up to five seat-count price bands for larger subscription purchases.
- **Retention Messaging**: App Store Connect can show cancellation-flow retention messages and offers. Real-time Retention Messaging adds a server-to-server decision point and supports a switch-plan view for monthly subscriptions with a 12-month commitment.
- **Offer-code expansion**: Offer codes now support consumables, non-consumables, non-renewing subscriptions, and broader auto-renewable subscription scenarios. Starting March 26, 2026, App Store Connect no longer creates new promo codes for In-App Purchases.

### Verified Offer-Code Redemption (WWDC 2026)

The new UIKit/AppKit redemption API accepts `RedeemOption` values and returns
the redeemed transaction as a `VerificationResult<Transaction>`:

```swift
let result = try await AppStore.presentOfferCodeRedeemSheet(
    from: viewController,
    options: []
)
```

SwiftUI exposes the same result through
`offerCodeRedemption(options:isPresented:onCompletion:)`. These APIs require the
Xcode 27 beta SDK and are currently beta. Xcode 26.x SDKs expose the StoreKit 2
scene-based `AppStore.presentOfferCodeRedeemSheet(in:)` API, which presents the
sheet but does not return the redeemed transaction.

OpenIAP 3 changes `presentCodeRedemptionSheetIOS` to return `PurchaseIOS?`.
Xcode 27 builds call the new API, require a verified result, and return the
mapped transaction on Apple 27+ runtimes. Older result paths use the StoreKit 2
scene API on iOS 16+ and visionOS 1+ and return `nil` after presentation; iOS 15
retains the StoreKit 1 fallback. In Mac Catalyst apps, the scene API throws
`StoreKitError.unknown`, while the Catalyst 15 StoreKit 1 call has no effect and
returns `nil`. Nil results from an actually presented sheet rely on the
transaction listener or explicit purchase reconciliation. Xcode 27 beta 4
declares `RedeemOption`,
but its public symbol graph exposes no constructible option values, so OpenIAP
currently passes an empty set.

### Subscription Bundles and Suites (Xcode 27 beta)

StoreKit 27 introduces two subscription product kinds:

- `subscriptionBundle`: independently purchasable subscriptions sold together.
- `subscriptionSuite`: subscriptions available only as one suite.

OpenIAP treats both as cross-platform `subs` products and preserves the detailed
Apple value through `ProductTypeIOS.subscriptionBundle` or
`ProductTypeIOS.subscriptionSuite`. `ProductSubscriptionIOS` also exposes
`bundledSubscriptionsIOS`, including each component's identity, display
metadata, price, Family Sharing state, and subscription-group metadata.

Existing transaction and renewal APIs return the Apple bundle linkage without
adding a new purchase operation:

- `PurchaseIOS.bundleOriginalTransactionIdIOS`,
  `bundleProductIdIOS`, `bundleSubscriptionGroupIdIOS`,
  `bundleTransactionIdIOS`, and `previousOriginalTransactionIdIOS`.
- `RenewalInfoIOS.bundleOriginalTransactionId`, `bundleProductId`,
  `bundleSubscriptionGroupId`, and `willUnbundle`.
- `PurchaseIOS.ownershipTypeIOS` can report `assigned`,
  `revocationReasonIOS` can report `upgraded_to_bundle`, and
  `revocationTypeIOS` preserves StoreKit's raw revocation type, including
  assignment revocation.
- `RenewalInfoIOS.expirationReason` preserves StoreKit's raw integer string,
  including the Xcode 27 SDK's back-deployed `unbundled` case.
- `AppTransaction.storeType` and `revocationDate`; `originalPlatform` can
  report the back-deployed `managed` acquisition platform.
- Advanced Commerce item-details JSON includes `partners` on Apple 27.

These fields are compiled only with the Xcode 27 SDK. StoreKit back-deploys the
transaction and renewal bundle metadata where Apple declares it available, but
the new product kinds and bundled-product catalog require Apple 27 runtimes.
Test the catalog and transaction mappings with an Xcode 27 StoreKit
configuration before using beta metadata in production logic.

StoreKit 27 also exposes `AppTransaction.all`. OpenIAP 3 intentionally keeps
`getAppTransactionIOS` as the current verified app-acquisition record and
`getAllTransactionsIOS` as in-app transaction history; it does not conflate
either API with Apple's new app-acquisition history sequence.

## appAccountToken

A UUID that associates a purchase with a user account in your system. This property allows you to correlate App Store transactions with users in your backend.

### Important: UUID Format Requirement

**The `appAccountToken` must be a valid UUID format.** If you provide a non-UUID string (e.g., `"user-123"` or `"my-account-id"`), Apple's StoreKit will silently return `null` for this field in the transaction response.

#### Valid UUID Examples

```swift
// Valid UUIDs - these will be returned correctly
"550e8400-e29b-41d4-a716-446655440000"
"6ba7b810-9dad-11d1-80b4-00c04fd430c8"
UUID().uuidString  // Generate new UUID
```

#### Invalid Examples (Will Return null)

```swift
// Invalid - NOT UUID format, Apple returns null silently
"user-123"
"my-account-token"
"abc123"
```

### Usage in Purchase Options

```swift
let appAccountToken = UUID()
let result = try await product.purchase(options: [
    .appAccountToken(appAccountToken)
])
```

### Retrieving from Transaction

```swift
let transaction: Transaction
if transaction.appAccountToken != nil {
    // Token will only be present if a valid UUID was provided during purchase
    print("App Account Token available")
}
```

### Best Practices

1. **Generate UUIDs per user**: Create and store a UUID for each user in your system
2. **Use consistent tokens**: Use the same UUID for all purchases from the same user
3. **Server-side mapping**: Map the UUID to your internal user ID on your server
4. **Don't use user IDs directly**: Convert your user IDs to UUIDs rather than using them directly

### References

- [Apple Developer Documentation: appAccountToken](https://developer.apple.com/documentation/storekit/transaction/appaccounttoken)
- [GitHub Issue: expo-iap #128](https://github.com/hyochan/expo-iap/issues/128)

## Product

A type that describes an in-app purchase product.

### Properties

```swift
let id: String                    // The product identifier
let type: Product.ProductType     // The type of product
let displayName: String           // Localized display name
let description: String           // Localized description
let displayPrice: String          // Localized price string
let price: Decimal               // Price as decimal
let subscription: Product.SubscriptionInfo?  // Subscription details
```

### Methods

#### products(for:)

```swift
static func products(for identifiers: [String]) async throws -> [Product]
```

Fetches products from the App Store.

#### purchase(options:)

```swift
func purchase(options: Set<Product.PurchaseOption> = []) async throws -> Product.PurchaseResult
```

Initiates a purchase for this product.

## Transaction

Represents a completed purchase transaction.

### Properties

```swift
let id: UInt64                   // Unique transaction ID
let originalID: UInt64           // Original transaction ID
let productID: String            // Product identifier
let purchaseDate: Date           // When the purchase occurred
let expirationDate: Date?        // Subscription expiration date
let revocationDate: Date?        // When the transaction was revoked
let isUpgraded: Bool             // Whether this subscription was upgraded
let environment: AppStore.Environment  // sandbox or production
```

### Methods

#### currentEntitlements

```swift
static var currentEntitlements: Transaction.Entitlements
```

A sequence of the customer's current entitlements.

#### latest(for:)

```swift
static func latest(for productID: String) async -> VerificationResult<Transaction>?
```

Gets the latest transaction for a product.

#### finish()

```swift
func finish() async
```

Marks the transaction as finished.

## AppStore

Provides access to App Store functionality.

### Methods

#### sync()

```swift
static func sync() async throws
```

Syncs transactions with the App Store.

#### showManageSubscriptions(in:)

```swift
static func showManageSubscriptions(in scene: UIWindowScene) async throws
```

Shows the subscription management UI.

#### beginRefundRequest(for:in:)

```swift
static func beginRefundRequest(for transactionID: UInt64, in scene: UIWindowScene) async throws -> Transaction.RefundRequestStatus
```

Begins a refund request for a transaction.

## Win-Back Offers (iOS 18+)

Win-back offers are a new offer type to re-engage churned subscribers.

### Automatic Presentation

StoreKit Message automatically presents win-back offers when a user is eligible:

```swift
// Message reason for win-back offers
StoreKit.Message.Reason.winBackOffer
```

### Manual Application

Apply a win-back offer during purchase:

```swift
let product: Product
let winBackOffer: Product.SubscriptionOffer

let result = try await product.purchase(options: [
    .winBackOffer(winBackOffer)
])
```

### Checking Eligibility

Discover eligible win-back offers before purchase via
`Product.SubscriptionInfo.RenewalInfo.eligibleWinBackOfferIDs` (iOS 18+):

```swift
let status = try await product.subscription?.status.first
guard let renewalInfo = try status?.renewalInfo.payloadValue else { return }

// iOS 18+: offer IDs the current Apple Account is eligible for
let eligibleIDs = renewalInfo.eligibleWinBackOfferIDs
let eligibleOffers = (product.subscription?.winBackOffers ?? []).filter {
    eligibleIDs.contains($0.id ?? "")
}
```

> **OpenIAP gap**: callers can apply a known win-back offer identifier, but the
> public product/renewal types do not yet expose `winBackOffers` or
> `eligibleWinBackOfferIDs` for discovery.

### RenewalInfo

Win-back offer information is available in renewal info:

```swift
let renewalInfo: Product.SubscriptionInfo.RenewalInfo

// Check if win-back offer is applied to next renewal
if renewalInfo.renewalOfferType == .winBack {
    // Win-back offer will be applied
}
```

## UI Context for Purchases (iOS 18.2+)

Beginning in iOS 18.2, purchase methods require a UI context to properly display payment sheets:

```swift
// iOS/iPadOS/tvOS/visionOS: UIViewController
let result = try await product.purchase(confirmIn: viewController)

// macOS: NSWindow
let result = try await product.purchase(confirmIn: window)

// watchOS: No UI context required
```

> **OpenIAP Note**: UI context is handled automatically in OpenIAP using the active window scene.

## AppTransaction Identity Updates (Xcode 16.4+; back-deployed)

```swift
let appTransaction = try await AppTransaction.shared

// Introduced in iOS 18.4 (back-deployed to the AppTransaction baseline)
let appTransactionID = appTransaction.appTransactionID  // Globally unique per Apple Account
let originalPlatform = appTransaction.originalPlatform   // Typed value on iOS 18.4+
```

OpenIAP uses `originalPlatformStringRepresentation` on older runtimes. The typed
`originalPlatform` property starts at iOS 18.4, macOS 15.4, tvOS 18.4, watchOS
11.4, and visionOS 2.4.

## AppTransaction Acquisition Updates (Xcode 27 SDK)

```swift
let appTransaction = try await AppTransaction.shared

// Public in the Xcode 27 SDK and back-deployed to these existing runtimes
let revocationDate = appTransaction.revocationDate        // App-acquisition revocation
// Runtime-gated to Apple 27+
let storeType = appTransaction.storeType                  // Acquisition store channel
```

### appTransactionID

- Globally unique identifier for each Apple Account that downloads your app
- Remains consistent across redownloads, refunds, repurchases, and storefront changes
- Works with Family Sharing (each family member gets unique ID)
- Back-deployed to iOS 15

The Xcode 27 SDK also adds the back-deployed `managed` platform case, which
OpenIAP returns through `originalPlatform`, and exposes `revocationDate` for
revoked app-acquisition records. `storeType` identifies consumer, education,
enterprise, or a future StoreKit acquisition channel.

## Transaction Updates (iOS 18.4+)

iOS 18.4 added three new read-only properties to `Transaction` (not just `AppTransaction`):

```swift
let transaction: Transaction

// iOS 18.4+ — all back-deployed to iOS 15
let txAppTransactionID = transaction.appTransactionID        // Apple Account identifier
let offerPeriod = transaction.offerPeriod                    // Offer.Period?
let advancedCommerce = transaction.advancedCommerceInfo      // AdvancedCommerceInfo?
```

| Property               | Type                  | Notes                                   |
| ---------------------- | --------------------- | --------------------------------------- |
| `appTransactionID`     | String                | Mirrors AppTransaction's identifier     |
| `offerPeriod`          | Offer.Period?         | Phase of the promotional/intro offer    |
| `advancedCommerceInfo` | AdvancedCommerceInfo? | Present for Advanced Commerce SKUs only |

## Advanced Commerce API (iOS 18.4+)

For apps with large product catalogs:

```swift
// Check if product has advanced commerce info
if let advancedInfo = product.advancedCommerceInfo {
    // Handle large catalog monetization
}
```

For Advanced Commerce transactions, OpenIAP maps
`AdvancedCommerceInfoIOS.period` as an optional `SubscriptionPeriodValueIOS`
containing the subscription period `unit` and integer `value`.

## Monthly Subscriptions With 12-Month Commitment (iOS 26.4+)

This billing plan lets customers pay monthly while committing to an annual
auto-renewable subscription. Apps need to compile with the Xcode 26.5 SDK to
merchandise the plan, and customers can purchase on Apple platforms running
26.4 or later.

```swift
let result = try await product.purchase(options: [
    .billingPlanType(.monthly)
])
```

> **OpenIAP Note**: The schema represents this with
> `SubscriptionBillingPlanTypeIOS` and `RequestSubscriptionIosProps.billingPlanType`.

## Group Purchases and Volume Purchasing (WWDC 2026)

Apple announced multi-seat auto-renewable subscriptions for groups or
organizations, with an Apple-managed invitation flow. Volume purchasing is
handled by Apple Business Manager and Apple School Manager.

Group Purchases are planned for later in 2026. The Xcode 27 beta 4 StoreKit
module and its public symbol graph expose no group-purchase request option,
seat-count field, transaction property, or group-management identifier.
OpenIAP must not invent a schema contract before Apple publishes one. Add the
feature only after a public SDK symbol can be compiled, exercised with StoreKit
Testing, and mapped consistently across every OpenIAP language target.

## Retention Messaging (WWDC 2026)

Retention Messaging lets App Store Connect present messages and optional offers
when a subscriber is about to cancel. Real-time Retention Messaging can call a
server endpoint so the developer can choose the message, offer, or switch-plan
view at cancellation time.

Signed transaction and renewal information can include a retention offer as
offer type `5`.

## StoreKit Message API (iOS 16.0+; billing issue on iOS 16.4+; win-back on iOS 18+)

Listen for App Store–generated messages (billing issues, win-back offers, price increases, generic).

```swift
// Somewhere near app launch. This all-cases sample targets iOS 18+.
Task {
    for await message in Message.messages {
        switch message.reason {
        case .billingIssue:
            // Show UI when user is ready; display from message.display(in:)
            break
        case .winBackOffer:
            break
        case .priceIncreaseConsent:
            break
        case .generic:
            break
        @unknown default:
            break
        }
    }
}
```

| Reason                  | Availability | Trigger                                                  |
| ----------------------- | ------------ | -------------------------------------------------------- |
| `.billingIssue`         | iOS 16.4+    | User has an unresolved billing problem on a subscription |
| `.priceIncreaseConsent` | iOS 16.0+    | Price change that requires user consent                  |
| `.winBackOffer`         | iOS 18.0+    | User is eligible for a win-back offer                    |
| `.generic`              | iOS 16.0+    | All other system-initiated messages                      |

> **OpenIAP Note**: OpenIAP displays every StoreKit message and additionally
> surfaces `.billingIssue` through `subscriptionBillingIssue`; other reasons
> are not separate OpenIAP events.

## SubscriptionStatus by Transaction ID (WWDC 2025)

```swift
// WWDC 2025: look up status using any transactionID, not just a SKU
let status = try await Product.SubscriptionInfo.Status.status(for: transactionID)
```

## Consumable Transaction History (iOS 18+)

By default, `Transaction.all` omits finished consumables. Opt in by adding this key to **Info.plist**:

```xml
<key>SKIncludeConsumableInAppPurchaseHistory</key>
<true/>
```

With the key set, finished consumable transactions are included in
`Transaction.all`, `Transaction.latest(for:)`, and `Product.latestTransaction`.

## External Purchase Support (iOS 17.4+)

`ExternalPurchase.presentNoticeSheet()` / `ExternalPurchaseLink.open(url:)`
ship on iOS 17.4+. The follow-on custom-link APIs
(`ExternalPurchaseCustomLink.isEligible`, `showNotice(type:)`,
`token(for:)`) are iOS 18.1+.

### Present External Purchase Notice

```swift
// Check if external purchase notice can be presented
if await ExternalPurchase.canPresent {
    let result = try await ExternalPurchase.presentNoticeSheet()
    switch result {
    case .continuedWithExternalPurchaseToken(let token):
        // Send the token to your backend reporting flow
        preserveForBackend(token)
    case .cancelled:
        break
    }
}
```

### Present External Purchase Link

```swift
try await ExternalPurchaseLink.open(url: externalURL)
```

> **OpenIAP Note**: `presentExternalPurchaseNoticeSheetIOS` is available on
> iOS 17.4+ and macOS 14.4+. The current
> `presentExternalPurchaseLinkIOS` implementation uses `UIApplication` and is
> not supported on macOS.
