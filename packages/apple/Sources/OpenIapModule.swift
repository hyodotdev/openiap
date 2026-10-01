import Foundation
import StoreKit

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
@objc(OpenIapModule)
public final class OpenIapModule: NSObject, OpenIapModuleProtocol {
    public static let shared = OpenIapModule()
    private let selection: Result<OpenIapProviderSelection, PurchaseError>

    public override init() {
        selection = OpenIapProvider.select(bundle: .main)
        super.init()
    }

    public init(factory: any OpenIapProviderFactory) {
        selection = OpenIapProvider.select(factory: factory)
        super.init()
    }

    init(selection: Result<OpenIapProviderSelection, PurchaseError>) {
        self.selection = selection
        super.init()
    }

    @objc public class func sharedInstance() -> OpenIapModule { shared }

    @objc public var storeId: String? { try? selection.get().storeId }
    public var capabilities: Set<String> { (try? selection.get().capabilities) ?? [] }

    private var provider: any OpenIapModuleProtocol {
        get throws { try selection.get().module }
    }

    public func initConnection() async throws -> Bool {
        try await provider.initConnection()
    }

    public func endConnection() async throws -> Bool {
        try await provider.endConnection()
    }

    public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult {
        try await provider.fetchProducts(params)
    }

    public func getPromotedProductIOS() async throws -> ProductIOS? {
        try await provider.getPromotedProductIOS()
    }

    public func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? {
        try await provider.requestPurchase(params)
    }

    public func restorePurchases() async throws -> Void {
        try await provider.restorePurchases()
    }

    public func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] {
        try await provider.getAvailablePurchases(options)
    }

    public func getAllTransactionsIOS() async throws -> [PurchaseIOS] {
        try await provider.getAllTransactionsIOS()
    }

    public func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws -> Void {
        guard case .purchaseIos = purchase else {
            throw PurchaseError.make(code: .developerError, message: "Apple providers require an iOS purchase.")
        }
        guard purchase.storeId == storeId else {
            throw PurchaseError.make(code: .developerError, message: "Purchase storeId differs from the selected provider.")
        }
        try await provider.finishTransaction(purchase: purchase, isConsumable: isConsumable)
    }

    public func getPendingTransactionsIOS() async throws -> [PurchaseIOS] {
        try await provider.getPendingTransactionsIOS()
    }

    public func clearTransactionIOS() async throws -> Bool {
        try await provider.clearTransactionIOS()
    }

    public func isTransactionVerifiedIOS(sku: String) async throws -> Bool {
        try await provider.isTransactionVerifiedIOS(sku: sku)
    }

    public func getTransactionJwsIOS(sku: String) async throws -> String? {
        try await provider.getTransactionJwsIOS(sku: sku)
    }

    public func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS? {
        try await provider.currentEntitlementIOS(sku: sku)
    }

    public func latestTransactionIOS(sku: String) async throws -> PurchaseIOS? {
        try await provider.latestTransactionIOS(sku: sku)
    }

    public func getReceiptDataIOS() async throws -> String? {
        try await provider.getReceiptDataIOS()
    }

    public func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        try await provider.verifyPurchase(props)
    }

    public func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult {
        try await provider.verifyPurchaseWithProvider(props)
    }

    public func getStorefront() async throws -> String {
        try await provider.getStorefront()
    }

    @available(iOS 16.0, macOS 14.0, tvOS 16.0, watchOS 9.0, *)
    public func getAppTransactionIOS() async throws -> AppTransaction? {
        try await provider.getAppTransactionIOS()
    }

    public func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] {
        try await provider.getActiveSubscriptions(subscriptionIds)
    }

    public func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool {
        try await provider.hasActiveSubscriptions(subscriptionIds)
    }

    public func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS] {
        try await provider.subscriptionStatusIOS(sku: sku)
    }

    public func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool {
        try await provider.isEligibleForIntroOfferIOS(groupID: groupID)
    }

    public func beginRefundRequestIOS(sku: String) async throws -> String? {
        try await provider.beginRefundRequestIOS(sku: sku)
    }

    public func syncIOS() async throws -> Bool {
        try await provider.syncIOS()
    }

    public func openRedeemOfferCode() async throws -> PurchaseIOS? {
        try await provider.openRedeemOfferCode()
    }

    @available(*, deprecated, message: "Use openRedeemOfferCode. Scheduled for removal in client protocol 1.0.0.")
    public func presentCodeRedemptionSheetIOS() async throws -> PurchaseIOS? {
        try await provider.openRedeemOfferCode()
    }

    public func showManageSubscriptionsIOS() async throws -> [PurchaseIOS] {
        try await provider.showManageSubscriptionsIOS()
    }

    public func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws -> Void {
        try await provider.deepLinkToSubscriptions(options)
    }

    public func canPresentExternalPurchaseNoticeIOS() async throws -> Bool {
        try await provider.canPresentExternalPurchaseNoticeIOS()
    }

    public func presentExternalPurchaseNoticeSheetIOS() async throws -> ExternalPurchaseNoticeResultIOS {
        try await provider.presentExternalPurchaseNoticeSheetIOS()
    }

    public func presentExternalPurchaseLinkIOS(_ url: String) async throws -> ExternalPurchaseLinkResultIOS {
        try await provider.presentExternalPurchaseLinkIOS(url)
    }

    public func isEligibleForExternalPurchaseCustomLinkIOS() async throws -> Bool {
        try await provider.isEligibleForExternalPurchaseCustomLinkIOS()
    }

    public func getExternalPurchaseCustomLinkTokenIOS(_ tokenType: ExternalPurchaseCustomLinkTokenTypeIOS) async throws -> ExternalPurchaseCustomLinkTokenResultIOS {
        try await provider.getExternalPurchaseCustomLinkTokenIOS(tokenType)
    }

    public func showExternalPurchaseCustomLinkNoticeIOS(_ noticeType: ExternalPurchaseCustomLinkNoticeTypeIOS) async throws -> ExternalPurchaseCustomLinkNoticeResultIOS {
        try await provider.showExternalPurchaseCustomLinkNoticeIOS(noticeType)
    }

    public func purchaseUpdatedListener(_ listener: @escaping PurchaseUpdatedListener, options: PurchaseUpdatedListenerOptions? = nil) -> Subscription {
        guard case .success(let selected) = selection else { return Subscription(eventType: .purchaseUpdated) }
        return selected.module.purchaseUpdatedListener(listener, options: options)
    }

    public func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        guard case .success(let selected) = selection else { return Subscription(eventType: .purchaseError) }
        return selected.module.purchaseErrorListener(listener)
    }

    public func promotedProductListenerIOS(_ listener: @escaping PromotedProductListener) -> Subscription {
        guard case .success(let selected) = selection else { return Subscription(eventType: .promotedProductIos) }
        return selected.module.promotedProductListenerIOS(listener)
    }

    public func subscriptionBillingIssueListener(_ listener: @escaping SubscriptionBillingIssueListener) -> Subscription {
        guard case .success(let selected) = selection else { return Subscription(eventType: .subscriptionBillingIssue) }
        return selected.module.subscriptionBillingIssueListener(listener)
    }

    public func removeListener(_ subscription: Subscription) -> Void {
        if case .success(let selected) = selection { selected.module.removeListener(subscription) }
    }

    public func removeAllListeners() -> Void {
        if case .success(let selected) = selection { selected.module.removeAllListeners() }
    }

    static func validateIOSPurchaseProps(_ params: RequestPurchaseProps) throws {
        try OpenIapStoreKitModule.validateIOSPurchaseProps(params)
    }
}

#if os(iOS)
extension OpenIapModule: SKPaymentTransactionObserver {
    public func paymentQueue(_ queue: SKPaymentQueue, updatedTransactions transactions: [SKPaymentTransaction]) {
        guard let storeKit = (try? provider) as? OpenIapStoreKitModule else { return }
        storeKit.paymentQueue(queue, updatedTransactions: transactions)
    }

    public func paymentQueue(_ queue: SKPaymentQueue, shouldAddStorePayment payment: SKPayment, for product: SKProduct) -> Bool {
        guard let storeKit = (try? provider) as? OpenIapStoreKitModule else { return false }
        return storeKit.paymentQueue(queue, shouldAddStorePayment: payment, for: product)
    }
}
#endif
