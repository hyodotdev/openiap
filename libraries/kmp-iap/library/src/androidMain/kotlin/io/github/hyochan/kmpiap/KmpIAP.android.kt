package io.github.hyochan.kmpiap

/**
 * Android-specific factory function for creating InAppPurchase implementation
 */
actual fun createPlatformInAppPurchase(): KmpInAppPurchase =
    when (BuildConfig.OPENIAP_STORE) {
        "horizon" -> OpenIapDelegateInAppPurchaseAndroid(
            storeName = "horizon",
            store = Store.HORIZON,
            versionPlatform = "Android Horizon"
        )
        "amazon" -> OpenIapDelegateInAppPurchaseAndroid(
            storeName = "amazon",
            store = Store.AMAZON,
            versionPlatform = "Android Amazon"
        )
        else -> InAppPurchaseAndroid()
    }
