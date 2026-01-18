import Foundation
import StoreKit

// MARK: - iOS Props Protocol

/// Protocol for iOS purchase/subscription props to enable polymorphic handling.
/// Both RequestPurchaseIosProps and RequestSubscriptionIosProps conform to this protocol.
public protocol IosPropsProtocol {
    var sku: String { get }
    var quantity: Int? { get }
    var appAccountToken: String? { get }
    var withOffer: DiscountOfferInputIOS? { get }
    var advancedCommerceData: String? { get }
    var andDangerouslyFinishTransactionAutomatically: Bool? { get }
}

extension RequestPurchaseIosProps: IosPropsProtocol {}
extension RequestSubscriptionIosProps: IosPropsProtocol {}

// MARK: - Event Listeners

@available(iOS 15.0, macOS 14.0, *)
public typealias PurchaseUpdatedListener = @Sendable (Purchase) -> Void

@available(iOS 15.0, macOS 14.0, *)
public typealias PurchaseErrorListener = @Sendable (PurchaseError) -> Void

@available(iOS 15.0, macOS 14.0, *)
public typealias PromotedProductListener = @Sendable (String) -> Void

// MARK: - Protocol

@available(iOS 15.0, macOS 14.0, *)
public protocol OpenIapModuleProtocol {
    // Connection Management
    func initConnection() async throws -> Bool
    func endConnection() async throws -> Bool

    // Product Management
    func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult
    func getPromotedProductIOS() async throws -> ProductIOS?

    // Purchase Management
    func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?
    @available(*, deprecated, message: "Use promotedProductListenerIOS + requestPurchase instead")
    func requestPurchaseOnPromotedProductIOS() async throws -> Bool
    func restorePurchases() async throws -> Void
    func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase]

    // Transaction Management
    func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void
    func getPendingTransactionsIOS() async throws -> [PurchaseIOS]
    func clearTransactionIOS() async throws -> Bool
    func isTransactionVerifiedIOS(sku: String) async throws -> Bool
    func getTransactionJwsIOS(sku: String) async throws -> String?
    func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS?
    func latestTransactionIOS(sku: String) async throws -> PurchaseIOS?

    // Validation
    func getReceiptDataIOS() async throws -> String?
    @available(*, deprecated, message: "Use verifyPurchase")
    func validateReceiptIOS(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS
    @available(*, deprecated, message: "Use verifyPurchase")
    func validateReceipt(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult
    func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult

    // Store Information
    func getStorefrontIOS() async throws -> String
    @available(iOS 16.0, macOS 14.0, *)
    func getAppTransactionIOS() async throws -> AppTransaction?

    // Subscription Management
    func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription]
    func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool
    func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS]
    func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool

    // Refunds (iOS 15+)
    func beginRefundRequestIOS(sku: String) async throws -> String?

    // Misc
    func syncIOS() async throws -> Bool
    func presentCodeRedemptionSheetIOS() async throws -> Bool
    func showManageSubscriptionsIOS() async throws -> [PurchaseIOS]
    func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void

    // Event Listeners
    func purchaseUpdatedListener(_ listener: @escaping PurchaseUpdatedListener) -> Subscription
    func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription
    func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription
    func removeListener(_ subscription: Subscription)
    func removeAllListeners()
}

// Backward compatibility for legacy receipt validation APIs
public extension OpenIapModuleProtocol {
    /// Default implementation that throws. Override in your module to provide actual verification.
    func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult {
        throw PurchaseError(code: .featureNotSupported, message: "verifyPurchaseWithProvider not supported")
    }

    @available(*, deprecated, message: "Use verifyPurchase instead")
    func validateReceiptIOS(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResultIOS {
        let result = try await verifyPurchase(props)
        if case let .verifyPurchaseResultIos(ios) = result {
            return ios
        }
        throw PurchaseError(
            code: .featureNotSupported,
            message: "Expected iOS validation result",
            productId: props.apple?.sku
        )
    }

    @available(*, deprecated, message: "Use verifyPurchase instead")
    func validateReceipt(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        try await verifyPurchase(props)
    }
}
