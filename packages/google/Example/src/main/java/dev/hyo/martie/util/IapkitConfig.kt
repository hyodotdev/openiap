package dev.hyo.martie.util

import dev.hyo.martie.BuildConfig
import dev.hyo.martie.IapConstants
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult

/** IAPKit settings the example reads from local.properties or Gradle properties. */
object IapkitConfig {
    /**
     * Sent as `Bearer {apiKey}`; null when unset or when a secret key was pasted.
     * The guard stops the key reaching a request, not the build — an sk_ key is
     * still compiled into BuildConfig, so keep it out of local.properties.
     */
    val apiKey: String? = BuildConfig.IAPKIT_API_KEY.trim()
        .takeIf { it.isNotEmpty() && !it.startsWith("openiap-kit_sk_") }

    /** Origin of a locally running IAPKit server; null selects the hosted default. */
    val localBaseUrl: String? = BuildConfig.IAPKIT_BASE_URL.trim().takeIf { it.isNotEmpty() }

    /** Amazon App Tester receipts only verify against the RVS Cloud Sandbox. */
    val amazonRvsSandbox: Boolean = BuildConfig.AMAZON_RVS_SANDBOX

    // These term-to-base IDs belong to Martie's Amazon catalog.
    fun verificationProductId(productId: String, store: IapStore): String =
        if (store == IapStore.Amazon && productId in IapConstants.SUBS_SKUS)
            "dev.hyo.martie.premium.base" else productId

    fun acceptsVerification(result: RequestVerifyPurchaseWithIapkitResult?, purchase: PurchaseAndroid): Boolean {
        if (result == null || !result.isValid || result.store != purchase.store ||
            result.productId != verificationProductId(purchase.productId, purchase.store)) return false
        val consumable = purchase.productId in IapConstants.CONSUMABLE_SKUS
        return when (result.store) {
            IapStore.Apple, IapStore.Amazon ->
                (result.store != IapStore.Amazon || result.environment ==
                    if (amazonRvsSandbox) "Sandbox" else "Production") &&
                    result.state == if (consumable) IapkitPurchaseState.ReadyToConsume else IapkitPurchaseState.Entitled
            IapStore.Google -> result.state == IapkitPurchaseState.Entitled ||
                result.state == IapkitPurchaseState.PendingAcknowledgment ||
                (consumable && result.state == IapkitPurchaseState.ReadyToConsume)
            IapStore.Horizon -> result.state == IapkitPurchaseState.Entitled
            IapStore.Unknown -> false
        }
    }
}
