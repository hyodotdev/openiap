package dev.hyo.martie

object IapConstants {
    // App-defined SKU lists
    val INAPP_SKUS = listOf(
        "dev.hyo.martie.10bulbs",
        "dev.hyo.martie.30bulbs",
        "dev.hyo.martie.certified"  // Non-consumable
    )

    val SUBS_SKUS = listOf(
        "dev.hyo.martie.premium",      // Main subscription with multiple offers
        "dev.hyo.martie.premium_year"  // Separate yearly subscription product
    )

    // Base plan IDs for dev.hyo.martie.premium subscription
    const val PREMIUM_MONTHLY_BASE_PLAN = "premium"       // Monthly base plan
    const val PREMIUM_YEARLY_BASE_PLAN = "premium-year"   // Yearly base plan
}

