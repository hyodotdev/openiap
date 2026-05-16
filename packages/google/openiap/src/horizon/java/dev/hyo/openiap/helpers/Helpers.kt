package dev.hyo.openiap.helpers

import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.QueryPurchasesParams
import com.meta.horizon.billingclient.api.ProductDetails as HorizonProductDetails
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.utils.HorizonBillingConverters.toPurchase
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

private const val TAG = "Helpers"

/**
 * Query and restore all purchases (both INAPP and SUBS) for Horizon
 */
internal suspend fun restorePurchasesHorizon(client: BillingClient?): List<Purchase> {
    OpenIapLog.d("restorePurchasesHorizon: Starting", TAG)
    if (client == null) {
        OpenIapLog.w("restorePurchasesHorizon: BillingClient is null", TAG)
        return emptyList()
    }

    val purchases = mutableListOf<Purchase>()
    val inapp = queryPurchasesHorizon(client, BillingClient.ProductType.INAPP)
    OpenIapLog.d("restorePurchasesHorizon: INAPP purchases = ${inapp.size}", TAG)
    purchases += inapp

    val subs = queryPurchasesHorizon(client, BillingClient.ProductType.SUBS)
    OpenIapLog.d("restorePurchasesHorizon: SUBS purchases = ${subs.size}", TAG)
    purchases += subs

    OpenIapLog.d("restorePurchasesHorizon: Total = ${purchases.size}", TAG)
    return purchases
}

/**
 * Query purchases for a specific product type for Horizon
 */
internal suspend fun queryPurchasesHorizon(
    client: BillingClient?,
    productType: String
): List<Purchase> = suspendCancellableCoroutine { continuation ->
    OpenIapLog.d("queryPurchasesHorizon: type=$productType", TAG)

    val billingClient = client ?: run {
        OpenIapLog.w("queryPurchasesHorizon: BillingClient is null", TAG)
        continuation.resume(emptyList())
        return@suspendCancellableCoroutine
    }

    // CRITICAL FIX: Check if BillingClient is ready before querying
    if (!billingClient.isReady()) {
        OpenIapLog.w("queryPurchasesHorizon: BillingClient is not ready", TAG)
        continuation.resume(emptyList())
        return@suspendCancellableCoroutine
    }

    OpenIapLog.d("queryPurchasesHorizon: BillingClient is ready, querying purchases", TAG)
    val params = QueryPurchasesParams.newBuilder().setProductType(productType).build()
    billingClient.queryPurchasesAsync(params) { result, purchaseList ->
        OpenIapLog.d(
            "queryPurchasesHorizon: type=$productType responseCode=${result.responseCode} " +
            "count=${purchaseList?.size ?: 0}",
            TAG
        )

        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            val mapped = purchaseList?.map {
                OpenIapLog.d("  - Purchase: productIds=${it.products}", TAG)
                it.toPurchase()
            } ?: emptyList()
            OpenIapLog.d("queryPurchasesHorizon: Returning ${mapped.size} mapped purchases", TAG)
            continuation.resume(mapped)
        } else {
            OpenIapLog.w("queryPurchasesHorizon: Failed with code=${result.responseCode}", TAG)
            continuation.resume(emptyList())
        }
    }
}

/**
 * Query product details using ProductManager cache for Horizon
 */
internal suspend fun queryProductDetailsHorizon(
    client: BillingClient?,
    productManager: ProductManager,
    skus: List<String>,
    productType: String
): List<HorizonProductDetails> {
    val billingClient = client ?: throw OpenIapError.NotPrepared
    return productManager.getOrQuery(billingClient, skus, productType)
}
