package dev.hyo.openiap

import com.android.billingclient.api.BillingClient

/**
 * Extension function for converting Google Play Billing response codes to OpenIapError
 */
@Suppress("DEPRECATION")
fun OpenIapError.Companion.fromBillingResponseCode(responseCode: Int, debugMessage: String? = null): OpenIapError {
    return when (responseCode) {
        BillingClient.BillingResponseCode.USER_CANCELED -> OpenIapError.UserCancelled
        BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> OpenIapError.ServiceUnavailable
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> OpenIapError.BillingUnavailable
        BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> OpenIapError.ItemUnavailable
        BillingClient.BillingResponseCode.DEVELOPER_ERROR -> OpenIapError.DeveloperError
        BillingClient.BillingResponseCode.ERROR -> OpenIapError.BillingError
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> OpenIapError.ItemAlreadyOwned
        BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> OpenIapError.ItemNotOwned
        BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> OpenIapError.ServiceDisconnected
        BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> OpenIapError.FeatureNotSupported
        BillingClient.BillingResponseCode.SERVICE_TIMEOUT -> OpenIapError.ServiceTimeout
        else -> OpenIapError.UnknownError
    }
}
