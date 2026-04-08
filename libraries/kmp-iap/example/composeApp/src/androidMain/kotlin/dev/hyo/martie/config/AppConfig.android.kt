package dev.hyo.martie.config

import dev.hyo.martie.BuildConfig

actual object AppConfig {
    actual val iapkitApiKey: String = BuildConfig.IAPKIT_API_KEY
}
