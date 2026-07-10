package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ProductStatusAndroid
import io.github.hyochan.kmpiap.openiap.ProductType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

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
}
