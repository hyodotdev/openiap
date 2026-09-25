package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AmazonFreeTrialOfferTest {

    @Test
    fun `trial word becomes a free-trial offer described only by cross-platform fields`() {
        val offer = buildAmazonFreeTrialOffer("dev.hyo.martie.premium", "Weekly")

        assertEquals(PaymentMode.FreeTrial, offer?.paymentMode)
        assertEquals(DiscountOfferType.Introductory, offer?.type)
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Week, 1), offer?.period)
        assertEquals(1, offer?.periodCount)
        assertEquals(0.0, offer?.price)
        assertEquals("", offer?.id)
        assertEquals("", offer?.displayPrice)
        assertEquals("", offer?.currency)
        assertNull(offer?.basePlanIdAndroid)
        assertNull(offer?.offerTokenAndroid)
        assertNull(offer?.offerTagsAndroid)
        assertNull(offer?.pricingPhasesAndroid)
    }

    @Test
    fun `iso trial periods are accepted as-is`() {
        assertEquals(
            SubscriptionPeriod(SubscriptionPeriodUnit.Month, 1),
            buildAmazonFreeTrialOffer("sku", "P1M")?.period
        )
    }

    @Test
    fun `missing or unknown trial periods produce no offer`() {
        assertNull(buildAmazonFreeTrialOffer("sku", null))
        assertNull(buildAmazonFreeTrialOffer("sku", "   "))
        assertNull(buildAmazonFreeTrialOffer("sku", "Fortnightly"))
        assertNull(buildAmazonFreeTrialOffer("sku", "7 Days"))
    }

    @Test
    fun `amazon period words map to every documented duration`() {
        assertEquals("P1W", "Weekly".toIsoBillingPeriod())
        assertEquals("P2W", "BiWeekly".toIsoBillingPeriod())
        assertEquals("P1M", "Monthly".toIsoBillingPeriod())
        assertEquals("P2M", "BiMonthly".toIsoBillingPeriod())
        assertEquals("P3M", "Quarterly".toIsoBillingPeriod())
        assertEquals("P6M", "SemiAnnual".toIsoBillingPeriod())
        assertEquals("P1Y", "Annual".toIsoBillingPeriod())
        assertEquals("P1Y", " annual ".toIsoBillingPeriod())
        assertEquals("", null.toIsoBillingPeriod())
        assertEquals("", "".toIsoBillingPeriod())
        assertEquals("P1Y", "P1Y".toIsoBillingPeriod())
        assertEquals("7 Days", "7 Days".toIsoBillingPeriod())
    }

    @Test
    fun `original spelling variants still map`() {
        assertEquals("P1W", "1 week".toIsoBillingPeriod())
        assertEquals("P2W", "Bi-Weekly".toIsoBillingPeriod())
        assertEquals("P6M", "SemiAnnually".toIsoBillingPeriod())
        assertEquals("P1Y", "Yearly".toIsoBillingPeriod())
        assertEquals("P1Y", "Annually".toIsoBillingPeriod())
    }

    @Test
    fun `iso billing periods parse into subscription periods`() {
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Day, 7), "P7D".toSubscriptionPeriod())
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Week, 2), "P2W".toSubscriptionPeriod())
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Month, 6), "P6M".toSubscriptionPeriod())
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Year, 1), "P1Y".toSubscriptionPeriod())
        assertNull("".toSubscriptionPeriod())
        assertNull("Monthly".toSubscriptionPeriod())
        assertNull("P1X".toSubscriptionPeriod())
    }
}
