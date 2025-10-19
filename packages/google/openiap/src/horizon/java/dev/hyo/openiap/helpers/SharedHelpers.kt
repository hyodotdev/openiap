package dev.hyo.openiap.helpers

import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseError
import dev.hyo.openiap.RequestPurchaseProps
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Suspend function to wait for purchase update (Horizon)
 */
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

/**
 * Suspend function to wait for purchase error (Horizon)
 */
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

/**
 * Data class for Android purchase arguments (Horizon)
 */
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

/**
 * Extension function to convert RequestPurchaseProps to AndroidPurchaseArgs (Horizon)
 */
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

            // For subscription upgrades/downgrades:
            // - purchaseTokenAndroid: Identifies which existing subscription to upgrade/downgrade
            // - obfuscatedProfileId: Optional user identifier for fraud prevention and attribution
            // Both can be provided together - they serve different purposes and are not mutually exclusive
            AndroidPurchaseArgs(
                skus = android.skus,
                isOfferPersonalized = android.isOfferPersonalized,
                obfuscatedAccountId = android.obfuscatedAccountIdAndroid,
                obfuscatedProfileId = android.obfuscatedProfileIdAndroid,
                purchaseTokenAndroid = android.purchaseTokenAndroid,
                replacementModeAndroid = android.replacementModeAndroid,
                subscriptionOffers = android.subscriptionOffers,
                type = type,
                useAlternativeBilling = useAlternativeBilling
            )
        }
    }
}

/**
 * Extension function to convert OpenIapError to PurchaseError (Horizon)
 */
internal fun OpenIapError.toPurchaseError(): PurchaseError {
    val code = runCatching { ErrorCode.fromJson(this.code) }.getOrElse { ErrorCode.Unknown }
    val productId = when (this) {
        is OpenIapError.ProductNotFound -> productId
        is OpenIapError.SkuNotFound -> sku
        else -> null
    }
    return PurchaseError(code = code, message = message, productId = productId)
}
