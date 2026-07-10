package io.github.hyochan.kmpiap

import com.android.billingclient.api.BillingClient
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductStatusAndroid
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.PurchaseError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withTimeout
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue

internal class TestUnfetchedProduct(
    private val productIdValue: String,
    private val productTypeValue: String,
    private val statusCodeValue: Int,
) {
    fun getProductId(): String = productIdValue

    fun getProductType(): String = productTypeValue

    fun getStatusCode(): Int = statusCodeValue
}

class ProductStatusAndroidTest {
    @Test
    fun `maps Billing 8 unfetched status codes`() {
        assertEquals(ProductStatusAndroid.NotFound, productStatusFromUnfetchedStatus(3))
        assertEquals(ProductStatusAndroid.NoOffersAvailable, productStatusFromUnfetchedStatus(4))
        assertEquals(ProductStatusAndroid.Unknown, productStatusFromUnfetchedStatus(2))
        assertEquals(ProductStatusAndroid.Unknown, productStatusFromUnfetchedStatus(0))
    }

    @Test
    fun `creates typed placeholders for unfetched products`() {
        val inApp = unavailableInAppProduct("missing.inapp", ProductStatusAndroid.NotFound)
        val subscription = unavailableSubscriptionProduct(
            "ineligible.subscription",
            ProductStatusAndroid.NoOffersAvailable,
        )

        assertEquals(ProductType.InApp, inApp.type)
        assertEquals(ProductStatusAndroid.NotFound, inApp.productStatusAndroid)
        assertEquals(ProductType.Subs, subscription.type)
        assertEquals(ProductStatusAndroid.NoOffersAvailable, subscription.productStatusAndroid)
        assertTrue(subscription.subscriptionOfferDetailsAndroid.isEmpty())
        assertTrue(subscription.subscriptionOffers.isEmpty())
    }

    @Test
    fun `keeps in-app and subscription cache entries for the same sku separate`() {
        val inAppKey = ProductCacheKey("shared.sku", BillingClient.ProductType.INAPP)
        val subscriptionKey = ProductCacheKey("shared.sku", BillingClient.ProductType.SUBS)
        val cache = mapOf(inAppKey to "in-app", subscriptionKey to "subscription")

        assertEquals(2, cache.size)
        assertEquals("in-app", cache[inAppKey])
        assertEquals("subscription", cache[subscriptionKey])
    }

    @Test
    fun `reads unfetched products with one reflected accessor lookup`() {
        val products = unfetchedProductInfoFrom(
            listOf(
                null,
                TestUnfetchedProduct("missing.inapp", "inapp", 3),
                Any(),
                TestUnfetchedProduct("ineligible.subscription", "subs", 4),
            )
        )

        assertEquals(
            listOf(
                UnfetchedProductInfo("missing.inapp", "inapp", 3),
                UnfetchedProductInfo("ineligible.subscription", "subs", 4),
            ),
            products,
        )
    }

    @Test
    fun `falls back when a Billing 8 string getter is unavailable`() {
        assertEquals("offer-token", billingStringOrEmpty { "offer-token" })
        assertEquals("", billingStringOrEmpty { null })
        assertEquals("", billingStringOrEmpty { throw NoSuchMethodError("Billing 8 API") })
    }

    @Test
    fun `single product query propagates failures`() = runTest {
        val failure = PurchaseException(
            PurchaseError(code = ErrorCode.ServiceError, message = "Service unavailable")
        )

        val thrown = assertFailsWith<PurchaseException> {
            collectProductQueryOutcomes(
                queryType = ProductQueryType.InApp,
                queryInApp = { throw failure },
                querySubscriptions = { error("Subscription query must not run") },
            )
        }

        assertSame(failure, thrown)
    }

    @Test
    fun `all query preserves a successful product kind`() = runTest {
        val outcomes = collectProductQueryOutcomes(
            queryType = ProductQueryType.All,
            queryInApp = { ProductQueryOutcome(emptyList(), emptyList(), true) },
            querySubscriptions = { throw IllegalStateException("Subscriptions unavailable") },
        )

        assertTrue(outcomes.inApp.succeeded)
        assertFalse(outcomes.subscriptions.succeeded)
    }

    @Test
    fun `all query rethrows its first failure when both product kinds fail`() = runTest {
        val firstFailure = IllegalStateException("In-app unavailable")

        val thrown = assertFailsWith<IllegalStateException> {
            collectProductQueryOutcomes(
                queryType = ProductQueryType.All,
                queryInApp = { throw firstFailure },
                querySubscriptions = { throw IllegalArgumentException("Subscriptions unavailable") },
            )
        }

        assertSame(firstFailure, thrown)
    }

    @Test
    fun `all query runs both product kinds concurrently`() = runTest {
        val inAppStarted = CompletableDeferred<Unit>()
        val subscriptionsStarted = CompletableDeferred<Unit>()

        val outcomes = withTimeout(1_000) {
            collectProductQueryOutcomes(
                queryType = ProductQueryType.All,
                queryInApp = {
                    inAppStarted.complete(Unit)
                    subscriptionsStarted.await()
                    ProductQueryOutcome(emptyList(), emptyList(), true)
                },
                querySubscriptions = {
                    subscriptionsStarted.complete(Unit)
                    inAppStarted.await()
                    ProductQueryOutcome(emptyList(), emptyList(), true)
                },
            )
        }

        assertTrue(outcomes.inApp.succeeded)
        assertTrue(outcomes.subscriptions.succeeded)
    }

    @Test
    fun `all query propagates cancellation and cancels its sibling`() = runTest {
        val cancellation = CancellationException("Cancelled")
        val subscriptionQueryStarted = CompletableDeferred<Unit>()
        var subscriptionQueryCancelled = false

        val thrown = assertFailsWith<CancellationException> {
            withTimeout(1_000) {
                collectProductQueryOutcomes(
                    queryType = ProductQueryType.All,
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
        }

        assertEquals(cancellation.message, thrown.message)
        assertTrue(subscriptionQueryCancelled)
    }
}
