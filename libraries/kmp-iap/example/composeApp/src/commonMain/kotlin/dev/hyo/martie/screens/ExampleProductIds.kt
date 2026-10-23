package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.Purchase

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

// The educational community adapter that carries Amazon receipts.
internal const val AmazonExampleStoreId = "amazon_example"

internal fun subscriptionProductId(purchase: Purchase): String? =
    if (purchase.productId in SubscriptionProductIds || purchase.store == IapStore.Amazon ||
        purchase.storeId == AmazonExampleStoreId
    ) subscriptionProductId(purchase.productId, purchase.currentPlanId) else null

// Amazon RVS reports a term of Martie's catalog under its base SKU.
internal fun amazonVerifiedProductId(productId: String): String =
    if (productId in SubscriptionProductIds) AmazonSubscriptionBaseId else productId
