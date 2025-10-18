package dev.hyo.martie.util

import android.content.SharedPreferences
import dev.hyo.martie.IapConstants
import dev.hyo.openiap.PurchaseAndroid
import org.json.JSONObject

const val SUBSCRIPTION_PREFS_NAME = "subscription_prefs"
const val PREMIUM_SUBSCRIPTION_PRODUCT_ID = "dev.hyo.martie.premium"
private const val OFFER_PREF_KEY_PREFIX = "current_offer_"

data class SubscriptionOfferInfo(
    val basePlanId: String,
    val displayName: String,
    val billingPeriod: String? = null  // e.g., "P1M", "P1Y" (Horizon uses this)
)

fun premiumOfferPreferenceKey(productId: String): String = "$OFFER_PREF_KEY_PREFIX$productId"

fun SharedPreferences.savePremiumOffer(productId: String, basePlanId: String) {
    edit().putString(premiumOfferPreferenceKey(productId), basePlanId).apply()
}

fun SharedPreferences.loadPremiumOffer(productId: String): String? =
    getString(premiumOfferPreferenceKey(productId), null)

fun resolvePremiumOfferInfo(
    prefs: SharedPreferences,
    purchase: PurchaseAndroid
): SubscriptionOfferInfo? {
    if (purchase.productId != PREMIUM_SUBSCRIPTION_PRODUCT_ID) return null

    val receiptOffer = extractBasePlanFromReceipt(purchase.dataAndroid)
    val storedOffer = prefs.loadPremiumOffer(purchase.productId)

    if (!receiptOffer.isNullOrBlank() && receiptOffer != storedOffer) {
        prefs.savePremiumOffer(purchase.productId, receiptOffer)
    }

    val resolvedOffer = receiptOffer ?: storedOffer
    val basePlanId = resolvedOffer?.takeIf { it.isNotBlank() } ?: IapConstants.PREMIUM_MONTHLY_BASE_PLAN

    // Extract billing period from receipt (for Horizon)
    val billingPeriod = extractBillingPeriodFromReceipt(purchase.dataAndroid)

    val displayName = when (basePlanId) {
        IapConstants.PREMIUM_YEARLY_BASE_PLAN -> "Yearly Plan (premium-year)"
        IapConstants.PREMIUM_MONTHLY_BASE_PLAN -> "Monthly Plan (premium)"
        else -> "Base Plan: $basePlanId"
    }

    return SubscriptionOfferInfo(
        basePlanId = basePlanId,
        displayName = displayName,
        billingPeriod = billingPeriod
    )
}

private fun extractBasePlanFromReceipt(rawJson: String?): String? {
    val json = rawJson ?: return null
    return try {
        val root = JSONObject(json)
        val lineItemBasePlan = root.optJSONArray("lineItems")
            ?.optJSONObject(0)
            ?.optString("basePlanId")
            ?.takeIf { it.isNotBlank() }

        lineItemBasePlan ?: when {
            root.has("basePlanId") -> root.optString("basePlanId")
            root.has("subscriptionType") -> root.optString("subscriptionType")
            root.has("subscriptionPurchase") -> root.optJSONObject("subscriptionPurchase")?.optString("basePlanId")
            else -> null
        }?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
        null
    }
}

private fun extractBillingPeriodFromReceipt(rawJson: String?): String? {
    val json = rawJson ?: return null
    return try {
        val root = JSONObject(json)
        // Try to extract billing period from receipt JSON
        // This is useful for Horizon where all offers have same base plan ID
        when {
            root.has("billingPeriod") -> root.optString("billingPeriod")
            root.has("subscriptionPeriod") -> root.optString("subscriptionPeriod")
            root.has("lineItems") -> root.optJSONArray("lineItems")
                ?.optJSONObject(0)
                ?.optString("billingPeriod")
            else -> null
        }?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
        null
    }
}
