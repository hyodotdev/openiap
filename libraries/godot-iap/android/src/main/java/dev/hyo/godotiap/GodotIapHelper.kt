package dev.hyo.godotiap

import dev.hyo.openiap.AndroidSubscriptionOfferInput
import dev.hyo.openiap.ProductQueryType
import dev.hyo.openiap.SubscriptionProductReplacementParamsAndroid
import dev.hyo.openiap.SubscriptionReplacementModeAndroid
import org.json.JSONObject
import java.util.Locale

/**
 * Helper utilities for GodotIap plugin.
 * Provides parsing functions for request parameters and sanitization utilities.
 */
internal object GodotIapHelper {

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
     * Parse product query type from string.
     * Handles various formats: "subs", "in-app", "in_app", "inapp", "all"
     */
    fun parseProductQueryType(rawType: String?): ProductQueryType {
        val normalized = rawType
            ?.trim()
            ?.lowercase(Locale.US)
            ?.replace("-", "")
            ?.replace("_", "")

        return when (normalized) {
            "subs" -> ProductQueryType.Subs
            "all" -> ProductQueryType.All
            else -> ProductQueryType.InApp
        }
    }

    /**
     * Parse request purchase parameters from JSON string.
     * Mirrors ExpoIapHelper.parseRequestPurchaseParams() for consistency.
     */
    fun parseRequestPurchaseParams(paramsJson: String): RequestPurchaseParams {
        val json = JSONObject(paramsJson)

        // Parse type
        val type = json.optStringOrNull("type")

        // Parse skus - check multiple possible keys
        val skus = mutableListOf<String>()
        val skusArray = json.optJSONArray("skus") ?: json.optJSONArray("skuArr")
        if (skusArray != null) {
            for (i in 0 until skusArray.length()) {
                skus.add(skusArray.getString(i))
            }
        }

        // Parse obfuscated IDs (support both Android-suffixed and plain keys)
        val obfuscatedAccountId = json.optStringOrNull("obfuscatedAccountIdAndroid")
            ?: json.optStringOrNull("obfuscatedAccountId")
        val obfuscatedProfileId = json.optStringOrNull("obfuscatedProfileIdAndroid")
            ?: json.optStringOrNull("obfuscatedProfileId")

        // Parse other options
        val isOfferPersonalized = json.optBoolean("isOfferPersonalized", false)
        val purchaseToken = json.optStringOrNull("purchaseTokenAndroid")
            ?: json.optStringOrNull("purchaseToken")
        val replacementMode = when {
            json.has("replacementModeAndroid") -> json.optInt("replacementModeAndroid")
            json.has("replacementMode") -> json.optInt("replacementMode")
            else -> null
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

        // Parse offer token array
        val offerTokenArr = mutableListOf<String>()
        val offerTokenArray = json.optJSONArray("offerTokenArr")
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
        val subscriptionOffers = if (explicitSubscriptionOffers.isNotEmpty()) {
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
            offerTokenArr = offerTokenArr,
            subscriptionOffers = subscriptionOffers,
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
        val offerTokenArr: List<String>,
        val subscriptionOffers: List<AndroidSubscriptionOfferInput>,
        val purchaseToken: String?,
        val replacementMode: Int?,
        val subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid?
    )
}
