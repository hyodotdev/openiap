package dev.hyo.openiap.conformance

import android.app.Activity
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.fromBillingResponseCode
import dev.hyo.openiap.utils.HorizonBillingConverters.toActiveSubscription
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Meta Horizon's binding into the shared conformance suite.
 * The behavioral expectations live in [StoreConformanceSuite].
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class HorizonStoreConformanceTest : StoreConformanceSuite() {
    override val provider: OpenIapProtocol =
        OpenIapModule(ApplicationProvider.getApplicationContext<Context>())
    override val redemptionActivity: Activity =
        Robolectric.buildActivity(Activity::class.java).setup().get()
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

        override val normativeErrorCases = playBillingErrorCases(OpenIapError::fromBillingResponseCode)

        override val unrecognizedError = OpenIapError.fromBillingResponseCode(9999)
    }
}
