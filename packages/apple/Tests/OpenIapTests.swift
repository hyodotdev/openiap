import XCTest
@testable import OpenIAP

final class OpenIapTests: XCTestCase {

    func testProductIOS() {
        let product = makeSampleProduct()
        XCTAssertEqual(product.id, "dev.hyo.premium")
        XCTAssertEqual(product.platform, .ios)
        XCTAssertEqual(product.price, 9.99)
        XCTAssertEqual(product.subscriptionInfoIOS?.subscriptionGroupId, "group")
    }

    func testPurchaseIOS() {
        let purchase = makeSamplePurchase()
        XCTAssertEqual(purchase.productId, "dev.hyo.premium")
        XCTAssertEqual(purchase.platform, .ios)
        XCTAssertEqual(purchase.purchaseState, .purchased)
    }

    func testPurchaseErrorStruct() {
        let error = PurchaseError(code: .skuNotFound, message: "Not found", productId: "sku")
        XCTAssertEqual(error.code, .skuNotFound)
        XCTAssertEqual(error.message, "Not found")
        XCTAssertEqual(error.productId, "sku")
    }

    func testProductRequestEncoding() throws {
        let request = ProductRequest(skus: ["sku1", "sku2"], type: .inApp)
        let data = try JSONEncoder().encode(request)
        let decoded = try JSONDecoder().decode(ProductRequest.self, from: data)
        XCTAssertEqual(decoded.skus.count, 2)
        XCTAssertEqual(decoded.type, .inApp)
    }

    func testPurchaseErrorDefaultMessage() {
        XCTAssertEqual(PurchaseError.defaultMessage(for: .skuNotFound), "SKU not found")
        XCTAssertEqual(PurchaseError.defaultMessage(for: "billing-unavailable"), "Billing unavailable")
        XCTAssertEqual(PurchaseError.defaultMessage(for: "unknown-code"), "Unknown error occurred")
    }

    func testPurchaseErrorMakeProvidesDefaultMessage() {
        let error = PurchaseError.make(code: .userCancelled, productId: "sku", message: nil)
        XCTAssertEqual(error.message, "User cancelled the purchase flow")
    }

    func testPurchaseIOSWithRenewalInfo() {
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "dev.hyo.premium_year",
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: "dev.hyo.premium_year",
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: false
        )

        let purchase = PurchaseIOS(
            appAccountToken: nil,
            appBundleIdIOS: "dev.hyo.app",
            countryCodeIOS: "US",
            currencyCodeIOS: "USD",
            currencySymbolIOS: "$",
            environmentIOS: "Sandbox",
            expirationDateIOS: 1729087555000,
            id: "2000001034753679",
            ids: nil,
            isAutoRenewing: false,
            isUpgradedIOS: false,
            offerIOS: nil,
            originalTransactionDateIOS: 1729083955000,
            originalTransactionIdentifierIOS: "2000001034753679",
            ownershipTypeIOS: "purchased",
            platform: .ios,
            productId: "dev.hyo.martie.premium",
            purchaseState: .purchased,
            purchaseToken: "jws_token",
            quantity: 1,
            quantityIOS: 1,
            reasonIOS: "purchase",
            reasonStringRepresentationIOS: "purchase",
            renewalInfoIOS: renewalInfo,
            revocationDateIOS: nil,
            revocationReasonIOS: nil,
            storefrontCountryCodeIOS: "US",
            subscriptionGroupIdIOS: "21686373",
            transactionDate: 1729083955000,
            transactionId: "2000001034753679",
            transactionReasonIOS: "PURCHASE",
            webOrderLineItemIdIOS: nil
        )

        XCTAssertNotNil(purchase.renewalInfoIOS)
        XCTAssertEqual(purchase.renewalInfoIOS?.willAutoRenew, false)
        XCTAssertEqual(purchase.renewalInfoIOS?.autoRenewPreference, "dev.hyo.premium_year")
        XCTAssertEqual(purchase.renewalInfoIOS?.pendingUpgradeProductId, "dev.hyo.premium_year")
        XCTAssertEqual(purchase.renewalInfoIOS?.renewalDate, 1729087555000)
    }

    func testPurchaseIOSSerializationWithRenewalInfo() throws {
        let renewalInfo = RenewalInfoIOS(
            autoRenewPreference: "dev.hyo.premium_year",
            expirationReason: nil,
            gracePeriodExpirationDate: nil,
            isInBillingRetry: nil,
            jsonRepresentation: nil,
            pendingUpgradeProductId: "dev.hyo.premium_year",
            priceIncreaseStatus: nil,
            renewalDate: 1729087555000,
            renewalOfferId: nil,
            renewalOfferType: nil,
            willAutoRenew: false
        )

        let purchase = makeSamplePurchaseWithRenewalInfo(renewalInfo)

        // Test encoding to dictionary
        let dictionary = OpenIapSerialization.encode(purchase)
        XCTAssertNotNil(dictionary["renewalInfoIOS"] as Any?)

        if let renewalDict = dictionary["renewalInfoIOS"] as? [String: Any] {
            XCTAssertEqual(renewalDict["willAutoRenew"] as? Bool, false)
            XCTAssertEqual(renewalDict["autoRenewPreference"] as? String, "dev.hyo.premium_year")
            XCTAssertEqual(renewalDict["pendingUpgradeProductId"] as? String, "dev.hyo.premium_year")
            XCTAssertEqual(renewalDict["renewalDate"] as? Double, 1729087555000)
        } else {
            XCTFail("renewalInfoIOS should be a dictionary")
        }

        // Test round-trip encoding/decoding
        let data = try JSONEncoder().encode(purchase)
        let decoded = try JSONDecoder().decode(PurchaseIOS.self, from: data)
        XCTAssertNotNil(decoded.renewalInfoIOS)
        XCTAssertEqual(decoded.renewalInfoIOS?.willAutoRenew, false)
        XCTAssertEqual(decoded.renewalInfoIOS?.pendingUpgradeProductId, "dev.hyo.premium_year")
    }

    func testProductSubscriptionIOSPaymentModeSerialization() throws {
        let product = makeSampleSubscription()

        // Test encoding to dictionary
        let dictionary = OpenIapSerialization.encode(product)

        // Verify introductoryPricePaymentModeIOS is encoded as raw value string
        XCTAssertNotNil(dictionary["introductoryPricePaymentModeIOS"])
        XCTAssertEqual(dictionary["introductoryPricePaymentModeIOS"] as? String, "free-trial",
            "introductoryPricePaymentModeIOS should be encoded as 'free-trial' (raw value), not 'freeTrial' (enum case name)")

        // Test round-trip encoding/decoding
        let data = try JSONEncoder().encode(product)
        let decoded = try JSONDecoder().decode(ProductSubscriptionIOS.self, from: data)

        XCTAssertEqual(decoded.introductoryPricePaymentModeIOS, .freeTrial)

        // Verify JSON string contains the raw value
        let jsonString = String(data: data, encoding: .utf8)!
        XCTAssertTrue(jsonString.contains("\"free-trial\""),
            "JSON should contain 'free-trial' (raw value), not 'freeTrial' (case name)")
        XCTAssertFalse(jsonString.contains("\"freeTrial\""),
            "JSON should not contain 'freeTrial' (case name)")
    }

    func testProductSubscriptionIOSPeriodNormalization() throws {
        // Test 1: 14-day trial (periodCount = 1) should be normalized to 2 weeks
        let product14Days = ProductSubscriptionIOS(
            currency: "USD",
            debugDescription: "Test",
            description: "Test subscription with 14-day trial",
            discountsIOS: nil,
            displayName: "Test",
            displayNameIOS: "Test",
            displayPrice: "$9.99",
            id: "test.14days",
            introductoryPriceAsAmountIOS: "0",
            introductoryPriceIOS: "$0.00",
            introductoryPriceNumberOfPeriodsIOS: "2",  // 14 days / 7 = 2 weeks, * 1 periodCount = 2
            introductoryPricePaymentModeIOS: .freeTrial,
            introductoryPriceSubscriptionPeriodIOS: .week,  // Should be week
            isFamilyShareableIOS: false,
            jsonRepresentationIOS: "{}",
            platform: .ios,
            price: 9.99,
            subscriptionInfoIOS: nil,
            subscriptionPeriodNumberIOS: "1",
            subscriptionPeriodUnitIOS: .month,
            title: "Test",
            type: .subs,
            typeIOS: .autoRenewableSubscription
        )

        XCTAssertEqual(product14Days.introductoryPriceNumberOfPeriodsIOS, "2",
            "14 days (periodCount=1) should be normalized to 2 weeks")
        XCTAssertEqual(product14Days.introductoryPriceSubscriptionPeriodIOS, .week,
            "14 days should use 'week' as the unit")

        // Test 2: Pay-as-you-go: $0.99/month for 3 months (periodCount = 3)
        let productPayAsYouGo = ProductSubscriptionIOS(
            currency: "USD",
            debugDescription: "Test",
            description: "Test subscription with pay-as-you-go",
            discountsIOS: nil,
            displayName: "Test",
            displayNameIOS: "Test",
            displayPrice: "$9.99",
            id: "test.payasyougo",
            introductoryPriceAsAmountIOS: "0.99",
            introductoryPriceIOS: "$0.99",
            introductoryPriceNumberOfPeriodsIOS: "3",  // 1 month * 3 periodCount = 3
            introductoryPricePaymentModeIOS: .payAsYouGo,
            introductoryPriceSubscriptionPeriodIOS: .month,
            isFamilyShareableIOS: false,
            jsonRepresentationIOS: "{}",
            platform: .ios,
            price: 9.99,
            subscriptionInfoIOS: nil,
            subscriptionPeriodNumberIOS: "1",
            subscriptionPeriodUnitIOS: .month,
            title: "Test",
            type: .subs,
            typeIOS: .autoRenewableSubscription
        )

        XCTAssertEqual(productPayAsYouGo.introductoryPriceNumberOfPeriodsIOS, "3",
            "Pay-as-you-go: 1 month * 3 periodCount should equal 3 total periods")
        XCTAssertEqual(productPayAsYouGo.introductoryPriceSubscriptionPeriodIOS, .month,
            "Pay-as-you-go should preserve month unit")

        // Test encoding
        let dictionary14Days = OpenIapSerialization.encode(product14Days)
        XCTAssertEqual(dictionary14Days["introductoryPriceNumberOfPeriodsIOS"] as? String, "2")
        XCTAssertEqual(dictionary14Days["introductoryPriceSubscriptionPeriodIOS"] as? String, "week")

        let dictionaryPayAsYouGo = OpenIapSerialization.encode(productPayAsYouGo)
        XCTAssertEqual(dictionaryPayAsYouGo["introductoryPriceNumberOfPeriodsIOS"] as? String, "3")
        XCTAssertEqual(dictionaryPayAsYouGo["introductoryPriceSubscriptionPeriodIOS"] as? String, "month")
    }

    func testErrorCodeKebabCaseInitialization() {
        // Test kebab-case initialization (standard)
        XCTAssertEqual(ErrorCode(rawValue: "already-owned"), .alreadyOwned)
        XCTAssertEqual(ErrorCode(rawValue: "user-cancelled"), .userCancelled)
        XCTAssertEqual(ErrorCode(rawValue: "item-not-owned"), .itemNotOwned)
        XCTAssertEqual(ErrorCode(rawValue: "billing-unavailable"), .billingUnavailable)
        XCTAssertEqual(ErrorCode(rawValue: "sku-not-found"), .skuNotFound)
    }

    func testErrorCodeCamelCaseInitialization() {
        // Test camelCase initialization (react-native-iap compatibility)
        XCTAssertEqual(ErrorCode(rawValue: "AlreadyOwned"), .alreadyOwned)
        XCTAssertEqual(ErrorCode(rawValue: "UserCancelled"), .userCancelled)
        XCTAssertEqual(ErrorCode(rawValue: "ItemNotOwned"), .itemNotOwned)
        XCTAssertEqual(ErrorCode(rawValue: "BillingUnavailable"), .billingUnavailable)
        XCTAssertEqual(ErrorCode(rawValue: "SkuNotFound"), .skuNotFound)
    }

    func testErrorCodeAllCasesWithBothFormats() throws {
        // Test all error codes can be initialized with both formats
        let testCases: [(kebab: String, camel: String, expected: ErrorCode)] = [
            ("unknown", "Unknown", .unknown),
            ("user-cancelled", "UserCancelled", .userCancelled),
            ("user-error", "UserError", .userError),
            ("item-unavailable", "ItemUnavailable", .itemUnavailable),
            ("remote-error", "RemoteError", .remoteError),
            ("network-error", "NetworkError", .networkError),
            ("service-error", "ServiceError", .serviceError),
            ("receipt-failed", "ReceiptFailed", .receiptFailed),
            ("not-prepared", "NotPrepared", .notPrepared),
            ("already-owned", "AlreadyOwned", .alreadyOwned),
            ("developer-error", "DeveloperError", .developerError),
            ("deferred-payment", "DeferredPayment", .deferredPayment),
            ("purchase-error", "PurchaseError", .purchaseError),
            ("sku-not-found", "SkuNotFound", .skuNotFound),
            ("item-not-owned", "ItemNotOwned", .itemNotOwned),
            ("billing-unavailable", "BillingUnavailable", .billingUnavailable),
        ]

        for (kebab, camel, expected) in testCases {
            XCTAssertEqual(ErrorCode(rawValue: kebab), expected,
                "kebab-case '\(kebab)' should map to \(expected)")
            XCTAssertEqual(ErrorCode(rawValue: camel), expected,
                "camelCase '\(camel)' should map to \(expected)")
        }
    }

    func testErrorCodeInvalidValue() {
        // Test that invalid error codes return nil
        XCTAssertNil(ErrorCode(rawValue: "invalid-error"))
        XCTAssertNil(ErrorCode(rawValue: "InvalidError"))
        XCTAssertNil(ErrorCode(rawValue: "nonexistent"))
    }

    func testErrorCodeJSONDecoding() throws {
        // Test decoding from JSON with camelCase (react-native-iap format)
        let jsonCamel = """
        {
            "code": "AlreadyOwned",
            "message": "Item is already owned"
        }
        """
        let errorCamel = try JSONDecoder().decode(PurchaseError.self, from: jsonCamel.data(using: .utf8)!)
        XCTAssertEqual(errorCamel.code, .alreadyOwned)
        XCTAssertEqual(errorCamel.message, "Item is already owned")

        // Test decoding from JSON with kebab-case (standard format)
        let jsonKebab = """
        {
            "code": "already-owned",
            "message": "Item is already owned"
        }
        """
        let errorKebab = try JSONDecoder().decode(PurchaseError.self, from: jsonKebab.data(using: .utf8)!)
        XCTAssertEqual(errorKebab.code, .alreadyOwned)
        XCTAssertEqual(errorKebab.message, "Item is already owned")
    }

    // MARK: - Helpers

    private func makeSampleProduct() -> ProductIOS {
        let subscriptionPeriod = SubscriptionPeriodValueIOS(unit: .month, value: 1)
        let offer = SubscriptionOfferIOS(
            displayPrice: "$0.00",
            id: "intro",
            paymentMode: .freeTrial,
            period: subscriptionPeriod,
            periodCount: 1,
            price: 0,
            type: .introductory
        )
        let subscriptionInfo = SubscriptionInfoIOS(
            introductoryOffer: offer,
            promotionalOffers: nil,
            subscriptionGroupId: "group",
            subscriptionPeriod: subscriptionPeriod
        )

        return ProductIOS(
            currency: "USD",
            debugDescription: "",
            description: "Premium subscription",
            displayName: "Premium",
            displayNameIOS: "Premium",
            displayPrice: "$9.99",
            id: "dev.hyo.premium",
            isFamilyShareableIOS: true,
            jsonRepresentationIOS: "{}",
            platform: .ios,
            price: 9.99,
            subscriptionInfoIOS: subscriptionInfo,
            title: "Premium",
            type: .subs,
            typeIOS: .autoRenewableSubscription
        )
    }

    private func makeSamplePurchase() -> PurchaseIOS {
        PurchaseIOS(
            appAccountToken: nil,
            appBundleIdIOS: "dev.hyo.app",
            countryCodeIOS: "US",
            currencyCodeIOS: "USD",
            currencySymbolIOS: "$",
            environmentIOS: "Production",
            expirationDateIOS: nil,
            id: "transaction",
            ids: ["transaction"],
            isAutoRenewing: false,
            isUpgradedIOS: false,
            offerIOS: nil,
            originalTransactionDateIOS: 1,
            originalTransactionIdentifierIOS: "origin",
            ownershipTypeIOS: "purchased",
            platform: .ios,
            productId: "dev.hyo.premium",
            purchaseState: .purchased,
            purchaseToken: "token",
            quantity: 1,
            quantityIOS: 1,
            reasonIOS: "purchase",
            reasonStringRepresentationIOS: "purchase",
            renewalInfoIOS: nil,
            revocationDateIOS: nil,
            revocationReasonIOS: nil,
            storefrontCountryCodeIOS: "US",
            subscriptionGroupIdIOS: "group",
            transactionDate: 2,
            transactionId: "transaction",
            transactionReasonIOS: "PURCHASE",
            webOrderLineItemIdIOS: nil
        )
    }

    private func makeSamplePurchaseWithRenewalInfo(_ renewalInfo: RenewalInfoIOS) -> PurchaseIOS {
        PurchaseIOS(
            appAccountToken: nil,
            appBundleIdIOS: "dev.hyo.app",
            countryCodeIOS: "US",
            currencyCodeIOS: "USD",
            currencySymbolIOS: "$",
            environmentIOS: "Sandbox",
            expirationDateIOS: 1729087555000,
            id: "2000001034753679",
            ids: nil,
            isAutoRenewing: false,
            isUpgradedIOS: false,
            offerIOS: nil,
            originalTransactionDateIOS: 1729083955000,
            originalTransactionIdentifierIOS: "2000001034753679",
            ownershipTypeIOS: "purchased",
            platform: .ios,
            productId: "dev.hyo.martie.premium",
            purchaseState: .purchased,
            purchaseToken: "jws_token",
            quantity: 1,
            quantityIOS: 1,
            reasonIOS: "purchase",
            reasonStringRepresentationIOS: "purchase",
            renewalInfoIOS: renewalInfo,
            revocationDateIOS: nil,
            revocationReasonIOS: nil,
            storefrontCountryCodeIOS: "US",
            subscriptionGroupIdIOS: "21686373",
            transactionDate: 1729083955000,
            transactionId: "2000001034753679",
            transactionReasonIOS: "PURCHASE",
            webOrderLineItemIdIOS: nil
        )
    }

    private func makeSampleSubscription() -> ProductSubscriptionIOS {
        let subscriptionPeriod = SubscriptionPeriodValueIOS(unit: .month, value: 1)
        let offer = SubscriptionOfferIOS(
            displayPrice: "$0.00",
            id: "intro",
            paymentMode: .freeTrial,
            period: subscriptionPeriod,
            periodCount: 1,
            price: 0,
            type: .introductory
        )
        let info = SubscriptionInfoIOS(
            introductoryOffer: offer,
            promotionalOffers: nil,
            subscriptionGroupId: "group",
            subscriptionPeriod: subscriptionPeriod
        )

        return ProductSubscriptionIOS(
            currency: "USD",
            debugDescription: "",
            description: "Premium subscription",
            discountsIOS: nil,
            displayName: "Premium",
            displayNameIOS: "Premium",
            displayPrice: "$9.99",
            id: "dev.hyo.premium",
            introductoryPriceAsAmountIOS: "0",
            introductoryPriceIOS: "$0.00",
            introductoryPriceNumberOfPeriodsIOS: "1",
            introductoryPricePaymentModeIOS: .freeTrial,
            introductoryPriceSubscriptionPeriodIOS: .month,
            isFamilyShareableIOS: true,
            jsonRepresentationIOS: "{}",
            platform: .ios,
            price: 9.99,
            subscriptionInfoIOS: info,
            subscriptionPeriodNumberIOS: "1",
            subscriptionPeriodUnitIOS: .month,
            title: "Premium",
            type: .subs,
            typeIOS: .autoRenewableSubscription
        )
    }
}
