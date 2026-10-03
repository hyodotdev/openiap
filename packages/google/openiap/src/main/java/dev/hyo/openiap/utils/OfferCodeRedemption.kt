package dev.hyo.openiap.utils

import android.app.Activity
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol

@Suppress("DEPRECATION")
suspend fun redeemOfferCode(provider: OpenIapProtocol, activity: Activity?): Boolean {
    if (activity != null) {
        provider.setActivity(activity)
        return provider.openRedeemOfferCode(activity)
    }
    // Legacy handlers preserve the official stores' no-Activity result.
    return provider.mutationHandlers.openRedeemOfferCodeAndroid?.invoke()
        ?: throw OpenIapError.MissingCurrentActivity
}
