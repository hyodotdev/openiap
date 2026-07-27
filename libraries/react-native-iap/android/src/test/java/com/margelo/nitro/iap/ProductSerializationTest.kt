package com.margelo.nitro.iap

import dev.hyo.openiap.DiscountOffer
import dev.hyo.openiap.DiscountOfferType
import dev.hyo.openiap.InstallmentPlanDetailsAndroid
import dev.hyo.openiap.PaymentMode
import dev.hyo.openiap.PreorderDetailsAndroid
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.RentalDetailsAndroid
import dev.hyo.openiap.SubscriptionOffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class ProductSerializationTest {
    @Test
    fun `standardized subscription offer keeps Android metadata`() {
        val maps = subscriptionOfferMaps(
            listOf(
                SubscriptionOffer(
                    basePlanIdAndroid = "annual",
                    currency = "USD",
                    displayPrice = "\$9.99",
                    id = "commitment",
                    installmentPlanDetailsAndroid = InstallmentPlanDetailsAndroid(12, 0),
                    offerTagsAndroid = listOf("commitment"),
                    offerTokenAndroid = "token",
                    paymentMode = PaymentMode.PayAsYouGo,
                    price = 9.99,
                    type = DiscountOfferType.Promotional,
                )
            )
        )

        val map = maps.single()
        assertEquals("promotional", map["type"])
        assertNotNull(map["installmentPlanDetailsAndroid"])
    }

    @Test
    fun `standardized discount offer keeps every public Android field`() {
        val maps = discountOfferMaps(
            listOf(
                DiscountOffer(
                    currency = "USD",
                    displayPrice = "\$4.99",
                    id = "half-off",
                    percentageDiscountAndroid = 50,
                    preorderDetailsAndroid = PreorderDetailsAndroid(
                        preorderPresaleEndTimeMillis = "1000",
                        preorderReleaseTimeMillis = "2000",
                    ),
                    price = 4.99,
                    purchaseOptionIdAndroid = "purchase-option",
                    rentalDetailsAndroid = RentalDetailsAndroid(
                        rentalExpirationPeriod = "P1D",
                        rentalPeriod = "P7D",
                    ),
                    type = DiscountOfferType.OneTime,
                )
            )
        )

        val map = maps.single()
        assertEquals("one-time", map["type"])
        assertEquals(50, map["percentageDiscountAndroid"])
        assertEquals("purchase-option", map["purchaseOptionIdAndroid"])
        assertNotNull(map["preorderDetailsAndroid"])
        assertNotNull(map["rentalDetailsAndroid"])
    }

    @Test
    fun `native product metadata reaches Nitro bridge models`() {
        val product = ProductAndroid(
            currency = "USD",
            debugDescription = "native debug metadata",
            description = "Premium access",
            discountOffers = emptyList(),
            displayPrice = "\$4.99",
            id = "premium",
            nameAndroid = "Premium",
            title = "Premium",
        )

        assertEquals("native debug metadata", product.nitroDebugDescription()?.asSecondOrNull())
    }
}
