package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * On Horizon the billing-issue event has no underlying signal (Horizon
 * Billing Compatibility SDK targets Play Billing 7.0 which lacks
 * Purchase.isSuspended). The handler must still be exposed for API parity
 * with the generated bundle, but invoking it must throw
 * FeatureNotSupported instead of suspending forever.
 *
 * This guards against two regressions:
 *  - dropping the handler entirely (would return null on Horizon), and
 *  - reintroducing a silent no-op that hangs consumers waiting for an
 *    event the platform cannot emit.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class SubscriptionHandlersBillingIssueHorizonTest {

    @Test
    fun `Horizon subscriptionHandlers exposes subscriptionBillingIssue that throws FeatureNotSupported`() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val module = OpenIapModule(context)

        val handler = module.subscriptionHandlers.subscriptionBillingIssue
        assertNotNull(
            "Horizon flavor must wire subscriptionBillingIssue handler for bundle parity",
            handler
        )

        val thrown = runCatching { runBlocking { handler!!.invoke() } }.exceptionOrNull()
        assertTrue(
            "Horizon subscriptionBillingIssue handler must throw FeatureNotSupported, got: $thrown",
            thrown is OpenIapError.FeatureNotSupported
        )
    }
}
