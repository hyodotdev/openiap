package dev.hyo.openiap.conformance

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.fromBillingResponseCode
import dev.hyo.openiap.utils.toActiveSubscription

/**
 * Google Play's binding into the shared conformance suite.
 * The behavioral expectations live in [StoreConformanceSuite].
 */
class PlayStoreConformanceTest : StoreConformanceSuite() {
    override val adapter = object : StoreConformanceAdapter {
        override val store = IapStore.Google

        override val capabilities = setOf(
            StoreCapability.PendingPurchases,
            StoreCapability.SubscriptionBillingIssue,
            StoreCapability.OfferCodeRedemption,
        )

        override fun toActiveSubscription(purchase: PurchaseAndroid): ActiveSubscription =
            purchase.toActiveSubscription()

        override fun errorForResponseCode(responseCode: Int): OpenIapError =
            OpenIapError.fromBillingResponseCode(responseCode)
    }
}
