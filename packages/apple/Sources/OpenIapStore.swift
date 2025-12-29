import Foundation
import StoreKit

/// Convenience store for OpenIapModule with managed listeners and state
/// Requires explicit initConnection() and endConnection() calls
@available(iOS 15.0, macOS 14.0, *)
@MainActor
public final class OpenIapStore: ObservableObject {

    // MARK: - Published Properties

    @Published public private(set) var isConnected: Bool = false
    @Published public private(set) var products: [OpenIAP.Product] = []
    @Published public private(set) var subscriptions: [OpenIAP.ProductSubscription] = []
    @Published public private(set) var availablePurchases: [OpenIAP.Purchase] = []
    @Published public private(set) var currentPurchase: OpenIAP.Purchase?
    @Published public private(set) var currentPurchaseError: PurchaseError?
    @Published public private(set) var activeSubscriptions: [ActiveSubscription] = []
    @Published public private(set) var promotedProduct: String?

    public var iosProducts: [ProductIOS] { products.compactMap { $0.asIOS() } }
    public var iosSubscriptionProducts: [ProductSubscriptionIOS] { subscriptions.compactMap { $0.asIOS() } }
    public var iosAvailablePurchases: [PurchaseIOS] { availablePurchases.compactMap { $0.asIOS() } }
    public var iosCurrentPurchase: PurchaseIOS? { currentPurchase?.asIOS() }

    // MARK: - UI Status Management

    @Published public var status: IapStatus = IapStatus()

    // MARK: - Private Properties

    private let module: OpenIapModuleProtocol
    private var listenerTokens: [Subscription] = []

    // MARK: - Callbacks

    public var onPurchaseSuccess: ((OpenIAP.Purchase) -> Void)?
    public var onPurchaseError: ((PurchaseError) -> Void)?
    public var onPromotedProduct: ((String) -> Void)?

    // MARK: - Initialization

    public init(
        onPurchaseSuccess: ((OpenIAP.Purchase) -> Void)? = nil,
        onPurchaseError: ((PurchaseError) -> Void)? = nil,
        onPromotedProduct: ((String) -> Void)? = nil,
        module: OpenIapModuleProtocol = OpenIapModule.shared
    ) {
        self.onPurchaseSuccess = onPurchaseSuccess
        self.onPurchaseError = onPurchaseError
        self.onPromotedProduct = onPromotedProduct
        self.module = module
        setupListeners()
    }

    deinit { listenerTokens.removeAll() }

    // MARK: - Listener Management

    private func setupListeners() {
        let purchaseUpdate = module.purchaseUpdatedListener { [weak self] purchase in
            Task { @MainActor in self?.handlePurchaseUpdate(purchase) }
        }
        listenerTokens.append(purchaseUpdate)

        let purchaseError = module.purchaseErrorListener { [weak self] error in
            Task { @MainActor in self?.handlePurchaseError(error) }
        }
        listenerTokens.append(purchaseError)

        #if os(iOS)
        let promoted = module.promotedProductListenerIOS { [weak self] productId in
            Task { @MainActor in self?.handlePromotedProduct(productId) }
        }
        listenerTokens.append(promoted)
        #endif
    }

    private func clearListeners() {
        for token in listenerTokens { module.removeListener(token) }
        listenerTokens.removeAll()
    }

    // MARK: - Connection Management

    public func initConnection() async throws {
        status.loadings.initConnection = true
        defer { status.loadings.initConnection = false }
        isConnected = try await module.initConnection()
    }

    public func endConnection() async throws {
        clearListeners()
        _ = try await module.endConnection()
        isConnected = false
    }

    // MARK: - Event Handlers

    private func handlePurchaseUpdate(_ purchase: OpenIAP.Purchase) {
        currentPurchase = purchase
        currentPurchaseError = nil

        if let ios = purchase.asIOS() {
            status.loadings.purchasing.remove(ios.productId)
            status.lastPurchaseResult = PurchaseResultData(
                productId: ios.productId,
                transactionId: ios.transactionId,
                timestamp: Date(timeIntervalSince1970: ios.transactionDate / 1000),
                message: "Purchase successful"
            )
            availablePurchases = deduplicatePurchases(availablePurchases + [purchase])
        }

        onPurchaseSuccess?(purchase)

        if let ios = purchase.asIOS() {
            let shouldRefresh = ios.expirationDateIOS != nil
                || ios.isAutoRenewing
                || (ios.subscriptionGroupIdIOS?.isEmpty == false)
            if shouldRefresh {
                Task {
                    await refreshPurchases()
                }

                // Update activeSubscriptions directly from purchase data (avoid calling getActiveSubscriptions)
                // Skip if this transaction is upgraded - it means it's been replaced by a new subscription
                if let expirationDate = ios.expirationDateIOS, ios.isUpgradedIOS != true {
                    let isActive = Date(timeIntervalSince1970: expirationDate / 1000) > Date()

                    let newSubscription = ActiveSubscription(
                        autoRenewingAndroid: nil,
                        daysUntilExpirationIOS: nil,
                        environmentIOS: ios.environmentIOS,
                        expirationDateIOS: expirationDate,
                        isActive: isActive,
                        productId: ios.productId,  // Keep current productId, not autoRenewPreference
                        purchaseToken: ios.purchaseToken,
                        renewalInfoIOS: ios.renewalInfoIOS,  // Future changes reflected here
                        transactionDate: ios.transactionDate,
                        transactionId: ios.transactionId,
                        willExpireSoon: false
                    )

                    // Remove duplicates by transactionId
                    activeSubscriptions = activeSubscriptions.filter { existing in
                        existing.transactionId != ios.transactionId
                    } + [newSubscription]
                }
            }
        }
    }

    private func handlePurchaseError(_ error: PurchaseError) {
        currentPurchase = nil
        currentPurchaseError = error
        if let productId = error.productId {
            status.loadings.purchasing.remove(productId)
        }
        status.lastError = ErrorData(
            code: error.code.rawValue,
            message: error.message,
            productId: error.productId
        )
        onPurchaseError?(error)
    }

    private func handlePromotedProduct(_ productId: String) {
        promotedProduct = productId
        onPromotedProduct?(productId)
    }

    // MARK: - Product Management

    public func fetchProducts(skus: [String], type: ProductQueryType = .all) async throws {
        status.loadings.fetchProducts = true
        defer { status.loadings.fetchProducts = false }

        let request = ProductRequest(skus: skus, type: type)
        let result = try await module.fetchProducts(request)
        switch result {
        case .products(let list):
            products = list ?? []
            subscriptions = []
        case .subscriptions(let list):
            subscriptions = list ?? []
            products = []
        case .all(let items):
            let allItems = items ?? []
            // Extract Product and ProductSubscription from ProductOrSubscription union
            products = allItems.compactMap { item in
                if case .product(let product) = item {
                    return product
                }
                return nil
            }
            subscriptions = allItems.compactMap { item in
                if case .productSubscription(.productSubscriptionIos(let subscription)) = item {
                    return .productSubscriptionIos(subscription)
                }
                return nil
            }
        }
    }

    // MARK: - Purchase Management

    public func getAvailablePurchases(options: PurchaseOptions? = nil) async throws {
        status.loadings.restorePurchases = true
        defer { status.loadings.restorePurchases = false }

        let purchases = try await module.getAvailablePurchases(options)
        availablePurchases = deduplicatePurchases(purchases)

        OpenIapLog.debug("🧾 availablePurchases: \(purchases.count) total → \(availablePurchases.count) active")

        // Show renewal info details for active subscriptions
        let withRenewalInfo = availablePurchases.compactMap { $0.asIOS() }.filter { $0.renewalInfoIOS != nil }
        for purchase in withRenewalInfo {
            if let info = purchase.renewalInfoIOS {
                OpenIapLog.debug("   📋 \(purchase.productId) renewalInfo:")
                OpenIapLog.debug("      • willAutoRenew: \(info.willAutoRenew)")
                OpenIapLog.debug("      • autoRenewPreference: \(info.autoRenewPreference ?? "nil")")
                if let pendingUpgrade = info.pendingUpgradeProductId {
                    OpenIapLog.debug("      • pendingUpgradeProductId: \(pendingUpgrade) ⚠️ UPGRADE PENDING")
                }
                if let expirationReason = info.expirationReason {
                    OpenIapLog.debug("      • expirationReason: \(expirationReason)")
                }
                if let renewalDate = info.renewalDate {
                    let date = Date(timeIntervalSince1970: renewalDate / 1000)
                    OpenIapLog.debug("      • renewalDate: \(date)")
                }
                if let gracePeriod = info.gracePeriodExpirationDate {
                    let date = Date(timeIntervalSince1970: gracePeriod / 1000)
                    OpenIapLog.debug("      • gracePeriodExpirationDate: \(date)")
                }
                if let offerId = info.renewalOfferId {
                    OpenIapLog.debug("      • renewalOfferId: \(offerId)")
                }
                if let offerType = info.renewalOfferType {
                    OpenIapLog.debug("      • renewalOfferType: \(offerType)")
                }
            }
        }
    }

    public func requestPurchase(
        sku: String,
        type: ProductQueryType = .inApp,
        autoFinish: Bool? = nil,
        quantity: Int? = nil,
        appAccountToken: String? = nil,
        withOffer: DiscountOfferInputIOS? = nil,
        advancedCommerceData: String? = nil
    ) async throws -> OpenIAP.Purchase? {
        switch type {
        case .subs:
            let iosProps = RequestSubscriptionIosProps(
                advancedCommerceData: advancedCommerceData,
                andDangerouslyFinishTransactionAutomatically: autoFinish,
                appAccountToken: appAccountToken,
                quantity: quantity,
                sku: sku,
                withOffer: withOffer
            )
            let request = RequestPurchaseProps(
                request: .subscription(RequestSubscriptionPropsByPlatforms(android: nil, ios: iosProps)),
                type: .subs
            )
            return try await requestPurchase(request)
        default:
            let iosProps = RequestPurchaseIosProps(
                advancedCommerceData: advancedCommerceData,
                andDangerouslyFinishTransactionAutomatically: autoFinish,
                appAccountToken: appAccountToken,
                quantity: quantity,
                sku: sku,
                withOffer: withOffer
            )
            let request = RequestPurchaseProps(
                request: .purchase(RequestPurchasePropsByPlatforms(android: nil, ios: iosProps)),
                type: .inApp
            )
            return try await requestPurchase(request)
        }
    }

    public func requestPurchase(_ params: RequestPurchaseProps) async throws -> OpenIAP.Purchase? {
        clearCurrentPurchase()
        clearCurrentPurchaseError()

        if let sku = params.iosSku {
            status.loadings.purchasing.insert(sku)
        }
        defer {
            if let sku = params.iosSku {
                status.loadings.purchasing.remove(sku)
            }
        }

        let result = try await module.requestPurchase(params)
        switch result {
        case .purchase(let purchase?):
            currentPurchase = purchase
            return purchase
        case .purchase(nil):
            return nil
        case .purchases(let purchases?):
            availablePurchases = deduplicatePurchases(purchases)
            currentPurchase = purchases.first
            return purchases.first
        case .purchases(nil):
            return nil
        case .none:
            return nil
        @unknown default:
            return nil
        }
    }

    public func finishTransaction(purchase: PurchaseIOS, isConsumable: Bool = false) async throws {
        try await finishTransaction(purchase: .purchaseIos(purchase), isConsumable: isConsumable)
    }

    public func finishTransaction(purchase: Purchase, isConsumable: Bool = false) async throws {
        guard let ios = purchase.asIOS() else {
            throw PurchaseError(code: .featureNotSupported, message: "Finishing only supported for iOS purchases", productId: nil)
        }
        try await module.finishTransaction(purchase: purchase, isConsumable: isConsumable)
        if currentPurchase?.transactionId == ios.transactionId {
            clearCurrentPurchase()
        }
        status.lastPurchaseResult = nil
    }

    public func getActiveSubscriptions(subscriptionIds: [String]? = nil) async throws {
        let subs = try await module.getActiveSubscriptions(subscriptionIds)
        await MainActor.run {
            activeSubscriptions = subs
        }
        OpenIapLog.debug("📊 activeSubscriptions: \(activeSubscriptions.count) subscriptions")

        // Show renewal info details
        for sub in activeSubscriptions where sub.renewalInfoIOS != nil {
            if let info = sub.renewalInfoIOS {
                OpenIapLog.debug("   📋 \(sub.productId) renewalInfo:")
                OpenIapLog.debug("      • willAutoRenew: \(info.willAutoRenew)")
                if let pendingUpgrade = info.pendingUpgradeProductId {
                    OpenIapLog.debug("      • pendingUpgradeProductId: \(pendingUpgrade) ⚠️ UPGRADE PENDING")
                }
            }
        }
    }

    public func hasActiveSubscriptions(subscriptionIds: [String]? = nil) async throws -> Bool {
        try await module.hasActiveSubscriptions(subscriptionIds)
    }

    public func refreshPurchases(forceSync: Bool = false) async throws {
        try await getAvailablePurchases()

        guard forceSync else { return }

        status.loadings.restorePurchases = true
        defer { status.loadings.restorePurchases = false }

        _ = try await module.syncIOS()
        try await getAvailablePurchases()
    }

    // MARK: - Validation & Metadata

    @available(*, deprecated, message: "Use verifyPurchase")
    public func validateReceipt(sku: String) async throws -> VerifyPurchaseResultIOS {
        try await verifyPurchase(sku: sku)
    }

    public func verifyPurchase(sku: String) async throws -> VerifyPurchaseResultIOS {
        let result = try await module.verifyPurchase(VerifyPurchaseProps(apple: VerifyPurchaseAppleOptions(sku: sku)))
        if case let .verifyPurchaseResultIos(iosResult) = result {
            return iosResult
        }
        throw PurchaseError(
            code: .featureNotSupported,
            message: "Android receipt validation is not available on Apple platforms",
            productId: sku
        )
    }

    public func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> RequestVerifyPurchaseWithIapkitResult? {
        let result = try await module.verifyPurchaseWithProvider(props)
        return result.iapkit
    }

    public func getPromotedProductIOS() async throws -> ProductIOS? {
        try await module.getPromotedProductIOS()
    }

    public func getPendingTransactionsIOS() async throws -> [PurchaseIOS] {
        try await module.getPendingTransactionsIOS()
    }

    public func getReceiptDataIOS() async throws -> String? {
        try await module.getReceiptDataIOS()
    }

    public func getTransactionJwsIOS(sku: String) async throws -> String? {
        try await module.getTransactionJwsIOS(sku: sku)
    }

    public func getStorefrontIOS() async throws -> String {
        try await module.getStorefrontIOS()
    }

    @available(iOS 16.0, macOS 14.0, *)
    public func getAppTransactionIOS() async throws -> AppTransaction? {
        try await module.getAppTransactionIOS()
    }

    public func isEligibleForIntroOfferIOS(groupID: String) async throws -> Bool {
        try await module.isEligibleForIntroOfferIOS(groupID: groupID)
    }

    public func subscriptionStatusIOS(sku: String) async throws -> [SubscriptionStatusIOS] {
        try await module.subscriptionStatusIOS(sku: sku)
    }

    public func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS? {
        try await module.currentEntitlementIOS(sku: sku)
    }

    public func latestTransactionIOS(sku: String) async throws -> PurchaseIOS? {
        try await module.latestTransactionIOS(sku: sku)
    }

    // tvOS: beginRefundRequest API not available on tvOS
    #if !os(tvOS)
    public func beginRefundRequestIOS(sku: String) async throws -> String? {
        try await module.beginRefundRequestIOS(sku: sku)
    }
    #endif // !os(tvOS)

    public func isTransactionVerifiedIOS(sku: String) async throws -> Bool {
        try await module.isTransactionVerifiedIOS(sku: sku)
    }

    public func syncIOS() async throws -> Bool {
        try await module.syncIOS()
    }

    // tvOS: presentCodeRedemptionSheet explicitly unavailable on tvOS
    // tvOS: showManageSubscriptions not available on tvOS (subscriptions managed in Settings > Accounts)
    // tvOS: deepLinkToSubscriptions not available on tvOS (no window scene UI)
    #if !os(tvOS)
    public func presentCodeRedemptionSheetIOS() async throws {
        _ = try await module.presentCodeRedemptionSheetIOS()
    }

    public func showManageSubscriptionsIOS() async throws {
        _ = try await module.showManageSubscriptionsIOS()
    }

    public func deepLinkToSubscriptionsIOS() async throws {
        try await module.deepLinkToSubscriptions(nil)
    }
    #endif // !os(tvOS)

    public func clearTransactionIOS() async throws {
        _ = try await module.clearTransactionIOS()
    }

    public func resetEphemeralState() {
        currentPurchase = nil
        currentPurchaseError = nil
        status.reset()
    }

    // MARK: - Private Helpers

    private func clearCurrentPurchase() {
        currentPurchase = nil
    }

    private func clearCurrentPurchaseError() {
        currentPurchaseError = nil
    }

    private func deduplicatePurchases(_ purchases: [OpenIAP.Purchase]) -> [OpenIAP.Purchase] {
        var nonSubscriptionPurchases: [OpenIAP.Purchase] = []
        var latestSubscriptionByProduct: [String: OpenIAP.Purchase] = [:]
        var skippedInactive = 0

        for purchase in purchases {
            guard let iosPurchase = purchase.asIOS() else {
                nonSubscriptionPurchases.append(purchase)
                continue
            }

            let isSubscription = iosPurchase.expirationDateIOS != nil
                || iosPurchase.isAutoRenewing
                || (iosPurchase.subscriptionGroupIdIOS?.isEmpty == false)

            if isSubscription == false {
                nonSubscriptionPurchases.append(purchase)
                continue
            }

            let isActive: Bool
            if let expiry = iosPurchase.expirationDateIOS {
                let expiryDate = Date(timeIntervalSince1970: expiry / 1000)
                isActive = expiryDate > Date()
            } else {
                isActive = iosPurchase.isAutoRenewing
                    || iosPurchase.purchaseState == .purchased
            }

            guard isActive else {
                skippedInactive += 1
                continue
            }

            if let existing = latestSubscriptionByProduct[iosPurchase.productId], let existingIos = existing.asIOS() {
                let shouldReplace = shouldReplaceSubscription(existing: existingIos, candidate: iosPurchase)
                if shouldReplace {
                    latestSubscriptionByProduct[iosPurchase.productId] = purchase
                }
            } else {
                latestSubscriptionByProduct[iosPurchase.productId] = purchase
            }
        }

        if skippedInactive > 0 {
            OpenIapLog.debug("   ↳ filtered out \(skippedInactive) inactive subscriptions")
        }

        let allPurchases = nonSubscriptionPurchases + Array(latestSubscriptionByProduct.values)
        return allPurchases.sorted { lhs, rhs in
            (lhs.asIOS()?.transactionDate ?? 0) > (rhs.asIOS()?.transactionDate ?? 0)
        }
    }

    private func shouldReplaceSubscription(existing: PurchaseIOS, candidate: PurchaseIOS) -> Bool {
        let existingDate = existing.transactionDate
        let candidateDate = candidate.transactionDate
        if candidateDate > existingDate { return true }
        if candidateDate < existingDate { return false }

        if existing.isAutoRenewing != candidate.isAutoRenewing {
            return candidate.isAutoRenewing == false
        }

        let existingRevocation = existing.revocationDateIOS ?? 0
        let candidateRevocation = candidate.revocationDateIOS ?? 0
        if candidateRevocation != existingRevocation {
            return candidateRevocation > existingRevocation
        }

        let existingExpiration = existing.expirationDateIOS ?? 0
        let candidateExpiration = candidate.expirationDateIOS ?? 0
        if candidateExpiration != existingExpiration {
            return candidateExpiration > existingExpiration
        }

        return false
    }

    private func refreshPurchases() async {
        do {
            try await getAvailablePurchases()
        } catch {
            OpenIapLog.error("Failed to refresh purchases: \(error)")
        }
    }
}

// MARK: - Internal Helpers

@available(iOS 15.0, macOS 14.0, *)
private extension OpenIAP.Product {
    func asIOS() -> ProductIOS? {
        switch self {
        case .productIos(let product):
            return product
        default:
            return nil
        }
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension OpenIAP.ProductSubscription {
    func asIOS() -> ProductSubscriptionIOS? {
        switch self {
        case .productSubscriptionIos(let product):
            return product
        default:
            return nil
        }
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension OpenIAP.Purchase {
    func asIOS() -> PurchaseIOS? {
        switch self {
        case .purchaseIos(let purchase):
            return purchase
        default:
            return nil
        }
    }

    var transactionId: String {
        switch self {
        case .purchaseIos(let purchase):
            return purchase.transactionId
        default:
            return ""
        }
    }
}

@available(iOS 15.0, macOS 14.0, *)
private extension RequestPurchaseProps {
    var iosSku: String? {
        switch request {
        case .purchase(let platforms):
            return platforms.ios?.sku
        case .subscription(let platforms):
            return platforms.ios?.sku
        }
    }
}

// MARK: - Nested UI Status Types

@available(iOS 15.0, macOS 14.0, *)
public extension OpenIapStore {
    struct IapStatus {
        public var loadings: LoadingStates = LoadingStates()
        public var lastPurchaseResult: PurchaseResultData?
        public var lastError: ErrorData?
        public var currentOperation: IapOperation?
        public var operationHistory: [IapOperation] = []

        public init() {}

        public func isPurchasing(_ productId: String) -> Bool {
            loadings.purchasing.contains(productId)
        }

        public var isLoading: Bool {
            loadings.initConnection || loadings.fetchProducts || loadings.restorePurchases || !loadings.purchasing.isEmpty
        }

        public mutating func addToHistory(_ operation: IapOperation) {
            operationHistory.insert(operation, at: 0)
            if operationHistory.count > 10 {
                operationHistory.removeLast()
            }
        }

        public mutating func reset() {
            loadings = LoadingStates()
            lastPurchaseResult = nil
            lastError = nil
            currentOperation = nil
            operationHistory.removeAll()
        }
    }

    struct LoadingStates {
        public var initConnection: Bool = false
        public var fetchProducts: Bool = false
        public var restorePurchases: Bool = false
        public var purchasing: Set<String> = []

        public init() {}
    }

    struct PurchaseResultData {
        public let productId: String
        public let transactionId: String
        public let timestamp: Date
        public let message: String

        public init(productId: String, transactionId: String, timestamp: Date = Date(), message: String) {
            self.productId = productId
            self.transactionId = transactionId
            self.timestamp = timestamp
            self.message = message
        }
    }

    struct ErrorData {
        public let code: String
        public let message: String
        public let productId: String?

        public init(code: String, message: String, productId: String?) {
            self.code = code
            self.message = message
            self.productId = productId
        }
    }

    enum IapOperation: String {
        case initConnection
        case fetchProducts
        case restorePurchases
        case requestPurchase
        case finishTransaction
        case verifyPurchase
        case custom
    }
}
