# Apple Package Guide

Location: `packages/apple/`

## Overview

iOS/macOS in-app purchase library using StoreKit 2.

## Directory Structure

```text
packages/apple/
├── Sources/
│   ├── OpenIapModule.swift      # Core implementation
│   ├── OpenIapStore.swift       # SwiftUI-friendly store
│   ├── OpenIapProtocol.swift    # API interface definitions
│   ├── Models/
│   │   ├── Types.swift          # AUTO-GENERATED - DO NOT EDIT
│   │   ├── Product.swift        # ProductIOS type
│   │   ├── Purchase.swift       # PurchaseIOS type
│   │   └── ActiveSubscription.swift
│   └── Helpers/
│       ├── ProductManager.swift # Thread-safe product caching
│       └── IapStatus.swift      # UI status for SwiftUI
├── Tests/
├── scripts/
│   └── generate-types.sh        # Type generation script
└── openiap-versions.json        # Version management
```

## Key Files

### OpenIapProtocol.swift

Defines the public API interface:

```swift
public protocol OpenIapModuleProtocol {
    func initConnection() async throws -> Bool
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void
    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    // ... more methods
}
```

### OpenIapModule.swift

Main implementation with StoreKit 2 integration.

### OpenIapStore.swift

SwiftUI-compatible wrapper with `@Observable` pattern.

## Type Generation

Types.swift is auto-generated from GraphQL schema.

**Never edit Types.swift directly!**

```bash
# Generate types
./scripts/generate-types.sh

# Or with specific version
OPENIAP_GQL_VERSION=1.0.10 ./scripts/generate-types.sh
```

## Version Management

```bash
# Bump version
./scripts/bump-version.sh patch  # 1.2.5 → 1.2.6
./scripts/bump-version.sh minor  # 1.2.5 → 1.3.0
./scripts/bump-version.sh 1.3.0  # Set specific version
```

## Testing

```bash
swift test
swift build
```

## Android No-Op Events

Android-specific events are **no-ops** on iOS. When removing listeners for these events:

- Log an info message with `os_log(.info, ...)`
- Simply return without action

| Event | Behavior on iOS |
|-------|-----------------|
| `userChoiceBillingAndroid` | No-op, logs info |
| `developerProvidedBillingAndroid` | No-op, logs info |

### Guidelines for No-Op Implementations

When implementing no-ops for Android-only features:

1. **Use `os_log(.info, ...)`** so messages appear in system logs
2. **Include "(no-op)" suffix** in log message for clarity
3. **Format**: `os_log(.info, "featureName is not supported on iOS (no-op)")`

```swift
// Correct - visible in Console.app
case .userChoiceBillingAndroid:
    os_log(.info, "userChoiceBillingAndroid is not supported on iOS (no-op)")
```

## Deployment

Via GitHub Actions "Apple Release" workflow:

- Creates Git tag `apple-vX.X.X`
- Publishes to CocoaPods
- SPM uses Git tags automatically
