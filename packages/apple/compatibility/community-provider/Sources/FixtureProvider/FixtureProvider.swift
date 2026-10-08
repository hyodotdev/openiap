import Foundation
import OpenIAP

@objc(CommunityFixtureFactory)
public final class FixtureFactory: NSObject, OpenIapProviderFactory {
    public required override init() { super.init() }
    public var storeId: String { "community_fixture" }
    public var coreVersion: String { FixtureBuildVersion.core }
    public var clientProtocolVersion: String { FixtureBuildVersion.clientProtocol }
    public var capabilities: Set<String> { ["pendingPurchases", "subscriptionBillingIssue", "offerCodeRedemption"] }
    public func create() throws -> any OpenIapModuleProtocol { FixtureModule() }
}

public final class FixtureModule: OpenIapModuleProtocol, @unchecked Sendable {
    private let lock = NSRecursiveLock()
    private var connected = false
    private var updated: [UUID: PurchaseUpdatedListener] = [:]
    private var billing: [UUID: SubscriptionBillingIssueListener] = [:]
    private var errors: [UUID: PurchaseErrorListener] = [:]
    private var owned: [String: Purchase] = [:]
    public private(set) var finished: [String: Purchase] = [:]
    public var rejectOwnedPurchase = false
    public var failureEventCount = 1
    public var returnFailureInsteadOfThrow = false
    public var genericRequestFailure: Error?
    public var purchaseOnFailure = false
    public var rotateTokenAfterFirstRead = false
    private var ownedReadCount = 0
    public var emitAndroidPurchase = false
    public private(set) var lastRequest: RequestPurchaseProps?
    public var connectionResult = true
    public var connectionError: PurchaseError?
    public private(set) var disconnectCount = 0
    public var isConnected: Bool { synchronized { connected } }
    public var deferredPending = false
    public var billingGracePeriod = false
    public var deferredThenPurchased = false
    public var capabilityStore: IapStore = .unknown
    public var inactiveSubscriptions = false
    public var forcedHasActive: Bool?
    public private(set) var lastSubscriptionIds: [String]?
    public init() {}
    private func synchronized<T>(_ work: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try work()
    }
    public func initConnection() async throws -> Bool {
        synchronized { connected = true }
        if let connectionError { throw connectionError }
        return connectionResult
    }
    public func endConnection() async throws -> Bool {
        synchronized { connected = false; disconnectCount += 1 }
        return true
    }
    public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult {
        .products(params.skus.map { sku in
            .productIos(ProductIOS(
                currency: "USD", description: "Independent provider fixture", displayNameIOS: "Fixture",
                displayPrice: "$1.00", id: sku, isFamilyShareableIOS: false,
                jsonRepresentationIOS: "{}", price: 1.0, title: "Fixture", typeIOS: .consumable
            ))
        })
    }

    public func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult? {
        let sku: String?
        switch params.request {
        case .purchase(let props): sku = props.apple?.sku
        case .subscription(let props): sku = props.apple?.sku
        }
        guard synchronized({ connected }) else { try failRequest(PurchaseError.make(code: .notPrepared)) }
        guard let sku, !sku.isEmpty else {
            let error = normalizeError("missing-sku")
            if returnFailureInsteadOfThrow {
                try emitRequestFailure(error)
                return .purchases([])
            }
            try failRequest(error)
        }
        if rejectOwnedPurchase && synchronized({ owned.values.contains { $0.productId == sku } }) {
            try failRequest(PurchaseError.make(code: .alreadyOwned))
        }
        let ios = try makePurchase(sku: sku)
        let purchase = emitAndroidPurchase ? Purchase.purchaseAndroid(PurchaseAndroid(
            id: ios.id, isAutoRenewing: ios.isAutoRenewing, productId: ios.productId,
            purchaseState: ios.purchaseState, purchaseToken: ios.purchaseToken, quantity: ios.quantity,
            store: ios.store, storeId: ios.storeId, transactionDate: ios.transactionDate
        )) : Purchase.purchaseIos(ios)
        let listeners = synchronized {
            lastRequest = params
            owned[purchase.id] = purchase
            return Array(updated.values)
        }
        listeners.forEach { $0(purchase) }
        return .purchase(purchase)
    }
    public func restorePurchases() async throws {}
    public func getAvailablePurchases(_ options: PurchaseOptions?) async throws -> [Purchase] {
        synchronized {
            ownedReadCount += 1
            return owned.values.map { purchase in
                guard rotateTokenAfterFirstRead, ownedReadCount > 1,
                      case .purchaseIos(var ios) = purchase else { return purchase }
                ios.purchaseToken = "altered-token"
                return .purchaseIos(ios)
            }
        }
    }
    private func failRequest(_ error: PurchaseError) throws -> Never {
        try emitRequestFailure(error)
        throw genericRequestFailure ?? error
    }
    private func emitRequestFailure(_ error: PurchaseError) throws {
        let listeners = synchronized { Array(errors.values) }
        for _ in 0..<failureEventCount { listeners.forEach { $0(error) } }
        if purchaseOnFailure {
            let purchase = Purchase.purchaseIos(try makePurchase())
            synchronized { Array(updated.values) }.forEach { $0(purchase) }
        }
    }
    public func finishTransaction(purchase: PurchaseInput, isConsumable: Bool?) async throws {
        guard purchase.storeId == "community_fixture", purchase.purchaseToken?.isEmpty == false else {
            throw PurchaseError.make(code: .developerError, message: "Full provider identity and token are required")
        }
        synchronized { finished[purchase.id] = purchase }
    }
    public func getActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> [ActiveSubscription] {
        try await getAvailablePurchases(nil).compactMap { purchase in
            guard case .purchaseIos(let ios) = purchase,
                  (ios.isAutoRenewing || inactiveSubscriptions), ios.purchaseState == .purchased,
                  subscriptionIds?.contains(ios.productId) != false else { return nil }
            return toActiveSubscription(ios)
        }
    }
    public func hasActiveSubscriptions(_ subscriptionIds: [String]?) async throws -> Bool {
        lastSubscriptionIds = subscriptionIds
        if let forcedHasActive { return forcedHasActive }
        return try await !getActiveSubscriptions(subscriptionIds).isEmpty
    }
    public func verifyPurchase(_ props: VerifyPurchaseProps) async throws -> VerifyPurchaseResult {
        .verifyPurchaseResultIos(try OpenIapSerialization.decode(object: ["isValid": true], as: VerifyPurchaseResultIOS.self))
    }
    public func verifyPurchaseWithProvider(_ props: VerifyPurchaseWithProviderProps) async throws -> VerifyPurchaseWithProviderResult {
        try OpenIapSerialization.decode(object: [
            "provider": "iapkit", "iapkit": ["store": "unknown", "storeId": "community_fixture", "isValid": true, "state": "entitled"],
        ], as: VerifyPurchaseWithProviderResult.self)
    }
    public func getStorefront() async throws -> String { "US" }
    public func deepLinkToSubscriptions(_ options: DeepLinkOptions?) async throws {}
    public func openRedeemOfferCode() async throws -> PurchaseIOS? { nil }
    public func purchaseUpdatedListener(_ listener: @escaping PurchaseUpdatedListener, options: PurchaseUpdatedListenerOptions?) -> Subscription {
        let token = Subscription(eventType: .purchaseUpdated)
        synchronized { updated[token.id] = listener }
        return token
    }
    public func purchaseErrorListener(_ listener: @escaping PurchaseErrorListener) -> Subscription {
        let token = Subscription(eventType: .purchaseError)
        synchronized { errors[token.id] = listener }
        return token
    }
    public func subscriptionBillingIssueListener(_ listener: @escaping SubscriptionBillingIssueListener) -> Subscription {
        let token = Subscription(eventType: .subscriptionBillingIssue)
        synchronized { billing[token.id] = listener }
        return token
    }
    public func removeListener(_ subscription: Subscription) {
        synchronized { updated.removeValue(forKey: subscription.id); billing.removeValue(forKey: subscription.id); errors.removeValue(forKey: subscription.id) }
    }
    public func removeAllListeners() { synchronized { updated.removeAll(); billing.removeAll(); errors.removeAll() } }
    public func trigger(_ capability: String) throws {
        if capability == "pendingPurchases" && deferredThenPurchased {
            let listeners = synchronized { Array(errors.values) }
            listeners.forEach { $0(PurchaseError.make(code: .deferredPayment)) }
        }
        if capability == "pendingPurchases" && deferredPending {
            throw PurchaseError.make(code: .deferredPayment)
        }
        let pending = capability != "offerCodeRedemption" && !(capability == "subscriptionBillingIssue" && billingGracePeriod)
        var payload = try makePurchase(sku: "conformance.capability", state: pending && !deferredThenPurchased ? .pending : .purchased)
        payload.store = capabilityStore
        let purchase = Purchase.purchaseIos(payload)
        let listeners = synchronized { capability == "subscriptionBillingIssue" ? Array(billing.values) : Array(updated.values) }
        listeners.forEach { $0(purchase) }
    }
    public func makePurchase(sku: String = "conformance.product", state: PurchaseState = .purchased) throws -> PurchaseIOS {
        try OpenIapSerialization.decode(object: [
            "id": "txn-\(sku)", "transactionId": "txn-\(sku)", "productId": sku,
            "store": "unknown", "storeId": "community_fixture", "quantity": 1, "isAutoRenewing": false,
            "purchaseState": state.rawValue, "purchaseToken": "fixture-token-\(sku)", "transactionDate": 1.0,
        ], as: PurchaseIOS.self)
    }
    public func toActiveSubscription(_ purchase: PurchaseIOS) -> ActiveSubscription {
        ActiveSubscription(
            currentPlanId: purchase.productId, isActive: purchase.purchaseState == .purchased && !inactiveSubscriptions,
            productId: purchase.productId, purchaseToken: purchase.purchaseToken,
            transactionDate: purchase.transactionDate, transactionId: purchase.id
        )
    }

    public func normalizeError(_ code: String) -> PurchaseError {
        .make(code: ["cancelled": ErrorCode.userCancelled, "missing-sku": .skuNotFound][code] ?? .unknown)
    }
}
