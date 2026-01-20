package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseError
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.utils.BillingConverters.toPurchase
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

internal suspend fun onPurchaseUpdated(
    addListener: (OpenIapPurchaseUpdateListener) -> Unit,
    removeListener: (OpenIapPurchaseUpdateListener) -> Unit
): Purchase = suspendCancellableCoroutine { continuation ->
    val listener = object : OpenIapPurchaseUpdateListener {
        override fun onPurchaseUpdated(purchase: Purchase) {
            removeListener(this)
            if (continuation.isActive) continuation.resume(purchase)
        }
    }
    addListener(listener)
    continuation.invokeOnCancellation { removeListener(listener) }
}

internal suspend fun onPurchaseError(
    addListener: (OpenIapPurchaseErrorListener) -> Unit,
    removeListener: (OpenIapPurchaseErrorListener) -> Unit
): PurchaseError = suspendCancellableCoroutine { continuation ->
    val listener = object : OpenIapPurchaseErrorListener {
        override fun onPurchaseError(error: OpenIapError) {
            removeListener(this)
            if (continuation.isActive) continuation.resume(error.toPurchaseError())
        }
    }
    addListener(listener)
    continuation.invokeOnCancellation { removeListener(listener) }
}

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

internal data class AndroidPurchaseArgs(
    val skus: List<String>,
    val isOfferPersonalized: Boolean?,
    val obfuscatedAccountId: String?,
    val obfuscatedProfileId: String?,
    val offerToken: String?,
    val purchaseToken: String?,
    val replacementMode: Int?,
    val subscriptionOffers: List<AndroidSubscriptionOfferInput>?,
    val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?,
    val developerBillingOption: DeveloperBillingOptionParamsAndroid?,
    val type: ProductQueryType,
    val useAlternativeBilling: Boolean?
)

internal fun RequestPurchaseProps.toAndroidPurchaseArgs(): AndroidPurchaseArgs {
    return when (val payload = request) {
        is RequestPurchaseProps.Request.Purchase -> {
            // Prefer 'google' over deprecated 'android' field
            val params = payload.value.google ?: payload.value.android
                ?: throw IllegalArgumentException("Google purchase parameters are required (use 'google' field)")
            AndroidPurchaseArgs(
                skus = params.skus,
                isOfferPersonalized = params.isOfferPersonalized,
                obfuscatedAccountId = params.obfuscatedAccountId,
                obfuscatedProfileId = params.obfuscatedProfileId,
                offerToken = params.offerToken,
                purchaseToken = null,
                replacementMode = null,
                subscriptionOffers = null,
                subscriptionProductReplacementParams = null,
                developerBillingOption = params.developerBillingOption,
                type = type,
                useAlternativeBilling = useAlternativeBilling
            )
        }
        is RequestPurchaseProps.Request.Subscription -> {
            // Prefer 'google' over deprecated 'android' field
            val params = payload.value.google ?: payload.value.android
                ?: throw IllegalArgumentException("Google subscription parameters are required (use 'google' field)")

            // For subscription upgrades/downgrades:
            // - purchaseToken: Identifies which existing subscription to upgrade/downgrade
            // - obfuscatedProfileId: Optional user identifier for fraud prevention and attribution
            // Both can be provided together - they serve different purposes and are not mutually exclusive
            AndroidPurchaseArgs(
                skus = params.skus,
                isOfferPersonalized = params.isOfferPersonalized,
                obfuscatedAccountId = params.obfuscatedAccountId,
                obfuscatedProfileId = params.obfuscatedProfileId,
                offerToken = null,
                purchaseToken = params.purchaseToken,
                replacementMode = params.replacementMode,
                subscriptionOffers = params.subscriptionOffers,
                subscriptionProductReplacementParams = params.subscriptionProductReplacementParams,
                developerBillingOption = params.developerBillingOption,
                type = type,
                useAlternativeBilling = useAlternativeBilling
            )
        }
    }
}

internal fun OpenIapError.toPurchaseError(): PurchaseError {
    val code = runCatching { ErrorCode.fromJson(this.code) }.getOrElse { ErrorCode.Unknown }
    val productId = when (this) {
        is OpenIapError.ProductNotFound -> productId
        is OpenIapError.SkuNotFound -> sku
        else -> null
    }
    return PurchaseError(code = code, message = message, productId = productId)
}
