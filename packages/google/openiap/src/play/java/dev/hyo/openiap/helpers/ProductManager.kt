package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.UnfetchedProduct
import dev.hyo.openiap.OpenIapError
import java.util.concurrent.ConcurrentHashMap

internal data class ProductQueryResult(
    val productDetails: List<ProductDetails>,
    val unfetchedProducts: List<UnfetchedProduct>,
)

/**
 * Manages ProductDetails caching and queries.
 *
 * Retains the latest ProductDetails for purchase-event correlation and
 * enrichment. Public product fetches always query Play because prices, offer
 * eligibility, and availability can change while a connection is alive.
 */
internal class ProductManager {
    private data class CacheKey(val productId: String, val productType: String)
    private val cache = ConcurrentHashMap<CacheKey, ProductDetails>()

    fun get(productId: String, productType: String): ProductDetails? =
        cache[CacheKey(productId, productType)]

    fun get(productId: String): ProductDetails? =
        get(productId, BillingClient.ProductType.SUBS)
            ?: get(productId, BillingClient.ProductType.INAPP)

    fun putAll(details: Collection<ProductDetails>) {
        for (detail in details) {
            cache[CacheKey(detail.productId, detail.productType)] = detail
        }
    }

    fun clear() = cache.clear()

    /**
     * Returns ProductDetails for the requested productIds.
     * - Queries every requested product ID and replaces matching cache entries
     * - Preserves input ordering in the returned list
     */
    suspend fun getOrQuery(
        client: BillingClient,
        productIds: List<String>,
        productType: String,
        operations: ActiveStoreOperationRegistry<BillingClient>,
    ): List<ProductDetails> =
        getOrQueryWithStatus(client, productIds, productType, operations).productDetails

    /**
     * Returns fetched details together with Billing 8 per-product failures.
     * Unfetched products are not cached because eligibility can change between queries.
     */
    suspend fun getOrQueryWithStatus(
        client: BillingClient,
        productIds: List<String>,
        productType: String,
        operations: ActiveStoreOperationRegistry<BillingClient>,
    ): ProductQueryResult {
        if (productIds.isEmpty()) return ProductQueryResult(emptyList(), emptyList())

        val requestedProductIds = productIds.distinct()

        val productList = requestedProductIds.map { sku ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(sku)
                .setProductType(productType)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        return operations.await(client) { operation ->
            client.queryProductDetailsAsync(params) { billingResult, result ->
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    operation.fail(
                        OpenIapError.QueryProduct.withDiagnostics(
                            responseCode = billingResult.responseCode,
                            debugMessage = billingResult.debugMessage,
                            productIds = requestedProductIds,
                            productType = productType,
                            isEmptyProductList = result.productDetailsList.isNullOrEmpty()
                        )
                    )
                    return@queryProductDetailsAsync
                }
                val list = result.productDetailsList.orEmpty()
                val freshDetailsById = list
                    .associateBy { it.productId }
                operation.succeed(
                    ProductQueryResult(
                        productDetails = productIds.mapNotNull(freshDetailsById::get),
                        unfetchedProducts = result.unfetchedProductList.orEmpty(),
                    )
                ) {
                    requestedProductIds.forEach { productId ->
                        cache.remove(CacheKey(productId, productType))
                    }
                    putAll(list)
                }
            }
        }
    }
}
