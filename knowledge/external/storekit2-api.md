# StoreKit 2 API Reference

This document provides external API reference for Apple's StoreKit 2 framework.

## iOS 18+ Features

| Feature | iOS Version | Description |
|---------|-------------|-------------|
| Win-back offers | iOS 18.0 | Re-engage churned subscribers |
| Consumable transaction history | iOS 18.0 | History includes finished consumables |
| Billing issue messages | iOS 18.0 | Automatic billing issue notifications via StoreKit Message |
| UI context for purchases | iOS 18.2 | Required for proper payment sheet display |
| External purchase notice | iOS 18.2 | `presentExternalPurchaseNoticeSheetIOS` |
| `appTransactionID` | iOS 18.4 | Globally unique app transaction identifier (back-deployed to iOS 15) |
| `originalPlatform` | iOS 18.4 | Original purchase platform (back-deployed to iOS 15) |
| `Offer.Period` | iOS 18.4 | Offer period information |
| `advancedCommerceInfo` | iOS 18.4 | Advanced Commerce API data |
| Expanded offer codes | iOS 18.4 | For consumables/non-consumables |
| JWS promotional offers | WWDC 2025 | New `promotionalOffer` purchase option with JWS format |
| `introductoryOfferEligibility` | WWDC 2025 | Set eligibility via purchase option |

### WWDC 2025 Updates

- **SubscriptionStatus by Transaction ID**: Query subscription status using any transaction ID
- **JWS-based promotional offers**: New `promotionalOffer` purchase option with compact JWS string
- **Introductory offer eligibility**: Override eligibility check with `introductoryOfferEligibility` purchase option
- Both new purchase options are back-deployed to iOS 15

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
if let token = transaction.appAccountToken {
    // Token will only be present if a valid UUID was provided during purchase
    print("App Account Token: \(token)")
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

```swift
// Win-back offers are available in subscription.promotionalOffers
// with type == .winBack
let winBackOffers = product.subscription?.promotionalOffers.filter {
    $0.type == .winBack
}
```

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

## AppTransaction Updates (iOS 18.4+)

```swift
let appTransaction = try await AppTransaction.shared

// New in iOS 18.4 (back-deployed to iOS 15)
let appTransactionID = appTransaction.appTransactionID  // Globally unique per Apple Account
let originalPlatform = appTransaction.originalPlatform   // Original purchase platform
```

### appTransactionID

- Globally unique identifier for each Apple Account that downloads your app
- Remains consistent across redownloads, refunds, repurchases, and storefront changes
- Works with Family Sharing (each family member gets unique ID)
- Back-deployed to iOS 15

## Advanced Commerce API (iOS 18.4+)

For apps with large product catalogs:

```swift
// Check if product has advanced commerce info
if let advancedInfo = product.advancedCommerceInfo {
    // Handle large catalog monetization
}
```

## External Purchase Support (iOS 18.2+)

### Present External Purchase Notice

```swift
// Check if external purchase notice can be presented
if await ExternalPurchase.canPresent {
    let result = try await ExternalPurchase.presentNoticeSheet()
    switch result {
    case .continue:
        // User wants to continue to external purchase
    case .dismissed:
        // User dismissed the notice
    }
}
```

### Present External Purchase Link

```swift
let result = try await ExternalPurchase.open(url: externalURL)
```

> **OpenIAP Note**: `presentExternalPurchaseNoticeSheetIOS` and `presentExternalPurchaseLinkIOS` are available in the iOS package.
