package dev.hyo.openiap

/**
 * Compatibility mapping for tests and Android callers that still pass Google
 * Billing-style response codes while using the Amazon flavor.
 */
@Suppress("DEPRECATION")
fun OpenIapError.Companion.fromBillingResponseCode(
    responseCode: Int,
    debugMessage: String? = null,
): OpenIapError {
    return when (responseCode) {
        1 -> OpenIapError.UserCancelled(debugMessage)
        2 -> OpenIapError.ServiceUnavailable(debugMessage)
        3 -> OpenIapError.BillingUnavailable(debugMessage)
        4 -> OpenIapError.ItemUnavailable(debugMessage)
        5 -> OpenIapError.DeveloperError(debugMessage)
        6 -> OpenIapError.BillingError(debugMessage)
        7 -> OpenIapError.ItemAlreadyOwned(debugMessage)
        8 -> OpenIapError.ItemNotOwned(debugMessage)
        -1 -> OpenIapError.ServiceDisconnected(debugMessage)
        -2 -> OpenIapError.FeatureNotSupported(debugMessage)
        -3 -> OpenIapError.ServiceTimeout(debugMessage)
        else -> OpenIapError.UnknownError(debugMessage)
    }
}
