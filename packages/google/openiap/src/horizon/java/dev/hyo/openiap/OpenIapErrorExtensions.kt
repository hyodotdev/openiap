package dev.hyo.openiap

import com.meta.horizon.billingclient.api.BillingClient

/**
 * Extension function for converting Horizon Billing response codes to OpenIapError
 */
@Suppress("DEPRECATION")
fun OpenIapError.Companion.fromBillingResponseCode(responseCode: Int, debugMessage: String? = null): OpenIapError {
    return when (responseCode) {
        BillingClient.BillingResponseCode.USER_CANCELED -> OpenIapError.UserCancelled(debugMessage)
        BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> OpenIapError.ServiceUnavailable(debugMessage)
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> OpenIapError.BillingUnavailable(debugMessage)
        BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> OpenIapError.ItemUnavailable(debugMessage)
        BillingClient.BillingResponseCode.DEVELOPER_ERROR -> OpenIapError.DeveloperError(debugMessage)
        BillingClient.BillingResponseCode.ERROR -> OpenIapError.BillingError(debugMessage)
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> OpenIapError.ItemAlreadyOwned(debugMessage)
        BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> OpenIapError.ItemNotOwned(debugMessage)
        BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> OpenIapError.ServiceDisconnected(debugMessage)
        BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> OpenIapError.FeatureNotSupported(debugMessage)
        BillingClient.BillingResponseCode.SERVICE_TIMEOUT -> OpenIapError.ServiceTimeout(debugMessage)
        else -> OpenIapError.UnknownError(debugMessage)
    }
}
