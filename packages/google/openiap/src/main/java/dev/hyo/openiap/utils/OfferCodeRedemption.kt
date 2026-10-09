package dev.hyo.openiap.utils

import android.app.Activity
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.Purchase

suspend fun redeemOfferCode(provider: OpenIapProtocol, activity: Activity?): Purchase? {
    activity?.let(provider::setActivity)
    val handler = provider.mutationHandlers.openRedeemOfferCode
        ?: throw OpenIapError.FeatureNotSupported()
    return handler()
}
