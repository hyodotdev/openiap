import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class VerifyPurchaseTests: XCTestCase {

    @MainActor
    func testVerifyPurchaseReturnsIOSResult() async throws {
        let iosResult = VerifyPurchaseResultIOS(
            isValid: true,
            jwsRepresentation: "jws-token",
            latestTransaction: nil,
            receiptData: "base64-receipt"
        )
        let module = FakeOpenIapModule(validateResult: .verifyPurchaseResultIos(iosResult))
        let store = OpenIapStore(module: module)

        let result = try await store.verifyPurchase(sku: "test.sku")

        XCTAssertTrue(result.isValid)
        XCTAssertEqual("jws-token", result.jwsRepresentation)
        XCTAssertEqual("base64-receipt", result.receiptData)
    }

    @MainActor
    func testVerifyPurchaseThrowsForAndroidVariant() async {
        let androidPayload = VerifyPurchaseResultAndroid(
            autoRenewing: false,
            betaProduct: false,
            cancelDate: nil,
            cancelReason: nil,
            deferredDate: nil,
            deferredSku: nil,
            freeTrialEndDate: 0,
            gracePeriodEndDate: 0,
            parentProductId: "parent",
            productId: "android.sku",
            productType: "subs",
            purchaseDate: 0,
            quantity: 1,
            receiptId: "receipt-123",
            renewalDate: 0,
            term: "P1M",
            termSku: "plan-monthly",
            testTransaction: false
        )
        let module = FakeOpenIapModule(validateResult: .verifyPurchaseResultAndroid(androidPayload))
        let store = OpenIapStore(module: module)

        do {
            _ = try await store.verifyPurchase(sku: "android.sku")
            XCTFail("Expected featureNotSupported when Android result is returned on Apple platform")
        } catch let error as PurchaseError {
            XCTAssertEqual(.featureNotSupported, error.code)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    @MainActor
    func testStorefrontUsesUnifiedProtocolMethod() async throws {
        let iosResult = VerifyPurchaseResultIOS(
            isValid: true,
            jwsRepresentation: "jws-token",
            latestTransaction: nil,
            receiptData: "base64-receipt"
        )
        let module = FakeOpenIapModule(validateResult: .verifyPurchaseResultIos(iosResult))
        let store = OpenIapStore(module: module)

        let storefront = try await store.getStorefront()
        XCTAssertEqual("US", storefront)
        XCTAssertEqual(1, module.getStorefrontCallCount)
    }

    @MainActor
    func testStoreForwardsTransactionAndSubscriptionManagementResults() async throws {
        let purchase = makePurchase(id: "transaction-1")
        let module = FakeOpenIapModule(
            validateResult: .verifyPurchaseResultIos(makeVerifyPurchaseResult()),
            allTransactionsResult: [purchase],
            manageSubscriptionsResult: [purchase],
            presentCodeResult: false,
            clearTransactionResult: false
        )
        let store = OpenIapStore(module: module)

        let allTransactions = try await store.getAllTransactionsIOS()
        XCTAssertEqual(allTransactions.map(\.id), ["transaction-1"])

        let changedTransactions = try await store.showManageSubscriptionsResultIOS()
        XCTAssertEqual(changedTransactions.map(\.id), ["transaction-1"])

        let presentedCodeRedemptionSheet = try await store.presentCodeRedemptionSheetResultIOS()
        let clearedTransactions = try await store.clearTransactionResultIOS()
        XCTAssertFalse(presentedCodeRedemptionSheet)
        XCTAssertFalse(clearedTransactions)

        try await store.showManageSubscriptionsIOS()
        try await store.presentCodeRedemptionSheetIOS()
        try await store.clearTransactionIOS()

        let options = DeepLinkOptions(packageNameAndroid: "dev.hyo.app", skuAndroid: "premium")
        try await store.deepLinkToSubscriptions(options)
        XCTAssertEqual(module.deepLinkCallCount, 1)
        XCTAssertEqual(module.lastDeepLinkOptions?.packageNameAndroid, "dev.hyo.app")
        XCTAssertEqual(module.lastDeepLinkOptions?.skuAndroid, "premium")
    }

    @MainActor
    func testRestorePurchasesRefreshesStoreState() async throws {
        let purchase = makePurchase(id: "restored-transaction")
        let module = FakeOpenIapModule(
            validateResult: .verifyPurchaseResultIos(makeVerifyPurchaseResult()),
            availablePurchasesResult: [.purchaseIos(purchase)]
        )
        let store = OpenIapStore(module: module)

        try await store.restorePurchases()

        XCTAssertEqual(module.restorePurchasesCallCount, 1)
        XCTAssertEqual(module.lastPurchaseOptions?.onlyIncludeActiveItemsIOS, true)
        XCTAssertEqual(store.iosAvailablePurchases.map(\.id), ["restored-transaction"])
        XCTAssertFalse(store.status.loadings.restorePurchases)
    }

    @MainActor
    func testConveniencePurchaseUsesCanonicalAppleField() async throws {
        let module = FakeOpenIapModule(
            validateResult: .verifyPurchaseResultIos(makeVerifyPurchaseResult())
        )
        let store = OpenIapStore(module: module)

        _ = try await store.requestPurchase(sku: "dev.hyo.coins", type: .inApp)

        guard case let .purchase(platforms)? = module.lastRequestPurchaseProps?.request else {
            return XCTFail("Expected the purchase union branch")
        }
        XCTAssertEqual(platforms.apple?.sku, "dev.hyo.coins")
    }

    @MainActor
    func testConvenienceSubscriptionUsesCanonicalAppleField() async throws {
        let module = FakeOpenIapModule(
            validateResult: .verifyPurchaseResultIos(makeVerifyPurchaseResult())
        )
        let store = OpenIapStore(module: module)

        _ = try await store.requestPurchase(sku: "dev.hyo.premium", type: .subs)

        guard case let .subscription(platforms)? = module.lastRequestPurchaseProps?.request else {
            return XCTFail("Expected the subscription union branch")
        }
        XCTAssertEqual(platforms.apple?.sku, "dev.hyo.premium")
    }

    func testStoreSkuResolverUsesCanonicalAppleAcrossUnionBranches() {
        let purchase = RequestPurchaseProps(
            request: .purchase(RequestPurchasePropsByPlatforms(
                apple: RequestPurchaseIosProps(sku: "dev.hyo.purchase.apple")
            ))
        )
        let subscription = RequestPurchaseProps(
            request: .subscription(RequestSubscriptionPropsByPlatforms(
                apple: RequestSubscriptionIosProps(sku: "dev.hyo.subscription.apple")
            ))
        )

        XCTAssertEqual(
            OpenIapStorePurchaseRequestResolver.sku(from: purchase),
            "dev.hyo.purchase.apple"
        )
        XCTAssertEqual(
            OpenIapStorePurchaseRequestResolver.sku(from: subscription),
            "dev.hyo.subscription.apple"
        )
    }

    @MainActor
    func testStorePublishesSubscriptionBillingIssue() async {
        let purchase = makePurchase(id: "billing-issue-transaction")
        let callback = expectation(description: "subscription billing issue callback")
        var callbackPurchaseId: String?
        let module = FakeOpenIapModule(
            validateResult: .verifyPurchaseResultIos(makeVerifyPurchaseResult())
        )
        let store = OpenIapStore(
            onSubscriptionBillingIssue: { issue in
                callbackPurchaseId = issue.id
                callback.fulfill()
            },
            module: module
        )

        module.emitSubscriptionBillingIssue(.purchaseIos(purchase))
        await fulfillment(of: [callback], timeout: 1.0)

        XCTAssertEqual(callbackPurchaseId, "billing-issue-transaction")
        XCTAssertEqual(store.currentSubscriptionBillingIssue?.id, "billing-issue-transaction")
    }

    func testChangedPurchasesReturnsOnlyAddedOrModifiedTransactions() {
        let unchanged = makePurchase(id: "unchanged")
        let previousChanged = makePurchase(id: "changed", isAutoRenewing: false)
        let currentChanged = makePurchase(id: "changed", isAutoRenewing: true)
        let added = makePurchase(id: "added")

        let result = OpenIapModule.changedPurchasesIOS(
            [unchanged, currentChanged, added],
            comparedTo: [unchanged, previousChanged]
        )

        XCTAssertEqual(result.map(\.id), ["changed", "added"])
    }

    private func makeVerifyPurchaseResult() -> VerifyPurchaseResultIOS {
        VerifyPurchaseResultIOS(
            isValid: true,
            jwsRepresentation: "jws-token",
            latestTransaction: nil,
            receiptData: "base64-receipt"
        )
    }

    private func makePurchase(id: String, isAutoRenewing: Bool = false) -> PurchaseIOS {
        PurchaseIOS(
            id: id,
            isAutoRenewing: isAutoRenewing,
            productId: "premium",
            purchaseState: .purchased,
            quantity: 1,
            store: .apple,
            transactionDate: 1,
            transactionId: id
        )
    }
}

@available(iOS 15.0, macOS 14.0, *)
private final class FakeOpenIapModule: OpenIapModuleProtocol {
    private let validateResult: VerifyPurchaseResult
    private let providerResult: VerifyPurchaseWithProviderResult
    private let availablePurchasesResult: [Purchase]
    private let allTransactionsResult: [PurchaseIOS]
    private let manageSubscriptionsResult: [PurchaseIOS]
    private let presentCodeResult: Bool
    private let clearTransactionResult: Bool
    private var subscriptionBillingIssueHandler: SubscriptionBillingIssueListener?
    private(set) var getStorefrontCallCount = 0
    private(set) var restorePurchasesCallCount = 0
    private(set) var deepLinkCallCount = 0
    private(set) var lastDeepLinkOptions: DeepLinkOptions?
    private(set) var lastPurchaseOptions: PurchaseOptions?
    private(set) var lastRequestPurchaseProps: RequestPurchaseProps?

    init(
        validateResult: VerifyPurchaseResult,
        providerResult: VerifyPurchaseWithProviderResult = VerifyPurchaseWithProviderResult(
            iapkit: nil,
            provider: .iapkit
        ),
        availablePurchasesResult: [Purchase] = [],
        allTransactionsResult: [PurchaseIOS] = [],
        manageSubscriptionsResult: [PurchaseIOS] = [],
        presentCodeResult: Bool = true,
        clearTransactionResult: Bool = true
    ) {
        self.validateResult = validateResult
        self.providerResult = providerResult
        self.availablePurchasesResult = availablePurchasesResult
        self.allTransactionsResult = allTransactionsResult
        self.manageSubscriptionsResult = manageSubscriptionsResult
        self.presentCodeResult = presentCodeResult
        self.clearTransactionResult = clearTransactionResult
    }

    // MARK: - Connection Management
    func initConnection() async throws -> Bool { true }
    func endConnection() async throws -> Bool { true }

    // MARK: - Product Management
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult { .products(nil) }
    func getPromotedProductIOS() async throws -> ProductIOS? { nil }

    // MARK: - Purchase Management
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? {
        lastRequestPurchaseProps = params
        return nil
    }
    func restorePurchases() async throws -> Void { restorePurchasesCallCount += 1 }
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] {
        lastPurchaseOptions = options
        return availablePurchasesResult
    }
    func getAllTransactionsIOS() async throws -> [PurchaseIOS] { allTransactionsResult }

    // MARK: - Transaction Management
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void { () }
    func getPendingTransactionsIOS() async throws -> [PurchaseIOS] { [] }
    func clearTransactionIOS() async throws -> Bool { clearTransactionResult }
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
    func getStorefront() async throws -> String {
        getStorefrontCallCount += 1
        return "US"
    }
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
    func presentCodeRedemptionSheetIOS() async throws -> Bool { presentCodeResult }
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] { manageSubscriptionsResult }
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void {
        deepLinkCallCount += 1
        lastDeepLinkOptions = options
    }

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
        subscriptionBillingIssueHandler = listener
        return Subscription(eventType: .subscriptionBillingIssue)
    }

    func emitSubscriptionBillingIssue(_ purchase: Purchase) {
        subscriptionBillingIssueHandler?(purchase)
    }

    func removeListener(_ subscription: Subscription) {
        subscription.onRemove?()
    }

    func removeAllListeners() {}
}
