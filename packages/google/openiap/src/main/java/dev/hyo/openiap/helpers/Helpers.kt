package dev.hyo.openiap.helpers

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseError
import dev.hyo.openiap.RequestPurchaseProps
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

internal suspend fun restorePurchases(client: BillingClient?): List<Purchase> {
    if (client == null) return emptyList()
    val purchases = mutableListOf<Purchase>()
    purchases += queryPurchases(client, BillingClient.ProductType.INAPP)
    purchases += queryPurchases(client, BillingClient.ProductType.SUBS)
    return purchases
}

internal suspend fun queryPurchases(
    client: BillingClient?,
    productType: String
): List<Purchase> = suspendCancellableCoroutine { continuation ->
    val billingClient = client ?: run {
        continuation.resume(emptyList())
        return@suspendCancellableCoroutine
    }
    val params = QueryPurchasesParams.newBuilder().setProductType(productType).build()
    billingClient.queryPurchasesAsync(params) { result, purchaseList ->
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            val mapped = purchaseList.map { it.toPurchase(productType) }
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
    val purchaseTokenAndroid: String?,
    val replacementModeAndroid: Int?,
    val subscriptionOffers: List<AndroidSubscriptionOfferInput>?,
    val type: ProductQueryType,
    val useAlternativeBilling: Boolean?
)

internal fun RequestPurchaseProps.toAndroidPurchaseArgs(): AndroidPurchaseArgs {
    return when (val payload = request) {
        is RequestPurchaseProps.Request.Purchase -> {
            val android = payload.value.android
                ?: throw IllegalArgumentException("Android purchase parameters are required")
            AndroidPurchaseArgs(
                skus = android.skus,
                isOfferPersonalized = android.isOfferPersonalized,
                obfuscatedAccountId = android.obfuscatedAccountIdAndroid,
                obfuscatedProfileId = android.obfuscatedProfileIdAndroid,
                purchaseTokenAndroid = null,
                replacementModeAndroid = null,
                subscriptionOffers = null,
                type = type,
                useAlternativeBilling = useAlternativeBilling
            )
        }
        is RequestPurchaseProps.Request.Subscription -> {
            val android = payload.value.android
                ?: throw IllegalArgumentException("Android subscription parameters are required")

            // For subscription upgrades/downgrades, obfuscatedProfileIdAndroid and purchaseTokenAndroid
            // are mutually exclusive. If purchaseTokenAndroid is provided (upgrade scenario),
            // we should not send obfuscatedProfileIdAndroid to avoid "Invalid arguments" error
            val isUpgrade = !android.purchaseTokenAndroid.isNullOrEmpty()
            val effectiveObfuscatedProfileId = if (isUpgrade) null else android.obfuscatedProfileIdAndroid

            AndroidPurchaseArgs(
                skus = android.skus,
                isOfferPersonalized = android.isOfferPersonalized,
                obfuscatedAccountId = android.obfuscatedAccountIdAndroid,
                obfuscatedProfileId = effectiveObfuscatedProfileId,
                purchaseTokenAndroid = android.purchaseTokenAndroid,
                replacementModeAndroid = android.replacementModeAndroid,
                subscriptionOffers = android.subscriptionOffers,
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
