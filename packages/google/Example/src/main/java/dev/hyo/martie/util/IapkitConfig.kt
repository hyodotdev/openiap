package dev.hyo.martie.util

import dev.hyo.martie.BuildConfig

/** IAPKit settings the example reads from local.properties or Gradle properties. */
object IapkitConfig {
    /** Sent as `Bearer {apiKey}`; null when unset. */
    val apiKey: String? = BuildConfig.IAPKIT_API_KEY.trim().takeIf { it.isNotEmpty() }

    /** Origin of a locally running IAPKit server; null selects the hosted default. */
    val localBaseUrl: String? = BuildConfig.IAPKIT_BASE_URL.trim().takeIf { it.isNotEmpty() }

    /** Amazon App Tester receipts only verify against the RVS Cloud Sandbox. */
    val amazonRvsSandbox: Boolean = BuildConfig.AMAZON_RVS_SANDBOX
}
