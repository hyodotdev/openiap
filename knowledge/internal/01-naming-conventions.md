# OpenIAP Naming Conventions

> **Priority: MANDATORY**
> These rules MUST be followed without exception.

## Platform-Specific Function Naming

### iOS Functions (packages/apple)

All iOS-specific functions MUST end with `IOS` suffix:

```swift
// CORRECT
func clearTransactionIOS()
func getStorefrontIOS()
func syncIOS()
func presentCodeRedemptionSheetIOS()
func showManageSubscriptionsIOS()
func isEligibleForIntroOfferIOS()
func subscriptionStatusIOS()
func currentEntitlementIOS()
func latestTransactionIOS()
func beginRefundRequestIOS()
func getReceiptDataIOS()
func getAppTransactionIOS()
func getTransactionJwsIOS()
func getPendingTransactionsIOS()
func getPromotedProductIOS()
func requestPurchaseOnPromotedProductIOS()

// INCORRECT - Missing IOS suffix
func clearTransaction()
func presentCodeRedemptionSheet()
func sync()
```

### Android Functions (packages/google)

In the `packages/google` directory (Android-only package), **DO NOT** add `Android` suffix:

```kotlin
// CORRECT - No Android suffix in Android package
fun acknowledgePurchase()
fun consumePurchase()
fun getPackageName()
fun buildModule(context: Context)
fun isFeatureSupported(feature: FeatureType)

// INCORRECT - Unnecessary Android suffix
fun acknowledgePurchaseAndroid()
fun consumePurchaseAndroid()
fun buildModuleAndroid()
```

**Exception**: Only use `Android` suffix for types that are part of a cross-platform API (e.g., `ProductAndroid`, `PurchaseAndroid` that contrast with iOS types).

### Cross-Platform Functions

Functions available on BOTH platforms have **NO** platform suffix:

```typescript
// CORRECT - Cross-platform, no suffix
fetchProducts()
requestPurchase()
getAvailablePurchases()
finishTransaction()
verifyPurchase()
initConnection()
endConnection()
getActiveSubscriptions()
hasActiveSubscriptions()
deepLinkToSubscriptions()
getStorefront()
```

## Action Prefix Rules

| Prefix | When to Use | Examples |
|--------|-------------|----------|
| `get` | Synchronous data retrieval | `getStorefrontIOS`, `getPackageName` |
| `fetch` | Async data retrieval from server | `fetchProducts` |
| `request` | User-initiated async operations | `requestPurchase` |
| `clear` | Remove/reset data | `clearTransactionIOS`, `clearProductsIOS` |
| `is/has` | Boolean checks | `isEligibleForIntroOfferIOS`, `hasActiveSubscriptions` |
| `show/present` | Display UI | `showManageSubscriptionsIOS`, `presentCodeRedemptionSheetIOS` |
| `begin` | Start a multi-step process | `beginRefundRequestIOS` |
| `finish/end` | Complete a process | `finishTransaction`, `endConnection` |
| `init` | Initialize resources | `initConnection` |
| `verify` | Validate data | `verifyPurchase` |
| `acknowledge` | Confirm receipt (Android) | `acknowledgePurchase` |
| `consume` | Mark as consumed (Android) | `consumePurchase` |

## Swift Acronym Rules

- **Acronyms should be ALL CAPS only when they appear as a suffix**
- **When acronyms appear at the beginning or middle, use Pascal case**

```swift
// CORRECT
OpenIAP       // Package name: Open at beginning, IAP as suffix
IapManager    // IAP at beginning
IapPurchase   // IAP at beginning
ProductIAP    // IAP as suffix

// INCORRECT
OpenIap       // Should be OpenIAP - IAP is suffix
IAPManager    // Should be IapManager - IAP at beginning
```

## File Naming

### TypeScript/JavaScript
- Use `kebab-case` for file names: `purchase-validator.ts`
- Use `PascalCase` for class/type files: `PurchaseValidator.ts` (when single class)

### Swift
- Use `PascalCase`: `OpenIapModule.swift`, `ProductManager.swift`

### Kotlin
- Use `PascalCase`: `OpenIapModule.kt`, `BillingManager.kt`

## URL Anchors and Search IDs

### URL Anchors

Use kebab-case for all URL anchors:

```
Function: fetchProducts     -> Anchor: #fetch-products
Function: getAppTransactionIOS -> Anchor: #get-app-transaction-ios
```

### Search Modal IDs

Use kebab-case for search modal IDs:

```typescript
// CORRECT
{ id: 'request-products' }
{ id: 'fetch-products' }

// INCORRECT
{ id: 'requestproducts' }
{ id: 'fetchProducts' }
```

## Variable Naming

```typescript
// CORRECT - camelCase for variables
const productId: string;
const isSubscription: boolean;
const purchaseToken: string;

// INCORRECT
const product_id: string;     // No snake_case
const IsSubscription: boolean; // No PascalCase for variables
```

## Deprecated Functions

When renaming functions, document the migration path:

| Deprecated | Use Instead |
|------------|-------------|
| `buy-promoted-product-ios` | `requestPurchaseOnPromotedProductIOS` |
| `requestProducts` | `fetchProducts` |
| `get-storefront-ios` | `getStorefront` |
| `validateReceipt` | `verifyPurchase` |
| `validateReceiptIOS` | `verifyPurchase` |
