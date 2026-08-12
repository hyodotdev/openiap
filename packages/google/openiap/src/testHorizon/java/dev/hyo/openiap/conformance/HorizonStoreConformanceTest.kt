package dev.hyo.openiap.conformance

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.fromBillingResponseCode
import dev.hyo.openiap.utils.HorizonBillingConverters.toActiveSubscription

/**
 * Meta Horizon's binding into the shared conformance suite.
 * The behavioral expectations live in [StoreConformanceSuite].
 */
class HorizonStoreConformanceTest : StoreConformanceSuite() {
    override val adapter = object : StoreConformanceAdapter {
        override val store = IapStore.Horizon

        // Horizon's Billing Compatibility SDK implements Play Billing 7.0,
        // which predates the suspension signal, and exposes no offer-code
        // redemption entry point. It does report PENDING.
        override val capabilities = setOf(
            StoreCapability.PendingPurchases,
        )

        override fun toActiveSubscription(purchase: PurchaseAndroid): ActiveSubscription =
            purchase.toActiveSubscription()

        override fun errorForResponseCode(responseCode: Int): OpenIapError =
            OpenIapError.fromBillingResponseCode(responseCode)
    }
}
