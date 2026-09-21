package dev.hyo.martie.config

/**
 * Application configuration for the example app.
 *
 * Environment variables are loaded from .env file or BuildConfig.
 * This mobile example must use an openiap-kit_pk_ publishable key. Never put
 * an openiap-kit_sk_ secret admin key in an app build.
 */
expect object AppConfig {
    /**
     * IAPKit publishable key for purchase verification.
     * Get an openiap-kit_pk_ key from https://kit.openiap.dev
     */
    val iapkitApiKey: String

    /** Origin of a local IAPKit server; blank selects the hosted default. */
    val iapkitBaseUrl: String

    /** App Tester receipts only verify against Amazon's RVS Cloud Sandbox. */
    val amazonRvsSandbox: Boolean
}

/**
 * Refuse a secret key rather than send it. It is still compiled into the app,
 * so keep it out of .env and Secrets.xcconfig in the first place.
 */
fun rejectSecretKey(apiKey: String): String {
    if (!apiKey.startsWith("openiap-kit_sk_")) return apiKey
    println("[AppConfig] api key is a secret sk_ key; use an openiap-kit_pk_ key")
    return ""
}
