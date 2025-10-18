package dev.hyo.martie

import android.os.Build

object IapConstants {
    // App-defined SKU lists
    val INAPP_SKUS = listOf(
        "dev.hyo.martie.10bulbs",
        "dev.hyo.martie.30bulbs",
        "dev.hyo.martie.certified"  // Non-consumable
    )

    // Google Play: Two separate subscription products
    private val SUBS_SKUS_PLAY = listOf(
        "dev.hyo.martie.premium",      // Main subscription with multiple offers
        "dev.hyo.martie.premium_year"  // Separate yearly subscription product
    )

    // Horizon OS: Two separate SKUs (both at Level 1 to prevent auto-upgrade)
    // IMPORTANT: In Horizon Developer Console, both must be set to the SAME Level
    // to prevent automatic tier upgrades. Currently configured as:
    // - premium (Level 1): Has MONTHLY and ANNUAL offers
    // - premium_year (Level 1): Has ANNUAL offer only
    private val SUBS_SKUS_HORIZON = listOf(
        "dev.hyo.martie.premium",      // Premium with multiple term options
        "dev.hyo.martie.premium_year"  // Separate yearly-only subscription
    )

    // Detect if running on Horizon OS
    private fun isHorizonOS(): Boolean {
        return Build.MANUFACTURER.equals("Meta", ignoreCase = true) ||
               Build.BRAND.equals("Meta", ignoreCase = true) ||
               Build.MODEL.contains("Quest", ignoreCase = true)
    }

    // Get subscription SKUs based on current device
    fun getSubscriptionSkus(): List<String> {
        val isHorizon = isHorizonOS()
        val skus = if (isHorizon) SUBS_SKUS_HORIZON else SUBS_SKUS_PLAY
        println("IapConstants: getSubscriptionSkus() - isHorizon=$isHorizon, skus=$skus")
        return skus
    }

    // Legacy: For screens that don't have platform context yet
    val SUBS_SKUS = getSubscriptionSkus()

    // Product IDs
    const val PREMIUM_PRODUCT_ID = "dev.hyo.martie.premium"
    const val PREMIUM_YEARLY_PRODUCT_ID_PLAY = "dev.hyo.martie.premium_year" // Play only

    // Base plan IDs (used by both Play and Horizon)
    const val PREMIUM_MONTHLY_BASE_PLAN = "premium"       // 1 month plan
    const val PREMIUM_YEARLY_BASE_PLAN = "premium-year"   // 12 months plan
}

