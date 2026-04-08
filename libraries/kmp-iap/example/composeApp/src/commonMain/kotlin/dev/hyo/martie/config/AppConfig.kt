package dev.hyo.martie.config

/**
 * Application configuration for the example app.
 *
 * Environment variables are loaded from .env file or BuildConfig.
 * For security, API keys should never be hardcoded in production apps.
 */
expect object AppConfig {
    /**
     * IAPKit API key for purchase verification.
     * Get your API key from https://iapkit.com
     */
    val iapkitApiKey: String
}
