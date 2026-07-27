package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Guards the Play-flavor OpenIapModule against regressing on the
 * `subscriptionHandlers.subscriptionBillingIssue` bundle surface.
 *
 * The GraphQL schema exposes a nullable `subscriptionBillingIssue`
 * handler and the Play flavor actually supports the event (Billing
 * Library 8.1+ via Purchase.isSuspended). If the module ever forgets
 * to wire the handler, consumers using the generated bundle API get
 * null even though `addSubscriptionBillingIssueListener` exists — this
 * test catches that drift.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class SubscriptionHandlersBillingIssueTest {

    @Test
    fun `Play subscriptionHandlers exposes every supported Android billing event`() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val module = OpenIapModule(context)

        assertNotNull(
            "Play flavor must wire subscriptionBillingIssue handler",
            module.subscriptionHandlers.subscriptionBillingIssue
        )
        assertNotNull(
            "Play flavor must wire userChoiceBillingAndroid handler",
            module.subscriptionHandlers.userChoiceBillingAndroid,
        )
        assertNotNull(
            "Play flavor must wire developerProvidedBillingAndroid handler",
            module.subscriptionHandlers.developerProvidedBillingAndroid,
        )
        assertNotNull("Play flavor must wire cross-platform getStorefront", module.queryHandlers.getStorefront)
    }
}
