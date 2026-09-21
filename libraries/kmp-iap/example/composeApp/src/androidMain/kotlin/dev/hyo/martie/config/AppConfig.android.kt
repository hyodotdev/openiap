package dev.hyo.martie.config

import dev.hyo.martie.BuildConfig

actual object AppConfig {
    actual val iapkitApiKey: String = rejectSecretKey(BuildConfig.IAPKIT_API_KEY.trim())
    actual val iapkitBaseUrl: String = BuildConfig.IAPKIT_BASE_URL.trim()
    actual val amazonRvsSandbox: Boolean = BuildConfig.AMAZON_RVS_SANDBOX
}
