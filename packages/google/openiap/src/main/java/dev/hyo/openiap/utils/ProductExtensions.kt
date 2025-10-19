package dev.hyo.openiap.utils

import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseInput

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

/**
 * Convert Purchase to PurchaseInput
 * Both types are compatible in the GraphQL schema
 */
fun Purchase.toPurchaseInput(): PurchaseInput = this
