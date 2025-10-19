package dev.hyo.openiap.utils

import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductSubscriptionAndroid

/**
 * Convert ProductSubscriptionAndroid to Product
 * This extension is used by OpenIapStore to add subscriptions to the products list
 */
fun ProductSubscriptionAndroid.toProduct(): Product = ProductAndroid(
    currency = currency,
    debugDescription = debugDescription,
    description = description,
    displayName = displayName,
    displayPrice = displayPrice,
    id = id,
    nameAndroid = nameAndroid,
    oneTimePurchaseOfferDetailsAndroid = oneTimePurchaseOfferDetailsAndroid,
    platform = platform,
    price = price,
    subscriptionOfferDetailsAndroid = subscriptionOfferDetailsAndroid,
    title = title,
    type = type
)
