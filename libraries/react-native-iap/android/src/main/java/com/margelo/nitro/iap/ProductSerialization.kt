package com.margelo.nitro.iap

import dev.hyo.openiap.DiscountOffer
import dev.hyo.openiap.ProductSubscriptionAndroidOfferDetails
import dev.hyo.openiap.SubscriptionOffer

internal fun legacySubscriptionOfferMaps(
    offers: List<ProductSubscriptionAndroidOfferDetails>,
): List<Map<String, Any?>> = offers.map { it.toJson().withoutTypeNames() }

internal fun subscriptionOfferMaps(
    offers: List<SubscriptionOffer>,
): List<Map<String, Any?>> = offers.map { it.toJson().withoutTypeNames() }

internal fun discountOfferMaps(
    offers: List<DiscountOffer>,
): List<Map<String, Any?>> = offers.map { it.toJson().withoutTypeNames() }

private fun Map<String, Any?>.withoutTypeNames(): Map<String, Any?> =
    entries
        .filter { it.key != "__typename" }
        .associate { (key, value) -> key to value.withoutTypeNames() }

private fun Any?.withoutTypeNames(): Any? = when (this) {
    is Map<*, *> -> entries
        .filter { it.key != "__typename" }
        .associate { (key, value) -> key.toString() to value.withoutTypeNames() }
    is List<*> -> map { it.withoutTypeNames() }
    else -> this
}
