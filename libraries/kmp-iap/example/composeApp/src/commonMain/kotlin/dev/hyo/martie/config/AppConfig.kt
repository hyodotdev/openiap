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
}
