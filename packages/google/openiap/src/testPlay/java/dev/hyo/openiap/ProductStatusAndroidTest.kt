package dev.hyo.openiap

import com.android.billingclient.api.UnfetchedProduct
import dev.hyo.openiap.utils.BillingConverters.productStatusFromUnfetchedStatus
import dev.hyo.openiap.utils.BillingConverters.unavailableInAppProduct
import dev.hyo.openiap.utils.BillingConverters.unavailableSubscriptionProduct
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class ProductStatusAndroidTest {
    @Test
    fun `maps Billing 8 unfetched status codes`() {
        assertEquals(
            ProductStatusAndroid.NotFound,
            productStatusFromUnfetchedStatus(UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND),
        )
        assertEquals(
            ProductStatusAndroid.NoOffersAvailable,
            productStatusFromUnfetchedStatus(UnfetchedProduct.StatusCode.NO_ELIGIBLE_OFFER),
        )
        assertEquals(
            ProductStatusAndroid.Unknown,
            productStatusFromUnfetchedStatus(UnfetchedProduct.StatusCode.INVALID_PRODUCT_ID_FORMAT),
        )
        assertEquals(
            ProductStatusAndroid.Unknown,
            productStatusFromUnfetchedStatus(UnfetchedProduct.StatusCode.UNKNOWN),
        )
    }

    @Test
    fun `creates typed placeholders for unfetched products`() {
        val inApp = unavailableInAppProduct("missing.inapp", ProductStatusAndroid.NotFound)
        val subscription = unavailableSubscriptionProduct(
            "ineligible.subscription",
            ProductStatusAndroid.NoOffersAvailable,
        )

        assertEquals("missing.inapp", inApp.id)
        assertEquals(ProductType.InApp, inApp.type)
        assertEquals(ProductStatusAndroid.NotFound, inApp.productStatusAndroid)
        assertEquals("ineligible.subscription", subscription.id)
        assertEquals(ProductType.Subs, subscription.type)
        assertEquals(ProductStatusAndroid.NoOffersAvailable, subscription.productStatusAndroid)
        assertTrue(subscription.subscriptionOffers.isEmpty())
        assertTrue(subscription.subscriptionOffers.isEmpty())
    }

    @Test
    fun `records only the first recoverable all-query failure`() {
        val first = IllegalStateException("In-app query failed")
        val second = IllegalArgumentException("Subscription query failed")

        assertSame(first, recordRecoverableProductQueryFailure(null, first))
        assertSame(first, recordRecoverableProductQueryFailure(first, second))
    }

    @Test
    fun `all query runs both product kinds concurrently and preserves partial success`() = runTest {
        val inAppStarted = CompletableDeferred<Unit>()
        val subscriptionsStarted = CompletableDeferred<Unit>()

        val results = withTimeout(1_000) {
            collectAllProductQueryResults(
                queryInApp = {
                    inAppStarted.complete(Unit)
                    subscriptionsStarted.await()
                    "in-app"
                },
                querySubscriptions = {
                    subscriptionsStarted.complete(Unit)
                    inAppStarted.await()
                    throw IllegalStateException("Subscriptions unavailable")
                },
            )
        }

        assertEquals("in-app", results.inApp)
        assertEquals(null, results.subscriptions)
    }

    @Test
    fun `all query propagates cancellation and cancels its sibling`() = runTest {
        val cancellation = CancellationException("Cancelled")
        val subscriptionQueryStarted = CompletableDeferred<Unit>()
        var subscriptionQueryCancelled = false

        val thrown = try {
            withTimeout(1_000) {
                collectAllProductQueryResults(
                    queryInApp = {
                        subscriptionQueryStarted.await()
                        throw cancellation
                    },
                    querySubscriptions = {
                        subscriptionQueryStarted.complete(Unit)
                        try {
                            awaitCancellation()
                        } finally {
                            subscriptionQueryCancelled = true
                        }
                    },
                )
            }
            throw AssertionError("Expected CancellationException")
        } catch (error: CancellationException) {
            error
        }

        assertEquals(cancellation.message, thrown.message)
        assertTrue(subscriptionQueryCancelled)
    }

    @Test
    fun `rethrows cancellation and fatal errors from all queries`() {
        val cancellation = CancellationException("Cancelled")
        val fatal = AssertionError("Fatal")

        assertRethrown(cancellation)
        assertRethrown(fatal)
    }

    private fun assertRethrown(expected: Throwable) {
        try {
            recordRecoverableProductQueryFailure(null, expected)
            fail("Expected ${expected::class.simpleName} to be rethrown")
        } catch (actual: Throwable) {
            assertSame(expected, actual)
        }
    }
}
