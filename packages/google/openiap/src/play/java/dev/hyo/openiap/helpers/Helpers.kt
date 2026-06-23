package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.utils.BillingConverters.toPurchase
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.atomic.AtomicBoolean

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
    val resumer = continuation.resumeGuard()

    val billingClient = client ?: run {
        resumer.resume(emptyList())
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
            resumer.resume(mapped)
        } else {
            resumer.resume(emptyList())
        }
    }
}

/**
 * Queries Play Billing directly after ITEM_ALREADY_OWNED and returns only
 * currently owned purchases that match the in-flight request SKUs.
 */
internal fun queryAlreadyOwnedPurchases(
    client: BillingClient?,
    productType: String,
    skus: List<String>,
    basePlanIdsBySku: Map<String, String?> = emptyMap(),
    onResult: (List<Purchase>) -> Unit
) {
    val requestedSkus = skus.toSet()
    if (client == null || requestedSkus.isEmpty()) {
        onResult(emptyList())
        return
    }

    val didHandleResult = AtomicBoolean(false)
    val params = QueryPurchasesParams.newBuilder()
        .setProductType(productType)
        .build()

    try {
        client.queryPurchasesAsync(params) { result, purchaseList ->
            if (!didHandleResult.compareAndSet(false, true)) return@queryPurchasesAsync

            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                onResult(emptyList())
                return@queryPurchasesAsync
            }

            val recovered = purchaseList.orEmpty().mapNotNull { billingPurchase ->
                val matchingSku = billingPurchase.products.firstOrNull { productId ->
                    productId in requestedSkus
                }
                matchingSku?.let { sku ->
                    billingPurchase.toPurchase(productType, basePlanIdsBySku[sku])
                }
            }
            onResult(recovered)
        }
    } catch (_: Exception) {
        if (didHandleResult.compareAndSet(false, true)) {
            onResult(emptyList())
        }
    }
}

internal data class SubscriptionBasePlanOffer(
    val offerToken: String?,
    val basePlanId: String?
)

internal fun resolveBasePlanIdForOfferToken(
    offers: List<SubscriptionBasePlanOffer>,
    requestedOfferToken: String?
): String? {
    return requestedOfferToken?.let { token ->
        offers.find { it.offerToken == token }?.basePlanId
    }
        ?: offers.firstOrNull()?.basePlanId
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
