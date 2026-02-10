package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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

    // MARK: - RequestPurchaseAndroidProps offerToken Tests

    @Test
    fun `RequestPurchaseAndroidProps supports offerToken for one-time purchases`() {
        val props = RequestPurchaseAndroidProps(
            skus = listOf("premium_upgrade"),
            offerToken = "discount_offer_token_abc123"
        )

        assertEquals(listOf("premium_upgrade"), props.skus)
        assertEquals("discount_offer_token_abc123", props.offerToken)
        assertNull(props.isOfferPersonalized)
        assertNull(props.obfuscatedAccountId)
    }

    @Test
    fun `RequestPurchaseAndroidProps toJson includes offerToken`() {
        val props = RequestPurchaseAndroidProps(
            skus = listOf("product_id"),
            offerToken = "test_offer_token",
            isOfferPersonalized = true
        )

        val json = props.toJson()
        assertEquals(listOf("product_id"), json["skus"])
        assertEquals("test_offer_token", json["offerToken"])
        assertEquals(true, json["isOfferPersonalized"])
    }

    @Test
    fun `RequestPurchaseAndroidProps fromJson parses offerToken`() {
        val json = mapOf<String, Any?>(
            "skus" to listOf("sku_001"),
            "offerToken" to "parsed_offer_token",
            "obfuscatedAccountId" to "account_123"
        )

        val props = RequestPurchaseAndroidProps.fromJson(json)
        assertEquals(listOf("sku_001"), props?.skus)
        assertEquals("parsed_offer_token", props?.offerToken)
        assertEquals("account_123", props?.obfuscatedAccountId)
    }

    @Test
    fun `RequestPurchaseAndroidProps allows null offerToken`() {
        val props = RequestPurchaseAndroidProps(
            skus = listOf("regular_product")
        )

        assertNull(props.offerToken)

        val json = props.toJson()
        assertNull(json["offerToken"])
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
            offerToken = discountOffer.offerTokenAndroid
        )

        assertEquals("summer_sale_offer_token_xyz", purchaseProps.offerToken)
        assertEquals(discountOffer.offerTokenAndroid, purchaseProps.offerToken)
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
            offerToken = offerToken
        )

        assertEquals("consumable_gems", purchaseProps.skus.first())
        assertEquals("flash_sale_token", purchaseProps.offerToken)
    }

    // MARK: - purchaseOptionIdAndroid Tests (Issue #77)

    @Test
    fun `DiscountOffer supports purchaseOptionIdAndroid`() {
        val offer = DiscountOffer(
            id = "option_offer",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = "token_abc",
            purchaseOptionIdAndroid = "purchase_option_001"
        )

        assertEquals("purchase_option_001", offer.purchaseOptionIdAndroid)
    }

    @Test
    fun `DiscountOffer toJson includes purchaseOptionIdAndroid`() {
        val offer = DiscountOffer(
            id = "test_offer",
            displayPrice = "$2.99",
            price = 2.99,
            currency = "USD",
            type = DiscountOfferType.OneTime,
            purchaseOptionIdAndroid = "option_xyz"
        )

        val json = offer.toJson()
        assertEquals("option_xyz", json["purchaseOptionIdAndroid"])
    }

    @Test
    fun `DiscountOffer fromJson parses purchaseOptionIdAndroid`() {
        val json = mapOf<String, Any?>(
            "id" to "offer_100",
            "displayPrice" to "$1.99",
            "price" to 1.99,
            "currency" to "USD",
            "type" to "one-time",
            "purchaseOptionIdAndroid" to "parsed_option_id"
        )

        val offer = DiscountOffer.fromJson(json)
        assertEquals("parsed_option_id", offer.purchaseOptionIdAndroid)
    }

    @Test
    fun `DiscountOffer allows null purchaseOptionIdAndroid`() {
        val offer = DiscountOffer(
            id = "basic_offer",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.OneTime
        )

        assertNull(offer.purchaseOptionIdAndroid)
    }

    // MARK: - InstallmentPlanDetailsAndroid Tests

    @Test
    fun `InstallmentPlanDetailsAndroid creation and toJson`() {
        val details = InstallmentPlanDetailsAndroid(
            commitmentPaymentsCount = 12,
            subsequentCommitmentPaymentsCount = 12
        )

        assertEquals(12, details.commitmentPaymentsCount)
        assertEquals(12, details.subsequentCommitmentPaymentsCount)

        val json = details.toJson()
        assertEquals(12, json["commitmentPaymentsCount"])
        assertEquals(12, json["subsequentCommitmentPaymentsCount"])
    }

    @Test
    fun `InstallmentPlanDetailsAndroid fromJson`() {
        val json = mapOf(
            "commitmentPaymentsCount" to 6,
            "subsequentCommitmentPaymentsCount" to 0
        )

        val details = InstallmentPlanDetailsAndroid.fromJson(json)
        assertEquals(6, details.commitmentPaymentsCount)
        assertEquals(0, details.subsequentCommitmentPaymentsCount)
    }

    @Test
    fun `InstallmentPlanDetailsAndroid zero subsequent means revert to normal plan`() {
        val details = InstallmentPlanDetailsAndroid(
            commitmentPaymentsCount = 12,
            subsequentCommitmentPaymentsCount = 0
        )

        // subsequentCommitmentPaymentsCount = 0 means plan reverts to normal upon renewal
        assertEquals(0, details.subsequentCommitmentPaymentsCount)
    }

    // MARK: - SubscriptionOffer installmentPlanDetailsAndroid Tests

    @Test
    fun `SubscriptionOffer supports installmentPlanDetailsAndroid`() {
        val installmentDetails = InstallmentPlanDetailsAndroid(
            commitmentPaymentsCount = 12,
            subsequentCommitmentPaymentsCount = 12
        )

        val offer = SubscriptionOffer(
            id = "installment_sub",
            displayPrice = "$9.99/month",
            price = 9.99,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            basePlanIdAndroid = "monthly_installment",
            offerTokenAndroid = "install_token",
            installmentPlanDetailsAndroid = installmentDetails
        )

        assertEquals(12, offer.installmentPlanDetailsAndroid?.commitmentPaymentsCount)
        assertEquals(12, offer.installmentPlanDetailsAndroid?.subsequentCommitmentPaymentsCount)
    }

    @Test
    fun `SubscriptionOffer toJson includes installmentPlanDetailsAndroid`() {
        val offer = SubscriptionOffer(
            id = "sub_with_installment",
            displayPrice = "$5.99",
            price = 5.99,
            currency = "USD",
            type = DiscountOfferType.Promotional,
            installmentPlanDetailsAndroid = InstallmentPlanDetailsAndroid(
                commitmentPaymentsCount = 6,
                subsequentCommitmentPaymentsCount = 6
            )
        )

        val json = offer.toJson()
        @Suppress("UNCHECKED_CAST")
        val installmentJson = json["installmentPlanDetailsAndroid"] as? Map<String, Any?>
        assertEquals(6, installmentJson?.get("commitmentPaymentsCount"))
        assertEquals(6, installmentJson?.get("subsequentCommitmentPaymentsCount"))
    }

    @Test
    fun `SubscriptionOffer fromJson parses installmentPlanDetailsAndroid`() {
        val json = mapOf<String, Any?>(
            "id" to "parsed_installment_offer",
            "displayPrice" to "$7.99",
            "price" to 7.99,
            "currency" to "USD",
            "type" to "introductory",
            "installmentPlanDetailsAndroid" to mapOf(
                "commitmentPaymentsCount" to 24,
                "subsequentCommitmentPaymentsCount" to 12
            )
        )

        val offer = SubscriptionOffer.fromJson(json)
        assertEquals(24, offer.installmentPlanDetailsAndroid?.commitmentPaymentsCount)
        assertEquals(12, offer.installmentPlanDetailsAndroid?.subsequentCommitmentPaymentsCount)
    }

    @Test
    fun `SubscriptionOffer allows null installmentPlanDetailsAndroid`() {
        val offer = SubscriptionOffer(
            id = "regular_sub",
            displayPrice = "$9.99",
            price = 9.99,
            currency = "USD",
            type = DiscountOfferType.Introductory
        )

        assertNull(offer.installmentPlanDetailsAndroid)
    }

    // MARK: - ProductAndroidOneTimePurchaseOfferDetail purchaseOptionId Tests

    @Test
    fun `ProductAndroidOneTimePurchaseOfferDetail supports purchaseOptionId`() {
        val offerDetail = ProductAndroidOneTimePurchaseOfferDetail(
            offerId = "offer_001",
            offerToken = "token_abc",
            offerTags = listOf("sale"),
            formattedPrice = "$4.99",
            priceAmountMicros = "4990000",
            priceCurrencyCode = "USD",
            purchaseOptionId = "purchase_opt_xyz"
        )

        assertEquals("purchase_opt_xyz", offerDetail.purchaseOptionId)
    }

    @Test
    fun `ProductAndroidOneTimePurchaseOfferDetail toJson includes purchaseOptionId`() {
        val offerDetail = ProductAndroidOneTimePurchaseOfferDetail(
            offerId = "offer_002",
            offerToken = "token_def",
            offerTags = emptyList(),
            formattedPrice = "$2.99",
            priceAmountMicros = "2990000",
            priceCurrencyCode = "USD",
            purchaseOptionId = "opt_id_123"
        )

        val json = offerDetail.toJson()
        assertEquals("opt_id_123", json["purchaseOptionId"])
    }

    @Test
    fun `ProductAndroidOneTimePurchaseOfferDetail fromJson parses purchaseOptionId`() {
        val json = mapOf<String, Any?>(
            "offerId" to "parsed_offer",
            "offerToken" to "parsed_token",
            "offerTags" to listOf("tag1"),
            "formattedPrice" to "$1.99",
            "priceAmountMicros" to "1990000",
            "priceCurrencyCode" to "EUR",
            "purchaseOptionId" to "parsed_purchase_option"
        )

        val offerDetail = ProductAndroidOneTimePurchaseOfferDetail.fromJson(json)
        assertEquals("parsed_purchase_option", offerDetail.purchaseOptionId)
    }

    // MARK: - ProductSubscriptionAndroidOfferDetails installmentPlanDetails Tests

    @Test
    fun `ProductSubscriptionAndroidOfferDetails supports installmentPlanDetails`() {
        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(
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

        val offerDetails = ProductSubscriptionAndroidOfferDetails(
            basePlanId = "monthly_installment",
            offerId = null,
            offerToken = "install_token",
            offerTags = listOf("installment"),
            pricingPhases = pricingPhases,
            installmentPlanDetails = InstallmentPlanDetailsAndroid(
                commitmentPaymentsCount = 12,
                subsequentCommitmentPaymentsCount = 0
            )
        )

        assertEquals(12, offerDetails.installmentPlanDetails?.commitmentPaymentsCount)
        assertEquals(0, offerDetails.installmentPlanDetails?.subsequentCommitmentPaymentsCount)
    }

    @Test
    fun `ProductSubscriptionAndroidOfferDetails toJson includes installmentPlanDetails`() {
        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(
                PricingPhaseAndroid(
                    billingCycleCount = 0,
                    billingPeriod = "P1M",
                    formattedPrice = "$7.99",
                    priceAmountMicros = "7990000",
                    priceCurrencyCode = "USD",
                    recurrenceMode = 1
                )
            )
        )

        val offerDetails = ProductSubscriptionAndroidOfferDetails(
            basePlanId = "yearly_base",
            offerId = "promo_offer",
            offerToken = "promo_token",
            offerTags = emptyList(),
            pricingPhases = pricingPhases,
            installmentPlanDetails = InstallmentPlanDetailsAndroid(
                commitmentPaymentsCount = 6,
                subsequentCommitmentPaymentsCount = 6
            )
        )

        val json = offerDetails.toJson()
        @Suppress("UNCHECKED_CAST")
        val installmentJson = json["installmentPlanDetails"] as? Map<String, Any?>
        assertEquals(6, installmentJson?.get("commitmentPaymentsCount"))
        assertEquals(6, installmentJson?.get("subsequentCommitmentPaymentsCount"))
    }

    @Test
    fun `ProductSubscriptionAndroidOfferDetails fromJson parses installmentPlanDetails`() {
        val json = mapOf<String, Any?>(
            "basePlanId" to "parsed_base",
            "offerId" to null,
            "offerToken" to "parsed_token",
            "offerTags" to listOf("monthly"),
            "pricingPhases" to mapOf(
                "pricingPhaseList" to listOf(
                    mapOf(
                        "billingCycleCount" to 0,
                        "billingPeriod" to "P1M",
                        "formattedPrice" to "$9.99",
                        "priceAmountMicros" to "9990000",
                        "priceCurrencyCode" to "USD",
                        "recurrenceMode" to 1
                    )
                )
            ),
            "installmentPlanDetails" to mapOf(
                "commitmentPaymentsCount" to 24,
                "subsequentCommitmentPaymentsCount" to 12
            )
        )

        val offerDetails = ProductSubscriptionAndroidOfferDetails.fromJson(json)
        assertEquals(24, offerDetails.installmentPlanDetails?.commitmentPaymentsCount)
        assertEquals(12, offerDetails.installmentPlanDetails?.subsequentCommitmentPaymentsCount)
    }

    // MARK: - PendingPurchaseUpdateAndroid Tests

    @Test
    fun `PendingPurchaseUpdateAndroid creation and toJson`() {
        val pendingUpdate = PendingPurchaseUpdateAndroid(
            products = listOf("premium_monthly", "premium_yearly"),
            purchaseToken = "pending_token_abc123"
        )

        assertEquals(listOf("premium_monthly", "premium_yearly"), pendingUpdate.products)
        assertEquals("pending_token_abc123", pendingUpdate.purchaseToken)

        val json = pendingUpdate.toJson()
        @Suppress("UNCHECKED_CAST")
        assertEquals(listOf("premium_monthly", "premium_yearly"), json["products"] as List<String>)
        assertEquals("pending_token_abc123", json["purchaseToken"])
    }

    @Test
    fun `PendingPurchaseUpdateAndroid fromJson`() {
        val json = mapOf(
            "products" to listOf("basic_plan", "pro_plan"),
            "purchaseToken" to "token_xyz789"
        )

        val pendingUpdate = PendingPurchaseUpdateAndroid.fromJson(json)
        assertEquals(listOf("basic_plan", "pro_plan"), pendingUpdate.products)
        assertEquals("token_xyz789", pendingUpdate.purchaseToken)
    }

    @Test
    fun `PendingPurchaseUpdateAndroid single product upgrade`() {
        val pendingUpdate = PendingPurchaseUpdateAndroid(
            products = listOf("premium_yearly"),
            purchaseToken = "upgrade_token"
        )

        // Single product upgrade scenario
        assertEquals(1, pendingUpdate.products.size)
        assertEquals("premium_yearly", pendingUpdate.products.first())
    }

    // MARK: - PurchaseAndroid with pendingPurchaseUpdateAndroid Tests

    @Test
    fun `PurchaseAndroid supports pendingPurchaseUpdateAndroid`() {
        val pendingUpdate = PendingPurchaseUpdateAndroid(
            products = listOf("premium_yearly"),
            purchaseToken = "pending_upgrade_token"
        )

        val purchase = PurchaseAndroid(
            id = "order_123",
            productId = "premium_monthly",
            transactionDate = 1700000000000.0,
            purchaseToken = "current_token",
            store = IapStore.Google,
            platform = IapPlatform.Android,
            quantity = 1,
            purchaseState = PurchaseState.Purchased,
            isAutoRenewing = true,
            pendingPurchaseUpdateAndroid = pendingUpdate
        )

        assertNotNull(purchase.pendingPurchaseUpdateAndroid)
        assertEquals(listOf("premium_yearly"), purchase.pendingPurchaseUpdateAndroid?.products)
        assertEquals("pending_upgrade_token", purchase.pendingPurchaseUpdateAndroid?.purchaseToken)
    }

    @Test
    fun `PurchaseAndroid toJson includes pendingPurchaseUpdateAndroid`() {
        val purchase = PurchaseAndroid(
            id = "order_456",
            productId = "basic_plan",
            transactionDate = 1700000000000.0,
            store = IapStore.Google,
            platform = IapPlatform.Android,
            quantity = 1,
            purchaseState = PurchaseState.Purchased,
            isAutoRenewing = true,
            pendingPurchaseUpdateAndroid = PendingPurchaseUpdateAndroid(
                products = listOf("pro_plan"),
                purchaseToken = "upgrade_token_789"
            )
        )

        val json = purchase.toJson()
        @Suppress("UNCHECKED_CAST")
        val pendingJson = json["pendingPurchaseUpdateAndroid"] as? Map<String, Any?>
        assertNotNull(pendingJson)
        assertEquals(listOf("pro_plan"), pendingJson?.get("products"))
        assertEquals("upgrade_token_789", pendingJson?.get("purchaseToken"))
    }

    @Test
    fun `PurchaseAndroid fromJson parses pendingPurchaseUpdateAndroid`() {
        val json = mapOf<String, Any?>(
            "id" to "order_789",
            "productId" to "starter_plan",
            "transactionDate" to 1700000000000.0,
            "store" to "google",
            "platform" to "android",
            "quantity" to 1,
            "purchaseState" to "purchased",
            "isAutoRenewing" to true,
            "pendingPurchaseUpdateAndroid" to mapOf(
                "products" to listOf("enterprise_plan"),
                "purchaseToken" to "enterprise_upgrade_token"
            )
        )

        val purchase = PurchaseAndroid.fromJson(json)
        assertNotNull(purchase.pendingPurchaseUpdateAndroid)
        assertEquals(listOf("enterprise_plan"), purchase.pendingPurchaseUpdateAndroid?.products)
        assertEquals("enterprise_upgrade_token", purchase.pendingPurchaseUpdateAndroid?.purchaseToken)
    }

    @Test
    fun `PurchaseAndroid allows null pendingPurchaseUpdateAndroid`() {
        val purchase = PurchaseAndroid(
            id = "order_no_pending",
            productId = "regular_product",
            transactionDate = 1700000000000.0,
            store = IapStore.Google,
            platform = IapPlatform.Android,
            quantity = 1,
            purchaseState = PurchaseState.Purchased,
            isAutoRenewing = false
        )

        assertNull(purchase.pendingPurchaseUpdateAndroid)
    }

    @Test
    fun `PurchaseAndroid pendingPurchaseUpdateAndroid use case - subscription downgrade`() {
        // Scenario: User on yearly plan downgrades to monthly
        // The downgrade is pending until the yearly period ends
        val purchase = PurchaseAndroid(
            id = "yearly_order",
            productId = "premium_yearly",
            transactionDate = 1700000000000.0,
            store = IapStore.Google,
            platform = IapPlatform.Android,
            quantity = 1,
            purchaseState = PurchaseState.Purchased,
            isAutoRenewing = true,
            currentPlanId = "yearly",
            pendingPurchaseUpdateAndroid = PendingPurchaseUpdateAndroid(
                products = listOf("premium_monthly"),
                purchaseToken = "downgrade_pending_token"
            )
        )

        // Current purchase is still yearly
        assertEquals("premium_yearly", purchase.productId)
        assertEquals("yearly", purchase.currentPlanId)

        // But there's a pending downgrade to monthly
        assertNotNull(purchase.pendingPurchaseUpdateAndroid)
        assertEquals("premium_monthly", purchase.pendingPurchaseUpdateAndroid?.products?.first())
    }
}
