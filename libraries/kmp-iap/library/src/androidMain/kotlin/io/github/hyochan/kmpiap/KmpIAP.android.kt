package io.github.hyochan.kmpiap

/**
 * Android-specific factory function for creating InAppPurchase implementation
 */
actual fun createPlatformInAppPurchase(): KmpInAppPurchase = InAppPurchaseAndroid()