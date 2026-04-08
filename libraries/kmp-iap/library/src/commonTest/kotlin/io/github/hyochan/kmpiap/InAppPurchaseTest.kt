package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class InAppPurchaseTest {

    @Test
    fun testErrorCodes() {
        val errorCode = ErrorCode.UserCancelled
        assertEquals(ErrorCode.UserCancelled, errorCode)
        assertEquals("user-cancelled", errorCode.toJson())
    }

    @Test
    fun testPlatformTypes() {
        val platform = IapPlatform.Android
        assertEquals(IapPlatform.Android, platform)
    }

    @Test
    fun testConnectionResult() {
        val result = ConnectionResult(connected = true, message = "Connected successfully")
        assertTrue(result.connected)
        assertEquals("Connected successfully", result.message)
    }

    @Test
    fun testPurchaseError() {
        val error = PurchaseError(code = ErrorCode.UserCancelled, message = "Test error")
        assertEquals("Test error", error.message)
        assertEquals(ErrorCode.UserCancelled, error.code)
    }

    @Test
    fun testProductTypes() {
        val product = ProductAndroid(
            currency = "USD",
            description = "A test product",
            displayPrice = "$0.99",
            id = "test_product",
            nameAndroid = "Test Product",
            platform = IapPlatform.Android,
            price = 0.99,
            title = "Test Product",
            type = ProductType.InApp
        )

        assertEquals("test_product", product.id)
        assertEquals("$0.99", product.displayPrice)
        assertEquals("USD", product.currency)
        assertEquals(0.99, product.price)
    }

    @Test
    fun testSubscriptionTypes() {
        val subscription = ProductSubscriptionIOS(
            currency = "USD",
            description = "A test subscription",
            displayPrice = "$9.99",
            id = "test_subscription",
            displayNameIOS = "Test Subscription",
            isFamilyShareableIOS = false,
            jsonRepresentationIOS = "{}",
            subscriptionPeriodNumberIOS = "1",
            subscriptionPeriodUnitIOS = SubscriptionPeriodIOS.Month,
            platform = IapPlatform.Ios,
            price = 9.99,
            title = "Test Subscription",
            type = ProductType.Subs,
            typeIOS = ProductTypeIOS.AutoRenewableSubscription,
            introductoryPricePaymentModeIOS = PaymentModeIOS.Empty
        )

        assertEquals("test_subscription", subscription.id)
        assertEquals("$9.99", subscription.displayPrice)
        assertEquals("1", subscription.subscriptionPeriodNumberIOS)
    }

    @Test
    fun testPurchaseTypes() {
        val purchase = PurchaseAndroid(
            autoRenewingAndroid = false,
            dataAndroid = "receipt_data",
            developerPayloadAndroid = null,
            id = "12345",
            ids = listOf("test_product"),
            isAcknowledgedAndroid = false,
            isAutoRenewing = false,
            obfuscatedAccountIdAndroid = null,
            obfuscatedProfileIdAndroid = null,
            packageNameAndroid = "com.example",
            platform = IapPlatform.Android,
            productId = "test_product",
            purchaseState = PurchaseState.Purchased,
            purchaseToken = "token",
            quantity = 1,
            signatureAndroid = "signature",
            store = IapStore.Google,
            transactionDate = 1234567890.0
        )

        assertEquals("12345", purchase.id)
        assertEquals("test_product", purchase.productId)
        assertEquals("token", purchase.purchaseToken)
        assertEquals(PurchaseState.Purchased, purchase.purchaseState)
    }

    @Test
    fun testProductRequest() {
        val request = ProductRequest(
            skus = listOf("product1", "product2"),
            type = ProductQueryType.InApp
        )

        assertEquals(2, request.skus.size)
        assertEquals(ProductQueryType.InApp, request.type)
    }

    @Test
    fun testActiveSubscription() {
        val activeSubscription = ActiveSubscription(
            autoRenewingAndroid = true,
            isActive = true,
            productId = "test_sub",
            purchaseToken = "token",
            transactionDate = 1234567890.0,
            transactionId = "txn"
        )

        assertEquals("test_sub", activeSubscription.productId)
        assertTrue(activeSubscription.isActive)
        assertEquals("txn", activeSubscription.transactionId)
    }

    // =========================================================================
    // advancedCommerceData Tests
    // =========================================================================

    @Test
    fun testRequestPurchaseIosPropsWithAdvancedCommerceData() {
        val props = RequestPurchaseIosProps(
            sku = "com.example.premium",
            advancedCommerceData = "campaign_summer_2025"
        )

        assertEquals("com.example.premium", props.sku)
        assertEquals("campaign_summer_2025", props.advancedCommerceData)
    }

    @Test
    fun testRequestPurchaseIosPropsWithoutAdvancedCommerceData() {
        val props = RequestPurchaseIosProps(
            sku = "com.example.premium"
        )

        assertEquals("com.example.premium", props.sku)
        assertNull(props.advancedCommerceData)
    }

    @Test
    fun testRequestSubscriptionIosPropsWithAdvancedCommerceData() {
        val props = RequestSubscriptionIosProps(
            sku = "com.example.subscription.monthly",
            advancedCommerceData = "campaign_q4_2025"
        )

        assertEquals("com.example.subscription.monthly", props.sku)
        assertEquals("campaign_q4_2025", props.advancedCommerceData)
    }

    // =========================================================================
    // google field support Tests
    // =========================================================================

    @Test
    fun testRequestPurchasePropsByPlatformsWithGoogleField() {
        val props = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(
                skus = listOf("sku_premium")
            )
        )

        assertNotNull(props.google)
        assertEquals(listOf("sku_premium"), props.google?.skus)
        assertNull(props.android)
    }

    @Test
    fun testRequestPurchasePropsByPlatformsWithBothIosAndGoogle() {
        val props = RequestPurchasePropsByPlatforms(
            ios = RequestPurchaseIosProps(
                sku = "ios_premium",
                advancedCommerceData = "campaign_123"
            ),
            google = RequestPurchaseAndroidProps(
                skus = listOf("android_premium"),
                obfuscatedAccountId = "user_123"
            )
        )

        assertNotNull(props.ios)
        assertNotNull(props.google)
        assertEquals("ios_premium", props.ios?.sku)
        assertEquals("campaign_123", props.ios?.advancedCommerceData)
        assertEquals(listOf("android_premium"), props.google?.skus)
    }

    @Test
    fun testRequestSubscriptionPropsByPlatformsWithGoogleField() {
        val props = RequestSubscriptionPropsByPlatforms(
            google = RequestSubscriptionAndroidProps(
                skus = listOf("sub_monthly"),
                subscriptionOffers = listOf(
                    AndroidSubscriptionOfferInput(
                        sku = "sub_monthly",
                        offerToken = "offer_token_123"
                    )
                )
            )
        )

        assertNotNull(props.google)
        assertEquals(listOf("sub_monthly"), props.google?.skus)
        assertEquals(1, props.google?.subscriptionOffers?.size)
    }

    // =========================================================================
    // SubscriptionOffer Cross-Platform Types Tests
    // =========================================================================

    @Test
    fun testSubscriptionOfferCreation() {
        val offer = SubscriptionOffer(
            id = "offer_123",
            displayPrice = "$9.99/month",
            price = 9.99,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial,
            periodCount = 1
        )

        assertEquals("offer_123", offer.id)
        assertEquals("$9.99/month", offer.displayPrice)
        assertEquals(9.99, offer.price)
        assertEquals("USD", offer.currency)
        assertEquals(DiscountOfferType.Introductory, offer.type)
        assertEquals(PaymentMode.FreeTrial, offer.paymentMode)
        assertEquals(1, offer.periodCount)
    }

    @Test
    fun testSubscriptionOfferWithAndroidFields() {
        val pricingPhases = PricingPhasesAndroid(
            pricingPhaseList = listOf(
                PricingPhaseAndroid(
                    billingCycleCount = 1,
                    billingPeriod = "P1M",
                    formattedPrice = "$9.99",
                    priceAmountMicros = "9990000",
                    priceCurrencyCode = "USD",
                    recurrenceMode = 1
                )
            )
        )

        val offer = SubscriptionOffer(
            id = "base_plan_monthly",
            displayPrice = "$9.99",
            price = 9.99,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.PayAsYouGo,
            basePlanIdAndroid = "monthly_plan",
            offerTokenAndroid = "offer_token_abc",
            offerTagsAndroid = listOf("promo", "featured"),
            pricingPhasesAndroid = pricingPhases
        )

        assertEquals("monthly_plan", offer.basePlanIdAndroid)
        assertEquals("offer_token_abc", offer.offerTokenAndroid)
        assertEquals(listOf("promo", "featured"), offer.offerTagsAndroid)
        assertNotNull(offer.pricingPhasesAndroid)
        assertEquals(1, offer.pricingPhasesAndroid?.pricingPhaseList?.size)
    }

    @Test
    fun testSubscriptionOfferWithIOSFields() {
        val period = SubscriptionPeriod(
            value = 1,
            unit = SubscriptionPeriodUnit.Month
        )

        val offer = SubscriptionOffer(
            id = "ios_intro_offer",
            displayPrice = "$4.99",
            price = 4.99,
            currency = "USD",
            type = DiscountOfferType.Promotional,
            paymentMode = PaymentMode.PayUpFront,
            period = period,
            periodCount = 3,
            keyIdentifierIOS = "key_abc123",
            nonceIOS = "nonce_uuid_here",
            signatureIOS = "signature_base64",
            timestampIOS = 1704067200.0,
            localizedPriceIOS = "$4.99 USD",
            numberOfPeriodsIOS = 3
        )

        assertEquals("key_abc123", offer.keyIdentifierIOS)
        assertEquals("nonce_uuid_here", offer.nonceIOS)
        assertEquals("signature_base64", offer.signatureIOS)
        assertEquals(1704067200.0, offer.timestampIOS)
        assertEquals("$4.99 USD", offer.localizedPriceIOS)
        assertEquals(3, offer.numberOfPeriodsIOS)
        assertNotNull(offer.period)
        assertEquals(SubscriptionPeriodUnit.Month, offer.period?.unit)
    }

    @Test
    fun testSubscriptionOfferToJson() {
        val offer = SubscriptionOffer(
            id = "test_offer",
            displayPrice = "$5.99",
            price = 5.99,
            currency = "USD",
            type = DiscountOfferType.Introductory,
            paymentMode = PaymentMode.FreeTrial
        )

        val json = offer.toJson()
        assertEquals("test_offer", json["id"])
        assertEquals("$5.99", json["displayPrice"])
        assertEquals(5.99, json["price"])
        assertEquals("USD", json["currency"])
        assertEquals("introductory", json["type"])
        assertEquals("free-trial", json["paymentMode"])
    }

    @Test
    fun testSubscriptionOfferFromJson() {
        val json = mapOf(
            "id" to "json_offer",
            "displayPrice" to "$7.99",
            "price" to 7.99,
            "currency" to "EUR",
            "type" to "promotional",
            "paymentMode" to "pay-as-you-go",
            "basePlanIdAndroid" to "base_plan_id",
            "offerTokenAndroid" to "token_123"
        )

        val offer = SubscriptionOffer.fromJson(json)
        assertEquals("json_offer", offer.id)
        assertEquals("$7.99", offer.displayPrice)
        assertEquals(7.99, offer.price)
        assertEquals("EUR", offer.currency)
        assertEquals(DiscountOfferType.Promotional, offer.type)
        assertEquals(PaymentMode.PayAsYouGo, offer.paymentMode)
        assertEquals("base_plan_id", offer.basePlanIdAndroid)
        assertEquals("token_123", offer.offerTokenAndroid)
    }

    // =========================================================================
    // DiscountOffer Cross-Platform Types Tests
    // =========================================================================

    @Test
    fun testDiscountOfferCreation() {
        val offer = DiscountOffer(
            currency = "USD",
            displayPrice = "$4.99",
            price = 4.99,
            type = DiscountOfferType.OneTime,
            id = "discount_123"
        )

        assertEquals("USD", offer.currency)
        assertEquals("$4.99", offer.displayPrice)
        assertEquals(4.99, offer.price)
        assertEquals(DiscountOfferType.OneTime, offer.type)
        assertEquals("discount_123", offer.id)
    }

    @Test
    fun testDiscountOfferWithAndroidFields() {
        val offer = DiscountOffer(
            currency = "USD",
            displayPrice = "$0.99",
            price = 0.99,
            type = DiscountOfferType.Promotional,
            id = "android_discount",
            discountAmountMicrosAndroid = "5000000",
            formattedDiscountAmountAndroid = "$5.00 OFF",
            fullPriceMicrosAndroid = "5990000",
            offerTagsAndroid = listOf("holiday_sale"),
            offerTokenAndroid = "discount_token",
            percentageDiscountAndroid = 83
        )

        assertEquals("5000000", offer.discountAmountMicrosAndroid)
        assertEquals("$5.00 OFF", offer.formattedDiscountAmountAndroid)
        assertEquals("5990000", offer.fullPriceMicrosAndroid)
        assertEquals(listOf("holiday_sale"), offer.offerTagsAndroid)
        assertEquals("discount_token", offer.offerTokenAndroid)
        assertEquals(83, offer.percentageDiscountAndroid)
    }

    @Test
    fun testDiscountOfferToJson() {
        val offer = DiscountOffer(
            currency = "JPY",
            displayPrice = "¥500",
            price = 500.0,
            type = DiscountOfferType.Introductory,
            id = "jpn_offer"
        )

        val json = offer.toJson()
        assertEquals("JPY", json["currency"])
        assertEquals("¥500", json["displayPrice"])
        assertEquals(500.0, json["price"])
        assertEquals("introductory", json["type"])
        assertEquals("jpn_offer", json["id"])
    }

    @Test
    fun testDiscountOfferFromJson() {
        val json = mapOf(
            "currency" to "GBP",
            "displayPrice" to "£3.99",
            "price" to 3.99,
            "type" to "one-time",
            "id" to "uk_offer",
            "percentageDiscountAndroid" to 50
        )

        val offer = DiscountOffer.fromJson(json)
        assertEquals("GBP", offer.currency)
        assertEquals("£3.99", offer.displayPrice)
        assertEquals(3.99, offer.price)
        assertEquals(DiscountOfferType.OneTime, offer.type)
        assertEquals("uk_offer", offer.id)
        assertEquals(50, offer.percentageDiscountAndroid)
    }

    // =========================================================================
    // DiscountOfferType Enum Tests
    // =========================================================================

    @Test
    fun testDiscountOfferTypeEnum() {
        assertEquals("introductory", DiscountOfferType.Introductory.rawValue)
        assertEquals("promotional", DiscountOfferType.Promotional.rawValue)
        assertEquals("one-time", DiscountOfferType.OneTime.rawValue)
    }

    @Test
    fun testDiscountOfferTypeFromJson() {
        assertEquals(DiscountOfferType.Introductory, DiscountOfferType.fromJson("introductory"))
        assertEquals(DiscountOfferType.Introductory, DiscountOfferType.fromJson("INTRODUCTORY"))
        assertEquals(DiscountOfferType.Promotional, DiscountOfferType.fromJson("promotional"))
        assertEquals(DiscountOfferType.Promotional, DiscountOfferType.fromJson("PROMOTIONAL"))
        assertEquals(DiscountOfferType.OneTime, DiscountOfferType.fromJson("one-time"))
        assertEquals(DiscountOfferType.OneTime, DiscountOfferType.fromJson("ONE_TIME"))
    }

    // =========================================================================
    // PaymentMode Enum Tests
    // =========================================================================

    @Test
    fun testPaymentModeEnum() {
        assertEquals("free-trial", PaymentMode.FreeTrial.rawValue)
        assertEquals("pay-as-you-go", PaymentMode.PayAsYouGo.rawValue)
        assertEquals("pay-up-front", PaymentMode.PayUpFront.rawValue)
    }

    @Test
    fun testPaymentModeFromJson() {
        assertEquals(PaymentMode.FreeTrial, PaymentMode.fromJson("free-trial"))
        assertEquals(PaymentMode.FreeTrial, PaymentMode.fromJson("FREE_TRIAL"))
        assertEquals(PaymentMode.PayAsYouGo, PaymentMode.fromJson("pay-as-you-go"))
        assertEquals(PaymentMode.PayAsYouGo, PaymentMode.fromJson("PAY_AS_YOU_GO"))
        assertEquals(PaymentMode.PayUpFront, PaymentMode.fromJson("pay-up-front"))
        assertEquals(PaymentMode.PayUpFront, PaymentMode.fromJson("PAY_UP_FRONT"))
    }

    // =========================================================================
    // ProductSubscriptionAndroid with SubscriptionOffers Tests
    // =========================================================================

    @Test
    fun testProductSubscriptionAndroidWithSubscriptionOffers() {
        val subscriptionOffers = listOf(
            SubscriptionOffer(
                id = "intro_offer",
                displayPrice = "Free for 7 days",
                price = 0.0,
                type = DiscountOfferType.Introductory,
                paymentMode = PaymentMode.FreeTrial,
                basePlanIdAndroid = "monthly_plan",
                offerTokenAndroid = "intro_token"
            ),
            SubscriptionOffer(
                id = "promo_offer",
                displayPrice = "$4.99/month",
                price = 4.99,
                type = DiscountOfferType.Promotional,
                paymentMode = PaymentMode.PayAsYouGo,
                basePlanIdAndroid = "monthly_plan",
                offerTokenAndroid = "promo_token"
            )
        )

        val product = ProductSubscriptionAndroid(
            currency = "USD",
            description = "Monthly subscription",
            displayPrice = "$9.99/month",
            id = "monthly_sub",
            nameAndroid = "Monthly Subscription",
            subscriptionOfferDetailsAndroid = emptyList(),
            subscriptionOffers = subscriptionOffers,
            title = "Monthly Plan",
            type = ProductType.Subs
        )

        assertEquals(2, product.subscriptionOffers.size)
        assertEquals("intro_offer", product.subscriptionOffers[0].id)
        assertEquals("promo_offer", product.subscriptionOffers[1].id)
        assertEquals(PaymentMode.FreeTrial, product.subscriptionOffers[0].paymentMode)
        assertEquals(PaymentMode.PayAsYouGo, product.subscriptionOffers[1].paymentMode)
    }

    // =========================================================================
    // SubscriptionPeriod Tests
    // =========================================================================

    @Test
    fun testSubscriptionPeriodCreation() {
        val period = SubscriptionPeriod(
            value = 3,
            unit = SubscriptionPeriodUnit.Month
        )

        assertEquals(3, period.value)
        assertEquals(SubscriptionPeriodUnit.Month, period.unit)
    }

    @Test
    fun testSubscriptionPeriodUnitEnum() {
        assertEquals("day", SubscriptionPeriodUnit.Day.rawValue)
        assertEquals("week", SubscriptionPeriodUnit.Week.rawValue)
        assertEquals("month", SubscriptionPeriodUnit.Month.rawValue)
        assertEquals("year", SubscriptionPeriodUnit.Year.rawValue)
    }

    // =========================================================================
    // Billing Programs API types Tests
    // =========================================================================

    @Test
    fun testBillingProgramAndroidEnum() {
        assertEquals("unspecified", BillingProgramAndroid.Unspecified.rawValue)
        assertEquals("external-content-link", BillingProgramAndroid.ExternalContentLink.rawValue)
        assertEquals("external-offer", BillingProgramAndroid.ExternalOffer.rawValue)
        assertEquals("user-choice-billing", BillingProgramAndroid.UserChoiceBilling.rawValue)
    }

    @Test
    fun testPurchaseStateEnum() {
        assertEquals("pending", PurchaseState.Pending.rawValue)
        assertEquals("purchased", PurchaseState.Purchased.rawValue)
        assertEquals("unknown", PurchaseState.Unknown.rawValue)
    }

    @Test
    fun testExternalLinkLaunchModeAndroidEnum() {
        assertEquals("unspecified", ExternalLinkLaunchModeAndroid.Unspecified.rawValue)
        assertEquals("launch-in-external-browser-or-app", ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp.rawValue)
        assertEquals("caller-will-launch-link", ExternalLinkLaunchModeAndroid.CallerWillLaunchLink.rawValue)
    }

    @Test
    fun testLaunchExternalLinkParamsAndroid() {
        val params = LaunchExternalLinkParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalOffer,
            launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
            linkUri = "https://example.com/offer"
        )

        assertEquals(BillingProgramAndroid.ExternalOffer, params.billingProgram)
        assertEquals(ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp, params.launchMode)
        assertEquals("https://example.com/offer", params.linkUri)
    }

    @Test
    fun testProductAndroidOneTimePurchaseOfferDetailWithRequiredFields() {
        val detail = ProductAndroidOneTimePurchaseOfferDetail(
            formattedPrice = "$0.99",
            priceAmountMicros = "990000",
            priceCurrencyCode = "USD",
            offerTags = listOf("sale", "featured"),
            offerToken = "offer_token_abc123"
        )

        assertEquals("$0.99", detail.formattedPrice)
        assertEquals("990000", detail.priceAmountMicros)
        assertEquals("USD", detail.priceCurrencyCode)
        assertEquals(listOf("sale", "featured"), detail.offerTags)
        assertEquals("offer_token_abc123", detail.offerToken)
    }

    // =========================================================================
    // External Payments API Tests (Billing Library 8.3.0+)
    // =========================================================================

    @Test
    fun testBillingProgramAndroidExternalPayments() {
        val program = BillingProgramAndroid.ExternalPayments
        assertEquals("external-payments", program.rawValue)
        assertEquals(BillingProgramAndroid.ExternalPayments, program)
    }

    @Test
    fun testDeveloperBillingLaunchModeAndroidEnum() {
        assertEquals("unspecified", DeveloperBillingLaunchModeAndroid.Unspecified.rawValue)
        assertEquals("launch-in-external-browser-or-app", DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp.rawValue)
        assertEquals("caller-will-launch-link", DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink.rawValue)
    }

    @Test
    fun testDeveloperBillingOptionParamsAndroid() {
        val params = DeveloperBillingOptionParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalPayments,
            launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            linkUri = "https://example.com/checkout"
        )

        assertEquals(BillingProgramAndroid.ExternalPayments, params.billingProgram)
        assertEquals(DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp, params.launchMode)
        assertEquals("https://example.com/checkout", params.linkUri)
    }

    @Test
    fun testDeveloperBillingOptionParamsAndroidWithCallerWillLaunch() {
        val params = DeveloperBillingOptionParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalPayments,
            launchMode = DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink,
            linkUri = "https://example.com/payment"
        )

        assertEquals(BillingProgramAndroid.ExternalPayments, params.billingProgram)
        assertEquals(DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink, params.launchMode)
        assertEquals("https://example.com/payment", params.linkUri)
    }

    @Test
    fun testDeveloperProvidedBillingDetailsAndroid() {
        val details = DeveloperProvidedBillingDetailsAndroid(
            externalTransactionToken = "ext_txn_token_12345"
        )

        assertEquals("ext_txn_token_12345", details.externalTransactionToken)
    }

    @Test
    fun testRequestPurchaseAndroidPropsWithDeveloperBillingOption() {
        val developerBillingOption = DeveloperBillingOptionParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalPayments,
            launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            linkUri = "https://example.com/checkout"
        )

        val props = RequestPurchaseAndroidProps(
            skus = listOf("premium_product"),
            developerBillingOption = developerBillingOption
        )

        assertEquals(listOf("premium_product"), props.skus)
        assertNotNull(props.developerBillingOption)
        assertEquals(BillingProgramAndroid.ExternalPayments, props.developerBillingOption?.billingProgram)
        assertEquals("https://example.com/checkout", props.developerBillingOption?.linkUri)
    }

    @Test
    fun testRequestSubscriptionAndroidPropsWithDeveloperBillingOption() {
        val developerBillingOption = DeveloperBillingOptionParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalPayments,
            launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            linkUri = "https://example.com/subscribe"
        )

        val props = RequestSubscriptionAndroidProps(
            skus = listOf("monthly_subscription"),
            subscriptionOffers = listOf(
                AndroidSubscriptionOfferInput(
                    sku = "monthly_subscription",
                    offerToken = "offer_token_abc"
                )
            ),
            developerBillingOption = developerBillingOption
        )

        assertEquals(listOf("monthly_subscription"), props.skus)
        assertNotNull(props.developerBillingOption)
        assertEquals(BillingProgramAndroid.ExternalPayments, props.developerBillingOption?.billingProgram)
        assertEquals("https://example.com/subscribe", props.developerBillingOption?.linkUri)
    }

    @Test
    fun testRequestPurchasePropsByPlatformsWithExternalPayments() {
        val props = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(
                skus = listOf("premium_upgrade"),
                developerBillingOption = DeveloperBillingOptionParamsAndroid(
                    billingProgram = BillingProgramAndroid.ExternalPayments,
                    launchMode = DeveloperBillingLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                    linkUri = "https://example.com/checkout"
                )
            )
        )

        assertNotNull(props.google)
        assertNotNull(props.google?.developerBillingOption)
        assertEquals(BillingProgramAndroid.ExternalPayments, props.google?.developerBillingOption?.billingProgram)
    }

    // =========================================================================
    // ExternalPurchaseCustomLink API Tests (iOS 18.1+)
    // =========================================================================

    @Test
    fun testExternalPurchaseCustomLinkNoticeTypeIOSEnum() {
        val noticeType = ExternalPurchaseCustomLinkNoticeTypeIOS.Browser
        assertEquals("browser", noticeType.rawValue)
        assertEquals(noticeType.toJson(), "browser")
    }

    @Test
    fun testExternalPurchaseCustomLinkNoticeTypeIOSFromJson() {
        assertEquals(
            ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
            ExternalPurchaseCustomLinkNoticeTypeIOS.fromJson("browser")
        )
        assertEquals(
            ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
            ExternalPurchaseCustomLinkNoticeTypeIOS.fromJson("BROWSER")
        )
        assertEquals(
            ExternalPurchaseCustomLinkNoticeTypeIOS.Browser,
            ExternalPurchaseCustomLinkNoticeTypeIOS.fromJson("Browser")
        )
    }

    @Test
    fun testExternalPurchaseCustomLinkTokenTypeIOSEnum() {
        assertEquals("acquisition", ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition.rawValue)
        assertEquals("services", ExternalPurchaseCustomLinkTokenTypeIOS.Services.rawValue)
    }

    @Test
    fun testExternalPurchaseCustomLinkTokenTypeIOSFromJson() {
        assertEquals(
            ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
            ExternalPurchaseCustomLinkTokenTypeIOS.fromJson("acquisition")
        )
        assertEquals(
            ExternalPurchaseCustomLinkTokenTypeIOS.Acquisition,
            ExternalPurchaseCustomLinkTokenTypeIOS.fromJson("ACQUISITION")
        )
        assertEquals(
            ExternalPurchaseCustomLinkTokenTypeIOS.Services,
            ExternalPurchaseCustomLinkTokenTypeIOS.fromJson("services")
        )
        assertEquals(
            ExternalPurchaseCustomLinkTokenTypeIOS.Services,
            ExternalPurchaseCustomLinkTokenTypeIOS.fromJson("SERVICES")
        )
    }

    @Test
    fun testExternalPurchaseCustomLinkNoticeResultIOSCreation() {
        val result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued = true,
            error = null
        )

        assertTrue(result.continued)
        assertNull(result.error)
    }

    @Test
    fun testExternalPurchaseCustomLinkNoticeResultIOSWithError() {
        val result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued = false,
            error = "User dismissed the notice"
        )

        assertEquals(false, result.continued)
        assertEquals("User dismissed the notice", result.error)
    }

    @Test
    fun testExternalPurchaseCustomLinkNoticeResultIOSFromJson() {
        val json = mapOf(
            "continued" to true,
            "error" to null
        )

        val result = ExternalPurchaseCustomLinkNoticeResultIOS.fromJson(json)
        assertTrue(result.continued)
        assertNull(result.error)
    }

    @Test
    fun testExternalPurchaseCustomLinkNoticeResultIOSToJson() {
        val result = ExternalPurchaseCustomLinkNoticeResultIOS(
            continued = true,
            error = "test error"
        )

        val json = result.toJson()
        assertEquals(true, json["continued"])
        assertEquals("test error", json["error"])
    }

    @Test
    fun testExternalPurchaseCustomLinkTokenResultIOSCreation() {
        val result = ExternalPurchaseCustomLinkTokenResultIOS(
            token = "external_purchase_token_abc123",
            error = null
        )

        assertEquals("external_purchase_token_abc123", result.token)
        assertNull(result.error)
    }

    @Test
    fun testExternalPurchaseCustomLinkTokenResultIOSWithError() {
        val result = ExternalPurchaseCustomLinkTokenResultIOS(
            token = null,
            error = "Not eligible for external purchase"
        )

        assertNull(result.token)
        assertEquals("Not eligible for external purchase", result.error)
    }

    @Test
    fun testExternalPurchaseCustomLinkTokenResultIOSFromJson() {
        val json = mapOf(
            "token" to "token_xyz",
            "error" to null
        )

        val result = ExternalPurchaseCustomLinkTokenResultIOS.fromJson(json)
        assertEquals("token_xyz", result.token)
        assertNull(result.error)
    }

    @Test
    fun testExternalPurchaseCustomLinkTokenResultIOSToJson() {
        val result = ExternalPurchaseCustomLinkTokenResultIOS(
            token = "my_token",
            error = null
        )

        val json = result.toJson()
        assertEquals("my_token", json["token"])
        assertNull(json["error"])
    }
}
