package dev.hyo.martie.screens

import dev.hyo.martie.config.AppConfig
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult

internal val ConsumableProductIds = listOf(
    "dev.hyo.martie.10bulbs",
    "dev.hyo.martie.30bulbs",
)

internal val NonConsumableProductIds = listOf(
    "dev.hyo.martie.certified",
)

internal val InAppProductIds = ConsumableProductIds + NonConsumableProductIds

internal val SubscriptionProductIds = listOf(
    "dev.hyo.martie.premium",
    "dev.hyo.martie.premium_year",
)

internal val AllProductIds = InAppProductIds + SubscriptionProductIds

private const val AmazonSubscriptionBaseId = "dev.hyo.martie.premium.base"
internal val SubscriptionQueryIds = SubscriptionProductIds + AmazonSubscriptionBaseId

internal fun subscriptionProductId(productId: String, currentPlanId: String?): String? = when {
    productId in SubscriptionProductIds -> productId
    productId == AmazonSubscriptionBaseId && currentPlanId in SubscriptionProductIds -> currentPlanId
    else -> null
}

internal fun subscriptionProductId(purchase: Purchase): String? =
    if (purchase.productId in SubscriptionProductIds || verificationStore(purchase) == IapStore.Amazon)
        subscriptionProductId(purchase.productId, purchase.currentPlanId) else null

// These term-to-base IDs belong to Martie's Amazon catalog.
internal fun verificationProductId(productId: String, store: IapStore): String =
    if (store == IapStore.Amazon && productId in SubscriptionProductIds)
        AmazonSubscriptionBaseId else productId

// Only this known community adapter uses Amazon's server verification.
internal fun verificationStore(purchase: Purchase): IapStore =
    if (purchase.store == IapStore.Unknown && purchase.storeId == "amazon_example")
        IapStore.Amazon else purchase.store

internal fun acceptsVerification(result: RequestVerifyPurchaseWithIapkitResult?, purchase: Purchase): Boolean {
    if (result == null || !result.isValid || result.store != purchase.store ||
        result.storeId != purchase.storeId ||
        result.productId != verificationProductId(purchase.productId, verificationStore(purchase))) return false
    val consumable = purchase.productId in ConsumableProductIds
    val store = verificationStore(purchase)
    return when (store) {
        IapStore.Apple, IapStore.Amazon ->
            (store != IapStore.Amazon || result.environment ==
                if (AppConfig.amazonRvsSandbox) "Sandbox" else "Production") &&
                result.state == if (consumable) IapkitPurchaseState.ReadyToConsume else IapkitPurchaseState.Entitled
        IapStore.Google -> result.state == IapkitPurchaseState.Entitled ||
            result.state == IapkitPurchaseState.PendingAcknowledgment ||
            (consumable && result.state == IapkitPurchaseState.ReadyToConsume)
        IapStore.Horizon -> result.state == IapkitPurchaseState.Entitled
        IapStore.Unknown -> false
    }
}
