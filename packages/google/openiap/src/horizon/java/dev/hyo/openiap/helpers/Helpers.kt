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
    android.util.Log.i("HORIZON_QUERY", "restorePurchasesHorizon: Starting")
    OpenIapLog.d("restorePurchasesHorizon: Starting", TAG)
    if (client == null) {
        android.util.Log.w("HORIZON_QUERY", "restorePurchasesHorizon: BillingClient is null")
        OpenIapLog.w("restorePurchasesHorizon: BillingClient is null", TAG)
        return emptyList()
    }

    val purchases = mutableListOf<Purchase>()
    val inapp = queryPurchasesHorizon(client, BillingClient.ProductType.INAPP)
    android.util.Log.i("HORIZON_QUERY", "restorePurchasesHorizon: INAPP purchases = ${inapp.size}")
    OpenIapLog.d("restorePurchasesHorizon: INAPP purchases = ${inapp.size}", TAG)
    purchases += inapp

    val subs = queryPurchasesHorizon(client, BillingClient.ProductType.SUBS)
    android.util.Log.i("HORIZON_QUERY", "restorePurchasesHorizon: SUBS purchases = ${subs.size}")
    OpenIapLog.d("restorePurchasesHorizon: SUBS purchases = ${subs.size}", TAG)
    purchases += subs

    android.util.Log.i("HORIZON_QUERY", "restorePurchasesHorizon: Total = ${purchases.size}")
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
    android.util.Log.i("HORIZON_QUERY", "queryPurchasesHorizon: type=$productType")
    OpenIapLog.d("queryPurchasesHorizon: type=$productType", TAG)

    val billingClient = client ?: run {
        android.util.Log.w("HORIZON_QUERY", "queryPurchasesHorizon: BillingClient is null")
        OpenIapLog.w("queryPurchasesHorizon: BillingClient is null", TAG)
        continuation.resume(emptyList())
        return@suspendCancellableCoroutine
    }

    // CRITICAL FIX: Check if BillingClient is ready before querying
    if (!billingClient.isReady()) {
        android.util.Log.w("HORIZON_QUERY", "queryPurchasesHorizon: BillingClient is not ready, returning empty list")
        OpenIapLog.w("queryPurchasesHorizon: BillingClient is not ready", TAG)
        continuation.resume(emptyList())
        return@suspendCancellableCoroutine
    }

    android.util.Log.i("HORIZON_QUERY", "queryPurchasesHorizon: BillingClient is ready, querying purchases")
    val params = QueryPurchasesParams.newBuilder().setProductType(productType).build()
    billingClient.queryPurchasesAsync(params) { result, purchaseList ->
        android.util.Log.i("HORIZON_QUERY", "queryPurchasesHorizon: type=$productType responseCode=${result.responseCode} count=${purchaseList?.size ?: 0}")
        OpenIapLog.d(
            "queryPurchasesHorizon: type=$productType responseCode=${result.responseCode} " +
            "count=${purchaseList?.size ?: 0}",
            TAG
        )

        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            val mapped = purchaseList?.map {
                android.util.Log.d("HORIZON_QUERY", "  - Purchase: productIds=${it.products}")
                OpenIapLog.d("  - Purchase: productIds=${it.products}", TAG)
                it.toPurchase()
            } ?: emptyList()
            android.util.Log.i("HORIZON_QUERY", "queryPurchasesHorizon: Returning ${mapped.size} mapped purchases")
            continuation.resume(mapped)
        } else {
            android.util.Log.w("HORIZON_QUERY", "queryPurchasesHorizon: Failed with code=${result.responseCode}")
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
