package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ProductStatusAndroid
import io.github.hyochan.kmpiap.openiap.ProductType
import kotlin.test.Test
import kotlin.test.assertEquals
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
}
