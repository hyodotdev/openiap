import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class VerifyPurchaseWithProviderTests: XCTestCase {

    func testIapkitVerificationURLUsesHostedDefaultForNilOrBlankBaseUrl() throws {
        let expectedUrl = "https://kit.openiap.dev/v1/purchase/verify"

        XCTAssertEqual(expectedUrl, try OpenIapModule.iapkitVerificationURL(baseUrl: nil).absoluteString)
        XCTAssertEqual(expectedUrl, try OpenIapModule.iapkitVerificationURL(baseUrl: " \n\t ").absoluteString)
    }

    func testIapkitVerificationURLTrimsOverrideAndTrailingSlashes() throws {
        let url = try OpenIapModule.iapkitVerificationURL(
            baseUrl: "  http://127.0.0.1:4174///\n"
        )

        XCTAssertEqual("http://127.0.0.1:4174/v1/purchase/verify", url.absoluteString)
    }

    func testIapkitVerificationURLRejectsMalformedOverride() {
        let invalidBaseUrls = [
            "localhost:4174",
            "https://user:password@kit.openiap.dev",
            "https://kit.openiap.dev/prefix",
            "https://kit.openiap.dev?environment=local",
            "https://kit.openiap.dev#fragment",
            "http://127.0.0.1:0",
            "http://127.0.0.1:65536",
            "http://127.0.0.1:not-a-port",
        ]

        for invalidBaseUrl in invalidBaseUrls {
            XCTAssertThrowsError(
                try OpenIapModule.iapkitVerificationURL(baseUrl: invalidBaseUrl),
                "Expected \(invalidBaseUrl) to be rejected"
            ) { error in
                guard let purchaseError = error as? PurchaseError else {
                    return XCTFail("Expected PurchaseError, received \(type(of: error))")
                }
                XCTAssertEqual(.developerError, purchaseError.code)
                XCTAssertEqual(
                    "IAPKit baseUrl must be a valid HTTP(S) origin",
                    purchaseError.message
                )
            }
        }
    }

    func testObjCBridgeKeepsPublishedSelectorsAndExposesClientPayloadSelector() {
        let hostedSelector = NSSelectorFromString(
            "verifyPurchaseWithProviderObjCWithProvider:apiKey:jws:completion:"
        )
        let customBaseUrlSelector = NSSelectorFromString(
            "verifyPurchaseWithProviderObjCWithProvider:apiKey:baseUrl:jws:completion:"
        )
        let clientPayloadSelector = NSSelectorFromString(
            "verifyPurchaseWithProviderObjCWithProvider:apiKey:baseUrl:jws:includeClientPayload:completion:"
        )

        XCTAssertTrue(OpenIapModule.shared.responds(to: hostedSelector))
        XCTAssertTrue(OpenIapModule.shared.responds(to: customBaseUrlSelector))
        XCTAssertTrue(OpenIapModule.shared.responds(to: clientPayloadSelector))
    }

    func testIapkitClientPayloadParsesAndDropsUnreadableValues() throws {
        let payload = try XCTUnwrap(
            OpenIapModule.iapkitClientPayload(from: [
                "format": "toml",
                "body": "tier = \"gold\"",
                "version": 2,
                "updatedAt": 1_720_000_000_000,
            ])
        )

        XCTAssertEqual(.toml, payload.format)
        XCTAssertEqual("tier = \"gold\"", payload.body)
        XCTAssertEqual(2, payload.version)
        XCTAssertNil(OpenIapModule.iapkitClientPayload(from: nil))
        XCTAssertNil(OpenIapModule.iapkitClientPayload(from: NSNull()))
        // A format IAPKit adds after this build shipped, and every structural
        // defect, drop the payload instead of failing the verified receipt.
        XCTAssertNil(
            OpenIapModule.iapkitClientPayload(from: [
                "format": "yaml",
                "body": "tier: gold",
                "version": 1,
                "updatedAt": 1,
            ])
        )
        XCTAssertNil(
            OpenIapModule.iapkitClientPayload(from: [
                "format": "TOML",
                "body": "invalid format",
                "version": 1,
                "updatedAt": 1,
            ])
        )
        XCTAssertNil(
            OpenIapModule.iapkitClientPayload(from: [
                "format": "toml",
                "body": "missing version",
                "updatedAt": 1,
            ])
        )
        for invalidVersion: Any in [true, 0, 1.5] {
            XCTAssertNil(
                OpenIapModule.iapkitClientPayload(from: [
                    "format": "toml",
                    "body": "invalid version",
                    "version": invalidVersion,
                    "updatedAt": 1,
                ])
            )
        }
        XCTAssertNil(
            OpenIapModule.iapkitClientPayload(from: [
                "format": "toml",
                "body": "invalid timestamp",
                "version": 1,
                "updatedAt": -1,
            ])
        )
    }

    func testIapkitBooleanRejectsNumericJsonValues() throws {
        XCTAssertTrue(try OpenIapModule.iapkitBoolean(from: true))
        XCTAssertFalse(try OpenIapModule.iapkitBoolean(from: false))

        for invalidValue: Any? in [nil, NSNull(), 0, 1, "true"] {
            XCTAssertThrowsError(
                try OpenIapModule.iapkitBoolean(from: invalidValue)
            )
        }
    }

    func testIapkitEnvironmentForwardsAnyStringAndNeverFails() throws {
        XCTAssertNil(OpenIapModule.iapkitEnvironment(from: nil))
        XCTAssertNil(OpenIapModule.iapkitEnvironment(from: NSNull()))
        XCTAssertEqual("Sandbox", OpenIapModule.iapkitEnvironment(from: "Sandbox"))
        XCTAssertEqual("Production", OpenIapModule.iapkitEnvironment(from: "Production"))

        // The spec types `environment` as String, so a value IAPKit adds later
        // is forwarded rather than dropped. "Xcode" and "LocalTesting" are real
        // App Store Server environments.
        for forwarded in ["sandbox", "Xcode", "LocalTesting", "Staging"] {
            XCTAssertEqual(forwarded, OpenIapModule.iapkitEnvironment(from: forwarded))
        }

        // Only a non-string, or an empty string, has nothing to forward.
        for unreadableValue: Any in ["", 1, true, [:], []] {
            XCTAssertNil(OpenIapModule.iapkitEnvironment(from: unreadableValue))
        }
    }

    func testIapkitRequestReportsTheSpecItWasBuiltAgainst() throws {
        let url = try XCTUnwrap(URL(string: "https://kit.openiap.dev/v1/purchase/verify"))
        let request = OpenIapModule.makeIapkitRequest(
            url: url,
            apiKey: "  iapkit_pk_test  ",
            body: Data("{}".utf8)
        )

        XCTAssertEqual("POST", request.httpMethod)
        XCTAssertEqual("application/json", request.value(forHTTPHeaderField: "Content-Type"))
        XCTAssertEqual("Bearer iapkit_pk_test", request.value(forHTTPHeaderField: "Authorization"))
        // The header is present exactly when the version resolves, and carries a
        // semver when it does. It cannot be asserted unconditionally: SwiftPM
        // copies `Sources/openiap-versions.json` as the symlink it is, which
        // dangles inside the built bundle, so `Bundle.module` finds nothing
        // under `swift test`. That is why the accessor is optional and the
        // header is omitted rather than trapping.
        let header = request.value(forHTTPHeaderField: "X-OpenIAP-Spec")
        XCTAssertEqual(OpenIapVersion.specVersionIfAvailable, header)
        if let header {
            XCTAssertNotNil(
                header.range(of: #"^\d+\.\d+\.\d+"#, options: .regularExpression),
                "X-OpenIAP-Spec must carry a semver, got \(header)"
            )
        }
        XCTAssertEqual(Data("{}".utf8), request.httpBody)
    }

    func testIapkitRequestOmitsAuthorizationForABlankApiKey() throws {
        let url = try XCTUnwrap(URL(string: "https://kit.openiap.dev/v1/purchase/verify"))

        for blank in [nil, "", "   "] as [String?] {
            let request = OpenIapModule.makeIapkitRequest(
                url: url,
                apiKey: blank,
                body: Data()
            )
            XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        }
    }

    func testIapkitAmazonPayloadForwardsExpectedProductId() throws {
        let payload = try OpenIapModule.iapkitAmazonPayload(
            from: RequestVerifyPurchaseWithIapkitAmazonProps(
                expectedProductId: "premium.monthly",
                receiptId: "  amzn1.receipt.ABC123456789  ",
                sandbox: true,
                userId: "  amzn1.account.ABC123  "
            ),
            includeClientPayload: false
        )

        XCTAssertEqual(.amazon, payload.store)
        XCTAssertEqual("premium.monthly", payload.expectedProductId)
        XCTAssertEqual("amzn1.receipt.ABC123456789", payload.receiptId)
        XCTAssertEqual(true, payload.sandbox)
        XCTAssertEqual("amzn1.account.ABC123", payload.userId)
        XCTAssertEqual(false, payload.includeClientPayload)

        let encoded = try JSONEncoder().encode(payload)
        let body = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encoded) as? [String: Any]
        )
        XCTAssertEqual("premium.monthly", body["expectedProductId"] as? String)
    }

    @MainActor
    func testStoreReturnsIapkitResult() async throws {
        let iapkitResult = RequestVerifyPurchaseWithIapkitResult(
            clientPayload: IapkitProductClientPayload(
                body: "tier = \"gold\"",
                format: .toml,
                updatedAt: 1_720_000_000_000,
                version: 2
            ),
            isValid: true,
            productId: "premium.monthly",
            state: .entitled,
            store: .apple
        )
        let module = FakeVerifyPurchaseModule(
            validateResult: VerifyPurchaseResult.verifyPurchaseResultIos(
                VerifyPurchaseResultIOS(
                    isValid: true,
                    jwsRepresentation: "",
                    latestTransaction: nil,
                    receiptData: ""
                )
            ),
            providerResult: VerifyPurchaseWithProviderResult(
                iapkit: iapkitResult,
                provider: .iapkit
            )
        )
        let store = OpenIapStore(module: module)
        let props = VerifyPurchaseWithProviderProps(
            iapkit: RequestVerifyPurchaseWithIapkitProps(
                apiKey: "secret",
                apple: RequestVerifyPurchaseWithIapkitAppleProps(
                    jws: "jws-token"
                ),
                google: nil
            ),
            provider: .iapkit
        )

        let result = try await store.verifyPurchaseWithProvider(props)

        XCTAssertNotNil(result)
        XCTAssertEqual(IapStore.apple, result?.store)
        XCTAssertEqual(true, result?.isValid)
        XCTAssertEqual("premium.monthly", result?.productId)
        XCTAssertEqual("tier = \"gold\"", result?.clientPayload?.body)
        XCTAssertEqual(.entitled, result?.state)
    }

    @MainActor
    func testStoreReturnsNilWhenProviderResultIsNil() async throws {
        let module = FakeVerifyPurchaseModule(
            validateResult: VerifyPurchaseResult.verifyPurchaseResultIos(
                VerifyPurchaseResultIOS(
                    isValid: false,
                    jwsRepresentation: "",
                    latestTransaction: nil,
                    receiptData: ""
                )
            ),
            providerResult: VerifyPurchaseWithProviderResult(
                iapkit: nil,
                provider: .iapkit
            )
        )
        let store = OpenIapStore(module: module)
        let props = VerifyPurchaseWithProviderProps(
            iapkit: RequestVerifyPurchaseWithIapkitProps(
                apiKey: nil,
                apple: RequestVerifyPurchaseWithIapkitAppleProps(
                    jws: "jws-token"
                ),
                google: nil
            ),
            provider: .iapkit
        )

        let result = try await store.verifyPurchaseWithProvider(props)

        XCTAssertNil(result)
    }
}

@available(iOS 15.0, macOS 14.0, *)
private final class FakeVerifyPurchaseModule: OpenIapModuleProtocol {
    private let validateResult: VerifyPurchaseResult
    private let providerResult: VerifyPurchaseWithProviderResult

    init(validateResult: VerifyPurchaseResult, providerResult: VerifyPurchaseWithProviderResult) {
        self.validateResult = validateResult
        self.providerResult = providerResult
    }

    // MARK: - Connection Management
    func initConnection() async throws -> Bool { true }
    func endConnection() async throws -> Bool { true }

    // MARK: - Product Management
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult { .products(nil) }
    func getPromotedProductIOS() async throws -> ProductIOS? { nil }

    // MARK: - Purchase Management
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? { nil }
    func restorePurchases() async throws -> Void { () }
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] { [] }
    func getAllTransactionsIOS() async throws -> [PurchaseIOS] { [] }

    // MARK: - Transaction Management
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void { () }
    func getPendingTransactionsIOS() async throws -> [PurchaseIOS] { [] }
    func clearTransactionIOS() async throws -> Bool { true }
    func isTransactionVerifiedIOS(sku: String) async throws -> Bool { false }
    func getTransactionJwsIOS(sku: String) async throws -> String? { nil }
    func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS? { nil }
    func latestTransactionIOS(sku: String) async throws -> PurchaseIOS? { nil }

    // MARK: - Validation
    func getReceiptDataIOS() async throws -> String? { "receipt" }
    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        validateResult
    }

    func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult {
        providerResult
    }

    // MARK: - Store Information
    func getStorefront() async throws -> String { "US" }
    func getAppTransactionIOS() async throws -> AppTransaction? { nil }

    // MARK: - Subscription Management
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] { [] }
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool { false }
    func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS] { [] }
    func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool { true }

    // MARK: - Refunds (iOS 15+)
    func beginRefundRequestIOS(sku: String) async throws -> String? { nil }

    // MARK: - Misc
    func syncIOS() async throws -> Bool { true }
    func presentCodeRedemptionSheetIOS() async throws -> PurchaseIOS? { nil }
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] { [] }
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void { () }

    // MARK: - Event Listeners
    func purchaseUpdatedListener(
        _ listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions?
    ) -> Subscription {
        Subscription(eventType: .purchaseUpdated)
    }

    func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        Subscription(eventType: .purchaseError)
    }

    func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription {
        Subscription(eventType: .promotedProductIos)
    }

    func subscriptionBillingIssueListener(_ listener: @escaping SubscriptionBillingIssueListener) -> Subscription {
        Subscription(eventType: .subscriptionBillingIssue)
    }

    func removeListener(_ subscription: Subscription) {
        subscription.onRemove?()
    }

    func removeAllListeners() {}
}
