package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.utils.BillingConverters.toPurchase
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

// Common helpers (onPurchaseUpdated, onPurchaseError, AndroidPurchaseArgs,
// toAndroidPurchaseArgs, toPurchaseError) are in main/helpers/CommonHelpers.kt

internal suspend fun restorePurchases(
    client: BillingClient?,
    includeSuspended: Boolean = false
): List<Purchase> {
    if (client == null) return emptyList()
    val purchases = mutableListOf<Purchase>()
    purchases += queryPurchases(client, BillingClient.ProductType.INAPP, includeSuspended = false)
    purchases += queryPurchases(client, BillingClient.ProductType.SUBS, includeSuspended)
    return purchases
}

internal suspend fun queryPurchases(
    client: BillingClient?,
    productType: String,
    includeSuspended: Boolean = false
): List<Purchase> = suspendCancellableCoroutine { continuation ->
    val billingClient = client ?: run {
        continuation.resume(emptyList())
        return@suspendCancellableCoroutine
    }
    val paramsBuilder = QueryPurchasesParams.newBuilder().setProductType(productType)

    // Include suspended subscriptions (Google Play Billing Library 8.1+)
    // Suspended subscriptions have isSuspendedAndroid=true and should NOT be granted entitlements.
    // Users should be directed to the subscription center to resolve payment issues.
    if (productType == BillingClient.ProductType.SUBS && includeSuspended) {
        runCatching {
            // Use reflection to maintain backward compatibility with older billing library versions
            val setIncludeSuspendedMethod = paramsBuilder::class.java.getMethod(
                "setIncludeSuspended",
                Boolean::class.javaPrimitiveType
            )
            setIncludeSuspendedMethod.invoke(paramsBuilder, true)
        }
    }

    val params = paramsBuilder.build()
    billingClient.queryPurchasesAsync(params) { result, purchaseList ->
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            val mapped = purchaseList.map { billingPurchase ->
                // IMPORTANT: Google Play Billing Library does not include basePlanId in the Purchase object
                // The only way to get basePlanId is through:
                // 1. Server-side Google Play Developer API (purchases.subscriptionsv2:get)
                // 2. Tracking it when the purchase is made (from ProductDetails.SubscriptionOfferDetails)
                //
                // For now, we pass null and rely on the ProductDetails cache enrichment in getActiveSubscriptions
                // This is a known limitation of the client-side Billing Library
                billingPurchase.toPurchase(productType, null)
            }
            continuation.resume(mapped)
        } else {
            continuation.resume(emptyList())
        }
    }
}

internal suspend fun queryProductDetails(
    client: BillingClient?,
    productManager: ProductManager,
    skus: List<String>,
    productType: String
): List<ProductDetails> {
    val billingClient = client ?: throw OpenIapError.NotPrepared
    if (!billingClient.isReady) throw OpenIapError.NotPrepared
    return productManager.getOrQuery(billingClient, skus, productType)
}
