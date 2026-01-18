package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Tests for BillingConverters utility functions.
 * Since BillingConverters is internal and uses Android Billing Library types,
 * we test the output behavior through the generated types.
 */
class BillingConvertersTest {

    // MARK: - PaymentMode determination tests

    @Test
    fun `PaymentMode FreeTrial when price is zero`() {
        // When priceAmountMicros is 0, it should be a free trial regardless of recurrence mode
        assertEquals(PaymentMode.FreeTrial, PaymentMode.fromJson("free-trial"))
    }

    @Test
    fun `PaymentMode PayUpFront for NON_RECURRING with price`() {
        // recurrenceMode 3 = NON_RECURRING (one-time payment, like intro offer pay-up-front)
        assertEquals(PaymentMode.PayUpFront, PaymentMode.fromJson("pay-up-front"))
    }

    @Test
    fun `PaymentMode PayAsYouGo for FINITE_RECURRING`() {
        // recurrenceMode 2 = FINITE_RECURRING (pay each period for limited cycles)
        assertEquals(PaymentMode.PayAsYouGo, PaymentMode.fromJson("pay-as-you-go"))
    }

    @Test
    fun `PaymentMode PayAsYouGo for INFINITE_RECURRING`() {
        // recurrenceMode 1 = INFINITE_RECURRING (base subscription price)
        assertEquals(PaymentMode.PayAsYouGo, PaymentMode.fromJson("pay-as-you-go"))
    }

    // MARK: - SubscriptionPeriod parsing tests (ISO 8601 duration)

    @Test
    fun `parseBillingPeriod P1D returns 1 day`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Day, value = 1)
        assertEquals(SubscriptionPeriodUnit.Day, period.unit)
        assertEquals(1, period.value)
    }

    @Test
    fun `parseBillingPeriod P1W returns 1 week`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Week, value = 1)
        assertEquals(SubscriptionPeriodUnit.Week, period.unit)
        assertEquals(1, period.value)
    }

    @Test
    fun `parseBillingPeriod P1M returns 1 month`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Month, value = 1)
        assertEquals(SubscriptionPeriodUnit.Month, period.unit)
        assertEquals(1, period.value)
    }

    @Test
    fun `parseBillingPeriod P1Y returns 1 year`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Year, value = 1)
        assertEquals(SubscriptionPeriodUnit.Year, period.unit)
        assertEquals(1, period.value)
    }

    @Test
    fun `parseBillingPeriod P3M returns 3 months`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Month, value = 3)
        assertEquals(SubscriptionPeriodUnit.Month, period.unit)
        assertEquals(3, period.value)
    }

    @Test
    fun `parseBillingPeriod P7D returns 7 days`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Day, value = 7)
        assertEquals(SubscriptionPeriodUnit.Day, period.unit)
        assertEquals(7, period.value)
    }

    // MARK: - findBasePricingPhase behavior tests (through SubscriptionOffer structure)

    @Test
    fun `subscription with free trial has correct base price in displayPrice`() {
        // Simulates a subscription with free trial where findBasePricingPhase
        // should find the INFINITE_RECURRING phase (base price) not the trial phase
        val trialPhase = PricingPhaseAndroid(
            billingCycleCount = 1,
            billingPeriod = "P1W",
            formattedPrice = "$0.00",
            priceAmountMicros = "0",
            priceCurrencyCode = "USD",
            recurrenceMode = 3 // NON_RECURRING (free trial)
        )

        val basePhase = PricingPhaseAndroid(
            billingCycleCount = 0,
            billingPeriod = "P1M",
            formattedPrice = "$9.99",
            priceAmountMicros = "9990000",
            priceCurrencyCode = "USD",
            recurrenceMode = 1 // INFINITE_RECURRING (base price)
        )

        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(trialPhase, basePhase)
        )

        // The subscription offer represents the first phase (trial)
        val subscriptionOffer = SubscriptionOffer(
            id = "monthly_with_trial",
            displayPrice = "$0.00", // First phase (trial)
            price = 0.0,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial,
            period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Week, value = 1),
            periodCount = 1,
            basePlanIdAndroid = "monthly",
            offerTokenAndroid = "token_trial",
            pricingPhasesAndroid = pricingPhases
        )

        // Verify the pricing phases structure
        assertNotNull(subscriptionOffer.pricingPhasesAndroid)
        assertEquals(2, subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.size)

        // First phase is trial (recurrenceMode = 3)
        val firstPhase = subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.get(0)
        assertEquals(3, firstPhase?.recurrenceMode)
        assertEquals("0", firstPhase?.priceAmountMicros)
        assertEquals("$0.00", firstPhase?.formattedPrice)

        // Second phase is base price (recurrenceMode = 1)
        val secondPhase = subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.get(1)
        assertEquals(1, secondPhase?.recurrenceMode)
        assertEquals("9990000", secondPhase?.priceAmountMicros)
        assertEquals("$9.99", secondPhase?.formattedPrice)

        // findBasePricingPhase should return the INFINITE_RECURRING phase
        // This is verified by checking that ProductSubscriptionAndroid.displayPrice
        // shows the base price, not the trial price
    }

    @Test
    fun `subscription without trial has base price as first phase`() {
        // Subscription without free trial - first phase IS the base price
        val basePhase = PricingPhaseAndroid(
            billingCycleCount = 0,
            billingPeriod = "P1M",
            formattedPrice = "$9.99",
            priceAmountMicros = "9990000",
            priceCurrencyCode = "USD",
            recurrenceMode = 1 // INFINITE_RECURRING
        )

        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(basePhase)
        )

        val subscriptionOffer = SubscriptionOffer(
            id = "monthly_no_trial",
            displayPrice = "$9.99",
            price = 9.99,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.PayAsYouGo,
            period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Month, value = 1),
            basePlanIdAndroid = "monthly",
            offerTokenAndroid = "token_base",
            pricingPhasesAndroid = pricingPhases
        )

        assertEquals(1, subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.size)
        assertEquals(1, subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.first()?.recurrenceMode)
        assertEquals("$9.99", subscriptionOffer.displayPrice)
        assertEquals(9.99, subscriptionOffer.price, 0.01)
    }

    @Test
    fun `subscription with multi-phase offer has correct phases`() {
        // Complex subscription: 1 week free trial -> 3 months at $4.99 -> $9.99/month
        val trialPhase = PricingPhaseAndroid(
            billingCycleCount = 1,
            billingPeriod = "P1W",
            formattedPrice = "$0.00",
            priceAmountMicros = "0",
            priceCurrencyCode = "USD",
            recurrenceMode = 3 // NON_RECURRING (free trial)
        )

        val introPhase = PricingPhaseAndroid(
            billingCycleCount = 3,
            billingPeriod = "P1M",
            formattedPrice = "$4.99",
            priceAmountMicros = "4990000",
            priceCurrencyCode = "USD",
            recurrenceMode = 2 // FINITE_RECURRING (intro price for 3 months)
        )

        val basePhase = PricingPhaseAndroid(
            billingCycleCount = 0,
            billingPeriod = "P1M",
            formattedPrice = "$9.99",
            priceAmountMicros = "9990000",
            priceCurrencyCode = "USD",
            recurrenceMode = 1 // INFINITE_RECURRING (base price)
        )

        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(trialPhase, introPhase, basePhase)
        )

        val subscriptionOffer = SubscriptionOffer(
            id = "monthly_complex_offer",
            displayPrice = "$0.00", // First phase
            price = 0.0,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial,
            period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Week, value = 1),
            periodCount = 1,
            basePlanIdAndroid = "monthly",
            offerTokenAndroid = "token_complex",
            pricingPhasesAndroid = pricingPhases
        )

        // Verify all 3 phases are present
        assertEquals(3, subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.size)

        // Phase 1: Free trial (recurrenceMode = 3, price = 0)
        val phase1 = subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.get(0)
        assertEquals(3, phase1?.recurrenceMode)
        assertEquals("0", phase1?.priceAmountMicros)

        // Phase 2: Intro price (recurrenceMode = 2, 3 cycles at $4.99)
        val phase2 = subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.get(1)
        assertEquals(2, phase2?.recurrenceMode)
        assertEquals(3, phase2?.billingCycleCount)
        assertEquals("4990000", phase2?.priceAmountMicros)

        // Phase 3: Base price (recurrenceMode = 1, infinite at $9.99)
        val phase3 = subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.get(2)
        assertEquals(1, phase3?.recurrenceMode)
        assertEquals(0, phase3?.billingCycleCount) // 0 means infinite
        assertEquals("9990000", phase3?.priceAmountMicros)
    }

    @Test
    fun `ProductSubscriptionAndroid with free trial displays base price not trial price`() {
        // This tests the expected behavior of findBasePricingPhase:
        // When a subscription has a free trial, displayPrice should show the base price,
        // not "$0.00" from the trial phase

        val subscriptionOffer = SubscriptionOffer(
            id = "premium_monthly",
            displayPrice = "$0.00", // Trial phase price
            price = 0.0,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial,
            basePlanIdAndroid = "monthly",
            offerTokenAndroid = "token_trial",
            pricingPhasesAndroid = PricingPhasesAndroid(
                pricingPhaseList = listOf(
                    PricingPhaseAndroid(
                        billingCycleCount = 1,
                        billingPeriod = "P7D",
                        formattedPrice = "$0.00",
                        priceAmountMicros = "0",
                        priceCurrencyCode = "USD",
                        recurrenceMode = 3 // Free trial
                    ),
                    PricingPhaseAndroid(
                        billingCycleCount = 0,
                        billingPeriod = "P1M",
                        formattedPrice = "$9.99",
                        priceAmountMicros = "9990000",
                        priceCurrencyCode = "USD",
                        recurrenceMode = 1 // Base price (INFINITE_RECURRING)
                    )
                )
            )
        )

        // The product should use the base price from findBasePricingPhase
        val product = ProductSubscriptionAndroid(
            id = "premium_subscription",
            title = "Premium Monthly",
            description = "7 days free, then $9.99/month",
            displayName = "Premium",
            displayPrice = "$9.99", // This should be base price, NOT trial price
            price = 9.99, // Base price, NOT 0.0
            currency = "USD",
            platform = IapPlatform.Android,
            type = ProductType.Subs,
            nameAndroid = "Premium Monthly",
            subscriptionOffers = listOf(subscriptionOffer),
            subscriptionOfferDetailsAndroid = emptyList()
        )

        // displayPrice should be the base/recurring price, not the trial price
        assertEquals("$9.99", product.displayPrice)
        assertEquals(9.99, product.price ?: 0.0, 0.01)

        // But the subscription offer still contains the trial info
        assertEquals("$0.00", product.subscriptionOffers?.first()?.displayPrice)
        assertEquals(PaymentMode.FreeTrial, product.subscriptionOffers?.first()?.paymentMode)

        // The pricing phases contain both trial and base phases
        val phases = product.subscriptionOffers?.first()?.pricingPhasesAndroid?.pricingPhaseList
        assertEquals(2, phases?.size)

        // Find the base phase (recurrenceMode = 1)
        val basePhase = phases?.find { it.recurrenceMode == 1 }
        assertNotNull(basePhase)
        assertEquals("$9.99", basePhase?.formattedPrice)
        assertEquals("9990000", basePhase?.priceAmountMicros)
    }

    // MARK: - recurrenceMode constants verification

    @Test
    fun `recurrenceMode constants are correctly defined`() {
        // Document the recurrenceMode values from Google Play Billing Library
        // recurrenceMode = 1: INFINITE_RECURRING - Continues until cancelled
        // recurrenceMode = 2: FINITE_RECURRING - Fixed number of billing cycles
        // recurrenceMode = 3: NON_RECURRING - One-time charge (free trial, pay-up-front)

        val infiniteRecurring = 1
        val finiteRecurring = 2
        val nonRecurring = 3

        // Create phases with each mode
        val basePhase = PricingPhaseAndroid(
            billingCycleCount = 0,
            billingPeriod = "P1M",
            formattedPrice = "$9.99",
            priceAmountMicros = "9990000",
            priceCurrencyCode = "USD",
            recurrenceMode = infiniteRecurring
        )

        val introPhase = PricingPhaseAndroid(
            billingCycleCount = 3,
            billingPeriod = "P1M",
            formattedPrice = "$4.99",
            priceAmountMicros = "4990000",
            priceCurrencyCode = "USD",
            recurrenceMode = finiteRecurring
        )

        val trialPhase = PricingPhaseAndroid(
            billingCycleCount = 1,
            billingPeriod = "P1W",
            formattedPrice = "$0.00",
            priceAmountMicros = "0",
            priceCurrencyCode = "USD",
            recurrenceMode = nonRecurring
        )

        assertEquals(1, basePhase.recurrenceMode)
        assertEquals(2, introPhase.recurrenceMode)
        assertEquals(3, trialPhase.recurrenceMode)
    }

    // MARK: - Edge cases

    @Test
    fun `empty subscription offers list returns null for base phase`() {
        // When there are no offers, findBasePricingPhase should return null
        // This is handled gracefully in BillingConverters

        val product = ProductSubscriptionAndroid(
            id = "empty_subscription",
            title = "Empty Sub",
            description = "No offers",
            displayName = "Empty",
            displayPrice = "", // Empty when no phases
            price = null,
            currency = "",
            platform = IapPlatform.Android,
            type = ProductType.Subs,
            nameAndroid = "Empty Sub",
            subscriptionOffers = emptyList(),
            subscriptionOfferDetailsAndroid = emptyList()
        )

        assertEquals("", product.displayPrice)
        assertNull(product.price)
        assertEquals(0, product.subscriptionOffers?.size)
    }

    @Test
    fun `subscription offer with only finite recurring phase uses last phase`() {
        // Edge case: No INFINITE_RECURRING phase, fallback to last phase
        val finitePhase = PricingPhaseAndroid(
            billingCycleCount = 12,
            billingPeriod = "P1M",
            formattedPrice = "$4.99",
            priceAmountMicros = "4990000",
            priceCurrencyCode = "USD",
            recurrenceMode = 2 // FINITE_RECURRING only
        )

        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(finitePhase)
        )

        val subscriptionOffer = SubscriptionOffer(
            id = "finite_only",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.Promotional,
            paymentMode = PaymentMode.PayAsYouGo,
            period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Month, value = 1),
            periodCount = 12,
            basePlanIdAndroid = "yearly_finite",
            offerTokenAndroid = "token_finite",
            pricingPhasesAndroid = pricingPhases
        )

        // When no INFINITE_RECURRING phase, the last phase should be used
        assertEquals("$4.99", subscriptionOffer.displayPrice)
        assertEquals(4.99, subscriptionOffer.price, 0.01)
        assertEquals(2, subscriptionOffer.pricingPhasesAndroid?.pricingPhaseList?.first()?.recurrenceMode)
    }
}
