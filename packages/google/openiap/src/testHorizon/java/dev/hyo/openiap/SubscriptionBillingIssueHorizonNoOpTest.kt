package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.atomic.AtomicInteger

/**
 * Verifies that the Horizon flavor's OpenIapModule implements
 * [OpenIapProtocol.addSubscriptionBillingIssueListener] and
 * [OpenIapProtocol.removeSubscriptionBillingIssueListener] as **explicit
 * no-ops** rather than throwing.
 *
 * Guards against accidentally letting Play-flavor emission logic leak into
 * the Horizon flavor: the Horizon Billing Compatibility SDK targets Play
 * Billing 7.0 which does not expose Purchase.isSuspended, so the listener
 * must exist for API parity but must never invoke the callback.
 *
 * Reference: https://developers.meta.com/horizon/documentation/spatial-sdk/horizon-billing-compatibility-sdk/
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class SubscriptionBillingIssueHorizonNoOpTest {

    @Test
    fun `add and remove SubscriptionBillingIssueListener never invokes the callback`() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val module = OpenIapModule(context)
        val invoked = AtomicInteger(0)
        val listener = OpenIapSubscriptionBillingIssueListener { invoked.incrementAndGet() }

        module.addSubscriptionBillingIssueListener(listener)
        module.removeSubscriptionBillingIssueListener(listener)

        assertEquals(
            "Horizon flavor must never invoke the subscriptionBillingIssue listener",
            0,
            invoked.get()
        )
    }
}
