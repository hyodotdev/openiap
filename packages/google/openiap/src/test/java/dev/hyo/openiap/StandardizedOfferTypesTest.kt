package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StandardizedOfferTypesTest {

    // MARK: - DiscountOfferType Tests

    @Test
    fun `DiscountOfferType has correct raw values`() {
        assertEquals("introductory", DiscountOfferType.Introductory.rawValue)
        assertEquals("promotional", DiscountOfferType.Promotional.rawValue)
        assertEquals("one-time", DiscountOfferType.OneTime.rawValue)
    }

    @Test
    fun `DiscountOfferType fromJson handles supported formats`() {
        // Kebab-case (standard)
        assertEquals(DiscountOfferType.Introductory, DiscountOfferType.fromJson("introductory"))
        assertEquals(DiscountOfferType.Promotional, DiscountOfferType.fromJson("promotional"))
        assertEquals(DiscountOfferType.OneTime, DiscountOfferType.fromJson("one-time"))

        // PascalCase
        assertEquals(DiscountOfferType.Introductory, DiscountOfferType.fromJson("Introductory"))
        assertEquals(DiscountOfferType.Promotional, DiscountOfferType.fromJson("Promotional"))
        assertEquals(DiscountOfferType.OneTime, DiscountOfferType.fromJson("OneTime"))
    }

    @Test
    fun `DiscountOfferType toJson returns correct value`() {
        assertEquals("introductory", DiscountOfferType.Introductory.toJson())
        assertEquals("promotional", DiscountOfferType.Promotional.toJson())
        assertEquals("one-time", DiscountOfferType.OneTime.toJson())
    }

    // MARK: - PaymentMode Tests

    @Test
    fun `PaymentMode has correct raw values`() {
        assertEquals("free-trial", PaymentMode.FreeTrial.rawValue)
        assertEquals("pay-as-you-go", PaymentMode.PayAsYouGo.rawValue)
        assertEquals("pay-up-front", PaymentMode.PayUpFront.rawValue)
        assertEquals("unknown", PaymentMode.Unknown.rawValue)
    }

    @Test
    fun `PaymentMode fromJson handles supported formats`() {
        // Kebab-case (standard)
        assertEquals(PaymentMode.FreeTrial, PaymentMode.fromJson("free-trial"))
        assertEquals(PaymentMode.PayAsYouGo, PaymentMode.fromJson("pay-as-you-go"))
        assertEquals(PaymentMode.PayUpFront, PaymentMode.fromJson("pay-up-front"))
        assertEquals(PaymentMode.Unknown, PaymentMode.fromJson("unknown"))

        // PascalCase
        assertEquals(PaymentMode.FreeTrial, PaymentMode.fromJson("FreeTrial"))
        assertEquals(PaymentMode.PayAsYouGo, PaymentMode.fromJson("PayAsYouGo"))
        assertEquals(PaymentMode.PayUpFront, PaymentMode.fromJson("PayUpFront"))
        assertEquals(PaymentMode.Unknown, PaymentMode.fromJson("Unknown"))
    }

    // MARK: - SubscriptionPeriodUnit Tests

    @Test
    fun `SubscriptionPeriodUnit has correct raw values`() {
        assertEquals("day", SubscriptionPeriodUnit.Day.rawValue)
        assertEquals("week", SubscriptionPeriodUnit.Week.rawValue)
        assertEquals("month", SubscriptionPeriodUnit.Month.rawValue)
        assertEquals("year", SubscriptionPeriodUnit.Year.rawValue)
        assertEquals("unknown", SubscriptionPeriodUnit.Unknown.rawValue)
    }

    @Test
    fun `SubscriptionPeriodUnit fromJson handles supported formats`() {
        // Lowercase (standard)
        assertEquals(SubscriptionPeriodUnit.Day, SubscriptionPeriodUnit.fromJson("day"))
        assertEquals(SubscriptionPeriodUnit.Week, SubscriptionPeriodUnit.fromJson("week"))
        assertEquals(SubscriptionPeriodUnit.Month, SubscriptionPeriodUnit.fromJson("month"))
        assertEquals(SubscriptionPeriodUnit.Year, SubscriptionPeriodUnit.fromJson("year"))
        assertEquals(SubscriptionPeriodUnit.Unknown, SubscriptionPeriodUnit.fromJson("unknown"))

        // PascalCase
        assertEquals(SubscriptionPeriodUnit.Day, SubscriptionPeriodUnit.fromJson("Day"))
        assertEquals(SubscriptionPeriodUnit.Week, SubscriptionPeriodUnit.fromJson("Week"))
        assertEquals(SubscriptionPeriodUnit.Month, SubscriptionPeriodUnit.fromJson("Month"))
        assertEquals(SubscriptionPeriodUnit.Year, SubscriptionPeriodUnit.fromJson("Year"))
        assertEquals(SubscriptionPeriodUnit.Unknown, SubscriptionPeriodUnit.fromJson("Unknown"))
    }

    // MARK: - SubscriptionPeriod Tests

    @Test
    fun `SubscriptionPeriod creation and toJson`() {
        val period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Month, value = 3)

        assertEquals(SubscriptionPeriodUnit.Month, period.unit)
        assertEquals(3, period.value)

        val json = period.toJson()
        assertEquals("month", json["unit"])
        assertEquals(3, json["value"])
    }

    @Test
    fun `SubscriptionPeriod fromJson`() {
        val json = mapOf(
            "unit" to "week",
            "value" to 2
        )

        val period = SubscriptionPeriod.fromJson(json)
        assertEquals(SubscriptionPeriodUnit.Week, period.unit)
        assertEquals(2, period.value)
    }

    // MARK: - DiscountOffer Tests

    @Test
    fun `DiscountOffer creation with Android-specific fields`() {
        val offer = DiscountOffer(
            id = "summer_sale_2025",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = "token_abc123",
            offerTagsAndroid = listOf("summer", "sale"),
            fullPriceMicrosAndroid = "9990000",
            percentageDiscountAndroid = 50,
            discountAmountMicrosAndroid = "4990000",
            formattedDiscountAmountAndroid = "$5.00 OFF",
            validTimeWindowAndroid = ValidTimeWindowAndroid(
                startTimeMillis = "1704067200000",
                endTimeMillis = "1735689599000"
            ),
            limitedQuantityInfoAndroid = LimitedQuantityInfoAndroid(
                maximumQuantity = 3,
                remainingQuantity = 2
            )
        )

        assertEquals("summer_sale_2025", offer.id)
        assertEquals("$4.99", offer.displayPrice)
        assertEquals(4.99, offer.price, 0.01)
        assertEquals("USD", offer.currency)
        assertEquals(DiscountOfferType.OneTime, offer.type)
        assertEquals("token_abc123", offer.offerTokenAndroid)
        assertEquals(listOf("summer", "sale"), offer.offerTagsAndroid)
        assertEquals("9990000", offer.fullPriceMicrosAndroid)
        assertEquals(50, offer.percentageDiscountAndroid)
        assertEquals("4990000", offer.discountAmountMicrosAndroid)
        assertEquals("$5.00 OFF", offer.formattedDiscountAmountAndroid)
        assertEquals("1704067200000", offer.validTimeWindowAndroid?.startTimeMillis)
        assertEquals(3, offer.limitedQuantityInfoAndroid?.maximumQuantity)
    }

    @Test
    fun `DiscountOffer toJson serializes correctly`() {
        val offer = DiscountOffer(
            id = "promo_001",
            displayPrice = "$2.99",
            price = 2.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = "token_xyz"
        )

        val json = offer.toJson()
        assertEquals("promo_001", json["id"])
        assertEquals("$2.99", json["displayPrice"])
        assertEquals(2.99, json["price"])
        assertEquals("USD", json["currency"])
        assertEquals("one-time", json["type"])
        assertEquals("token_xyz", json["offerTokenAndroid"])
    }

    @Test
    fun `DiscountOffer fromJson deserializes correctly`() {
        val json = mapOf<String, Any?>(
            "id" to "discount_100",
            "displayPrice" to "$1.99",
            "price" to 1.99,
            "currency" to "EUR",
            "type" to "one-time",
            "offerTokenAndroid" to "token_123",
            "percentageDiscountAndroid" to 33
        )

        val offer = DiscountOffer.fromJson(json)
        assertEquals("discount_100", offer.id)
        assertEquals("$1.99", offer.displayPrice)
        assertEquals(1.99, offer.price, 0.01)
        assertEquals("EUR", offer.currency)
        assertEquals(DiscountOfferType.OneTime, offer.type)
        assertEquals("token_123", offer.offerTokenAndroid)
        assertEquals(33, offer.percentageDiscountAndroid)
    }

    // MARK: - SubscriptionOffer Tests

    @Test
    fun `SubscriptionOffer creation with cross-platform fields`() {
        val offer = SubscriptionOffer(
            id = "intro_monthly",
            displayPrice = "$0.00",
            price = 0.0,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Week, value = 1),
            periodCount = 1,
            paymentMode = PaymentMode.FreeTrial,
            basePlanIdAndroid = "monthly_base",
            offerTokenAndroid = "offer_token_abc",
            offerTagsAndroid = listOf("trial")
        )

        assertEquals("intro_monthly", offer.id)
        assertEquals("$0.00", offer.displayPrice)
        assertEquals(0.0, offer.price, 0.01)
        assertEquals(DiscountOfferType.Introductory, offer.type)
        assertEquals(PaymentMode.FreeTrial, offer.paymentMode)
        assertEquals(SubscriptionPeriodUnit.Week, offer.period?.unit)
        assertEquals(1, offer.period?.value)
        assertEquals(1, offer.periodCount)
        assertEquals("monthly_base", offer.basePlanIdAndroid)
        assertEquals("offer_token_abc", offer.offerTokenAndroid)
    }

    @Test
    fun `SubscriptionOffer creation with iOS-specific fields`() {
        val offer = SubscriptionOffer(
            id = "promo_ios",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.Promotional,
            keyIdentifierIOS = "key_123",
            nonceIOS = "uuid-nonce-456",
            signatureIOS = "signature_base64",
            timestampIOS = 1704067200000.0,
            numberOfPeriodsIOS = 3,
            localizedPriceIOS = "$4.99"
        )

        assertEquals("promo_ios", offer.id)
        assertEquals("key_123", offer.keyIdentifierIOS)
        assertEquals("uuid-nonce-456", offer.nonceIOS)
        assertEquals("signature_base64", offer.signatureIOS)
        assertEquals(1704067200000.0, offer.timestampIOS)
        assertEquals(3, offer.numberOfPeriodsIOS)
        assertEquals("$4.99", offer.localizedPriceIOS)
    }

    @Test
    fun `SubscriptionOffer toJson serializes correctly`() {
        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(
                PricingPhaseAndroid(
                    billingCycleCount = 0,
                    billingPeriod = "P1W",
                    formattedPrice = "$0.00",
                    priceAmountMicros = "0",
                    priceCurrencyCode = "USD",
                    recurrenceMode = 3
                ),
                PricingPhaseAndroid(
                    billingCycleCount = 0,
                    billingPeriod = "P1M",
                    formattedPrice = "$9.99",
                    priceAmountMicros = "9990000",
                    priceCurrencyCode = "USD",
                    recurrenceMode = 1
                )
            )
        )

        val offer = SubscriptionOffer(
            id = "sub_offer",
            displayPrice = "$0.00",
            price = 0.0,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial,
            period = SubscriptionPeriod(unit = SubscriptionPeriodUnit.Week, value = 1),
            periodCount = 1,
            basePlanIdAndroid = "base_monthly",
            offerTokenAndroid = "token_sub",
            pricingPhasesAndroid = pricingPhases
        )

        val json = offer.toJson()
        assertEquals("sub_offer", json["id"])
        assertEquals("$0.00", json["displayPrice"])
        assertEquals(0.0, json["price"])
        assertEquals("introductory", json["type"])
        assertEquals("free-trial", json["paymentMode"])
        assertEquals("base_monthly", json["basePlanIdAndroid"])
        assertEquals("token_sub", json["offerTokenAndroid"])

        @Suppress("UNCHECKED_CAST")
        val periodJson = json["period"] as Map<String, Any?>
        assertEquals("week", periodJson["unit"])
        assertEquals(1, periodJson["value"])
    }

    @Test
    fun `SubscriptionOffer fromJson deserializes correctly`() {
        val json = mapOf<String, Any?>(
            "id" to "parsed_offer",
            "displayPrice" to "$2.99",
            "price" to 2.99,
            "currency" to "USD",
            "type" to "promotional",
            "paymentMode" to "pay-as-you-go",
            "basePlanIdAndroid" to "yearly_base",
            "offerTokenAndroid" to "parsed_token",
            "period" to mapOf(
                "unit" to "month",
                "value" to 3
            ),
            "periodCount" to 3
        )

        val offer = SubscriptionOffer.fromJson(json)
        assertEquals("parsed_offer", offer.id)
        assertEquals("$2.99", offer.displayPrice)
        assertEquals(2.99, offer.price, 0.01)
        assertEquals(DiscountOfferType.Promotional, offer.type)
        assertEquals(PaymentMode.PayAsYouGo, offer.paymentMode)
        assertEquals("yearly_base", offer.basePlanIdAndroid)
        assertEquals("parsed_token", offer.offerTokenAndroid)
        assertEquals(SubscriptionPeriodUnit.Month, offer.period?.unit)
        assertEquals(3, offer.period?.value)
        assertEquals(3, offer.periodCount)
    }

    // MARK: - ProductAndroid Integration Tests

    @Test
    fun `ProductAndroid can hold discountOffers and subscriptionOffers`() {
        val discountOffer = DiscountOffer(
            id = "discount_001",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = "disc_token"
        )

        val product = ProductAndroid(
            id = "test_product",
            title = "Test Product",
            description = "A test product",
            displayName = "Test",
            displayPrice = "$9.99",
            price = 9.99,
            currency = "USD",
            platform = IapPlatform.Android,
            type = ProductType.InApp,
            nameAndroid = "Test Product",
            discountOffers = listOf(discountOffer),
            subscriptionOffers = null,
            oneTimePurchaseOfferDetailsAndroid = null,
            subscriptionOfferDetailsAndroid = null
        )

        assertEquals(1, product.discountOffers?.size)
        assertEquals("discount_001", product.discountOffers?.first()?.id)
        assertNull(product.subscriptionOffers)
    }

    @Test
    fun `ProductSubscriptionAndroid can hold subscriptionOffers`() {
        val subscriptionOffer = SubscriptionOffer(
            id = "sub_intro",
            displayPrice = "$0.00",
            price = 0.0,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial,
            basePlanIdAndroid = "monthly",
            offerTokenAndroid = "sub_token"
        )

        val product = ProductSubscriptionAndroid(
            id = "subscription_product",
            title = "Premium Subscription",
            description = "Monthly premium subscription",
            displayName = "Premium",
            displayPrice = "$9.99",
            price = 9.99,
            currency = "USD",
            platform = IapPlatform.Android,
            type = ProductType.Subs,
            nameAndroid = "Premium Subscription",
            discountOffers = null,
            subscriptionOffers = listOf(subscriptionOffer),
            oneTimePurchaseOfferDetailsAndroid = null,
            subscriptionOfferDetailsAndroid = emptyList()
        )

        assertEquals(1, product.subscriptionOffers.size)
        assertEquals("sub_intro", product.subscriptionOffers.first().id)
        assertEquals(PaymentMode.FreeTrial, product.subscriptionOffers.first().paymentMode)
    }

    // MARK: - RequestPurchaseAndroidProps offerTokenAndroid Tests

    @Test
    fun `RequestPurchaseAndroidProps supports offerTokenAndroid for one-time purchases`() {
        val props = RequestPurchaseAndroidProps(
            skus = listOf("premium_upgrade"),
            offerTokenAndroid = "discount_offer_token_abc123"
        )

        assertEquals(listOf("premium_upgrade"), props.skus)
        assertEquals("discount_offer_token_abc123", props.offerTokenAndroid)
        assertNull(props.isOfferPersonalizedAndroid)
        assertNull(props.obfuscatedAccountIdAndroid)
    }

    @Test
    fun `RequestPurchaseAndroidProps toJson includes offerTokenAndroid`() {
        val props = RequestPurchaseAndroidProps(
            skus = listOf("product_id"),
            offerTokenAndroid = "test_offer_token",
            isOfferPersonalizedAndroid = true
        )

        val json = props.toJson()
        assertEquals(listOf("product_id"), json["skus"])
        assertEquals("test_offer_token", json["offerTokenAndroid"])
        assertEquals(true, json["isOfferPersonalizedAndroid"])
    }

    @Test
    fun `RequestPurchaseAndroidProps fromJson parses offerTokenAndroid`() {
        val json = mapOf<String, Any?>(
            "skus" to listOf("sku_001"),
            "offerTokenAndroid" to "parsed_offer_token",
            "obfuscatedAccountIdAndroid" to "account_123"
        )

        val props = RequestPurchaseAndroidProps.fromJson(json)
        assertEquals(listOf("sku_001"), props?.skus)
        assertEquals("parsed_offer_token", props?.offerTokenAndroid)
        assertEquals("account_123", props?.obfuscatedAccountIdAndroid)
    }

    @Test
    fun `RequestPurchaseAndroidProps allows null offerTokenAndroid`() {
        val props = RequestPurchaseAndroidProps(
            skus = listOf("regular_product")
        )

        assertNull(props.offerTokenAndroid)

        val json = props.toJson()
        assertNull(json["offerTokenAndroid"])
    }

    @Test
    fun `DiscountOffer offerTokenAndroid can be used for purchase`() {
        // Simulate fetching a product with discount offer
        val discountOffer = DiscountOffer(
            id = "summer_sale",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = "summer_sale_offer_token_xyz",
            percentageDiscountAndroid = 50
        )

        // Create purchase props using the offer token from the discount offer
        val purchaseProps = RequestPurchaseAndroidProps(
            skus = listOf("premium_upgrade"),
            offerTokenAndroid = discountOffer.offerTokenAndroid
        )

        assertEquals("summer_sale_offer_token_xyz", purchaseProps.offerTokenAndroid)
        assertEquals(discountOffer.offerTokenAndroid, purchaseProps.offerTokenAndroid)
    }

    @Test
    fun `ProductAndroid discountOffers can provide offerTokenAndroid for purchase`() {
        val discountOffer = DiscountOffer(
            id = "flash_sale",
            displayPrice = "$2.99",
            price = 2.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = "flash_sale_token"
        )

        val product = ProductAndroid(
            id = "consumable_gems",
            title = "100 Gems",
            description = "A pack of 100 gems",
            displayName = "Gems Pack",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            platform = IapPlatform.Android,
            type = ProductType.InApp,
            nameAndroid = "100 Gems",
            discountOffers = listOf(discountOffer),
            subscriptionOffers = null,
            oneTimePurchaseOfferDetailsAndroid = null,
            subscriptionOfferDetailsAndroid = null
        )

        // Get the offer token from product's discount offers
        val offerToken = product.discountOffers?.firstOrNull()?.offerTokenAndroid

        // Create purchase request with the offer token
        val purchaseProps = RequestPurchaseAndroidProps(
            skus = listOf(product.id),
            offerTokenAndroid = offerToken
        )

        assertEquals("consumable_gems", purchaseProps.skus.first())
        assertEquals("flash_sale_token", purchaseProps.offerTokenAndroid)
    }
}
