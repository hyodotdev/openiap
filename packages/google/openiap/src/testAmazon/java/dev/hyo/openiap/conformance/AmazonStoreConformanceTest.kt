package dev.hyo.openiap.conformance

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.fromBillingResponseCode
import dev.hyo.openiap.utils.toActiveSubscription

/**
 * Amazon Appstore's binding into the shared conformance suite.
 * The behavioral expectations live in [StoreConformanceSuite].
 */
class AmazonStoreConformanceTest : StoreConformanceSuite() {
    override val adapter = object : StoreConformanceAdapter {
        override val store = IapStore.Amazon

        // Amazon's receipt model has no deferred/pending state, exposes no
        // suspension signal, and has no offer-code redemption entry point.
        // Declared here so the suite checks the opposite expectation instead
        // of silently skipping.
        override val capabilities = emptySet<StoreCapability>()

        override fun toActiveSubscription(purchase: PurchaseAndroid): ActiveSubscription =
            purchase.toActiveSubscription()

        override fun errorForResponseCode(responseCode: Int): OpenIapError =
            OpenIapError.fromBillingResponseCode(responseCode)
    }
}
