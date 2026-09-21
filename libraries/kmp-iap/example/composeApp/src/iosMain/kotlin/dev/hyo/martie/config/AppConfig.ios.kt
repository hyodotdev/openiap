package dev.hyo.martie.config

import platform.Foundation.NSBundle
import platform.Foundation.NSProcessInfo

// Info.plist first so a build can pin a value; the environment stays for local runs.
private fun readSetting(key: String): String {
    val bundleValue = NSBundle.mainBundle.objectForInfoDictionaryKey(key) as? String
    if (!bundleValue.isNullOrEmpty()) {
        return bundleValue
    }
    val envValue = NSProcessInfo.processInfo.environment[key] as? String
    if (!envValue.isNullOrEmpty()) {
        return envValue
    }
    return ""
}

actual object AppConfig {
    actual val iapkitApiKey: String
        get() = rejectSecretKey(readSetting("IAPKIT_API_KEY"))

    actual val iapkitBaseUrl: String
        get() = readSetting("IAPKIT_BASE_URL")

    actual val amazonRvsSandbox: Boolean
        get() = readSetting("AMAZON_RVS_SANDBOX").equals("true", ignoreCase = true)
}
