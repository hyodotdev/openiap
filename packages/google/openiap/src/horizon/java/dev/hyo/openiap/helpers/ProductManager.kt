package dev.hyo.openiap.helpers

import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.QueryProductDetailsParams
import com.meta.horizon.billingclient.api.ProductDetails as HorizonProductDetails
import dev.hyo.openiap.OpenIapLog
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume

private const val TAG = "ProductManager"

/**
 * Manages ProductDetails caching and queries for Horizon.
 */
internal class ProductManager {
    private data class CacheKey(val productId: String, val productType: String)
    private val cache = ConcurrentHashMap<CacheKey, HorizonProductDetails>()

    fun get(productId: String, productType: String): HorizonProductDetails? =
        cache[CacheKey(productId, productType)]

    fun putAll(details: Collection<HorizonProductDetails>, productType: String) {
        details.forEach { cache[CacheKey(it.productId, productType)] = it }
    }

    fun clear() = cache.clear()

    /**
     * Returns ProductDetails for the requested productIds.
     * - Uses cache when available
     * - Queries missing ones and updates the cache
     * - Preserves input ordering in the returned list
     *
     * IMPORTANT: Always validates cached ProductDetails have complete data.
     * If cached data appears incomplete (e.g., missing offer details),
     * it will be re-queried from Horizon Billing.
     */
    suspend fun getOrQuery(
        client: BillingClient,
        productIds: List<String>,
        productType: String,
    ): List<HorizonProductDetails> {
        OpenIapLog.d("getOrQuery: productIds=$productIds, type=$productType", TAG)

        if (productIds.isEmpty()) {
            OpenIapLog.d("getOrQuery: Empty productIds list", TAG)
            return emptyList()
        }

        // Check which products are missing or have incomplete data
        val needsQuery = mutableListOf<String>()
        val validCached = mutableListOf<HorizonProductDetails>()

        productIds.distinct().forEach { productId ->
            val cached = cache[CacheKey(productId, productType)]
            if (cached == null) {
                needsQuery.add(productId)
            } else {
                // Validate cached ProductDetails has complete data
                val isComplete = when (productType) {
                    BillingClient.ProductType.INAPP -> {
                        cached.oneTimePurchaseOfferDetails != null
                    }
                    BillingClient.ProductType.SUBS -> {
                        !cached.subscriptionOfferDetails.isNullOrEmpty()
                    }
                    else -> true
                }

                if (isComplete) {
                    validCached.add(cached)
                } else {
                    OpenIapLog.w("Cached ProductDetails for '$productId' has incomplete data, will re-query", TAG)
                    needsQuery.add(productId)
                    cache.remove(CacheKey(productId, productType))
                }
            }
        }

        OpenIapLog.d("getOrQuery: needsQuery=$needsQuery, validCached=${validCached.size}", TAG)

        if (needsQuery.isEmpty()) {
            val cached = productIds.mapNotNull { cache[CacheKey(it, productType)] }
            OpenIapLog.d("getOrQuery: Returning ${cached.size} cached products", TAG)
            return cached
        }

        val productList = needsQuery.map { sku ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(sku)
                .setProductType(productType)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        OpenIapLog.d("getOrQuery: Querying ${needsQuery.size} products from Horizon API", TAG)

        return suspendCancellableCoroutine { cont ->
            cont.invokeOnCancellation { OpenIapLog.d("getOrQuery: cancelled", TAG) }
            client.queryProductDetailsAsync(params) { billingResult, result ->
                OpenIapLog.d(
                    "getOrQuery: Response code=${billingResult.responseCode}, " +
                    "message=${billingResult.debugMessage}, " +
                    "resultCount=${result?.size ?: 0}",
                    TAG
                )

                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    OpenIapLog.w(
                        "getOrQuery: Query failed with code=${billingResult.responseCode}, " +
                        "message=${billingResult.debugMessage}. Returning cached items only.",
                        TAG
                    )
                    // Return whatever we have in cache instead of crashing
                    val cached = productIds.mapNotNull { cache[CacheKey(it, productType)] }
                    if (cont.isActive) cont.resume(cached)
                    return@queryProductDetailsAsync
                }

                val list = result ?: emptyList()
                OpenIapLog.d("getOrQuery: Received ${list.size} products", TAG)

                list.forEach { product ->
                    OpenIapLog.d("  - Product: ${product.productId}, type=${product.productType}", TAG)

                    // Log subscription offer details
                    product.subscriptionOfferDetails?.forEachIndexed { index, offer ->
                        OpenIapLog.d("    Offer[$index]: token=${offer.offerToken}", TAG)
                        offer.pricingPhases?.pricingPhaseList?.forEachIndexed { phaseIndex, phase ->
                            OpenIapLog.d(
                                "      Phase[$phaseIndex]: period=${phase.billingPeriod}, " +
                                "price=${phase.formattedPrice}, " +
                                "cycles=${phase.billingCycleCount}",
                                TAG
                            )
                        }
                    }

                    // Log one-time purchase details if applicable
                    product.oneTimePurchaseOfferDetails?.let { offer ->
                        OpenIapLog.d("    OneTime: price=${offer.formattedPrice}", TAG)
                    }
                }

                putAll(list, productType)

                // Preserve requested order and include cached + newly-fetched
                val finalList = productIds.mapNotNull { cache[CacheKey(it, productType)] }
                OpenIapLog.d("getOrQuery: Returning ${finalList.size} total products", TAG)
                if (cont.isActive) cont.resume(finalList)
            }
        }
    }
}
