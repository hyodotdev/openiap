package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.ProductDetails
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Manages ProductDetails caching and queries.
 *
 * Caches ProductDetails objects from Google Play Billing Library.
 * Note: ProductDetails should be immutable, but to ensure data integrity,
 * we store a reference and always query fresh data if the cached object
 * appears to have incomplete data (defensive programming).
 */
internal class ProductManager {
    private val cache = ConcurrentHashMap<String, ProductDetails>()

    fun get(productId: String): ProductDetails? = cache[productId]

    fun putAll(details: Collection<ProductDetails>) {
        for (detail in details) { cache[detail.productId] = detail }
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
     * it will be re-queried from Google Play Billing.
     */
    suspend fun getOrQuery(
        client: BillingClient,
        productIds: List<String>,
        productType: String,
    ): List<ProductDetails> {
        if (productIds.isEmpty()) return emptyList()

        // Check which products are missing or have incomplete data
        val needsQuery = mutableListOf<String>()

        for (productId in productIds.distinct()) {
            val cached = cache[productId]
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

                if (!isComplete) {
                    OpenIapLog.w("Cached ProductDetails for '$productId' has incomplete data, will re-query", "ProductManager")
                    needsQuery.add(productId)
                    cache.remove(productId)
                }
            }
        }

        if (needsQuery.isEmpty()) {
            return productIds.mapNotNull { cache[it] }
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

        return suspendCancellableCoroutine { cont ->
            val resumer = cont.resumeGuard()
            val didHandleProductDetails = AtomicBoolean(false)
            client.queryProductDetailsAsync(params) { billingResult, result ->
                if (!didHandleProductDetails.compareAndSet(false, true)) return@queryProductDetailsAsync

                // Always update cache even if coroutine was cancelled
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    val list = result.productDetailsList ?: emptyList()
                    putAll(list)
                }

                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    resumer.resumeWithException(
                        OpenIapError.QueryProduct.withDiagnostics(
                            responseCode = billingResult.responseCode,
                            debugMessage = billingResult.debugMessage,
                            productIds = needsQuery.toList(),
                            productType = productType,
                            isEmptyProductList = result.productDetailsList.isNullOrEmpty()
                        )
                    )
                    return@queryProductDetailsAsync
                }
                // Preserve requested order and include cached + newly-fetched
                resumer.resume(productIds.mapNotNull { cache[it] })
            }
        }
    }
}
