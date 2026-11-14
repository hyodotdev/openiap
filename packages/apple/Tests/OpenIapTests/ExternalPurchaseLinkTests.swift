import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class ExternalPurchaseLinkTests: XCTestCase {
    private let request = ExternalPurchaseLinkRequest(url: "https://example.com/checkout")

    func testUnavailableShowsNoDisclosure() async throws {
        let module = FakeExternalLinkModule()

        let available = try await module.isExternalPurchaseLinkAvailable()
        let result = try await module.openExternalPurchaseLink(request)

        XCTAssertFalse(available)
        XCTAssertEqual(result.status, .unavailable)
        XCTAssertNil(result.reportToken)
        XCTAssertEqual(module.calls, [])
    }

    #if os(macOS)
    func testStoreKitModuleIsUnavailableOnMacOS() async throws {
        let module = OpenIapStoreKitModule()

        let available = try await module.isExternalPurchaseLinkAvailable()
        let result = try await module.openExternalPurchaseLink(request)

        XCTAssertFalse(available)
        XCTAssertEqual(result.status, .unavailable)
    }
    #endif

    @MainActor
    func testStoreForwardsToItsModule() async throws {
        let module = FakeExternalLinkModule(customLinkEligible: true, noticeContinues: true)
        let store = OpenIapStore(module: module)

        let available = try await store.isExternalPurchaseLinkAvailable()
        let result = try await store.openExternalPurchaseLink(request)

        XCTAssertTrue(available)
        XCTAssertEqual(result.status, .opened)
        XCTAssertEqual(module.calls, ["notice", "token:acquisition", "open:https://example.com/checkout"])
    }

    func testUnsupportedProviderIsUnavailable() async throws {
        let module = FakeExternalLinkModule(unsupported: true)

        let result = try await module.openExternalPurchaseLink(request)

        XCTAssertEqual(result.status, .unavailable)
        XCTAssertEqual(module.calls, [])
    }

    func testCancelledCustomLinkNoticeOpensNothing() async throws {
        let module = FakeExternalLinkModule(customLinkEligible: true, noticeContinues: false)

        let result = try await module.openExternalPurchaseLink(request)

        XCTAssertEqual(result.status, .cancelled)
        XCTAssertNil(result.reportToken)
        XCTAssertEqual(module.calls, ["notice"])
    }

    func testCustomLinkReturnsTokenAfterNoticeContinues() async throws {
        let module = FakeExternalLinkModule(customLinkEligible: true, noticeContinues: true)
        let props = ExternalPurchaseLinkRequest(
            apple: ExternalPurchaseLinkIosProps(tokenType: .linkOut),
            url: "https://example.com/checkout"
        )

        let result = try await module.openExternalPurchaseLink(props)

        XCTAssertEqual(result.status, .opened)
        XCTAssertEqual(result.platform, .ios)
        XCTAssertEqual(result.reportToken, "custom-token")
        XCTAssertEqual(module.calls, ["notice", "token:link-out", "open:https://example.com/checkout"])
    }

    func testCancelledNoticeSheetOpensNothing() async throws {
        let module = FakeExternalLinkModule(noticeSheetAvailable: true, noticeContinues: false)

        let result = try await module.openExternalPurchaseLink(request)

        XCTAssertEqual(result.status, .cancelled)
        XCTAssertEqual(module.calls, ["sheet"])
    }

    func testNoticeSheetReturnsTokenAfterContinue() async throws {
        let module = FakeExternalLinkModule(noticeSheetAvailable: true, noticeContinues: true)

        let result = try await module.openExternalPurchaseLink(request)

        XCTAssertEqual(result.status, .opened)
        XCTAssertEqual(result.reportToken, "sheet-token")
        XCTAssertEqual(module.calls, ["sheet", "open:https://example.com/checkout"])
    }

    func testMissingTokenThrowsBeforeOpening() async throws {
        let module = FakeExternalLinkModule(customLinkEligible: true, noticeContinues: true, tokenValue: nil)

        do {
            _ = try await module.openExternalPurchaseLink(request)
            XCTFail("Expected a service error")
        } catch let error as PurchaseError {
            XCTAssertEqual(error.code, .serviceError)
        }
        XCTAssertEqual(module.calls, ["notice", "token:acquisition"])
    }
}

@available(iOS 15.0, macOS 14.0, *)
private final class FakeExternalLinkModule: OpenIapModuleProtocol {
    private let unsupported: Bool
    private let customLinkEligible: Bool
    private let noticeSheetAvailable: Bool
    private let noticeContinues: Bool
    private let tokenValue: String?
    private(set) var calls: [String] = []

    init(
        unsupported: Bool = false,
        customLinkEligible: Bool = false,
        noticeSheetAvailable: Bool = false,
        noticeContinues: Bool = false,
        tokenValue: String? = "custom-token"
    ) {
        self.unsupported = unsupported
        self.customLinkEligible = customLinkEligible
        self.noticeSheetAvailable = noticeSheetAvailable
        self.noticeContinues = noticeContinues
        self.tokenValue = tokenValue
    }

    // MARK: - External purchase primitives
    func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool {
        if unsupported { throw PurchaseError(code: .featureNotSupported, message: "unsupported") }
        return customLinkEligible
    }
    func canPresentExternalPurchaseNoticeIOS() async throws -> Bool {
        if unsupported { throw PurchaseError(code: .featureNotSupported, message: "unsupported") }
        return noticeSheetAvailable
    }
    func showExternalPurchaseCustomLinkNoticeIOS(
        _ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS
    ) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS {
        calls.append("notice")
        return ExternalPurchaseCustomLinkNoticeResultIOS(continued: noticeContinues)
    }
    func getExternalPurchaseCustomLinkTokenIOS(
        _ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS
    ) async throws -> ExternalPurchaseCustomLinkTokenResultIOS {
        calls.append("token:\(tokenType.rawValue)")
        return ExternalPurchaseCustomLinkTokenResultIOS(token: tokenValue)
    }
    func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS {
        calls.append("sheet")
        return noticeContinues
            ? ExternalPurchaseNoticeResultIOS(externalPurchaseToken: "sheet-token", result: .continue)
            : ExternalPurchaseNoticeResultIOS(result: .dismissed)
    }
    func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS {
        calls.append("open:\(url)")
        return ExternalPurchaseLinkResultIOS(success: true)
    }

    // MARK: - Unused
    func initConnection() async throws -> Bool { true }
    func endConnection() async throws -> Bool { true }
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult { .products(nil) }
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? { nil }
    func restorePurchases() async throws -> Void {}
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] { [] }
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void {}
    func getReceiptDataIOS() async throws -> String? { nil }
    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        throw PurchaseError(code: .featureNotSupported, message: "unused")
    }
    func getStorefront() async throws -> String { "DEU" }
    func getAppTransactionIOS() async throws -> AppTransaction? { nil }
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] { [] }
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool { false }
    func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS] { [] }
    func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool { false }
    func beginRefundRequestIOS(sku: String) async throws -> String? { nil }
    func syncIOS() async throws -> Bool { true }
    func openRedeemOfferCode() async throws -> PurchaseIOS? { nil }
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] { [] }
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void {}
    func purchaseUpdatedListener(
        _ listener: @escaping PurchaseUpdatedListener,
        options: PurchaseUpdatedListenerOptions?
    ) -> Subscription { Subscription(eventType: .purchaseUpdated) }
    func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        Subscription(eventType: .purchaseError)
    }
    func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription {
        Subscription(eventType: .promotedProductIos)
    }
    func subscriptionBillingIssueListener(_ listener: @escaping SubscriptionBillingIssueListener) -> Subscription {
        Subscription(eventType: .subscriptionBillingIssue)
    }
    func removeListener(_ subscription: Subscription) {}
    func removeAllListeners() {}
}
