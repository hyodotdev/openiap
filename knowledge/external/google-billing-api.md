# Google Play Billing Library API Reference

> Reference documentation for Google Play Billing Library 8.x
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

Google Play Billing Library enables in-app purchases and subscriptions on Android devices.

## Version History

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 8.0 | 2025-06-30 | Auto-reconnect, product-level status codes, one-time products with multiple offers, sub-response codes |
| 8.1 | 2025-11-06 | Suspended subscriptions (`isSuspended`), `includeSuspended` parameter, pre-order details, product-level subscription replacement, `KEEP_EXISTING` mode |
| 8.2 | 2025-12-09 | Billing Programs API (external content links, external offers), deprecates old External Offers API |
| 8.2.1 | 2025-12-15 | Bug fix for `isBillingProgramAvailableAsync()` and `createBillingProgramReportingDetailsAsync()` |
| 8.3 | 2025-12-23 | External Payments program (Japan only), developer billing options |

**Current Version**: 8.3.0 (as of January 2026)

## Core Classes

### BillingClient

The main interface for communicating with Google Play Billing.

```kotlin
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases()
    // New in 8.0: Auto-reconnect on service disconnect
    .enableAutoServiceReconnection()
    .build()
```

### Auto Service Reconnection (8.0+)

```kotlin
// Enables automatic reconnection when service disconnects
BillingClient.newBuilder(context)
    .enableAutoServiceReconnection()
    .build()
```

When enabled, the library automatically re-establishes the connection if an API call is made while disconnected. This reduces `SERVICE_DISCONNECTED` errors.

> **OpenIAP Note**: Auto-reconnection is **always enabled** internally since OpenIAP uses Billing Library 8.3.0+. No configuration needed.

### Connection Management

```kotlin
billingClient.startConnection(object : BillingClientStateListener {
    override fun onBillingSetupFinished(billingResult: BillingResult) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            // Ready to query purchases
        }
    }

    override fun onBillingServiceDisconnected() {
        // Reconnect on next request
    }
})
```

## Product Details

### QueryProductDetailsParams

```kotlin
val productList = listOf(
    QueryProductDetailsParams.Product.newBuilder()
        .setProductId("product_id")
        .setProductType(BillingClient.ProductType.SUBS) // or INAPP
        .build()
)

val params = QueryProductDetailsParams.newBuilder()
    .setProductList(productList)
    .build()

billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
    // Handle product details
}
```

### ProductDetails Properties

| Property | Type | Description |
|----------|------|-------------|
| `productId` | String | Unique product identifier |
| `productType` | String | "subs" or "inapp" |
| `title` | String | Localized product title |
| `name` | String | Product name |
| `description` | String | Localized description |
| `oneTimePurchaseOfferDetails` | Object | For INAPP products |
| `subscriptionOfferDetails` | List | For subscription products |

### Subscription Offer Details

```kotlin
data class SubscriptionOfferDetails(
    val basePlanId: String,
    val offerId: String?,
    val offerToken: String,
    val pricingPhases: PricingPhases,
    val offerTags: List<String>
)
```

### Pricing Phases

```kotlin
data class PricingPhase(
    val formattedPrice: String,
    val priceAmountMicros: Long,
    val priceCurrencyCode: String,
    val billingPeriod: String,  // ISO 8601 (P1W, P1M, P1Y)
    val billingCycleCount: Int,
    val recurrenceMode: Int     // FINITE or INFINITE
)
```

## Purchase Flow

### Launch Purchase Flow

```kotlin
val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
    .setProductDetails(productDetails)
    .setOfferToken(offerToken) // For subscriptions
    .build()

val billingFlowParams = BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(productDetailsParams))
    .build()

val billingResult = billingClient.launchBillingFlow(activity, billingFlowParams)
```

### PurchasesUpdatedListener

```kotlin
val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
    when (billingResult.responseCode) {
        BillingClient.BillingResponseCode.OK -> {
            purchases?.forEach { purchase ->
                handlePurchase(purchase)
            }
        }
        BillingClient.BillingResponseCode.USER_CANCELED -> {
            // User cancelled
        }
        else -> {
            // Handle error
        }
    }
}
```

## Purchase Verification & Acknowledgement

### Verify Purchase

```kotlin
val purchase: Purchase

// Check purchase state
if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
    // Verify signature server-side
    // Then acknowledge or consume
}
```

### Acknowledge Purchase (Subscriptions/Non-consumables)

```kotlin
if (!purchase.isAcknowledged) {
    val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
        .setPurchaseToken(purchase.purchaseToken)
        .build()

    billingClient.acknowledgePurchase(acknowledgePurchaseParams) { billingResult ->
        // Handle result
    }
}
```

### Consume Purchase (Consumables)

```kotlin
val consumeParams = ConsumeParams.newBuilder()
    .setPurchaseToken(purchase.purchaseToken)
    .build()

billingClient.consumeAsync(consumeParams) { billingResult, purchaseToken ->
    // Handle result
}
```

## Query Existing Purchases

```kotlin
// Query subscriptions
billingClient.queryPurchasesAsync(
    QueryPurchasesParams.newBuilder()
        .setProductType(BillingClient.ProductType.SUBS)
        .build()
) { billingResult, purchasesList ->
    // Handle existing subscriptions
}

// Query in-app products
billingClient.queryPurchasesAsync(
    QueryPurchasesParams.newBuilder()
        .setProductType(BillingClient.ProductType.INAPP)
        .build()
) { billingResult, purchasesList ->
    // Handle existing purchases
}
```

## Purchase Properties

| Property | Type | Description |
|----------|------|-------------|
| `orderId` | String | Unique order identifier |
| `purchaseToken` | String | Token for verification |
| `purchaseState` | Int | PENDING, PURCHASED, UNSPECIFIED |
| `purchaseTime` | Long | Timestamp in milliseconds |
| `products` | List<String> | Product IDs in purchase |
| `isAcknowledged` | Boolean | Whether acknowledged |
| `isAutoRenewing` | Boolean | Auto-renewal status |
| `quantity` | Int | Quantity purchased |

## Response Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | OK | Success |
| 1 | USER_CANCELED | User cancelled |
| 2 | SERVICE_UNAVAILABLE | Network error |
| 3 | BILLING_UNAVAILABLE | Billing not available |
| 4 | ITEM_UNAVAILABLE | Item not available |
| 5 | DEVELOPER_ERROR | Invalid arguments |
| 6 | ERROR | Fatal error |
| 7 | ITEM_ALREADY_OWNED | Already owned |
| 8 | ITEM_NOT_OWNED | Not owned |

## Feature Support

```kotlin
// Check if feature is supported
val result = billingClient.isFeatureSupported(BillingClient.FeatureType.SUBSCRIPTIONS)
if (result.responseCode == BillingClient.BillingResponseCode.OK) {
    // Subscriptions are supported
}
```

### Feature Types

- `SUBSCRIPTIONS` - Subscription support
- `SUBSCRIPTIONS_UPDATE` - Subscription upgrades/downgrades
- `PRICE_CHANGE_CONFIRMATION` - Price change confirmation
- `PRODUCT_DETAILS` - Product details API

## Product-Level Status Codes (8.0+)

In Billing Library 8.0+, `queryProductDetailsAsync()` returns products that couldn't be fetched with a status code explaining why.

```kotlin
billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
    productDetailsList.forEach { productDetails ->
        when (productDetails.productStatus) {
            ProductDetails.ProductStatus.OK -> {
                // Product fetched successfully
            }
            ProductDetails.ProductStatus.NOT_FOUND -> {
                // SKU doesn't exist in Play Console
            }
            ProductDetails.ProductStatus.NO_OFFERS_AVAILABLE -> {
                // User not eligible for any offers
            }
        }
    }
}
```

| Status | Description |
|--------|-------------|
| `OK` | Product fetched successfully |
| `NOT_FOUND` | SKU doesn't exist in Play Console |
| `NO_OFFERS_AVAILABLE` | User not eligible for any offers |

## Suspended Subscriptions (8.1+)

```kotlin
val purchase: Purchase

// Check if subscription is suspended due to billing issue
if (purchase.isSuspended) {
    // User's payment method failed
    // Do NOT grant entitlements
    // Direct user to subscription center to fix payment
}
```

### Query Suspended Subscriptions (8.1+)

```kotlin
// Include suspended subscriptions in query results
val params = QueryPurchasesParams.newBuilder()
    .setProductType(BillingClient.ProductType.SUBS)
    .setIncludeSuspended(true)  // New in 8.1
    .build()

billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
    purchases.forEach { purchase ->
        if (purchase.isSuspended) {
            // Handle suspended subscription
        }
    }
}
```

> **OpenIAP Note**: Use `includeSuspendedAndroid: true` in `PurchaseOptions` when calling `getAvailablePurchases()`. The `isSuspendedAndroid` field on purchases indicates suspension status.

## Sub-Response Codes (8.0+)

`BillingResult` includes a sub-response code for more granular error information:

```kotlin
val result = billingClient.launchBillingFlow(activity, params)
when (result.subResponseCode) {
    BillingResult.SUB_RESPONSE_CODE_INSUFFICIENT_FUNDS -> {
        // User's payment method has insufficient funds
    }
    BillingResult.SUB_RESPONSE_CODE_USER_INELIGIBLE -> {
        // User doesn't meet offer eligibility requirements
    }
}
```

| Sub-Response Code | Description |
|-------------------|-------------|
| `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS` | User's payment method has insufficient funds |
| `USER_INELIGIBLE` | User doesn't meet subscription offer eligibility |
| `NO_APPLICABLE_SUB_RESPONSE_CODE` | No specific sub-code applies |

## Subscription Product Replacement (8.1+)

Product-level replacement parameters for subscription upgrades/downgrades:

```kotlin
val replacementParams = SubscriptionProductReplacementParams.newBuilder()
    .setOldProductId("old_subscription_id")
    .setReplacementMode(ReplacementMode.WITH_TIME_PRORATION)
    .build()

val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
    .setProductDetails(newProductDetails)
    .setOfferToken(offerToken)
    .setSubscriptionProductReplacementParams(replacementParams)  // New in 8.1
    .build()
```

### Replacement Modes

| Mode | Description |
|------|-------------|
| `WITH_TIME_PRORATION` | Immediate, expiration time prorated |
| `CHARGE_PRORATED_PRICE` | Immediate, same billing cycle |
| `CHARGE_FULL_PRICE` | Immediate, full price charged |
| `WITHOUT_PRORATION` | Takes effect on old plan expiration |
| `DEFERRED` | Deferred, no charge |
| `KEEP_EXISTING` | Keep existing payment schedule (8.1+) |

## Best Practices

1. **Always acknowledge purchases** within 3 days or they will be refunded
2. **Verify purchases server-side** using Google Play Developer API
3. **Handle pending purchases** for payment methods that require additional steps
4. **Auto-reconnect is enabled by default** in OpenIAP (8.0+)
5. **Check product status codes** (8.0+) to understand why products weren't fetched
6. **Check isSuspended** (8.1+) before granting entitlements
7. **Cache product details** to avoid repeated queries
