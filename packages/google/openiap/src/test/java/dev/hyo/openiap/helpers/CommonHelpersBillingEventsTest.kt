package dev.hyo.openiap.helpers

import dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.UserChoiceBillingDetails
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertSame
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CommonHelpersBillingEventsTest {
    @Test
    fun `storefront country requires authoritative nonblank store value`() {
        assertEquals("KR", requireAuthoritativeStorefrontCountry(" KR "))
        val error = runCatching {
            requireAuthoritativeStorefrontCountry("  ")
        }.exceptionOrNull()
        assertTrue(error is OpenIapError.UnknownError)
    }

    @Test
    fun `product level replacement params require one target`() {
        assertTrue(isSubscriptionReplacementTargetCountValid(1, true))
        assertFalse(isSubscriptionReplacementTargetCountValid(2, true))
        assertTrue(isSubscriptionReplacementTargetCountValid(2, false))
    }

    @Test
    fun `subscription update source count enforces xor semantics`() {
        assertTrue(subscriptionUpdateSourceCount("play-token", null) == 1)
        assertTrue(subscriptionUpdateSourceCount(null, "external-id") == 1)
        assertTrue(subscriptionUpdateSourceCount(null, null) == 0)
        assertTrue(subscriptionUpdateSourceCount("play-token", "external-id") == 2)
    }

    @Test
    fun `end generation invalidates a pending connection attempt`() {
        assertTrue(isConnectionAttemptCurrent(4, 4, ownsAttempt = true, ownsClient = true))
        assertFalse(isConnectionAttemptCurrent(5, 4, ownsAttempt = true, ownsClient = true))
        assertFalse(isConnectionAttemptCurrent(4, 4, ownsAttempt = false, ownsClient = true))
        assertFalse(isConnectionAttemptCurrent(4, 4, ownsAttempt = true, ownsClient = false))
    }

    @Test
    fun `failed rebuild closes the previous non-ready client`() {
        val previousClient = Any()

        assertSame(
            previousClient,
            connectionClientToClose(
                ownsAttempt = true,
                connected = false,
                currentClient = previousClient,
                expectedClient = null,
                expectedClientIsStale = false,
            )
        )
    }

    @Test
    fun `pending purchase matching rejects old and unrelated updates`() {
        val requestedSkus = setOf("monthly")

        assertFalse(isPurchaseForPendingRequest(999.0, listOf("monthly"), requestedSkus, 1_000.0))
        assertFalse(isPurchaseForPendingRequest(1_001.0, listOf("yearly"), requestedSkus, 1_000.0))
        assertTrue(isPurchaseForPendingRequest(1_001.0, listOf("monthly"), requestedSkus, 1_000.0))
    }

    @Test
    fun `user choice billing waits for one event and removes its listener`() = runTest {
        var registered: OpenIapUserChoiceBillingListener? = null
        var removed: OpenIapUserChoiceBillingListener? = null
        val expected = UserChoiceBillingDetails(
            externalTransactionToken = "choice-token",
            productDetailsAndroid = emptyList(),
            products = listOf("monthly"),
        )

        val result = async(start = CoroutineStart.UNDISPATCHED) {
            onUserChoiceBilling(
                addListener = { registered = it },
                removeListener = { removed = it },
            )
        }
        val listener = checkNotNull(registered)

        listener.onUserChoiceBilling(expected)

        assertSame(expected, result.await())
        assertSame(listener, removed)
    }

    @Test
    fun `developer provided billing waits for one event and removes its listener`() = runTest {
        var registered: OpenIapDeveloperProvidedBillingListener? = null
        var removed: OpenIapDeveloperProvidedBillingListener? = null
        val expected = DeveloperProvidedBillingDetailsAndroid(
            externalTransactionToken = "developer-token",
            products = emptyList(),
        )

        val result = async(start = CoroutineStart.UNDISPATCHED) {
            onDeveloperProvidedBilling(
                addListener = { registered = it },
                removeListener = { removed = it },
            )
        }
        val listener = checkNotNull(registered)

        listener.onDeveloperProvidedBilling(expected)

        assertSame(expected, result.await())
        assertSame(listener, removed)
    }
}
