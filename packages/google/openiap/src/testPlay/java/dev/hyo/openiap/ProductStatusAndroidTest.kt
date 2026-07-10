package dev.hyo.openiap

import com.android.billingclient.api.UnfetchedProduct
import dev.hyo.openiap.utils.BillingConverters.productStatusFromUnfetchedStatus
import dev.hyo.openiap.utils.BillingConverters.unavailableInAppProduct
import dev.hyo.openiap.utils.BillingConverters.unavailableSubscriptionProduct
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
        assertTrue(subscription.subscriptionOfferDetailsAndroid.isEmpty())
    }
}
