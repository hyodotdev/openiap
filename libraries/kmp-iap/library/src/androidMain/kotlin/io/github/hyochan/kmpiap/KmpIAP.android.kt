package io.github.hyochan.kmpiap

/**
 * Android-specific factory function for creating InAppPurchase implementation
 */
actual fun createPlatformInAppPurchase(): KmpInAppPurchase =
    when (BuildConfig.OPENIAP_STORE.lowercase()) {
        "horizon", "meta", "quest" -> AmazonInAppPurchaseAndroid(
            storeName = "horizon",
            store = Store.PLAY_STORE,
            versionPlatform = "Android Horizon"
        )
        "amazon", "fire", "fireos" -> AmazonInAppPurchaseAndroid(
            storeName = "amazon",
            store = Store.AMAZON,
            versionPlatform = "Android Amazon"
        )
        else -> InAppPurchaseAndroid()
    }
