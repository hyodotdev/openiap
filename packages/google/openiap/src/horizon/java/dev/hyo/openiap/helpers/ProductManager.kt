package dev.hyo.openiap.helpers

import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.QueryProductDetailsParams
import com.meta.horizon.billingclient.api.ProductDetails as HorizonProductDetails
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapLog
import java.util.concurrent.ConcurrentHashMap

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

    fun replaceQueryResults(
        requestedProductIds: Collection<String>,
        details: Collection<HorizonProductDetails>,
        productType: String,
    ) {
        requestedProductIds.forEach { cache.remove(CacheKey(it, productType)) }
        putAll(details, productType)
    }

    fun clear() = cache.clear()

    /**
     * Queries fresh ProductDetails and updates the correlation cache.
     *
     * Billing eligibility and offers can change while the process is alive, so
     * a cached ProductDetails instance must never be used to launch a purchase.
     * The cache remains useful only for classifying out-of-band purchase events.
     */
    suspend fun getOrQuery(
        client: BillingClient,
        productIds: List<String>,
        productType: String,
        operations: ActiveStoreOperationRegistry<BillingClient>,
    ): List<HorizonProductDetails> {
        OpenIapLog.debug("getOrQuery: productIds=$productIds, type=$productType", TAG)

        if (productIds.isEmpty()) {
            throw OpenIapError.EmptySkuList
        }

        val requestedIds = productIds.distinct()
        val productList = requestedIds.map { sku ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(sku)
                .setProductType(productType)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        OpenIapLog.debug("getOrQuery: Querying ${requestedIds.size} products from Horizon API", TAG)

        return operations.await(client) { operation ->
            client.queryProductDetailsAsync(params) { billingResult, result ->
                OpenIapLog.debug(
                    "getOrQuery: Response code=${billingResult.responseCode}, " +
                    "message=${billingResult.debugMessage}, " +
                    "resultCount=${result?.size ?: 0}",
                    TAG
                )

                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    OpenIapLog.warn(
                        "getOrQuery: Query failed with code=${billingResult.responseCode}, " +
                            "message=${billingResult.debugMessage}",
                        TAG
                    )
                    operation.fail(
                        OpenIapError.QueryProduct.withDiagnostics(
                            responseCode = billingResult.responseCode,
                            debugMessage = billingResult.debugMessage,
                            productIds = requestedIds,
                            productType = productType,
                            isEmptyProductList = result.isNullOrEmpty(),
                        )
                    )
                    return@queryProductDetailsAsync
                }

                val list = result ?: emptyList()
                OpenIapLog.debug("getOrQuery: Received ${list.size} products", TAG)

                if (list.isEmpty()) {
                    operation.fail(
                        OpenIapError.QueryProduct.withDiagnostics(
                            responseCode = billingResult.responseCode,
                            debugMessage = billingResult.debugMessage,
                            productIds = requestedIds,
                            productType = productType,
                            isEmptyProductList = true,
                        )
                    ) { replaceQueryResults(requestedIds, list, productType) }
                    return@queryProductDetailsAsync
                }

                list.forEach { product ->
                    OpenIapLog.debug("  - Product: ${product.productId}, type=${product.productType}", TAG)

                    // Log subscription offer details
                    product.subscriptionOfferDetails?.forEachIndexed { index, offer ->
                        OpenIapLog.debug("    Offer[$index]: tokenPresent=${offer.offerToken.isNotBlank()}", TAG)
                        offer.pricingPhases.pricingPhaseList.forEachIndexed { phaseIndex, phase ->
                            OpenIapLog.debug(
                                "      Phase[$phaseIndex]: period=${phase.billingPeriod}, " +
                                "price=${phase.formattedPrice}, " +
                                "cycles=${phase.billingCycleCount}",
                                TAG
                            )
                        }
                    }

                    // Log one-time purchase details if applicable
                    product.oneTimePurchaseOfferDetails?.let { offer ->
                        OpenIapLog.debug("    OneTime: price=${offer.formattedPrice}", TAG)
                    }
                }

                // Preserve requested order while still allowing duplicate input IDs.
                val detailsById = list.associateBy { it.productId }
                val finalList = productIds.mapNotNull(detailsById::get)
                OpenIapLog.debug("getOrQuery: Returning ${finalList.size} total products", TAG)
                operation.succeed(finalList) {
                    replaceQueryResults(requestedIds, list, productType)
                }
            }
        }
    }
}
