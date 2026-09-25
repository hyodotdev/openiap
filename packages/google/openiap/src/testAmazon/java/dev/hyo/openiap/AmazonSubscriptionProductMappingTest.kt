package dev.hyo.openiap

import java.util.Locale
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AmazonSubscriptionProductMappingTest {
    private lateinit var defaultLocale: Locale

    @Before
    fun setUp() {
        defaultLocale = Locale.getDefault()
        Locale.setDefault(Locale.US)
    }

    @After
    fun tearDown() {
        Locale.setDefault(defaultLocale)
    }

    @Test
    fun `base offer comes first and carries the subscription period`() {
        val product = buildAmazonSubscriptionProduct(
            sku = "dev.hyo.martie.premium",
            title = "Premium",
            description = "All features",
            price = "\$9.99",
            subscriptionPeriod = "Monthly",
            freeTrialPeriod = "Weekly"
        )

        assertEquals(2, product.subscriptionOffers.size)
        val base = product.subscriptionOffers[0]
        assertEquals("dev.hyo.martie.premium", base.id)
        assertEquals(PaymentMode.PayAsYouGo, base.paymentMode)
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Month, 1), base.period)
        assertEquals("P1M", base.pricingPhasesAndroid?.pricingPhaseList?.single()?.billingPeriod)
        assertEquals("\$9.99", base.displayPrice)
        assertEquals(9.99, base.price, 0.0001)

        val trial = product.subscriptionOffers[1]
        assertEquals(PaymentMode.FreeTrial, trial.paymentMode)
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Week, 1), trial.period)

        assertEquals("Premium", product.title)
        assertEquals(9.99, product.price ?: 0.0, 0.0001)
        assertEquals(ProductType.Subs, product.type)
    }

    @Test
    fun `no trial period yields the base offer only`() {
        val product = buildAmazonSubscriptionProduct(
            sku = "sku",
            title = null,
            description = null,
            price = "\$9.99",
            subscriptionPeriod = "Annual",
            freeTrialPeriod = null
        )

        assertEquals(1, product.subscriptionOffers.size)
        assertEquals(SubscriptionPeriod(SubscriptionPeriodUnit.Year, 1), product.subscriptionOffers[0].period)
        assertEquals("", product.title)
    }

    @Test
    fun `unknown subscription period passes through without a parsed period`() {
        val product = buildAmazonSubscriptionProduct(
            sku = "sku",
            title = "Premium",
            description = "",
            price = "\$9.99",
            subscriptionPeriod = "Fortnightly",
            freeTrialPeriod = null
        )

        val base = product.subscriptionOffers.single()
        assertNull(base.period)
        assertEquals("Fortnightly", base.pricingPhasesAndroid?.pricingPhaseList?.single()?.billingPeriod)
    }
}
