package io.github.hyochan.kmpiap

/**
 * iOS-specific factory function for creating InAppPurchase implementation
 */
actual fun createPlatformInAppPurchase(): KmpInAppPurchase = InAppPurchaseIOS()