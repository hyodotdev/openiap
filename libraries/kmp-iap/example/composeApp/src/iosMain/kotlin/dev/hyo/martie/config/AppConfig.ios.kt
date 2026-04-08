package dev.hyo.martie.config

import platform.Foundation.NSBundle
import platform.Foundation.NSProcessInfo

actual object AppConfig {
    actual val iapkitApiKey: String
        get() {
            // Try to get from Info.plist first
            val bundleValue = NSBundle.mainBundle.objectForInfoDictionaryKey("IAPKIT_API_KEY") as? String
            if (!bundleValue.isNullOrEmpty()) {
                return bundleValue
            }

            // Fallback to environment variable (for development)
            val envValue = NSProcessInfo.processInfo.environment["IAPKIT_API_KEY"] as? String
            if (!envValue.isNullOrEmpty()) {
                return envValue
            }

            // Default empty - will show error in UI
            return ""
        }
}
