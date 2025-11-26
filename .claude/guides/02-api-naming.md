# API Naming Conventions

## Platform Suffix Rules

### iOS-Specific Functions (IOS suffix)

Functions only available on iOS/macOS must end with `IOS`:

```text
clearTransactionIOS
getStorefrontIOS
getPromotedProductIOS
getPendingTransactionsIOS
isEligibleForIntroOfferIOS
subscriptionStatusIOS
currentEntitlementIOS
latestTransactionIOS
showManageSubscriptionsIOS
beginRefundRequestIOS
isTransactionVerifiedIOS
getTransactionJwsIOS
getReceiptDataIOS
syncIOS
presentCodeRedemptionSheetIOS
getAppTransactionIOS
```

### Android-Specific Functions (Android suffix)

Functions only available on Android must end with `Android`:

```text
acknowledgePurchaseAndroid
consumePurchaseAndroid
getPackageNameAndroid
```

### Cross-Platform Functions (No suffix)

Functions available on both platforms have no suffix:

```text
initConnection
endConnection
fetchProducts
requestPurchase
getAvailablePurchases
finishTransaction
verifyPurchase
getActiveSubscriptions
hasActiveSubscriptions
deepLinkToSubscriptions
getStorefront
restorePurchases
```

## Action Prefix Rules

| Prefix         | Usage                | Example                      |
| -------------- | -------------------- | ---------------------------- |
| `get`          | Retrieve data        | `getPromotedProductIOS`      |
| `fetch`        | Async data retrieval | `fetchProducts`              |
| `request`      | Initiate action      | `requestPurchase`            |
| `clear`        | Remove/reset         | `clearTransactionIOS`        |
| `is/has`       | Boolean checks       | `isEligibleForIntroOfferIOS` |
| `show/present` | Display UI           | `showManageSubscriptionsIOS` |
| `begin`        | Start process        | `beginRefundRequestIOS`      |
| `finish/end`   | Complete process     | `finishTransaction`          |

## URL Anchor Format

Use kebab-case for URL anchors:

- `fetchProducts` → `#fetch-products`
- `getAppTransactionIOS` → `#get-app-transaction-ios`
- `verifyPurchase` → `#verify-purchase`

## Package-Specific Rules

### In `packages/google` (Android-only package)

**DO NOT** add `Android` suffix to internal functions:

```kotlin
// Correct - inside Android package
fun acknowledgePurchase()
fun consumePurchase()

// Wrong - don't add Android suffix
fun acknowledgePurchaseAndroid()
```

### In `packages/apple` (iOS-only package)

iOS-specific functions still need `IOS` suffix for cross-platform API consistency:

```swift
// Correct
func presentCodeRedemptionSheetIOS()
func syncIOS()

// Cross-platform (no suffix)
func verifyPurchase()
```
