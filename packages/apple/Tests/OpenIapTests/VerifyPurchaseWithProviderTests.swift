import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class VerifyPurchaseWithProviderTests: XCTestCase {

    @MainActor
    func testStoreReturnsIapkitResult() async throws {
        let iapkitResult = RequestVerifyPurchaseWithIapkitResult(
            isValid: true,
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
    func requestPurchaseOnPromotedProductIOS() async throws -> Bool { false }
    func restorePurchases() async throws -> Void { () }
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] { [] }

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
    func validateReceiptIOS(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS {
        guard case let .verifyPurchaseResultIos(ios) = validateResult else {
            throw PurchaseError(code: .featureNotSupported, message: "Expected iOS validation result", productId: props.apple?.sku)
        }
        return ios
    }

    func validateReceipt(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        validateResult
    }

    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        validateResult
    }

    func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult {
        providerResult
    }

    // MARK: - Store Information
    func getStorefrontIOS() async throws -> String { "US" }
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
    func presentCodeRedemptionSheetIOS() async throws -> Bool { true }
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] { [] }
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void { () }

    // MARK: - Event Listeners
    func purchaseUpdatedListener(_ listener: @escaping PurchaseUpdatedListener) -> Subscription {
        Subscription(eventType: .purchaseUpdated)
    }

    func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        Subscription(eventType: .purchaseError)
    }

    func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription {
        Subscription(eventType: .promotedProductIos)
    }

    func removeListener(_ subscription: Subscription) {
        subscription.onRemove?()
    }

    func removeAllListeners() {}
}
