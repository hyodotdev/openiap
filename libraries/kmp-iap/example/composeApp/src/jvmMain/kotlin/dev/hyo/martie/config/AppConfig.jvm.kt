package dev.hyo.martie.config

actual object AppConfig {
    actual val iapkitApiKey: String
        get() = System.getenv("IAPKIT_API_KEY") ?: ""
}
