package dev.hyo.openiap

/**
 * Extension function to convert SubscriptionReplacementModeAndroid enum to
 * BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode constants.
 *
 * Reference (Billing Library 8.1.0+):
 * https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
 *
 * Note: These constants differ from the legacy SubscriptionUpdateParams.ReplacementMode API.
 * See: https://github.com/hyodotdev/openiap/issues/71
 *
 * @return The integer constant for SubscriptionProductReplacementParams.ReplacementMode
 */
internal fun SubscriptionReplacementModeAndroid.toReplacementModeConstant(): Int {
    return when (this) {
        SubscriptionReplacementModeAndroid.UnknownReplacementMode -> 0
        SubscriptionReplacementModeAndroid.WithTimeProration -> 1
        SubscriptionReplacementModeAndroid.ChargeProratedPrice -> 2
        SubscriptionReplacementModeAndroid.WithoutProration -> 3
        SubscriptionReplacementModeAndroid.ChargeFullPrice -> 4
        SubscriptionReplacementModeAndroid.Deferred -> 5
        SubscriptionReplacementModeAndroid.KeepExisting -> 6
    }
}
