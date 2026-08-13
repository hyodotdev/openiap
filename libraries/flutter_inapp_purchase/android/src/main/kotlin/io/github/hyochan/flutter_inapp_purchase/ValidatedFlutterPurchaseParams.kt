package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.ProductQueryType
import java.util.Locale

internal data class ValidatedFlutterPurchaseParams(
    val values: Map<*, *>,
    val type: ProductQueryType,
)

internal fun validateFlutterPurchaseParams(raw: Any?): ValidatedFlutterPurchaseParams {
    val params =
        raw as? Map<*, *>
            ?: throw IllegalArgumentException("Purchase parameters must be an object")
    val rawType = params["type"]
    require(rawType == null || rawType is String) { "type must be a string" }
    val type =
        when ((rawType as? String)?.trim()?.lowercase(Locale.ROOT)) {
            null, "", "in-app" -> ProductQueryType.InApp
            "subs" -> ProductQueryType.Subs
            "all" -> throw IllegalArgumentException(
                "Product type all is only supported for product queries.",
            )
            else -> throw IllegalArgumentException(
                "Unsupported product type: $rawType. Use in-app or subs.",
            )
        }

    params["skus"]?.let { rawSkus ->
        require(rawSkus is List<*> && rawSkus.all { it is String && it.isNotBlank() }) {
            "skus must contain only non-empty strings"
        }
    }
    for (key in listOf(
        "obfuscatedAccountId",
        "obfuscatedProfileId",
        "purchaseToken",
        "originalExternalTransactionId",
        "offerToken",
    )) {
        require(params[key] == null || params[key] is String) { "$key must be a string" }
    }
    require(params["isOfferPersonalized"] == null || params["isOfferPersonalized"] is Boolean) {
        "isOfferPersonalized must be a boolean"
    }
    for (key in listOf(
        "developerBillingOption",
        "subscriptionProductReplacementParams",
    )) {
        params[key]?.let { value ->
            require(value is Map<*, *> && value.keys.all { it is String }) {
                "$key must be an object with string keys"
            }
        }
    }
    params["subscriptionOffers"]?.let { rawOffers ->
        require(rawOffers is List<*>) { "subscriptionOffers must be a list" }
        require(
            rawOffers.all { entry ->
                val offer = entry as? Map<*, *> ?: return@all false
                val sku = offer["sku"] as? String
                val token = offer["offerToken"] as? String
                offer.keys.all { it is String } && !sku.isNullOrBlank() && !token.isNullOrBlank()
            },
        ) { "subscriptionOffers must contain valid sku and offerToken strings" }
    }
    val subscriptionOnlyFields = listOf(
        "subscriptionOffers",
        "subscriptionProductReplacementParams",
        "purchaseToken",
        "originalExternalTransactionId",
    )
    require(type != ProductQueryType.InApp || subscriptionOnlyFields.none { params[it] != null }) {
        "Subscription options require product type subs"
    }
    require(type != ProductQueryType.Subs || params["offerToken"] == null) {
        "offerToken requires product type in-app"
    }
    return ValidatedFlutterPurchaseParams(params, type)
}
