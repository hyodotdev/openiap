package dev.hyo.godotiap

import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.DeveloperBillingOptionParamsAndroid
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Helper utilities for GodotIap plugin.
 * Provides parsing functions for request parameters and sanitization utilities.
 */
internal object GodotIapHelper {

    fun jsonObjectToMap(json: JSONObject): Map<String, Any?> = buildMap {
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            put(key, jsonValue(json.opt(key)))
        }
    }

    private fun jsonValue(value: Any?): Any? = when (value) {
        null, JSONObject.NULL -> null
        is JSONObject -> jsonObjectToMap(value)
        is JSONArray -> List(value.length()) { index -> jsonValue(value.opt(index)) }
        else -> value
    }

    /**
     * Helper extension to get nullable string from JSONObject.
     * Returns null if the key doesn't exist or the value is empty.
     * This avoids Kotlin type inference issues with optString(key, null).
     */
    private fun JSONObject.optStringOrNull(key: String): String? {
        return if (has(key)) optString(key).takeIf { it.isNotEmpty() } else null
    }

    /**
     * Sanitize a dictionary by removing null values.
     * Similar to ExpoIapHelper.sanitizeDictionary() for consistency.
     */
    fun sanitizeDictionary(dictionary: Map<String, Any?>): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        for ((key, value) in dictionary) {
            if (value != null) {
                result[key] = value
            }
        }
        return result
    }

    /**
     * Sanitize an array of dictionaries by removing null values from each.
     */
    fun sanitizeArray(array: List<Map<String, Any?>>): List<Map<String, Any>> {
        return array.map { sanitizeDictionary(it) }
    }

    /**
     * Parse an OpenIAP product query type without silently changing unknown
     * values into another query class.
     *
     * The non-canonical spellings remain accepted during godot-iap 2.x so
     * projects using the native bridge directly can migrate before 3.0.0.
     */
    fun parseProductQueryType(
        rawType: String?,
        defaultType: ProductQueryType = ProductQueryType.InApp,
        allowAll: Boolean = true,
    ): ProductQueryType {
        val normalized = rawType?.trim()?.lowercase(Locale.US)
        if (normalized.isNullOrEmpty()) return defaultType

        val parsed = when (normalized) {
            ProductQueryType.InApp.toJson() -> ProductQueryType.InApp
            ProductQueryType.Subs.toJson() -> ProductQueryType.Subs
            ProductQueryType.All.toJson() -> ProductQueryType.All
            "inapp", "in_app" -> {
                warnLegacyWireInput(normalized, ProductQueryType.InApp.toJson())
                ProductQueryType.InApp
            }
            "subscription", "subscriptions" -> {
                warnLegacyWireInput(normalized, ProductQueryType.Subs.toJson())
                ProductQueryType.Subs
            }
            else -> throw IllegalArgumentException(
                "Unknown product query type '$rawType'. Expected in-app, subs, or all.",
            )
        }
        if (!allowAll && parsed == ProductQueryType.All) {
            throw IllegalArgumentException("Product query type 'all' is not valid for a purchase request.")
        }
        return parsed
    }

    /**
     * Parse request purchase parameters from JSON string.
     * Mirrors ExpoIapHelper.parseRequestPurchaseParams() for consistency.
     */
    fun parseRequestPurchaseParams(paramsJson: String): RequestPurchaseParams {
        val json = JSONObject(paramsJson)

        // Parse type
        val type = json.optStringOrNull("type")

        // Parse skus - keep the 2.x alias, but canonical presence always wins.
        val skus = mutableListOf<String>()
        val skusArray = resolveCanonicalWireValue(
            canonicalPresent = json.has("skus"),
            canonicalValue = json.optJSONArray("skus"),
            legacyPresent = json.has("skuArr"),
            legacyValue = json.optJSONArray("skuArr"),
            legacyName = "skuArr",
            canonicalName = "skus",
        )
        if (skusArray != null) {
            for (i in 0 until skusArray.length()) {
                skus.add(skusArray.getString(i))
            }
        }

        // Parse obfuscated IDs (canonical keys win when both are supplied).
        val obfuscatedAccountId = resolveCanonicalWireValue(
            canonicalPresent = json.has("obfuscatedAccountId"),
            canonicalValue = json.optStringOrNull("obfuscatedAccountId"),
            legacyPresent = json.has("obfuscatedAccountIdAndroid"),
            legacyValue = json.optStringOrNull("obfuscatedAccountIdAndroid"),
            legacyName = "obfuscatedAccountIdAndroid",
            canonicalName = "obfuscatedAccountId",
        )
        val obfuscatedProfileId = resolveCanonicalWireValue(
            canonicalPresent = json.has("obfuscatedProfileId"),
            canonicalValue = json.optStringOrNull("obfuscatedProfileId"),
            legacyPresent = json.has("obfuscatedProfileIdAndroid"),
            legacyValue = json.optStringOrNull("obfuscatedProfileIdAndroid"),
            legacyName = "obfuscatedProfileIdAndroid",
            canonicalName = "obfuscatedProfileId",
        )

        // Parse other options
        val isOfferPersonalized = json.optBoolean("isOfferPersonalized", false)
        val purchaseToken = resolveCanonicalWireValue(
            canonicalPresent = json.has("purchaseToken"),
            canonicalValue = json.optStringOrNull("purchaseToken"),
            legacyPresent = json.has("purchaseTokenAndroid"),
            legacyValue = json.optStringOrNull("purchaseTokenAndroid"),
            legacyName = "purchaseTokenAndroid",
            canonicalName = "purchaseToken",
        )
        val originalExternalTransactionId = json.optStringOrNull("originalExternalTransactionId")
        val replacementMode = resolveCanonicalWireValue(
            canonicalPresent = json.has("replacementMode"),
            canonicalValue = json.optInt("replacementMode").takeIf { json.has("replacementMode") },
            legacyPresent = json.has("replacementModeAndroid"),
            legacyValue = json.optInt("replacementModeAndroid").takeIf {
                json.has("replacementModeAndroid")
            },
            legacyName = "replacementModeAndroid",
            canonicalName = "subscriptionProductReplacementParams",
        )
        if (json.has("replacementMode")) {
            warnLegacyWireInput("replacementMode", "subscriptionProductReplacementParams")
        }

        // Parse subscriptionProductReplacementParams (8.1.0+)
        val subscriptionProductReplacementParams = if (json.has("subscriptionProductReplacementParams")) {
            val paramsObj = json.optJSONObject("subscriptionProductReplacementParams")
            if (paramsObj != null) {
                val oldProductId = paramsObj.optString("oldProductId").takeIf { it.isNotEmpty() }
                val mode = paramsObj.optString("replacementMode").takeIf { it.isNotEmpty() }
                val parsedMode = parseSubscriptionReplacementMode(mode)
                if (oldProductId != null && parsedMode != null) {
                    SubscriptionProductReplacementParamsAndroid(
                        oldProductId = oldProductId,
                        replacementMode = parsedMode
                    )
                } else null
            } else null
        } else null

        val developerBillingOption = json.optJSONObject("developerBillingOption")?.let {
            DeveloperBillingOptionParamsAndroid.fromJson(jsonObjectToMap(it))
        }

        val canonicalOfferToken = json.optStringOrNull("offerToken")

        // Parse the pre-3.0 offer token array.
        val offerTokenArr = mutableListOf<String>()
        val offerTokenArray = json.optJSONArray("offerTokenArr")
        if (json.has("offerTokenArr")) {
            warnLegacyWireInput(
                "offerTokenArr",
                "offerToken for one-time products or subscriptionOffers for subscriptions",
            )
        }
        if (offerTokenArray != null) {
            for (i in 0 until offerTokenArray.length()) {
                offerTokenArr.add(offerTokenArray.getString(i))
            }
        }

        // Parse explicit subscription offers
        val explicitSubscriptionOffers = mutableListOf<AndroidSubscriptionOfferInput>()
        val offersArray = json.optJSONArray("subscriptionOffers")
        if (offersArray != null) {
            for (i in 0 until offersArray.length()) {
                val offer = offersArray.getJSONObject(i)
                val sku = offer.optString("sku", "")
                val offerToken = offer.optString("offerToken", "")
                if (sku.isNotEmpty() && offerToken.isNotEmpty()) {
                    explicitSubscriptionOffers.add(
                        AndroidSubscriptionOfferInput(offerToken = offerToken, sku = sku)
                    )
                }
            }
        }

        // Build subscription offers from offerTokenArr as fallback
        val subscriptionOffers = if (json.has("subscriptionOffers")) {
            explicitSubscriptionOffers
        } else if (offerTokenArr.isNotEmpty() && skus.isNotEmpty()) {
            skus.zip(offerTokenArr).mapNotNull { (sku, token) ->
                if (token.isNotEmpty()) {
                    AndroidSubscriptionOfferInput(offerToken = token, sku = sku)
                } else {
                    null
                }
            }
        } else {
            emptyList()
        }

        return RequestPurchaseParams(
            type = type,
            skus = skus,
            obfuscatedAccountId = obfuscatedAccountId,
            obfuscatedProfileId = obfuscatedProfileId,
            isOfferPersonalized = isOfferPersonalized,
            offerToken = if (json.has("offerToken")) {
                canonicalOfferToken
            } else {
                offerTokenArr.firstOrNull()
            },
            subscriptionOffers = subscriptionOffers,
            developerBillingOption = developerBillingOption,
            originalExternalTransactionId = originalExternalTransactionId,
            purchaseToken = purchaseToken,
            replacementMode = replacementMode,
            subscriptionProductReplacementParams = subscriptionProductReplacementParams
        )
    }

    /**
     * Parse subscription replacement mode from string.
     * Maps string values to SubscriptionReplacementModeAndroid enum.
     */
    private fun parseSubscriptionReplacementMode(mode: String?): SubscriptionReplacementModeAndroid? {
        return when (mode?.lowercase(Locale.US)?.replace("-", "_")) {
            "unknown_replacement_mode" -> SubscriptionReplacementModeAndroid.UnknownReplacementMode
            "with_time_proration" -> SubscriptionReplacementModeAndroid.WithTimeProration
            "charge_prorated_price" -> SubscriptionReplacementModeAndroid.ChargeProratedPrice
            "without_proration" -> SubscriptionReplacementModeAndroid.WithoutProration
            "charge_full_price" -> SubscriptionReplacementModeAndroid.ChargeFullPrice
            "deferred" -> SubscriptionReplacementModeAndroid.Deferred
            else -> null
        }
    }

    /**
     * Request purchase parameters data class.
     * Matches ExpoIapHelper.RequestPurchaseParams structure.
     */
    data class RequestPurchaseParams(
        val type: String?,
        val skus: List<String>,
        val obfuscatedAccountId: String?,
        val obfuscatedProfileId: String?,
        val isOfferPersonalized: Boolean,
        val offerToken: String?,
        val subscriptionOffers: List<AndroidSubscriptionOfferInput>,
        val developerBillingOption: DeveloperBillingOptionParamsAndroid?,
        val originalExternalTransactionId: String?,
        val purchaseToken: String?,
        val replacementMode: Int?,
        val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?,
    )

    private fun warnLegacyWireInput(
        legacyName: String,
        canonicalName: String,
    ) {
        GodotIapLog.deprecation(
            key = "wire:$legacyName",
            message =
                "$legacyName is deprecated and will be removed in godot-iap 3.0.0; " +
                    "use $canonicalName instead.",
        )
    }

    internal fun <T> resolveCanonicalWireValue(
        canonicalPresent: Boolean,
        canonicalValue: T?,
        legacyPresent: Boolean,
        legacyValue: T?,
        legacyName: String,
        canonicalName: String,
    ): T? {
        if (legacyPresent) {
            warnLegacyWireInput(legacyName, canonicalName)
        }
        return if (canonicalPresent) canonicalValue else legacyValue
    }
}
