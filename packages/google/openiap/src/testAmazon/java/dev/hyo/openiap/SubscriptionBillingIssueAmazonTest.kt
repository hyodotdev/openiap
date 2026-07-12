package dev.hyo.openiap

import android.content.ContextWrapper
import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * Amazon Appstore SDK has no subscription billing issue callback. The bundle
 * still exposes the handler for API parity, but it must fail fast instead of
 * suspending forever.
 */
class SubscriptionBillingIssueAmazonTest {

    @Test
    fun `Amazon subscriptionBillingIssue handler throws FeatureNotSupported`() {
        val module = OpenIapModule(ContextWrapper(null))

        val handler = module.subscriptionHandlers.subscriptionBillingIssue
        assertNotNull(
            "Amazon flavor must wire subscriptionBillingIssue handler for bundle parity",
            handler
        )

        val thrown = runCatching { runBlocking { withTimeout(5_000) { handler!!.invoke() } } }.exceptionOrNull()
        assertTrue(
            "Amazon subscriptionBillingIssue handler must throw FeatureNotSupported, got: $thrown",
            thrown is OpenIapError.FeatureNotSupported
        )
    }

    @Test
    fun `add and remove SubscriptionBillingIssueListener never invokes the callback`() {
        val module = OpenIapModule(ContextWrapper(null))
        val invoked = AtomicInteger(0)
        val listener = OpenIapSubscriptionBillingIssueListener { invoked.incrementAndGet() }

        module.addSubscriptionBillingIssueListener(listener)
        module.removeSubscriptionBillingIssueListener(listener)

        assertEquals(
            "Amazon flavor must never invoke the subscriptionBillingIssue listener",
            0,
            invoked.get()
        )
    }

    @Test
    fun `Amazon Android billing-choice handlers fail fast as unsupported`() {
        val module = OpenIapModule(ContextWrapper(null))
        val userChoice = module.subscriptionHandlers.userChoiceBillingAndroid
        val developerProvided = module.subscriptionHandlers.developerProvidedBillingAndroid

        assertNotNull("Amazon must expose userChoiceBillingAndroid for bundle parity", userChoice)
        assertNotNull(
            "Amazon must expose developerProvidedBillingAndroid for bundle parity",
            developerProvided,
        )

        val userChoiceError = runCatching {
            runBlocking { withTimeout(5_000) { userChoice!!.invoke() } }
        }.exceptionOrNull()
        val developerProvidedError = runCatching {
            runBlocking { withTimeout(5_000) { developerProvided!!.invoke() } }
        }.exceptionOrNull()

        assertTrue(userChoiceError is OpenIapError.FeatureNotSupported)
        assertTrue(developerProvidedError is OpenIapError.FeatureNotSupported)
    }

    @Test
    fun `Amazon query bundle omits iOS-only storefront handler`() {
        val module = OpenIapModule(ContextWrapper(null))

        assertNotNull("Amazon must wire cross-platform getStorefront", module.queryHandlers.getStorefront)
        assertNull(
            "Amazon must not wire the iOS-only getStorefrontIOS handler",
            module.queryHandlers.getStorefrontIOS,
        )
    }
}
