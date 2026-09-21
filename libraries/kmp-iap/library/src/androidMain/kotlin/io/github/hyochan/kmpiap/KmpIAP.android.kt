package io.github.hyochan.kmpiap

/**
 * Android-specific factory function for creating InAppPurchase implementation
 */
actual fun createPlatformInAppPurchase(): KmpInAppPurchase =
    when (BuildConfig.OPENIAP_STORE.lowercase()) {
        "horizon", "meta", "quest" -> OpenIapDelegateInAppPurchaseAndroid(
            storeName = "horizon",
            store = Store.HORIZON,
            versionPlatform = "Android Horizon"
        )
        "amazon", "fire", "fireos" -> OpenIapDelegateInAppPurchaseAndroid(
            storeName = "amazon",
            store = Store.AMAZON,
            versionPlatform = "Android Amazon"
        )
        else -> InAppPurchaseAndroid()
    }
