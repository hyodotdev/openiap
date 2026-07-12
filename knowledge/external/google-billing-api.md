# Google Play Billing Library API Reference

> Reference documentation for Google Play Billing Library 9.x
> Adapt all patterns to match OpenIAP internal conventions.

## Overview

Google Play Billing Library enables in-app purchases and subscriptions on Android devices.

## Version History

| Version | Release Date | Key Features                                                                                                                                           |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8.0     | 2025-06-30   | Auto-reconnect, product-level status codes, one-time products with multiple offers, sub-response codes                                                 |
| 8.1     | 2025-11-06   | Suspended subscriptions (`isSuspended`), `includeSuspended` parameter, pre-order details, product-level subscription replacement, `KEEP_EXISTING` mode |
| 8.2     | 2025-12-09   | Billing Programs API (external content links, external offers), deprecates old External Offers API                                                     |
| 8.2.1   | 2025-12-15   | Bug fix for `isBillingProgramAvailableAsync()` and `createBillingProgramReportingDetailsAsync()`                                                       |
| 8.3     | 2025-12-23   | External Payments program (Japan only), developer billing options                                                                                      |
| 9.0     | 2026-05-19   | Removes older deprecated APIs, reclassifies blocked Play Store activity errors, adds richer sub-response handling, target SDK 35                       |
| 9.1     | 2026-06-18   | Billing Choice APIs: `getBillingChoiceInfoAsync()`, `showBillingProgramInformationDialog()`, choice-screen details                                     |

**Current Version**: 9.1.0 (as of July 2026)

> **OpenIAP audit note**: `packages/google` is pinned to Play Billing 9.1.0.
> Billing Choice APIs are implemented only in the Play flavor; Horizon and
> Amazon variants keep unsupported/default behavior for APIs that do not exist
> in their store SDKs.

### External Offer integration rule (8.2.1+)

Although the Billing Programs APIs were introduced in 8.2.0, Google requires
8.2.1 or later for External Offer integrations because 8.2.1 fixes the
availability and reporting-details APIs. The in-app sequence is:

1. Enable only `BillingProgram.EXTERNAL_OFFER` while building the client.
2. Check `isBillingProgramAvailableAsync`.
3. Call `createBillingProgramReportingDetailsAsync` immediately before each
   redirect session. Do not cache or reuse its external transaction token for a
   later redirect. Google permits the same token to report multiple purchases
   made during that one external-offer session.
4. Call `launchExternalLink` and proceed only when it succeeds.
5. If payment completes, report the transaction and token from the backend.

Do not also enable the deprecated `enableExternalOffer` or
`enableAlternativeBillingOnly` modes. Those legacy flows use different APIs
and must remain available only through explicit legacy configuration.

Official references: [External Offer in-app integration](https://developer.android.com/google/play/billing/external/integration),
[Play Billing release notes](https://developer.android.com/google/play/billing/release-notes).

## Core Classes

### BillingClient

The main interface for communicating with Google Play Billing.

```kotlin
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases(
        PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()
    )
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

> **OpenIAP Note**: Auto-reconnection is enabled internally when the Play
> Billing version exposes the API. No OpenIAP app-level configuration is needed.

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

billingClient.queryProductDetailsAsync(params) { billingResult, queryResult ->
    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
        queryResult.productDetailsList.forEach { productDetails ->
            // Handle fetched product details
        }
        queryResult.unfetchedProductList.forEach { unfetchedProduct ->
            // Inspect unfetchedProduct.statusCode for per-product failures
        }
    }
}
```

### ProductDetails Properties

| Property                          | Type   | Description                                           |
| --------------------------------- | ------ | ----------------------------------------------------- |
| `productId`                       | String | Unique product identifier                             |
| `productType`                     | String | "subs" or "inapp"                                     |
| `title`                           | String | Localized product title                               |
| `name`                            | String | Product name                                          |
| `description`                     | String | Localized description                                 |
| `oneTimePurchaseOfferDetailsList` | List   | All INAPP purchase options and discount offers (8.0+) |
| `oneTimePurchaseOfferDetails`     | Object | Legacy single-offer compatibility accessor            |
| `subscriptionOfferDetails`        | List   | For subscription products                             |

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

| Property         | Type         | Description                     |
| ---------------- | ------------ | ------------------------------- |
| `orderId`        | String       | Unique order identifier         |
| `purchaseToken`  | String       | Token for verification          |
| `purchaseState`  | Int          | PENDING, PURCHASED, UNSPECIFIED |
| `purchaseTime`   | Long         | Timestamp in milliseconds       |
| `products`       | List<String> | Product IDs in purchase         |
| `isAcknowledged` | Boolean      | Whether acknowledged            |
| `isAutoRenewing` | Boolean      | Auto-renewal status             |
| `quantity`       | Int          | Quantity purchased              |

## Response Codes

| Code | Constant            | Description                              |
| ---- | ------------------- | ---------------------------------------- |
| 0    | OK                  | Success                                  |
| 1    | USER_CANCELED       | User cancelled                           |
| 2    | SERVICE_UNAVAILABLE | Billing service is currently unavailable |
| 3    | BILLING_UNAVAILABLE | Billing not available                    |
| 4    | ITEM_UNAVAILABLE    | Item not available                       |
| 5    | DEVELOPER_ERROR     | Invalid arguments                        |
| 6    | ERROR               | Fatal error                              |
| 7    | ITEM_ALREADY_OWNED  | Already owned                            |
| 8    | ITEM_NOT_OWNED      | Not owned                                |
| 12   | NETWORK_ERROR       | Network connection problem               |

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
billingClient.queryProductDetailsAsync(params) { billingResult, queryResult ->
    if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
        return@queryProductDetailsAsync
    }

    queryResult.productDetailsList.forEach { productDetails ->
        // Product fetched successfully
    }

    queryResult.unfetchedProductList.forEach { unfetchedProduct ->
        when (unfetchedProduct.statusCode) {
            UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND -> {
                // SKU doesn't exist in Play Console
            }
            UnfetchedProduct.StatusCode.NO_ELIGIBLE_OFFER -> {
                // User not eligible for any offers
            }
            UnfetchedProduct.StatusCode.INVALID_PRODUCT_ID_FORMAT,
            UnfetchedProduct.StatusCode.UNKNOWN -> {
                // Invalid request or an unspecified per-product failure
            }
        }
    }
}
```

| Status                      | Description                       |
| --------------------------- | --------------------------------- |
| `PRODUCT_NOT_FOUND`         | SKU doesn't exist in Play Console |
| `NO_ELIGIBLE_OFFER`         | User not eligible for any offers  |
| `INVALID_PRODUCT_ID_FORMAT` | Product ID format is invalid      |
| `UNKNOWN`                   | Unspecified per-product failure   |

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
override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
  when (result.onPurchasesUpdatedSubResponseCode) {
    BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS -> {
        // User's payment method has insufficient funds
    }
    BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE -> {
        // User doesn't meet offer eligibility requirements
    }
  }
}
```

| Sub-Response Code                            | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS` | User's payment method has insufficient funds     |
| `USER_INELIGIBLE`                            | User doesn't meet subscription offer eligibility |
| `NO_APPLICABLE_SUB_RESPONSE_CODE`            | No specific sub-code applies                     |

PBL 9 makes sub-response-code handling part of the migration checklist. It also
changes blocked Play Store app cases from generic `ERROR` to
`BILLING_UNAVAILABLE`, with a debug message explaining that Play Store is
blocked.

> **OpenIAP Note**: Purchase failures delivered by
> `purchaseErrorListener` preserve this value as
> `PurchaseError.subResponseCodeAndroid` when Play supplies it. Available in
> OpenIAP Spec 2.3.0 / openiap-google 2.4.0 (requires Play Billing 8.0+).

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

| Mode                    | Description                           |
| ----------------------- | ------------------------------------- |
| `WITH_TIME_PRORATION`   | Immediate, expiration time prorated   |
| `CHARGE_PRORATED_PRICE` | Immediate, same billing cycle         |
| `CHARGE_FULL_PRICE`     | Immediate, full price charged         |
| `WITHOUT_PRORATION`     | Takes effect on old plan expiration   |
| `DEFERRED`              | Deferred, no charge                   |
| `KEEP_EXISTING`         | Keep existing payment schedule (8.1+) |

## User Choice Billing Details (9.1+ fields)

`UserChoiceBillingListener` receives `UserChoiceDetails` when the user selects
developer billing from Google's user-choice screen. Read product identifiers
from `UserChoiceDetails.Product.getId()`; `Product.toString()` is diagnostic
text and is not the product ID contract.

```kotlin
val listener = UserChoiceBillingListener { details ->
    val externalTransactionToken = details.externalTransactionToken
    val originalExternalTransactionId = details.originalExternalTransactionId
    val products = details.products.map { product ->
        Triple(product.id, product.type, product.offerToken)
    }
}
```

OpenIAP keeps the compatibility `products` ID list and also exposes
`productDetailsAndroid` with each product's ID, type, and optional offer token.
For a developer-billed subscription replacement, forward
`originalExternalTransactionId` together with the external transaction token
to the backend reporting flow. These two fields are available in OpenIAP Spec
2.3.0 / openiap-google 2.4.0 (requires Play Billing 9.1+).

## External Payments Program (8.3+)

Billing Library 8.3 (December 2025) added support for the External Payments program (Japan-only, as of launch). Developers enrolled in the program can offer alternative payment methods alongside Google Play billing.

### Enable Developer Billing Option

```kotlin
// During BillingClient setup
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases(
        PendingPurchasesParams.newBuilder()
            .enableOneTimeProducts()
            .build()
    )
    .enableAutoServiceReconnection()
    .enableBillingProgram(
        EnableBillingProgramParams.newBuilder()
            .setBillingProgram(BillingClient.BillingProgram.EXTERNAL_PAYMENTS)
            .setDeveloperProvidedBillingListener(developerBillingListener)
            .build()
    )
    .build()
```

### DeveloperProvidedBillingListener

```kotlin
val developerBillingListener = DeveloperProvidedBillingListener { details ->
    // All nullable fields depend on the selected program and flow.
    val token: String? = details.externalTransactionToken
    val linkUri: String? = details.linkUri
    val originalTransactionId: String? = details.originalExternalTransactionId
    val products: List<DeveloperProvidedBillingDetails.Product> = details.products
}
```

### Launch Purchase with External Payments Option

```kotlin
val params = BillingFlowParams.newBuilder()
    .setProductDetailsParamsList(listOf(productDetailsParams))
    .enableDeveloperBillingOption(
        DeveloperBillingOptionParams.newBuilder()
            .setBillingProgram(BillingClient.BillingProgram.EXTERNAL_PAYMENTS)
            .setLinkUri(Uri.parse("https://example.com/checkout"))
            .setLaunchMode(
                DeveloperBillingOptionParams.LaunchMode.LAUNCH_IN_EXTERNAL_BROWSER_OR_APP
            )
            .build()
    )
    .build()

billingClient.launchBillingFlow(activity, params)
```

### Key Types (8.3+)

| Type                                             | Purpose                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `DeveloperBillingOptionParams`                   | Configures developer billing on `BillingFlowParams`           |
| `DeveloperProvidedBillingListener`               | Callback when user picks developer-provided billing           |
| `DeveloperProvidedBillingDetails`                | Nullable token/link/original-ID fields plus selected products |
| `BillingClient.BillingProgram.EXTERNAL_PAYMENTS` | External Payments program constant                            |

> **OpenIAP Note**: Exposed through `enableBillingProgramAndroid`,
> `developerBillingOption`, and the developer-provided billing listener.
> Enrolment with Google Play's External Payments program is required;
> availability is currently restricted to Japan. Horizon and Amazon do not
> implement this Google Play program.

## Billing Choice (9.1+)

Billing Library 9.1 adds APIs for markets and programs where either Google Play
or the app renders a billing choice screen.

### Integration Scenarios

| Scenario | Choice renderer | Developer payment | BillingClient setup                                                  | Required flow                                                                                                         |
| -------- | --------------- | ----------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1A       | Google          | In app            | `EnableBillingProgramParams` with `DeveloperProvidedBillingListener` | Pass a minimal `DeveloperBillingOptionParams`; Play returns the token through the listener                            |
| 1B       | Developer       | In app            | `EnableBillingProgramParams` without the listener                    | Fetch choice info, create an `IN_APP` token, show the information dialog, then render the choice UI                   |
| 2A       | Google          | External link     | `EnableBillingProgramParams` with `DeveloperProvidedBillingListener` | Create an `EXTERNAL_LINK` token and pass it with the URI through `DeveloperBillingOptionParams`                       |
| 2B       | Developer       | External link     | `EnableBillingProgramParams` without the listener                    | Fetch choice info, create an `EXTERNAL_LINK` token, render the choice UI, then pass the token to `launchExternalLink` |

The setup must match `choiceScreenType` from Play Console. Registering the
listener in a developer-rendered integration is not equivalent to omitting it.

| API / Type                                                           | Purpose                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `BillingClient.getBillingChoiceInfoAsync()`                          | Fetches billing choices available to the current user                        |
| `BillingChoiceInfo`                                                  | Contains choice-screen data, including image URLs and loyalty details        |
| `GetBillingChoiceInfoParams`                                         | Configures the billing-choice info request                                   |
| `BillingClient.showBillingProgramInformationDialog()`                | Shows an information dialog for a billing program                            |
| `BillingProgramInformationDialogParams`                              | Configures the information dialog                                            |
| `LaunchExternalLinkParams.setExternalTransactionToken()`             | Supplies the pre-generated token for a developer-rendered external-link flow |
| `BillingProgramAvailabilityDetails.BillingChoiceAvailabilityDetails` | Returns choice-screen type and external-link availability                    |
| `DeveloperBillingOptionParams`                                       | Selects in-app or external-link developer billing during purchase            |
| `BillingProgramReportingDetailsParams.DeveloperBillingType`          | Distinguishes `IN_APP` and `EXTERNAL_LINK` reporting                         |

### Developer Billing Purchase Options

Only `billingProgram` is required for an in-app Billing Choice flow:

```kotlin
val inAppChoice = DeveloperBillingOptionParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .build()
```

For a Google-rendered external-link flow, also set the URI, launch mode, and the
pre-generated `EXTERNAL_LINK` transaction token:

```kotlin
val externalLinkChoice = DeveloperBillingOptionParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .setLinkUri(Uri.parse("https://example.com/checkout"))
    .setLaunchMode(DeveloperBillingOptionParams.LaunchMode.CALLER_WILL_LAUNCH_LINK)
    .setExternalTransactionToken(preGeneratedToken)
    .build()
```

### Developer-Rendered Choice Information

```kotlin
val params = GetBillingChoiceInfoParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .setPlayBillingChoiceImageLayout(
        GetBillingChoiceInfoParams.ImageLayout.RECTANGULAR_FOUR_BY_ONE
    )
    .setUserLocale(Locale.forLanguageTag("en-US"))
    .build()

billingClient.getBillingChoiceInfoAsync(params) { result, info ->
    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
        val imageUrl = info.playBillingChoiceImageUrl
        val loyaltyText = info.playBillingLoyaltyInfo
    }
}
```

Supported image layouts are `RECTANGULAR_FOUR_BY_ONE`,
`RECTANGULAR_THREE_BY_ONE`, and `RECTANGULAR_TWO_BY_TWO`.

### Availability Details

For `BILLING_CHOICE`, `BillingProgramAvailabilityDetails` can include:

| Field                     | Meaning                                                   |
| ------------------------- | --------------------------------------------------------- |
| `choiceScreenType`        | `UNSPECIFIED`, `DEVELOPER_RENDERED`, or `GOOGLE_RENDERED` |
| `isExternalLinkAvailable` | Whether the user is eligible for an external-link option  |

### Information Dialog

For developer-rendered in-app choice (scenario 1B), call
`showBillingProgramInformationDialog()` before showing the app's choice UI. It
is a UI-thread API and returns through its listener; it does not return a
synchronous `BillingResult`:

```kotlin
val params = BillingProgramInformationDialogParams.newBuilder()
    .setBillingProgram(BillingClient.BillingProgram.BILLING_CHOICE)
    .setExternalTransactionToken(externalTransactionToken)
    .build()

billingClient.showBillingProgramInformationDialog(activity, params) { result ->
    // Continue according to result.responseCode.
}
```

### Developer-Billed Subscription Replacement

Use the original external transaction ID instead of an old Play purchase token
when replacing a subscription bought through developer billing:

```kotlin
val updateParams = BillingFlowParams.SubscriptionUpdateParams.newBuilder()
    .setOriginalExternalTransactionId(originalExternalTransactionId)
    .build()
```

> **OpenIAP Note**: OpenIAP exposes these through `BILLING_CHOICE`,
> `getBillingChoiceInfoAndroid`, `showBillingProgramInformationDialogAndroid`,
> `launchExternalLinkAndroid`, `developerBillingOption`,
> `originalExternalTransactionId`, and the expanded developer-provided billing
> callback. Set `InitConnectionConfig.billingChoiceScreenTypeAndroid` to
> `GOOGLE_RENDERED` (default) or `DEVELOPER_RENDERED` so OpenIAP includes or
> omits the listener correctly. Play-only APIs return unsupported/default
> behavior on Horizon and Amazon.

## In-App Billing Messages (4.1+)

`showInAppMessages()` must run on the UI thread. It returns a synchronous
`BillingResult` for submission errors and reports the user interaction through
`InAppMessageResponseListener`.

## PBL 9 Migration Guardrails

- Replace removed APIs: `SkuDetails`, `SkuDetailsParams`, `SkuDetailsResponseListener`, `BillingClient.SkuType`, `querySkuDetailsAsync()`, no-argument `enablePendingPurchases()`, and string `queryPurchasesAsync()`.
- Use `ProductDetails`, `QueryProductDetailsParams`, `BillingClient.ProductType`, parameterized `enablePendingPurchases(PendingPurchasesParams)`, and `queryPurchasesAsync(QueryPurchasesParams, ...)`.
- Handle `DeveloperProvidedBillingDetails.getExternalTransactionToken()`,
  `getLinkUri()`, and `getOriginalExternalTransactionId()` as nullable.
- Preserve every `DeveloperProvidedBillingDetails.Product` (`id`, `type`, and
  nullable `offerToken`) from the callback.
- Keep Horizon shared code on the Billing 7.0-compatible API subset; put PBL 8/9 code in Play-only sources or behind reflection.

## Best Practices

1. **Always acknowledge purchases** within 3 days or they will be refunded
2. **Verify purchases server-side** using Google Play Developer API
3. **Handle pending purchases** for payment methods that require additional steps
4. **Auto-reconnect is enabled by default** in OpenIAP when available (8.0+)
5. **Check product status codes** (8.0+) to understand why products weren't fetched
6. **Check isSuspended** (8.1+) before granting entitlements
7. **Distinguish in-app and external-link Billing Choice** when configuring and reporting developer billing
8. **Query fresh ProductDetails before purchase**; stale objects can make `launchBillingFlow()` fail
