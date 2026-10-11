package dev.hyo.martie.util

import dev.hyo.martie.BuildConfig
import dev.hyo.martie.IapConstants
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult

/** IAPKit settings the example reads from local.properties or Gradle properties. */
object IapkitConfig {
    // Secret keys still enter BuildConfig, so never paste one into local.properties.
    val apiKey: String? = BuildConfig.IAPKIT_API_KEY.trim()
        .takeIf { it.isNotEmpty() && !it.startsWith("openiap-kit_sk_") }

    /** Origin of a locally running IAPKit server; null selects the hosted default. */
    val localBaseUrl: String? = BuildConfig.IAPKIT_BASE_URL.trim().takeIf { it.isNotEmpty() }

    /** Amazon App Tester receipts only verify against the RVS Cloud Sandbox. */
    val amazonRvsSandbox: Boolean = BuildConfig.AMAZON_RVS_SANDBOX

    private const val amazonSubscriptionBaseId = "dev.hyo.martie.premium.base"
    val subscriptionQueryIds = IapConstants.SUBS_SKUS + amazonSubscriptionBaseId

    fun subscriptionProductId(productId: String, currentPlanId: String?): String? = when {
        productId in IapConstants.SUBS_SKUS -> productId
        productId == amazonSubscriptionBaseId && currentPlanId in IapConstants.SUBS_SKUS -> currentPlanId
        else -> null
    }

    fun subscriptionProductId(purchase: PurchaseAndroid): String? =
        if (purchase.productId in IapConstants.SUBS_SKUS || verificationStore(purchase) == IapStore.Amazon)
            subscriptionProductId(purchase.productId, purchase.currentPlanId) else null

    // These term-to-base IDs belong to Martie's Amazon catalog.
    fun verificationProductId(productId: String, store: IapStore): String =
        if (store == IapStore.Amazon && productId in IapConstants.SUBS_SKUS)
            amazonSubscriptionBaseId else productId

    fun verificationStore(purchase: PurchaseAndroid): IapStore =
        if (purchase.store == IapStore.Unknown && purchase.storeId == "amazon_example")
            IapStore.Amazon else purchase.store

    fun acceptsVerification(result: RequestVerifyPurchaseWithIapkitResult?, purchase: PurchaseAndroid): Boolean {
        if (result == null || !result.isValid || result.store != purchase.store ||
            result.storeId != purchase.storeId ||
            result.productId != verificationProductId(purchase.productId, verificationStore(purchase))) return false
        val consumable = purchase.productId in IapConstants.CONSUMABLE_SKUS
        val store = verificationStore(purchase)
        return when (store) {
            IapStore.Apple, IapStore.Amazon ->
                (store != IapStore.Amazon || result.environment ==
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
