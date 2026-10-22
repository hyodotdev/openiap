package dev.hyo.openiap.helpers

import dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.PendingPurchaseUpdateAndroid
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
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
    fun `only a requested sku with a token unseen at launch belongs to the request`() {
        val requestedSkus = setOf("monthly")
        val tokensBeforeLaunch = setOf("stale-token")

        assertTrue(isPurchaseForPendingRequest(listOf("monthly"), "new-token", requestedSkus, tokensBeforeLaunch))
        assertFalse(isPurchaseForPendingRequest(listOf("monthly"), "stale-token", requestedSkus, tokensBeforeLaunch))
        assertFalse(isPurchaseForPendingRequest(listOf("yearly"), "new-token", requestedSkus, tokensBeforeLaunch))
        assertFalse(isPurchaseForPendingRequest(listOf("monthly"), null, requestedSkus, tokensBeforeLaunch))
    }

    @Test
    fun `a pending update answers a request only when its own token is new`() {
        val requestedSkus = setOf("monthly")
        val tokensBeforeLaunch = setOf("current-token", "stale-update")

        assertEquals(
            PendingRequestMatch.Purchase,
            matchPendingRequest(listOf("monthly"), "new-token", null, null, requestedSkus, tokensBeforeLaunch),
        )
        assertEquals(
            PendingRequestMatch.PendingUpdate,
            matchPendingRequest(listOf("basic"), "current-token", listOf("monthly"), "update-token", requestedSkus, tokensBeforeLaunch),
        )
        assertEquals(
            PendingRequestMatch.None,
            matchPendingRequest(listOf("basic"), "current-token", listOf("monthly"), "stale-update", requestedSkus, tokensBeforeLaunch),
        )
        assertEquals(
            PendingRequestMatch.None,
            matchPendingRequest(listOf("monthly"), "current-token", null, null, requestedSkus, tokensBeforeLaunch),
        )
    }

    @Test
    fun `each purchase state is delivered once within the claim window`() {
        val claims = PurchaseDeliveryClaims(maximumSize = 2)
        val pending = purchase("token-1", PurchaseState.Pending)

        assertTrue(claims.claim(pending))
        assertFalse(claims.claim(pending))
        assertTrue("a pending purchase that completes is new", claims.claim(purchase("token-1", PurchaseState.Purchased)))
        assertTrue(claims.claim(purchase("token-2", PurchaseState.Purchased)))
        assertTrue("the oldest claim is evicted", claims.claim(pending))
    }

    @Test
    fun `a purchase claimed in one state has been delivered in every state`() {
        val claims = PurchaseDeliveryClaims()
        assertFalse(claims.hasDelivered(purchase("token-1", PurchaseState.Pending)))

        claims.claim(purchase("token-1", PurchaseState.Pending))

        assertTrue(claims.hasDelivered(purchase("token-1", PurchaseState.Purchased)))
        assertFalse(claims.hasDelivered(purchase("token-2", PurchaseState.Pending)))
        assertTrue("reading must not claim", claims.claim(purchase("token-1", PurchaseState.Purchased)))
    }

    @Test
    fun `a new pending update on a delivered purchase is delivered`() {
        val claims = PurchaseDeliveryClaims()
        val stale = purchase("token-1", PurchaseState.Purchased, pendingUpdateToken = "update-1")

        assertTrue(claims.claim(stale))
        assertFalse(claims.claim(stale))
        assertTrue(
            claims.claim(purchase("token-1", PurchaseState.Purchased, pendingUpdateToken = "update-2")),
        )
    }

    private fun purchase(
        token: String,
        state: PurchaseState,
        pendingUpdateToken: String? = null,
    ) = PurchaseAndroid(
        id = token,
        isAutoRenewing = false,
        pendingPurchaseUpdateAndroid = pendingUpdateToken?.let {
            PendingPurchaseUpdateAndroid(products = listOf("yearly"), purchaseToken = it)
        },
        productId = "monthly",
        purchaseState = state,
        purchaseToken = token,
        quantity = 1,
        store = IapStore.Google,
        storeId = "play",
        transactionDate = 1.0,
    )

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
