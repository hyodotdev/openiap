package dev.hyo.martie.config

import dev.hyo.martie.BuildConfig

actual object AppConfig {
    actual val iapkitApiKey: String = BuildConfig.IAPKIT_API_KEY
    actual val iapkitBaseUrl: String = BuildConfig.IAPKIT_BASE_URL
    actual val amazonRvsSandbox: Boolean = BuildConfig.AMAZON_RVS_SANDBOX
}
