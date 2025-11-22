import XCTest
@testable import OpenIAP

@available(iOS 15.0, macOS 14.0, *)
final class ValidateReceiptTests: XCTestCase {

    @MainActor
    func testVerifyPurchaseReturnsIOSResult() async throws {
        let iosResult = ReceiptValidationResultIOS(
            isValid: true,
            jwsRepresentation: "jws-token",
            latestTransaction: nil,
            receiptData: "base64-receipt"
        )
        let module = FakeOpenIapModule(validateResult: .receiptValidationResultIos(iosResult))
        let store = OpenIapStore(module: module)

        let result = try await store.verifyPurchase(sku: "test.sku")

        XCTAssertTrue(result.isValid)
        XCTAssertEqual("jws-token", result.jwsRepresentation)
        XCTAssertEqual("base64-receipt", result.receiptData)
    }

    @MainActor
    func testVerifyPurchaseThrowsForAndroidVariant() async {
        let androidPayload = ReceiptValidationResultAndroid(
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
        let module = FakeOpenIapModule(validateResult: .receiptValidationResultAndroid(androidPayload))
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
}

@available(iOS 15.0, macOS 14.0, *)
private final class FakeOpenIapModule: OpenIapModuleProtocol {
    private let validateResult: ReceiptValidationResult

    init(validateResult: ReceiptValidationResult) {
        self.validateResult = validateResult
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
    func validateReceiptIOS(_ props: ReceiptValidationProps) async throws -> ReceiptValidationResultIOS {
        guard case let .receiptValidationResultIos(ios) = validateResult else {
            throw PurchaseError(code: .featureNotSupported, message: "Android validation not supported", productId: props.sku)
        }
        return ios
    }

    func validateReceipt(_ props: ReceiptValidationProps) async throws -> ReceiptValidationResult {
        validateResult
    }

    func verifyPurchase(_ props: ReceiptValidationProps) async throws -> ReceiptValidationResult {
        validateResult
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
