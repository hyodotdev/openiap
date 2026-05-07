package dev.hyo.martie.screens

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
