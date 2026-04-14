package dev.hyo.openiap

import com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode

/**
 * Extension function to convert SubscriptionReplacementModeAndroid enum to
 * BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode constants.
 *
 * Reference (Billing Library 8.1.0+):
 * https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
 *
 * Values are sourced from the native Billing Library constants so the mapping
 * tracks Google's library, not a hardcoded copy that can drift.
 *
 * Note: These constants differ from the legacy SubscriptionUpdateParams.ReplacementMode API.
 * See: https://github.com/hyodotdev/openiap/issues/71
 */
internal fun SubscriptionReplacementModeAndroid.toReplacementModeConstant(): Int {
    return when (this) {
        SubscriptionReplacementModeAndroid.UnknownReplacementMode -> ReplacementMode.UNKNOWN_REPLACEMENT_MODE
        SubscriptionReplacementModeAndroid.WithTimeProration -> ReplacementMode.WITH_TIME_PRORATION
        SubscriptionReplacementModeAndroid.ChargeProratedPrice -> ReplacementMode.CHARGE_PRORATED_PRICE
        SubscriptionReplacementModeAndroid.WithoutProration -> ReplacementMode.WITHOUT_PRORATION
        SubscriptionReplacementModeAndroid.ChargeFullPrice -> ReplacementMode.CHARGE_FULL_PRICE
        SubscriptionReplacementModeAndroid.Deferred -> ReplacementMode.DEFERRED
        SubscriptionReplacementModeAndroid.KeepExisting -> ReplacementMode.KEEP_EXISTING
    }
}
