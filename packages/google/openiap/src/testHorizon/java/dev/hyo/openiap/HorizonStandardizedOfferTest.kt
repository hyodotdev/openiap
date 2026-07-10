package dev.hyo.openiap

import dev.hyo.openiap.utils.toHorizonSubscriptionOffer
import org.junit.Assert.assertEquals
import org.junit.Test

class HorizonStandardizedOfferTest {
    @Test
    fun `legacy offer maps to standardized metadata`() {
        val legacy = ProductSubscriptionAndroidOfferDetails(
            basePlanId = "annual",
            offerId = "intro",
            offerTags = listOf("eligible"),
            offerToken = "token",
            pricingPhases = PricingPhasesAndroid(
                listOf(
                    PricingPhaseAndroid(
                        billingCycleCount = 3,
                        billingPeriod = "P1M",
                        formattedPrice = "\$1.99",
                        priceAmountMicros = "1990000",
                        priceCurrencyCode = "USD",
                        recurrenceMode = 2,
                    )
                )
            ),
        )

        val offer = legacy.toHorizonSubscriptionOffer()

        assertEquals("intro", offer.id)
        assertEquals(DiscountOfferType.Promotional, offer.type)
        assertEquals(PaymentMode.PayAsYouGo, offer.paymentMode)
        assertEquals(SubscriptionPeriodUnit.Month, offer.period?.unit)
        assertEquals(1, offer.period?.value)
        assertEquals(3, offer.periodCount)
        assertEquals("token", offer.offerTokenAndroid)
        assertEquals(1.99, offer.price, 0.0001)
    }
}
