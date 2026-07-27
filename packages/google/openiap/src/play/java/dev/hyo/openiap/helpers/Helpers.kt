package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.toOpenIapError
import dev.hyo.openiap.utils.BillingConverters.toPurchase
import java.util.concurrent.atomic.AtomicBoolean

// Common helpers (onPurchaseUpdated, onPurchaseError, AndroidPurchaseArgs,
// toAndroidPurchaseArgs, toPurchaseError) are in main/helpers/CommonHelpers.kt

internal suspend fun restorePurchases(
    client: BillingClient?,
    operations: ActiveStoreOperationRegistry<BillingClient>,
    includeSuspended: Boolean = false
): List<Purchase> {
    if (client == null || !client.isReady) throw OpenIapError.NotPrepared
    val purchases = mutableListOf<Purchase>()
    purchases += queryPurchases(client, operations, BillingClient.ProductType.INAPP)
    purchases += queryPurchases(client, operations, BillingClient.ProductType.SUBS, includeSuspended)
    return purchases
}

internal suspend fun queryPurchases(
    client: BillingClient?,
    operations: ActiveStoreOperationRegistry<BillingClient>,
    productType: String,
    includeSuspended: Boolean = false
): List<Purchase> {
    val billingClient = client ?: throw OpenIapError.NotPrepared
    if (!billingClient.isReady) throw OpenIapError.NotPrepared
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
    return operations.await(billingClient) { operation ->
        billingClient.queryPurchasesAsync(params) { result, purchaseList ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                val mapped = purchaseList.map { billingPurchase ->
                    // BillingClient does not expose basePlanId on Purchase; enrich it later.
                    billingPurchase.toPurchase(productType, null)
                }
                operation.succeed(mapped)
            } else {
                operation.fail(result.toOpenIapError())
            }
        }
    }
}

/**
 * Queries Play Billing for currently owned purchases that match an in-flight
 * request. When [purchasedSinceMillis] is set, older ownership is excluded so
 * a transient purchase-flow error cannot turn a pre-existing purchase into a
 * false success.
 */
internal fun queryAlreadyOwnedPurchases(
    client: BillingClient?,
    productType: String,
    skus: List<String>,
    basePlanIdsBySku: Map<String, String?> = emptyMap(),
    purchasedSinceMillis: Double? = null,
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
                if (purchasedSinceMillis != null &&
                    billingPurchase.purchaseTime.toDouble() < purchasedSinceMillis
                ) {
                    return@mapNotNull null
                }
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
    val matched = requestedOfferToken?.let { token ->
        offers.find { it.offerToken == token }?.basePlanId
    }
    return matched ?: offers
        .mapNotNull { it.basePlanId?.takeIf(String::isNotBlank) }
        .distinct()
        .singleOrNull()
}

internal suspend fun queryProductDetails(
    client: BillingClient?,
    productManager: ProductManager,
    operations: ActiveStoreOperationRegistry<BillingClient>,
    skus: List<String>,
    productType: String
): List<ProductDetails> {
    val billingClient = client ?: throw OpenIapError.NotPrepared
    if (!billingClient.isReady) throw OpenIapError.NotPrepared
    return productManager.getOrQuery(billingClient, skus, productType, operations)
}

internal suspend fun queryProductDetailsWithStatus(
    client: BillingClient?,
    productManager: ProductManager,
    operations: ActiveStoreOperationRegistry<BillingClient>,
    skus: List<String>,
    productType: String,
): ProductQueryResult {
    val billingClient = client ?: throw OpenIapError.NotPrepared
    if (!billingClient.isReady) throw OpenIapError.NotPrepared
    return productManager.getOrQueryWithStatus(billingClient, skus, productType, operations)
}
