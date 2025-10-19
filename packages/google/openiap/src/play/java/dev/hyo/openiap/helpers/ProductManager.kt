package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.ProductDetails
import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Manages ProductDetails caching and queries.
 */
internal class ProductManager {
    private val cache = mutableMapOf<String, ProductDetails>()

    fun get(productId: String): ProductDetails? = cache[productId]

    fun putAll(details: Collection<ProductDetails>) {
        details.forEach { cache[it.productId] = it }
    }

    fun clear() = cache.clear()

    /**
     * Returns ProductDetails for the requested productIds.
     * - Uses cache when available
     * - Queries missing ones and updates the cache
     * - Preserves input ordering in the returned list
     */
    suspend fun getOrQuery(
        client: BillingClient,
        productIds: List<String>,
        productType: String,
    ): List<ProductDetails> {
        if (productIds.isEmpty()) return emptyList()

        val missing = productIds.filter { cache[it] == null }.distinct()
        if (missing.isEmpty()) return productIds.mapNotNull { cache[it] }

        val productList = missing.map { sku ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(sku)
                .setProductType(productType)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        return suspendCancellableCoroutine { cont ->
            client.queryProductDetailsAsync(params) { billingResult, result ->
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    cont.resumeWithException(OpenIapError.QueryProduct)
                    return@queryProductDetailsAsync
                }
                val list = result.productDetailsList ?: emptyList()
                putAll(list)
                // Preserve requested order and include cached + newly-fetched
                cont.resume(productIds.mapNotNull { cache[it] })
            }
        }
    }
}
