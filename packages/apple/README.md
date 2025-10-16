# OpenIAP Apple

<div align="center">
  <img src="./logo.png" alt="OpenIAP Apple Logo" width="120" height="120">
</div>

<div align="center">
  <strong>A comprehensive Swift implementation of the <a href="https://openiap.dev">OpenIAP</a> specification for iOS, macOS, tvOS, and watchOS applications.</strong>
</div>

<div align="center">
  <a href="https://github.com/hyodotdev/openiap-apple">
    <img src="https://img.shields.io/github/v/tag/hyodotdev/openiap-apple?label=Swift%20Package&logo=swift&color=orange" alt="Swift Package" />
  </a>
  <a href="https://cocoapods.org/pods/openiap">
    <img src="https://img.shields.io/cocoapods/v/openiap?color=E35A5F&label=CocoaPods&logo=cocoapods" alt="CocoaPods" />
  </a>
  <a href="https://github.com/hyodotdev/openiap-apple/actions/workflows/test.yml">
    <img src="https://github.com/hyodotdev/openiap-apple/actions/workflows/test.yml/badge.svg" alt="Tests" />
  </a>
</div>

<br />

**OpenIAP** is a unified specification for in-app purchases across platforms, frameworks, and emerging technologies. This Apple ecosystem implementation standardizes IAP implementations to reduce fragmentation and enable consistent behavioral across all Apple platforms.

In the AI coding era, having a unified IAP specification becomes increasingly important as developers build applications across multiple platforms and frameworks with automated tools.

## 🌐 Learn More

Visit [**openiap.dev**](https://openiap.dev) for complete documentation, guides, and the full OpenIAP specification.

## ✨ Features

- ✅ **StoreKit 2** support with full iOS 15+ compatibility
- ✅ **Cross-platform** support (iOS, macOS, tvOS, watchOS)
- ✅ **Thread-safe** operations with MainActor isolation
- ✅ **Explicit connection management** with automatic listener cleanup
- ✅ **Multiple API levels** - Use `OpenIapModule.shared` or `OpenIapStore`
- ✅ **Product management** with intelligent caching
- ✅ **Purchase handling** with automatic transaction verification
  - Processes only StoreKit 2 verified transactions and emits updates.
- ✅ **Subscription management** with cancel/reactivate support
  - Opens App Store manage subscriptions UI for user cancel/reactivate and detects state changes.
- ✅ **Receipt validation** and transaction security
  - Provides Base64 receipt and JWS; verifies latest transaction via StoreKit and supports server-side validation.
- ✅ **Event-driven** purchase observation
- ✅ **Swift Package Manager** and **CocoaPods** support

## 📋 Requirements

| Platform | Minimum Version |
| -------- | --------------- |
| iOS      | 15.0+           |
| macOS    | 14.0+           |
| tvOS     | 15.0+           |
| watchOS  | 8.0+            |
| Swift    | 5.9+            |

## 📦 Installation

### Swift Package Manager

Add OpenIAP to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/hyodotdev/openiap-apple.git", from: "1.2.22")
]
```

Or through Xcode:

1. **File** → **Add Package Dependencies**
2. Enter: `https://github.com/hyodotdev/openiap-apple.git`
3. Select version and add to your target

### CocoaPods

Add to your `Podfile`:

```ruby
pod 'openiap', '~> 1.2.22'
```

Then run:

```bash
pod install
```

## 🚀 Quick Start

OpenIAP provides multiple ways to integrate in-app purchases, from super simple one-liners to advanced control. Choose the approach that fits your needs!

### Option 1: Shared Instance (Simplest)

Use `OpenIapModule.shared` for quick integration:

```swift
import OpenIAP

let module = OpenIapModule.shared

// Initialize connection
_ = try await module.initConnection()

// Fetch products
let products = try await module.fetchProducts(
    ProductRequest(skus: ["premium", "coins"], type: .all)
)

// Make a purchase
let purchase = try await module.requestPurchase(
    let purchase = try await module.requestPurchase(RequestPurchaseProps(request: .purchase(RequestPurchasePropsByPlatforms(android: nil, ios: RequestPurchaseIosProps(andDangerouslyFinishTransactionAutomatically: nil, appAccountToken: nil, quantity: 1, sku: "premium", withOffer: nil))), type: .inApp))
)

// Get available/restored purchases
let restored = try await module.getAvailablePurchases(nil)

// End connection when done
_ = try await module.endConnection()
```

### Option 2: OpenIapStore (SwiftUI Ready)

For more control while keeping it simple:

```swift
import OpenIAP

@MainActor
class StoreViewModel: ObservableObject {
    private let iapStore: OpenIapStore

    init() {
        // Setup store with event handlers
        self.iapStore = OpenIapStore(
            onPurchaseSuccess: { purchase in
                print("Purchase successful: \(purchase.productId)")
            },
            onPurchaseError: { error in
                print("Purchase failed: \(error.message)")
            }
        )

        Task {
            // Initialize connection
            try await iapStore.initConnection()

            // Fetch products
            try await iapStore.fetchProducts(
                skus: ["product1", "product2"],
                type: .inApp
            )
        }
    }

    deinit {
        Task {
            // End connection when done
            try await iapStore.endConnection()
        }
    }
}
```

### Option 3: OpenIapModule Direct (Low-level)

For complete control over the purchase flow:

```swift
import OpenIAP

@MainActor
func setupStore() async throws {
    let module = OpenIapModule.shared

    // Initialize connection first
    _ = try await module.initConnection()

    // Setup listeners
    let subscription = module.purchaseUpdatedListener { purchase in
        print("Purchase updated: \(purchase.productId)")
    }

    // Fetch and purchase
    let request = ProductRequest(skus: ["premium"], type: .all)
    let products = try await module.fetchProducts(request)

    let purchase = try await store.requestPurchase(sku: "premium")
    let purchase = try await module.requestPurchase(props)

    // When done, clean up
    module.removeListener(subscription)
    _ = try await module.endConnection()
}
```

## 🎯 API Architecture

OpenIAP now has a **simplified, minimal API** with just 2 main components:

### Core Components

1. **OpenIapModule** (`OpenIapModule.swift`)

   - Core StoreKit 2 implementation
   - Shared instance for simple usage
   - Low-level instance methods for advanced control

2. **OpenIapStore** (`OpenIapStore.swift`)
   - SwiftUI-ready with `@Published` properties
   - Explicit connection management (initConnection/endConnection)
   - Event callbacks for purchase success/error
   - Perfect for MVVM architecture

### Why This Design?

- **No Duplication**: Each component has a distinct purpose
- **Flexibility**: Use the shared module or the SwiftUI store
- **Simplicity**: Only 2 files to understand instead of 4+
- **Compatibility**: Maintains openiap.dev spec compliance

## 🧪 Testing

### Run Tests

```bash
# Via Swift Package Manager
swift test

# Via Xcode
⌘U (Product → Test)
```

### Test with Sandbox

1. Configure your products in **App Store Connect**
2. Create a **Sandbox Apple ID**
3. Use test card: `4242 4242 4242 4242`

### Server-Side Validation

OpenIAP provides comprehensive transaction verification with server-side receipt validation:

```swift
let store = OpenIapStore()
try await store.initConnection()

// Request purchase (validate server-side first)
let purchase = try await store.requestPurchase(
    try await store.requestPurchase(sku: "dev.hyo.premium")
)

// Validate on your server using purchase.purchaseToken
// Then finish the transaction manually
_ = try await store.finishTransaction(purchase: purchase, isConsumable: false)
```

## 🔄 Connection Management

The library provides explicit connection management with automatic listener cleanup.

### Key Benefits

1. **Explicit Connection Control**: You decide when to connect and disconnect
2. **Automatic Listener Cleanup**: Listeners are cleaned up on endConnection()
3. **Built-in Event Handling**: Purchase success/error callbacks are managed for you
4. **SwiftUI Ready**: Published properties for reactive UI updates
5. **Simplified API**: All common operations with sensible defaults

### Usage Pattern

```swift
class StoreViewModel: ObservableObject {
    private let iapStore = OpenIapStore()

    init() {
        Task {
            // Initialize connection
            try await iapStore.initConnection()

            // Fetch products
            try await iapStore.fetchProducts(skus: productIds)
        }
    }

    deinit {
        Task {
            // End connection (listeners cleaned up automatically)
            try await iapStore.endConnection()
        }
    }
}
```

## 📚 Data Models

Our Swift data models are generated from the shared GraphQL schema in the [`openiap` monorepo](https://github.com/hyodotdev/openiap/tree/main/packages/gql). Run `./scripts/generate-types.sh` to update `Sources/Models/Types.swift`, and every consumer—including the example app—should rely on those generated definitions instead of hand-written structs.

<details>
<summary>ProductIOS snapshot</summary>

```swift
struct ProductIOS {
    let id: String
    let title: String
    let description: String
    let type: ProductType
    let displayPrice: String
    let currency: String
    let price: Double?
    let platform: IapPlatform

    // iOS-specific properties
    let displayNameIOS: String
    let typeIOS: ProductTypeIOS
    let subscriptionInfoIOS: SubscriptionInfoIOS?
    let discountsIOS: [DiscountIOS]?
    let isFamilyShareableIOS: Bool
}
```

</details>

<details>
<summary>PurchaseIOS snapshot</summary>

```swift
struct PurchaseIOS {
    let id: String
    let productId: String
    let transactionDate: Double
    let purchaseToken: String?
    let purchaseState: PurchaseState
    let isAutoRenewing: Bool
    let quantity: Int
    let platform: IapPlatform

    // iOS-specific properties
    let appAccountToken: String?
    let environmentIOS: String?
    let storefrontCountryCodeIOS: String?
    let subscriptionGroupIdIOS: String?
    let transactionReasonIOS: String?
    let offerIOS: PurchaseOfferIOS?
}
```

</details>

### DiscountOffer

```swift
struct DiscountOffer {
    let identifier: String
    let keyIdentifier: String
    let nonce: String
    let signature: String
    let timestamp: String
}
```

## ⚡ Error Handling

OpenIAP provides comprehensive error handling:

```swift
// Unified error model
struct PurchaseError: LocalizedError {
    let code: String
    let message: String
    let productId: String?

    var errorDescription: String? { message }
}

// Create errors with predefined codes
let error = PurchaseError(code: "E_USER_CANCELLED", message: "User cancelled the purchase")
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🔄 Best Practices

1. **Choose the right API level**: Use `OpenIapModule.shared` for simple flows, or `OpenIapStore` for SwiftUI apps
2. **Handle errors appropriately**: Always check for user cancellations vs actual errors
3. **Validate receipts server-side**: Use `andDangerouslyFinishTransactionAutomatically: false` for server validation
4. **Test with Sandbox**: Always test purchases in App Store Connect Sandbox environment
5. **Monitor events**: Set up purchase listeners before making purchases

## 💬 Support

- 📖 **Documentation**: [openiap.dev](https://openiap.dev)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/hyodotdev/openiap-apple/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/hyodotdev/openiap-apple/discussions)
- 💬 **Community**: [Discord](https://discord.gg/openiap) (Coming Soon)

---

<div align="center">
  <strong>Built with ❤️ for the OpenIAP community</strong>
</div>
